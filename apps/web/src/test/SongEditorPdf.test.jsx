import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
// Lo que se prueba es el cableado de la subida: qué ruta se pide, en qué
// orden se tocan Storage y Firestore, y qué se ofrece en pantalla. Firebase
// no aparece por ninguna parte.

const mockGetSongById = vi.fn();
const mockCreateSong = vi.fn();
const mockUpdateSong = vi.fn();
const mockAddVoiceToSong = vi.fn();
const mockRemoveVoiceFromSong = vi.fn();
const mockUploadScore = vi.fn();
const mockDeleteScore = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@notesheet/api', () => ({
  getSongById: (...a) => mockGetSongById(...a),
  createSong: (...a) => mockCreateSong(...a),
  updateSong: (...a) => mockUpdateSong(...a),
  addVoiceToSong: (...a) => mockAddVoiceToSong(...a),
  removeVoiceFromSong: (...a) => mockRemoveVoiceFromSong(...a),
  uploadScore: (...a) => mockUploadScore(...a),
  deleteScore: (...a) => mockDeleteScore(...a)
}));

const routeParams = { id: 'song-pdf' };
vi.mock('react-router-dom', () => ({
  useParams: () => routeParams,
  useNavigate: () => mockNavigate
}));

const mockAuth = { currentUser: { uid: 'user-1' }, canEditSongs: () => true };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

vi.mock('react-simplemde-editor', () => ({
  default: ({ value, onChange }) => (
    <textarea
      aria-label="editor"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}));
vi.mock('easymde/dist/easymde.min.css', () => ({}));

const { default: SongEditor } = await import('../pages/SongEditor');

const SONG_PDF = {
  id: 'song-pdf',
  title: 'Popurrí de Navidad',
  key: 'SIb',
  type: 'Júbilo',
  format: 'pdf',
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1',
  pdfs: {
    bb_trumpet: {
      1: { partitura: 'partituras/song-pdf/bb_trumpet-1-partitura.pdf' }
    }
  }
};

const pdfFile = (nombre = 'trompeta.pdf') => (
  new File(['%PDF-1.4'], nombre, { type: 'application/pdf' })
);

beforeEach(() => {
  vi.clearAllMocks();
  routeParams.id = 'song-pdf';
  mockAuth.currentUser = { uid: 'user-1' };
  mockAuth.canEditSongs = () => true;
  mockGetSongById.mockResolvedValue(SONG_PDF);
  mockUpdateSong.mockResolvedValue({});
  mockCreateSong.mockResolvedValue({ id: 'nueva-1' });
  mockUploadScore.mockResolvedValue('partituras/song-pdf/bb_trumpet-1-conNotas.pdf');
  mockDeleteScore.mockResolvedValue(undefined);
});

const renderEditor = async () => {
  const result = render(<SongEditor />);
  await screen.findByDisplayValue('Popurrí de Navidad');
  return result;
};

describe('SongEditor con una canción en PDF', () => {
  it('muestra las dos casillas en vez del editor de texto', async () => {
    await renderEditor();

    expect(screen.getByText('Partitura')).toBeInTheDocument();
    expect(screen.getByText('Con nombres de notas')).toBeInTheDocument();
    expect(screen.queryByLabelText('editor')).not.toBeInTheDocument();
  });

  it('en una canción de acordes sigue saliendo el editor de texto', async () => {
    mockGetSongById.mockResolvedValue({
      ...SONG_PDF,
      format: undefined,
      pdfs: undefined,
      content: '## Intro\nDO SOL\n',
      voices: { bb_trumpet: { 1: '## Intro\nDO SOL\n' } }
    });

    await renderEditor();

    expect(screen.getByLabelText('editor')).toBeInTheDocument();
    expect(screen.queryByText('Con nombres de notas')).not.toBeInTheDocument();
  });

  it('distingue la casilla que ya tiene archivo de la que no', async () => {
    await renderEditor();

    expect(screen.getByText('Subida')).toBeInTheDocument();
    expect(screen.getByText('Sin archivo')).toBeInTheDocument();
  });

  it('la pestaña dice cuántas de las dos variantes están subidas', async () => {
    await renderEditor();
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('subir un PDF lo manda a la casilla que toca y guarda la ruta', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.upload(
      screen.getByLabelText('Subir Con nombres de notas'),
      pdfFile()
    );

    await waitFor(() => {
      expect(mockUploadScore).toHaveBeenCalledWith(expect.objectContaining({
        songId: 'song-pdf',
        instrumentId: 'bb_trumpet',
        voiceNumber: '1',
        variant: 'conNotas'
      }));
    });

    // La ruta se guarda en el acto, sin esperar al botón de Guardar: el
    // archivo ya está en Storage y dejarlo sin apuntar lo deja huérfano.
    await waitFor(() => {
      expect(mockUpdateSong).toHaveBeenCalledWith('song-pdf', expect.objectContaining({
        pdfs: {
          bb_trumpet: {
            1: {
              partitura: 'partituras/song-pdf/bb_trumpet-1-partitura.pdf',
              conNotas: 'partituras/song-pdf/bb_trumpet-1-conNotas.pdf'
            }
          }
        }
      }));
    });
  });

  it('si la subida falla, no se toca el documento', async () => {
    const user = userEvent.setup();
    mockUploadScore.mockRejectedValue(new Error('Solo se aceptan archivos PDF'));

    await renderEditor();
    await user.upload(
      screen.getByLabelText('Subir Con nombres de notas'),
      pdfFile()
    );

    await screen.findByText(/Solo se aceptan archivos PDF/);
    expect(mockUpdateSong).not.toHaveBeenCalled();
  });

  describe('al quitar una partitura', () => {
    let confirmSpy;

    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => confirmSpy.mockRestore());

    it('borra el archivo ANTES de quitar la ruta del documento', async () => {
      // Ese orden y no el contrario: la regla de Storage consulta la canción
      // en Firestore para dejar borrar. Al revés, un fallo dejaría el archivo
      // ahí sin forma de llegar a él.
      const user = userEvent.setup();
      const orden = [];
      mockDeleteScore.mockImplementation(async () => { orden.push('storage'); });
      mockUpdateSong.mockImplementation(async () => { orden.push('firestore'); });

      await renderEditor();
      await user.click(screen.getByRole('button', { name: /Quitar/ }));

      await waitFor(() => expect(orden).toEqual(['storage', 'firestore']));
      expect(mockDeleteScore).toHaveBeenCalledWith(
        'partituras/song-pdf/bb_trumpet-1-partitura.pdf'
      );
    });

    it('la casilla vacía desaparece del mapa en vez de quedarse a medias', async () => {
      const user = userEvent.setup();
      await renderEditor();

      await user.click(screen.getByRole('button', { name: /Quitar/ }));

      await waitFor(() => {
        expect(mockUpdateSong).toHaveBeenCalledWith('song-pdf', { pdfs: {} });
      });
    });

    it('si se cancela la confirmación no se borra nada', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(false);

      await renderEditor();
      await user.click(screen.getByRole('button', { name: /Quitar/ }));

      expect(mockDeleteScore).not.toHaveBeenCalled();
      expect(mockUpdateSong).not.toHaveBeenCalled();
    });
  });

  it('una canción nueva en PDF avisa de que hay que guardarla antes', async () => {
    // La regla de Storage comprueba el permiso contra la canción guardada,
    // así que no hay dónde subir hasta que exista.
    routeParams.id = undefined;
    const user = userEvent.setup();

    render(<SongEditor />);
    await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });

    await user.click(screen.getByRole('button', { name: /Partituras PDF/ }));

    expect(screen.getByRole('status')).toHaveTextContent(/Guarda la canción antes de subir/);

    const botones = screen.getAllByRole('button', { name: /Subir PDF/ });
    expect(botones).toHaveLength(2);
    botones.forEach((boton) => expect(boton).toBeDisabled());
  });

  it('una canción nueva en PDF se puede guardar sin contenido de texto', async () => {
    // En un PDF el cuerpo son los archivos; exigir texto haría imposible
    // crearla, porque subir requiere que exista.
    routeParams.id = undefined;
    const user = userEvent.setup();

    render(<SongEditor />);
    await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });

    await user.click(screen.getByRole('button', { name: /Partituras PDF/ }));
    await user.click(screen.getByRole('button', { name: /Guardar/ }));

    await waitFor(() => {
      expect(mockCreateSong).toHaveBeenCalledWith(expect.objectContaining({
        format: 'pdf'
      }));
    });
    // Y lleva de vuelta a la edición, que es donde se suben los archivos
    expect(mockNavigate).toHaveBeenCalledWith('/songs/nueva-1/edit', { replace: true });
  });

  it('una canción de acordes sin contenido sigue sin poder guardarse', async () => {
    routeParams.id = undefined;
    const user = userEvent.setup();

    render(<SongEditor />);
    await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });

    await user.clear(screen.getByLabelText('editor'));
    await user.click(screen.getByRole('button', { name: /Guardar/ }));

    await screen.findByText(/no puede estar vacío/);
    expect(mockCreateSong).not.toHaveBeenCalled();
  });

  it('guardar una canción en PDF conserva su matriz de archivos', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(screen.getByRole('button', { name: /^Guardar/ }));

    await waitFor(() => {
      expect(mockUpdateSong).toHaveBeenCalledWith('song-pdf', expect.objectContaining({
        format: 'pdf',
        pdfs: SONG_PDF.pdfs
      }));
    });
  });
});

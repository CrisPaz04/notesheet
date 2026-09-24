import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    expect(screen.queryByRole('button', { name: /Subir varios PDF/ })).not.toBeInTheDocument();
  });

  it('una canción en PDF ofrece subir varios de golpe', async () => {
    await renderEditor();
    expect(screen.getByRole('button', { name: /Subir varios PDF/ })).toBeEnabled();
  });

  it('distingue la casilla que ya tiene archivo de la que no', async () => {
    await renderEditor();

    expect(screen.getByText('Subida')).toBeInTheDocument();
    // La vacía además dice que se puede soltar ahí: si no, la única pista de
    // que el arrastre existe sería probarlo.
    expect(screen.getByText(/Suelta el PDF aquí/)).toBeInTheDocument();
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

  describe('soltando el archivo encima', () => {
    // La gente prueba las dos vías, y antes solo existía el botón: al
    // arrastrar no pasaba nada y parecía que la aplicación estaba rota.
    const soltarEn = (nodo, file) => {
      const dataTransfer = { files: [file], items: [], types: ['Files'] };
      fireEvent.dragOver(nodo, { dataTransfer });
      fireEvent.drop(nodo, { dataTransfer });
    };

    const casillaDe = (container, indice) => (
      container.querySelectorAll('.score-slot')[indice]
    );

    it('soltar un PDF en una casilla lo sube a esa variante', async () => {
      const { container } = await renderEditor();

      // La segunda casilla es la de "con nombres de notas"
      soltarEn(casillaDe(container, 1), pdfFile());

      await waitFor(() => {
        expect(mockUploadScore).toHaveBeenCalledWith(expect.objectContaining({
          variant: 'conNotas',
          instrumentId: 'bb_trumpet',
          voiceNumber: '1'
        }));
      });
    });

    it('cada casilla sube a su propia variante, no siempre a la misma', async () => {
      const { container } = await renderEditor();

      soltarEn(casillaDe(container, 0), pdfFile());

      await waitFor(() => {
        expect(mockUploadScore).toHaveBeenCalledWith(expect.objectContaining({
          variant: 'partitura'
        }));
      });
    });

    it('no acepta nada mientras la canción no exista', async () => {
      routeParams.id = undefined;
      const user = userEvent.setup();

      const { container } = render(<SongEditor />);
      await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });
      await user.click(screen.getByRole('button', { name: 'PDF' }));

      soltarEn(casillaDe(container, 0), pdfFile());

      expect(mockUploadScore).not.toHaveBeenCalled();
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

    await user.click(screen.getByRole('button', { name: 'PDF' }));

    expect(screen.getByRole('status')).toHaveTextContent(/la canción tiene que existir antes/);

    const botones = screen.getAllByRole('button', { name: /Buscar archivo/ });
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

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await user.type(screen.getByPlaceholderText('Nombre de la canción'), 'Popurrí');
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => {
      expect(mockCreateSong).toHaveBeenCalledWith(expect.objectContaining({
        format: 'pdf'
      }));
    });
    // Y lleva de vuelta a la edición, que es donde se suben los archivos
    expect(mockNavigate).toHaveBeenCalledWith('/songs/nueva-1/edit', { replace: true });
  });

  it('sin título no la deja guardar: no habría por dónde reconocerla', async () => {
    // Recién creada no tiene ni texto ni archivos; sin título sería una fila
    // en blanco en el repertorio.
    routeParams.id = undefined;
    const user = userEvent.setup();

    render(<SongEditor />);
    await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await screen.findByText(/Ponle un título/);
    expect(mockCreateSong).not.toHaveBeenCalled();
  });

  it('el atajo "Guardar ahora" del aviso desbloquea sin salir de ahí', async () => {
    // El aviso decía qué hacer pero no dejaba hacerlo: había que adivinar que
    // el botón bueno estaba arriba del todo.
    routeParams.id = undefined;
    const user = userEvent.setup();

    render(<SongEditor />);
    await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await user.type(screen.getByPlaceholderText('Nombre de la canción'), 'Popurrí');
    await user.click(screen.getByRole('button', { name: /Guardar ahora/ }));

    await waitFor(() => {
      expect(mockCreateSong).toHaveBeenCalledWith(expect.objectContaining({
        format: 'pdf'
      }));
    });
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

  it('no arrastra la plantilla de acordes al cuerpo de un PDF', async () => {
    // Antes guardaba ahí el texto de la voz principal, que en una canción
    // recién creada es la plantilla ("## Intro", "## Verso 1"...), y luego
    // reaparecía en el visor como una vista de letra fantasma.
    routeParams.id = undefined;
    const user = userEvent.setup();

    render(<SongEditor />);
    await screen.findByRole('heading', { level: 1, name: /Nueva Canción/ });

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await user.type(screen.getByPlaceholderText('Nombre de la canción'), 'Popurrí');
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => {
      expect(mockCreateSong).toHaveBeenCalledWith(expect.objectContaining({
        content: ''
      }));
    });
  });

  it('una canción de acordes sí guarda el contenido de su voz principal', async () => {
    // El contrapunto: vaciar `content` siempre rompería las 118 importadas.
    const user = userEvent.setup();
    mockGetSongById.mockResolvedValue({
      ...SONG_PDF,
      format: undefined,
      pdfs: undefined,
      content: '## Intro\nDO SOL\n',
      voices: { bb_trumpet: { 1: '## Intro\nDO SOL\n' } }
    });

    await renderEditor();
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => {
      expect(mockUpdateSong).toHaveBeenCalledWith('song-pdf', expect.objectContaining({
        content: '## Intro\nDO SOL\n'
      }));
    });
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

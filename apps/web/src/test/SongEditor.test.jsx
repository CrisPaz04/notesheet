import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
// SongEditor arrastra Firebase, el router y SimpleMDE (que no funciona en
// jsdom). Aquí interesa el cableado con useSongVoices, no el editor en sí.

const mockGetSongById = vi.fn();
const mockCreateSong = vi.fn();
const mockUpdateSong = vi.fn();
const mockAddVoiceToSong = vi.fn();
const mockRemoveVoiceFromSong = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@notesheet/api', () => ({
  getSongById: (...a) => mockGetSongById(...a),
  createSong: (...a) => mockCreateSong(...a),
  updateSong: (...a) => mockUpdateSong(...a),
  addVoiceToSong: (...a) => mockAddVoiceToSong(...a),
  removeVoiceFromSong: (...a) => mockRemoveVoiceFromSong(...a)
}));

const routeParams = { id: 'song-1' };
vi.mock('react-router-dom', () => ({
  useParams: () => routeParams,
  useNavigate: () => mockNavigate
}));

const mockAuth = { currentUser: { uid: 'user-1' }, canEditSongs: () => true };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

// SimpleMDE necesita un DOM real; lo sustituimos por un textarea.
// Se apunta qué `options` llega en cada render: la librería de verdad
// rehace el editor (y pierde el foco) cada vez que cambian de identidad.
const opcionesRecibidas = [];
vi.mock('react-simplemde-editor', () => ({
  default: ({ value, onChange, options }) => (
    opcionesRecibidas.push(options),
    <textarea
      aria-label="editor"
      value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}
    />
  )
}));
vi.mock('easymde/dist/easymde.min.css', () => ({}));

const { default: SongEditor } = await import('../pages/SongEditor');

const SONG = {
  id: 'song-1',
  title: 'Cristo Vive',
  key: 'DO',
  type: 'Júbilo',
  version: 'v1',
  content: '## Intro\nDO SOL\n',
  voices: {
    bb_trumpet: { 1: '## Intro\nDO SOL\n', 2: '## Intro\nMI SI\n' }
  },
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1'
};

beforeEach(() => {
  vi.clearAllMocks();
  routeParams.id = 'song-1';
  mockAuth.currentUser = { uid: 'user-1' };
  mockAuth.canEditSongs = () => true;
  mockGetSongById.mockResolvedValue(SONG);
  mockAddVoiceToSong.mockResolvedValue({});
  mockRemoveVoiceFromSong.mockResolvedValue({});
  mockUpdateSong.mockResolvedValue({});
  // handleRemoveVoice pide confirmación al usuario
  vi.stubGlobal('confirm', vi.fn(() => true));
});

const renderEditor = async () => {
  render(<SongEditor />);
  await screen.findByDisplayValue('Cristo Vive');
};

describe('SongEditor', () => {
  it('carga los datos de una canción existente', async () => {
    await renderEditor();
    expect(screen.getByDisplayValue('Cristo Vive')).toBeInTheDocument();
    expect(mockGetSongById).toHaveBeenCalledWith('song-1');
  });

  it('muestra una pestaña por voz más la de solo letra', async () => {
    await renderEditor();
    expect(screen.getByRole('button', { name: /Trompeta.*1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Trompeta.*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solo Letra/ })).toBeInTheDocument();
  });

  it('abre la voz primaria al cargar', async () => {
    await renderEditor();
    expect(screen.getByLabelText('editor')).toHaveValue('## Intro\nDO SOL\n');
  });

  it('cambia el contenido del editor al cambiar de pestaña', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(screen.getByRole('button', { name: /Trompeta.*2/ }));

    await waitFor(() => {
      expect(screen.getByLabelText('editor')).toHaveValue('## Intro\nMI SI\n');
    });
  });

  it('escribe en la voz activa sin tocar las demás', async () => {
    const user = userEvent.setup();
    await renderEditor();

    const editor = screen.getByLabelText('editor');
    await user.clear(editor);
    await user.type(editor, 'LA');

    expect(editor).toHaveValue('LA');

    // La segunda voz sigue intacta
    await user.click(screen.getByRole('button', { name: /Trompeta.*2/ }));
    await waitFor(() => {
      expect(screen.getByLabelText('editor')).toHaveValue('## Intro\nMI SI\n');
    });
  });

  it('elimina una voz secundaria y persiste el cambio', async () => {
    const user = userEvent.setup();
    await renderEditor();

    const tabVoz2 = screen.getByRole('button', { name: /Trompeta.*2/ });
    const cerrar = tabVoz2.querySelector('.tab-close');
    await user.click(cerrar);

    await waitFor(() => {
      expect(mockRemoveVoiceFromSong).toHaveBeenCalledWith('song-1', 'bb_trumpet', '2');
    });
    expect(screen.queryByRole('button', { name: /Trompeta.*2/ })).not.toBeInTheDocument();
  });

  it('no ofrece cerrar la voz primaria', async () => {
    await renderEditor();
    const tabVoz1 = screen.getByRole('button', { name: /Trompeta.*1/ });
    expect(tabVoz1.querySelector('.tab-close')).toBeNull();
  });

  it('respeta la cancelación del usuario al eliminar una voz', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const user = userEvent.setup();
    await renderEditor();

    const tabVoz2 = screen.getByRole('button', { name: /Trompeta.*2/ });
    await user.click(tabVoz2.querySelector('.tab-close'));

    expect(mockRemoveVoiceFromSong).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Trompeta.*2/ })).toBeInTheDocument();
  });

  it('muestra un error si la canción no se puede cargar', async () => {
    mockGetSongById.mockRejectedValue(new Error('sin permisos'));
    render(<SongEditor />);
    expect(await screen.findByText(/Error al cargar la canción/i)).toBeInTheDocument();
  });
});

describe('SongEditor: sugerencia de tonalidad', () => {
  // Una melodía en RE que descansa en RE, con notas de sobra para opinar
  const EN_RE = '## Intro\nRE MI FA# SOL LA SI DO# RE\nLA FA# RE MI FA# RE\n\nRE FA# LA RE LA FA# MI RE\n';
  const aviso = () => screen.queryByRole('status');

  it('no aparece si la tonalidad encaja con las notas', async () => {
    mockGetSongById.mockResolvedValue({ ...SONG, key: 'RE', voices: { bb_trumpet: { 1: EN_RE } } });
    await renderEditor();
    expect(aviso()).not.toBeInTheDocument();
  });

  it('no aparece con pocas notas', async () => {
    await renderEditor();
    expect(aviso()).not.toBeInTheDocument();
  });

  it('aparece si la canción está en DO y las notas dicen RE', async () => {
    mockGetSongById.mockResolvedValue({ ...SONG, voices: { bb_trumpet: { 1: EN_RE } } });
    await renderEditor();
    expect(aviso()).toHaveTextContent('Por las notas parece RE');
  });

  it('usar la sugerida cambia el selector y el aviso se va, sin guardar', async () => {
    const user = userEvent.setup();
    mockGetSongById.mockResolvedValue({ ...SONG, voices: { bb_trumpet: { 1: EN_RE } } });
    await renderEditor();

    await user.click(screen.getByRole('button', { name: 'Usar RE' }));

    expect(aviso()).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^RE$/ })).toBeInTheDocument();
    expect(mockUpdateSong).not.toHaveBeenCalled();
  });

  it('suma las notas de todas las voces, no solo la abierta', async () => {
    // Ninguna de las dos voces llega sola al mínimo de notas
    mockGetSongById.mockResolvedValue({
      ...SONG,
      voices: {
        bb_trumpet: {
          1: 'RE MI FA# SOL LA SI DO# RE\nLA FA# RE MI FA# RE',
          2: 'RE FA# LA RE LA FA# MI RE'
        }
      }
    });
    await renderEditor();
    expect(aviso()).toHaveTextContent('RE');
  });

  it('se actualiza mientras se escriben las notas', async () => {
    const user = userEvent.setup();
    await renderEditor();
    expect(aviso()).not.toBeInTheDocument();

    const editor = screen.getByLabelText('editor');
    await user.clear(editor);
    await user.type(editor, EN_RE);

    expect(aviso()).toHaveTextContent('Por las notas parece RE');
  });

  it('no aparece en una canción en PDF', async () => {
    mockGetSongById.mockResolvedValue({ ...SONG, format: 'pdf', voices: { bb_trumpet: { 1: EN_RE } } });
    await renderEditor();
    expect(aviso()).not.toBeInTheDocument();
  });
});

describe('SongEditor: el editor no pierde el foco al escribir', () => {
  it('le pasa siempre las mismas opciones, tecla tras tecla', async () => {
    const user = userEvent.setup();
    await renderEditor();
    opcionesRecibidas.length = 0;

    await user.type(screen.getByLabelText('editor'), 'RE MI');

    expect(opcionesRecibidas.length).toBeGreaterThan(1);
    expect(new Set(opcionesRecibidas).size).toBe(1);
  });
});

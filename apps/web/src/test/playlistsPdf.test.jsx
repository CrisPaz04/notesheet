import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// Una partitura en PDF entra en una lista como una canción más, en cualquier
// posición. Lo que cambia es que no se transpone: aquí se comprueba que el
// selector de tonalidad no aparece en esas entradas, y que la lista despliega
// la partitura en la voz del músico.

const mockGetAllSongs = vi.fn();
const mockGetPlaylistById = vi.fn();
const mockCreatePlaylist = vi.fn();
const mockUpdatePlaylist = vi.fn();
const mockUpdateSong = vi.fn();
const mockGetSongById = vi.fn();
const mockNavigate = vi.fn();
const mockGetUserPreferences = vi.fn();

vi.mock('@notesheet/api', () => ({
  getAllSongs: (...a) => mockGetAllSongs(...a),
  getPlaylistById: (...a) => mockGetPlaylistById(...a),
  createPlaylist: (...a) => mockCreatePlaylist(...a),
  updatePlaylist: (...a) => mockUpdatePlaylist(...a),
  updateSong: (...a) => mockUpdateSong(...a),
  getSongById: (...a) => mockGetSongById(...a),
  getUserPreferences: (...a) => mockGetUserPreferences(...a)
}));

// El visor de verdad carga pdf.js; aquí solo interesa qué archivo recibe
vi.mock('../components/PdfScoreViewer', () => ({
  default: ({ path }) => <div data-testid="visor-pdf" data-path={path ?? ''} />
}));

const routeParams = {};
vi.mock('react-router-dom', () => ({
  useParams: () => routeParams,
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const mockAuth = { currentUser: { uid: 'user-1' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children }) =>
    children({ droppableProps: {}, innerRef: () => {}, placeholder: null }),
  Draggable: ({ children }) =>
    children(
      { innerRef: () => {}, draggableProps: { style: {} }, dragHandleProps: {} },
      { isDragging: false }
    )
}));

const { default: PlaylistEditor } = await import('../pages/PlaylistEditor');
const { default: PlaylistView } = await import('../pages/PlaylistView');

const ACORDES = {
  id: 's1',
  title: 'Cristo Vive',
  key: 'DO',
  type: 'Júbilo',
  isOwn: true,
  public: true,
  content: '## Verso\nDO SOL LAm FA\nCristo vive hoy'
};

const PDF = {
  id: 's2',
  title: 'Popurrí de Navidad',
  key: 'SIb',
  type: 'Júbilo',
  isOwn: true,
  public: true,
  format: 'pdf',
  content: '',
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1',
  pdfs: {
    bb_trumpet: { 1: { partitura: 'partituras/s2/bb_trumpet-1-partitura.pdf' } },
    bb_trombone: { 1: { partitura: 'partituras/s2/bb_trombone-1-partitura.pdf' } }
  }
};

const LISTA = {
  id: 'p1',
  name: 'Domingo',
  date: { toDate: () => new Date('2026-09-20T00:00:00Z') },
  public: true,
  creatorId: 'user-1',
  // El PDF va en medio: la posición es justo lo que tenía que seguir siendo libre
  songs: [
    { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' },
    { id: 's2', title: 'Popurrí de Navidad', key: 'SIb', originalKey: 'SIb' }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  routeParams.id = 'p1';
  mockGetUserPreferences.mockResolvedValue({});
  mockGetAllSongs.mockResolvedValue([ACORDES, PDF]);
  mockGetPlaylistById.mockResolvedValue(LISTA);
  mockGetSongById.mockImplementation(async (id) => (
    id === 's1' ? ACORDES : PDF
  ));
});

describe('PlaylistEditor con una partitura en PDF', () => {
  it('no ofrece selector de tonalidad en la entrada de PDF', async () => {
    render(<PlaylistEditor />);
    await screen.findAllByText('Popurrí de Navidad');

    // La de acordes sí lo tiene; la de PDF muestra la tonalidad como dato
    await waitFor(() => {
      expect(screen.getByText(/SIb · partitura/)).toBeInTheDocument();
    });
  });

  it('la canción de acordes sí conserva su selector', async () => {
    // El contrapunto: si se ocultase en las dos, el test de arriba pasaría
    // igual sin comprobar nada.
    const { container } = render(<PlaylistEditor />);
    await screen.findAllByText('Cristo Vive');

    await waitFor(() => {
      expect(container.querySelectorAll('select, .playlist-key-selector').length)
        .toBeGreaterThan(0);
    });
  });

  it('las dos canciones aparecen y en el orden de la lista', async () => {
    const { container } = render(<PlaylistEditor />);
    await screen.findAllByText('Popurrí de Navidad');

    await waitFor(() => {
      const titulos = [...container.querySelectorAll('.selected-song-title')]
        .map((n) => n.textContent);
      expect(titulos).toEqual(['Cristo Vive', 'Popurrí de Navidad']);
    });
  });
});

describe('PlaylistView con una partitura en PDF', () => {
  it('despliega la partitura dentro de la lista, sin tener que abrirla', async () => {
    render(<PlaylistView />);
    await screen.findByText('Popurrí de Navidad');

    const visor = await screen.findByTestId('visor-pdf');
    // Sin preferencias, la voz principal de la canción
    expect(visor).toHaveAttribute('data-path', 'partituras/s2/bb_trumpet-1-partitura.pdf');
  });

  it('la abre en la voz del instrumento del músico', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultInstrument: 'bb_trombone' });
    render(<PlaylistView />);

    await waitFor(() => {
      expect(screen.getByTestId('visor-pdf'))
        .toHaveAttribute('data-path', 'partituras/s2/bb_trombone-1-partitura.pdf');
    });
  });

  it('deja un enlace para leerla en otra voz, y el resto de la lista sigue ahí', async () => {
    render(<PlaylistView />);
    const enlace = await screen.findByText('Ver en otra voz');
    expect(enlace.closest('a')).toHaveAttribute('href', '/songs/s2');
    expect(screen.getByText('Cristo Vive')).toBeInTheDocument();
  });

  it('la canción de acordes sigue mostrando su contenido transpuesto', async () => {
    render(<PlaylistView />);
    expect(await screen.findByText(/Cristo vive hoy/)).toBeInTheDocument();
  });
});

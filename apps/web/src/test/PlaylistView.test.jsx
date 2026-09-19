import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// --- Mocks ---
const mockGetPlaylistById = vi.fn();
const mockGetSongById = vi.fn();

vi.mock('@notesheet/api', () => ({
  getPlaylistById: (...a) => mockGetPlaylistById(...a),
  getSongById: (...a) => mockGetSongById(...a)
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'p1' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const mockAuth = { currentUser: { uid: 'user-1' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: PlaylistView } = await import('../pages/PlaylistView');

const CANCIONES = {
  s1: {
    id: 's1',
    title: 'Cristo Vive',
    key: 'DO',
    content: '## Verso\nDO SOL LAm FA\nCristo vive hoy'
  },
  s2: {
    id: 's2',
    title: 'Sublime Gracia',
    key: 'SOL',
    content: '## Coro\nSOL RE MIm DO\nSublime gracia'
  }
};

const LISTA = {
  id: 'p1',
  name: 'Domingo',
  date: { toDate: () => new Date('2026-09-20T00:00:00Z') },
  public: true,
  creatorId: 'user-1',
  songs: [
    // El director la transpuso a LA para esta ocasión
    { id: 's1', title: 'Cristo Vive', key: 'LA', originalKey: 'DO' },
    { id: 's2', title: 'Sublime Gracia', key: 'SOL', originalKey: 'SOL' }
  ]
};

const contenidoDeCancion = (i) =>
  [...document.querySelectorAll('.song-section-content')][i]?.textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.currentUser = { uid: 'user-1' };
  mockGetPlaylistById.mockResolvedValue(LISTA);
  mockGetSongById.mockImplementation(async (id) => {
    if (!CANCIONES[id]) throw new Error('Missing or insufficient permissions.');
    return CANCIONES[id];
  });
});

const renderLista = async () => {
  render(<PlaylistView />);
  await screen.findByText('Cristo Vive');
};

describe('PlaylistView', () => {
  it('carga la lista y todas sus canciones', async () => {
    await renderLista();

    expect(mockGetPlaylistById).toHaveBeenCalledWith('p1');
    expect(mockGetSongById).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Cristo Vive')).toBeInTheDocument();
    expect(screen.getByText('Sublime Gracia')).toBeInTheDocument();
  });

  it('muestra la tonalidad elegida en la lista', async () => {
    await renderLista();
    const etiquetas = [...document.querySelectorAll('.playlist-song-key')]
      .map((el) => el.textContent.trim());
    expect(etiquetas).toEqual(['LA', 'SOL']);
  });

  // El fallo que de verdad importa sobre el escenario: la etiqueta decía "LA"
  // pero los acordes seguían mostrándose en DO, la tonalidad original. El
  // músico tocaría en otra tonalidad distinta de la que marca la lista.
  it('transpone el contenido a la tonalidad de la lista', async () => {
    await renderLista();

    await waitFor(() => {
      expect(contenidoDeCancion(0)).toContain('LA MI FA#m RE');
    });
    expect(contenidoDeCancion(0)).not.toContain('DO SOL LAm FA');
  });

  it('deja intacta la canción que no se transpone', async () => {
    await renderLista();
    expect(contenidoDeCancion(1)).toContain('SOL RE MIm DO');
  });

  it('conserva la letra al transponer', async () => {
    await renderLista();
    expect(contenidoDeCancion(0)).toContain('Cristo vive hoy');
  });

  // Con las reglas de privacidad, una canción de otro músico puede fallar.
  // La lista tiene que seguir siendo utilizable: es lo que se está leyendo
  // en mitad del culto.
  it('si una canción falla, las demás siguen viéndose', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetPlaylistById.mockResolvedValue({
      ...LISTA,
      songs: [
        { id: 'inexistente', title: 'La que falla', key: 'DO' },
        { id: 's2', title: 'Sublime Gracia', key: 'SOL' }
      ]
    });

    render(<PlaylistView />);

    expect(await screen.findByText('Sublime Gracia')).toBeInTheDocument();
    expect(screen.getByText(/no está disponible/i)).toBeInTheDocument();
    expect(screen.getByText('La que falla')).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('muestra un error si la lista entera no se puede cargar', async () => {
    mockGetPlaylistById.mockRejectedValue(new Error('sin permisos'));
    render(<PlaylistView />);

    expect(await screen.findByText(/Error al cargar la lista/i)).toBeInTheDocument();
  });

  it('no revienta con una lista sin canciones', async () => {
    mockGetPlaylistById.mockResolvedValue({ ...LISTA, songs: [] });
    render(<PlaylistView />);

    await waitFor(() => {
      expect(screen.getByText('Domingo')).toBeInTheDocument();
    });
    expect(mockGetSongById).not.toHaveBeenCalled();
  });
});

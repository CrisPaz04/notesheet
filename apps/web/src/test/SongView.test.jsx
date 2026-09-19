import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
// SongView arrastra Firebase, el router y las páginas de metrónomo/afinador.
// Aquí solo interesa la lógica de presentación de la canción.

const mockGetSongById = vi.fn();
const mockGetAllSongs = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();

vi.mock('@notesheet/api', () => ({
  getSongById: (...args) => mockGetSongById(...args),
  getAllSongs: (...args) => mockGetAllSongs(...args),
  getUserPreferences: (...args) => mockGetUserPreferences(...args),
  updateUserPreferences: (...args) => mockUpdateUserPreferences(...args)
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'song-1' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

// `canEditSongs` es una función en el AuthContext real, no un booleano
const mockAuth = { currentUser: null, canEditSongs: () => false };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth
}));

vi.mock('../pages/Metronome', () => ({ default: () => <div>Metrónomo</div> }));
vi.mock('../pages/Tuner', () => ({ default: () => <div>Afinador</div> }));

const { default: SongView } = await import('../pages/SongView');

const TRUMPET_1 = `## Intro
DO SOL LAm FA

## Verso
DO        SOL
Cristo vive hoy
`;

const TRUMPET_2 = `## Intro
MI SI DO#m LA

## Verso
MI        SI
Segunda voz
`;

const SONG = {
  id: 'song-1',
  title: 'Cristo Vive',
  key: 'DO',
  type: 'Júbilo',
  voices: {
    bb_trumpet: { 1: TRUMPET_1, 2: TRUMPET_2 }
  },
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1'
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.currentUser = null;
  mockAuth.canEditSongs = () => false;
  mockGetSongById.mockResolvedValue(SONG);
  mockGetAllSongs.mockResolvedValue([]);
  mockGetUserPreferences.mockResolvedValue({});
  mockUpdateUserPreferences.mockResolvedValue({});
});

const renderSongView = async () => {
  const result = render(<SongView />);
  await screen.findByRole('heading', { name: 'Cristo Vive' });
  return result;
};

describe('SongView', () => {
  it('muestra un estado de carga antes de tener la canción', () => {
    render(<SongView />);
    expect(screen.getByText(/Cargando canción/i)).toBeInTheDocument();
  });

  it('muestra el título y la tonalidad de la canción', async () => {
    await renderSongView();
    expect(screen.getByRole('heading', { name: 'Cristo Vive' })).toBeInTheDocument();
    expect(screen.getAllByText('DO').length).toBeGreaterThan(0);
  });

  // Nota: SongView monta a la vez la vista de acordes y la de solo letra
  // (se alternan por CSS), asi que cada linea aparece dos veces en el DOM.
  it('muestra el contenido de la voz primaria', async () => {
    await renderSongView();
    expect(screen.getAllByText(/Cristo vive hoy/).length).toBe(2);
    expect(screen.queryAllByText(/Segunda voz/)).toHaveLength(0);
  });

  it('genera una vista de solo letra sin acordes', async () => {
    await renderSongView();
    const vistas = screen.getAllByText(/Cristo vive hoy/);
    const soloLetra = vistas.find((el) => !el.textContent.includes('SOL'));
    expect(soloLetra).toBeDefined();
    expect(soloLetra.textContent).not.toMatch(/DO/);
  });

  it('lista las voces disponibles de la canción', async () => {
    const user = userEvent.setup();
    await renderSongView();

    await user.click(screen.getByRole('button', { name: /Trompeta.*1/i }));

    const opciones = screen.getAllByText(/Trompeta/i);
    expect(opciones.length).toBeGreaterThan(1);
  });

  it('cambia el contenido al seleccionar otra voz', async () => {
    const user = userEvent.setup();
    await renderSongView();

    await user.click(screen.getByRole('button', { name: /Trompeta.*1/i }));
    const opcionVoz2 = screen
      .getAllByText(/Trompeta.*2/i)
      .find((el) => el.className.includes('dropdown-item-custom'));
    await user.click(opcionVoz2);

    await waitFor(() => {
      expect(screen.getAllByText(/Segunda voz/).length).toBe(2);
    });
    expect(screen.queryAllByText(/Cristo vive hoy/)).toHaveLength(0);
  });

  it('muestra un mensaje cuando la canción no se puede cargar', async () => {
    mockGetSongById.mockRejectedValue(new Error('sin permisos'));
    render(<SongView />);

    expect(await screen.findByText(/Error al cargar la canción/i)).toBeInTheDocument();
    expect(screen.getByText(/sin permisos/i)).toBeInTheDocument();
  });

  it('usa el contenido plano cuando la canción no tiene voces', async () => {
    mockGetSongById.mockResolvedValue({
      ...SONG,
      voices: {},
      content: '## Intro\nDO SOL\nLetra sin voces\n'
    });

    render(<SongView />);
    expect(await screen.findAllByText(/Letra sin voces/)).not.toHaveLength(0);
  });

  it('aplica las preferencias del usuario autenticado', async () => {
    mockAuth.currentUser = { uid: 'user-1' };
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });

    render(<SongView />);
    await screen.findByRole('heading', { name: 'Cristo Vive' });

    await waitFor(() => {
      expect(mockGetUserPreferences).toHaveBeenCalledWith('user-1');
    });
    // En notación anglosajona el DO del Verso se muestra como C
    const acordes = screen.getAllByText(/Cristo vive hoy/)
      .find((el) => el.textContent.includes('G'));
    expect(acordes.textContent).toMatch(/C\s+G/);
    expect(acordes.textContent).not.toMatch(/DO/);
  });

  it('no consulta preferencias si no hay usuario', async () => {
    await renderSongView();
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  describe('álbum', () => {
    const CON_ALBUM = { ...SONG, album: 'Tiempo de Gracia' };
    const HERMANAS = [
      { id: 'song-1', title: 'Cristo Vive', album: 'Tiempo de Gracia' },
      { id: 'song-2', title: 'Renuévame', album: 'Tiempo de Gracia' },
      { id: 'song-3', title: 'Sublime Gracia', album: 'Otro Álbum' },
      { id: 'song-4', title: 'Suelta', album: '' }
    ];

    it('no muestra nada si la canción no tiene álbum', async () => {
      await renderSongView();
      expect(document.querySelector('.song-album-line')).toBeNull();
    });

    it('no consulta el repertorio si la canción no tiene álbum', async () => {
      await renderSongView();
      expect(mockGetAllSongs).not.toHaveBeenCalled();
    });

    it('muestra el nombre del álbum', async () => {
      mockGetSongById.mockResolvedValue(CON_ALBUM);
      await renderSongView();
      expect(screen.getByText('Tiempo de Gracia')).toBeInTheDocument();
    });

    it('enlaza solo con las canciones del mismo álbum', async () => {
      mockGetSongById.mockResolvedValue(CON_ALBUM);
      mockGetAllSongs.mockResolvedValue(HERMANAS);
      await renderSongView();

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Renuévame' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('link', { name: 'Sublime Gracia' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Suelta' })).not.toBeInTheDocument();
    });

    it('no se enlaza a sí misma', async () => {
      mockGetSongById.mockResolvedValue(CON_ALBUM);
      mockGetAllSongs.mockResolvedValue(HERMANAS);
      await renderSongView();

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Renuévame' })).toBeInTheDocument();
      });
      expect(screen.queryByRole('link', { name: 'Cristo Vive' })).not.toBeInTheDocument();
    });

    it('el enlace apunta a la otra canción', async () => {
      mockGetSongById.mockResolvedValue(CON_ALBUM);
      mockGetAllSongs.mockResolvedValue(HERMANAS);
      await renderSongView();

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Renuévame' }))
          .toHaveAttribute('href', '/songs/song-2');
      });
    });

    it('muestra el álbum aunque no haya hermanas', async () => {
      mockGetSongById.mockResolvedValue(CON_ALBUM);
      mockGetAllSongs.mockResolvedValue([HERMANAS[0]]);
      await renderSongView();

      expect(screen.getByText('Tiempo de Gracia')).toBeInTheDocument();
      expect(document.querySelector('.song-album-siblings')).toBeNull();
    });

    // Que falle el repertorio no debe impedir leer la canción: el músico
    // está sobre el escenario y lo que necesita es la partitura.
    it('si falla la búsqueda de hermanas, la canción se sigue viendo', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetSongById.mockResolvedValue(CON_ALBUM);
      mockGetAllSongs.mockRejectedValue(new Error('sin permisos'));

      await renderSongView();

      expect(screen.getAllByText(/Cristo vive hoy/).length).toBe(2);
      expect(screen.queryByText(/Error al cargar la canción/)).not.toBeInTheDocument();
      errorSpy.mockRestore();
    });
  });
});

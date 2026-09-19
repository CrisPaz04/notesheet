import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
const mockGetAllSongs = vi.fn();
const mockDeleteSong = vi.fn();

vi.mock('@notesheet/api', () => ({
  getAllSongs: (...a) => mockGetAllSongs(...a),
  deleteSong: (...a) => mockDeleteSong(...a)
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className, ...rest }) => (
    <a href={to} className={className} {...rest}>{children}</a>
  )
}));

const mockAuth = { currentUser: { uid: 'user-1', email: 'lucia@iglesia.org' }, canEditSongs: () => true };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: Dashboard } = await import('../pages/Dashboard');

// `updatedAt` llega como Timestamp de Firestore, con .toDate()
const timestamp = (date) => ({ toDate: () => date });
const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
};

const SONGS = [
  {
    id: '1',
    title: 'Cristo Vive',
    key: 'DO',
    type: 'Júbilo',
    version: 'v1',
    updatedAt: timestamp(hace(1))
  },
  {
    id: '2',
    title: 'Sublime Gracia',
    key: 'SOL',
    type: 'Adoración',
    version: 'clásico',
    updatedAt: timestamp(hace(30))
  },
  {
    id: '3',
    title: 'Al Que Está Sentado',
    key: 'RE',
    type: 'Moderada',
    version: 'v2',
    updatedAt: timestamp(hace(2))
  }
].map((s) => ({ ...s, isOwn: true, public: true }));

// Canción publicada por otro músico: se ve en el repertorio pero no se toca
const AJENA = {
  id: '4',
  title: 'Renuévame',
  key: 'MI',
  type: 'Adoración',
  version: 'coro',
  updatedAt: timestamp(hace(3)),
  isOwn: false,
  public: true
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.currentUser = { uid: 'user-1', email: 'lucia@iglesia.org' };
  mockAuth.canEditSongs = () => true;
  mockGetAllSongs.mockResolvedValue(SONGS);
  mockDeleteSong.mockResolvedValue('1');
  vi.stubGlobal('confirm', vi.fn(() => true));
});

const renderDashboard = async () => {
  render(<Dashboard />);
  await screen.findByText('Cristo Vive');
};

const tituloVisibles = () =>
  SONGS.map((s) => s.title).filter((t) => screen.queryAllByText(t).length > 0);

describe('Dashboard', () => {
  it('carga las canciones del usuario autenticado', async () => {
    await renderDashboard();
    expect(mockGetAllSongs).toHaveBeenCalledWith('user-1');
    expect(tituloVisibles()).toEqual(['Cristo Vive', 'Sublime Gracia', 'Al Que Está Sentado']);
  });

  it('no consulta canciones sin usuario', async () => {
    mockAuth.currentUser = null;
    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No se encontraron canciones|Crear Mi Primera/i)).toBeInTheDocument();
    });
    expect(mockGetAllSongs).not.toHaveBeenCalled();
  });

  it('muestra un error si la carga falla', async () => {
    mockGetAllSongs.mockRejectedValue(new Error('sin permisos'));
    render(<Dashboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Error al cargar las canciones/i);
    expect(screen.getByRole('alert')).toHaveTextContent(/sin permisos/i);
  });

  describe('búsqueda', () => {
    it('filtra por título', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'sublime');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Sublime Gracia']);
      });
    });

    it('filtra por tonalidad', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'RE');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Al Que Está Sentado']);
      });
    });

    it('filtra por versión', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'clásico');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Sublime Gracia']);
      });
    });

    it('ignora mayúsculas y minúsculas', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'CRISTO');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Cristo Vive']);
      });
    });

    it('muestra el estado vacío si nada coincide', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'zzzz');

      expect(await screen.findByText('No se encontraron canciones')).toBeInTheDocument();
    });

    it('el botón de limpiar filtros restaura la lista', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'zzzz');
      await screen.findByText('No se encontraron canciones');

      await user.click(screen.getByRole('button', { name: 'Limpiar Filtros' }));

      await waitFor(() => {
        expect(tituloVisibles()).toHaveLength(3);
      });
    });
  });

  describe('filtros por categoría', () => {
    const clickFiltro = async (user, nombre) => {
      const tabs = document.querySelector('.filter-tabs');
      await user.click(within(tabs).getByRole('button', { name: nombre }));
    };

    it('filtra por Júbilo', async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await clickFiltro(user, 'Júbilo');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Cristo Vive']);
      });
    });

    it('filtra por Adoración', async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await clickFiltro(user, 'Adoración');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Sublime Gracia']);
      });
    });

    it('filtra por Moderada', async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await clickFiltro(user, 'Moderada');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Al Que Está Sentado']);
      });
    });

    it('Recientes deja solo lo de la última semana', async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await clickFiltro(user, 'Recientes');

      await waitFor(() => {
        // Sublime Gracia se actualizó hace 30 días
        expect(tituloVisibles()).toEqual(['Cristo Vive', 'Al Que Está Sentado']);
      });
    });

    it('Todas vuelve a mostrarlo todo', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await clickFiltro(user, 'Júbilo');
      await waitFor(() => expect(tituloVisibles()).toHaveLength(1));

      await clickFiltro(user, 'Todas');
      await waitFor(() => expect(tituloVisibles()).toHaveLength(3));
    });

    it('combina búsqueda y filtro de categoría', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await clickFiltro(user, 'Júbilo');
      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'sublime');

      // Sublime Gracia es de Adoración, así que no queda nada
      expect(await screen.findByText('No se encontraron canciones')).toBeInTheDocument();
    });
  });

  describe('repertorio compartido', () => {
    beforeEach(() => {
      mockGetAllSongs.mockResolvedValue([...SONGS, AJENA]);
    });

    it('muestra las canciones publicadas por otros músicos', async () => {
      await renderDashboard();
      expect(screen.getByText('Renuévame')).toBeInTheDocument();
    });

    it('no ofrece borrar una canción ajena', async () => {
      await renderDashboard();
      // Solo las tres propias llevan botón de eliminar
      expect(document.querySelectorAll('.song-delete-btn')).toHaveLength(3);
    });

    it('el filtro Mías deja fuera el repertorio ajeno', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      const tabs = document.querySelector('.filter-tabs');
      await user.click(within(tabs).getByRole('button', { name: 'Mías' }));

      await waitFor(() => {
        expect(screen.queryByText('Renuévame')).not.toBeInTheDocument();
      });
      expect(tituloVisibles()).toHaveLength(3);
    });

    it('la búsqueda también encuentra canciones ajenas', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'renu');

      await waitFor(() => {
        expect(screen.getByText('Renuévame')).toBeInTheDocument();
      });
      expect(screen.queryByText('Cristo Vive')).not.toBeInTheDocument();
    });
  });

  describe('permisos y borrado', () => {
    it('un viewer no ve botones de eliminar', async () => {
      mockAuth.canEditSongs = () => false;
      await renderDashboard();
      expect(document.querySelectorAll('.song-delete-btn')).toHaveLength(0);
    });

    it('un editor sí los ve', async () => {
      await renderDashboard();
      expect(document.querySelectorAll('.song-delete-btn')).toHaveLength(3);
    });

    it('elimina una canción y la quita de la lista', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(document.querySelectorAll('.song-delete-btn')[0]);

      await waitFor(() => {
        expect(mockDeleteSong).toHaveBeenCalledWith('1');
      });
      await waitFor(() => {
        expect(screen.queryByText('Cristo Vive')).not.toBeInTheDocument();
      });
      expect(tituloVisibles()).toHaveLength(2);
    });

    // El componente guarda `songs` y `filteredSongs` por separado, y al
    // borrar actualiza las dos a mano. Si solo se actualizara la lista
    // filtrada, la canción reaparecería en cuanto un cambio de filtro
    // recalculase `filteredSongs` a partir de `songs`.
    it('la canción borrada no reaparece al cambiar de filtro', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(document.querySelectorAll('.song-delete-btn')[0]);
      await waitFor(() => {
        expect(screen.queryByText('Cristo Vive')).not.toBeInTheDocument();
      });

      const tabs = document.querySelector('.filter-tabs');
      await user.click(within(tabs).getByRole('button', { name: 'Júbilo' }));
      await user.click(within(tabs).getByRole('button', { name: 'Todas' }));

      await waitFor(() => {
        expect(tituloVisibles()).toHaveLength(2);
      });
      expect(screen.queryByText('Cristo Vive')).not.toBeInTheDocument();
    });

    it('respeta la cancelación del usuario', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(document.querySelectorAll('.song-delete-btn')[0]);

      expect(mockDeleteSong).not.toHaveBeenCalled();
      expect(screen.getByText('Cristo Vive')).toBeInTheDocument();
    });

    it('avisa si falla el borrado y mantiene la canción', async () => {
      mockDeleteSong.mockRejectedValue(new Error('sin permisos'));
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(document.querySelectorAll('.song-delete-btn')[0]);

      expect(await screen.findByRole('alert')).toHaveTextContent(/Error al eliminar/i);
      expect(screen.getByText('Cristo Vive')).toBeInTheDocument();
    });
  });
});

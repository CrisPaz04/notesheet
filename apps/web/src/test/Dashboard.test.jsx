import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { elegirEnDesplegable, valorDe, opcionesDe } from './utils/desplegable';

// --- Mocks ---
const mockGetAllSongs = vi.fn();
const mockDeleteSong = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockGetPlaylistsWithSong = vi.fn();
const mockRemoveSongFromPlaylists = vi.fn();

vi.mock('@notesheet/api', () => ({
  getAllSongs: (...a) => mockGetAllSongs(...a),
  deleteSong: (...a) => mockDeleteSong(...a),
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
  getPlaylistsWithSong: (...a) => mockGetPlaylistsWithSong(...a),
  removeSongFromPlaylists: (...a) => mockRemoveSongFromPlaylists(...a)
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className, ...rest }) => (
    <a href={to} className={className} {...rest}>{children}</a>
  )
}));

const mockAuth = { currentUser: { uid: 'user-1', email: 'lucia@iglesia.org' }, canEditSongs: () => true };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: Dashboard } = await import('../pages/Dashboard');
const { mensajeDeBorrado } = await import('../utils/avisoBorrado');

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
    lyricsOnly: 'Cristo vive hoy, para siempre',
    updatedAt: timestamp(hace(1))
  },
  {
    id: '2',
    title: 'Sublime Gracia',
    key: 'SOL',
    type: 'Adoración',
    version: 'clásico',
    lyricsOnly: 'Sublime gracia cuán dulce el son que salvó a un pecador',
    updatedAt: timestamp(hace(30))
  },
  {
    id: '3',
    title: 'Al Que Está Sentado',
    key: 'RE',
    type: 'Moderada',
    version: 'v2',
    lyricsOnly: 'Con todo mi corazón te adoraré',
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
  // El orden elegido se recuerda en localStorage: sin esto, un test dejaría
  // el Dashboard ordenado para el siguiente.
  localStorage.clear();
  mockAuth.currentUser = { uid: 'user-1', email: 'lucia@iglesia.org' };
  mockAuth.canEditSongs = () => true;
  mockGetAllSongs.mockResolvedValue(SONGS);
  mockDeleteSong.mockResolvedValue('1');
  mockGetUserPreferences.mockResolvedValue({});
  mockGetPlaylistsWithSong.mockResolvedValue([]);
  mockRemoveSongFromPlaylists.mockResolvedValue({ limpiadas: 0, fallidas: 0, ajenas: 0 });
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

    it('encuentra una canción por un verso de su letra', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'sublime gracia cuan dulce');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Sublime Gracia']);
      });
    });

    // Los nombres de nota aparecen dentro de muchas palabras, así que una
    // búsqueda corta no debe arrastrar media letra: "RE" es una tonalidad.
    it('una búsqueda corta no busca en la letra', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'RE');

      await waitFor(() => {
        // "siempRE" y "adoraRÉ" están en las letras, pero no cuentan
        expect(tituloVisibles()).toEqual(['Al Que Está Sentado']);
      });
    });

    it('ignora las tildes', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      // El músico escribe sin tilde, la letra la lleva
      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'corazon');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Al Que Está Sentado']);
      });
    });

    it('encuentra por título aunque lleve tilde', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'al que esta sentado');

      await waitFor(() => {
        expect(tituloVisibles()).toEqual(['Al Que Está Sentado']);
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

      await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

      await waitFor(() => {
        expect(tituloVisibles()).toHaveLength(3);
      });
    });
  });

  describe('filtro por tonalidad', () => {
    const selector = () => screen.getByRole('combobox', { name: 'Filtrar por tonalidad' });
    const opciones = () => opcionesDe(selector());

    it('ofrece solo las tonalidades que hay, cada una una vez', async () => {
      mockGetAllSongs.mockResolvedValue([...SONGS, { ...SONGS[0], id: '5', title: 'Otra en Do' }]);
      await renderDashboard();

      expect(opciones()).toEqual(['Todas las tonalidades', 'DO', 'RE', 'SOL']);
    });

    it('pone las mayores antes que las menores', async () => {
      // La menor llega primero a propósito: si el orden no distinguiera el
      // modo, DOm se quedaría delante de DO por ir antes en la lista.
      mockGetAllSongs.mockResolvedValue([{ ...SONGS[0], id: '9', title: 'En do menor', key: 'DOm' }, ...SONGS]);
      render(<Dashboard />);
      await screen.findByText('En do menor');

      expect(opciones()).toEqual(['Todas las tonalidades', 'DO', 'RE', 'SOL', 'DOm']);
    });

    it('deja solo las canciones de la tonalidad elegida', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await elegirEnDesplegable(user, selector(), 'SOL');

      expect(tituloVisibles()).toEqual(['Sublime Gracia']);
    });

    it('junta las enarmónicas en una sola opción', async () => {
      const user = userEvent.setup();
      mockGetAllSongs.mockResolvedValue([
        ...SONGS,
        { ...SONGS[0], id: '6', title: 'Con sostenidos', key: 'RE#m' },
        { ...SONGS[0], id: '7', title: 'Con bemoles', key: 'MIbm' }
      ]);
      await renderDashboard();

      expect(opciones()).toContain('RE#m');
      expect(opciones()).not.toContain('MIbm');

      await elegirEnDesplegable(user, selector(), 'RE#m');
      expect(screen.getByText('Con sostenidos')).toBeInTheDocument();
      expect(screen.getByText('Con bemoles')).toBeInTheDocument();
      expect(tituloVisibles()).toEqual([]);
    });

    it('no confunde mayor con menor', async () => {
      const user = userEvent.setup();
      mockGetAllSongs.mockResolvedValue([...SONGS, { ...SONGS[0], id: '8', title: 'En menor', key: 'REm' }]);
      await renderDashboard();

      await elegirEnDesplegable(user, selector(), 'RE');

      expect(tituloVisibles()).toEqual(['Al Que Está Sentado']);
      expect(screen.queryByText('En menor')).not.toBeInTheDocument();
    });

    it('elegir una no esconde las demás opciones', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await elegirEnDesplegable(user, selector(), 'RE');

      expect(opciones()).toHaveLength(4);
    });

    it('limpiar filtros también quita la tonalidad', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await elegirEnDesplegable(user, selector(), 'RE');
      await user.click(screen.getByRole('button', { name: 'Júbilo' }));
      await screen.findByText('No se encontraron canciones');
      await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

      expect(tituloVisibles()).toHaveLength(3);
      expect(valorDe(selector())).toBe('');
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

    // Lo hace el orden "Últimos cambios primero", sin esconder el resto
    it('ya no hay filtro de "Mostrar" (mías, editadas esta semana)', async () => {
      await renderDashboard();
      expect(screen.queryByRole('combobox', { name: 'Mostrar canciones' })).toBeNull();
      expect(screen.queryByText('Editadas esta semana')).toBeNull();
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

  // Borrar una canción no la quitaba de las listas que la contienen: quedaba
  // una entrada apuntando a un documento inexistente y la lista mostraba
  // "Esta canción no está disponible" sin decir por qué. Ahora se avisa antes
  // y se limpian las listas que el usuario puede escribir.
  describe('referencias en listas al eliminar', () => {
    const LISTA_MIA = {
      id: 'viernes', name: 'Lista de Viernes', creatorId: 'user-1', isOwn: true,
      songs: [{ id: '1', title: 'Cristo Vive', key: 'DO' }]
    };
    const LISTA_AJENA = {
      id: 'vientos', name: 'Ensayo de vientos', creatorId: 'trompetista', isOwn: false,
      songs: [{ id: '1', title: 'Cristo Vive', key: 'MI' }]
    };

    const borrarLaPrimera = async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await user.click(document.querySelectorAll('.song-delete-btn')[0]);
    };

    it('consulta las listas de la canción antes de preguntar', async () => {
      await borrarLaPrimera();

      expect(mockGetPlaylistsWithSong).toHaveBeenCalledWith('1', 'user-1');
    });

    it('el aviso nombra las listas afectadas', async () => {
      mockGetPlaylistsWithSong.mockResolvedValue([LISTA_MIA, LISTA_AJENA]);

      await borrarLaPrimera();

      const texto = confirm.mock.calls[0][0];
      expect(texto).toContain('Lista de Viernes');
      expect(texto).toContain('Ensayo de vientos');
    });

    it('quita la canción de las listas tras borrarla', async () => {
      mockGetPlaylistsWithSong.mockResolvedValue([LISTA_MIA]);

      await borrarLaPrimera();

      await waitFor(() => {
        expect(mockRemoveSongFromPlaylists).toHaveBeenCalledWith('1', [LISTA_MIA], 'user-1');
      });
    });

    // El orden importa: limpiar primero y fallar el borrado dejaría las listas
    // vacías de una canción que sigue existiendo, y cada entrada lleva su
    // propia tonalidad para esa ocasión.
    it('borra antes de limpiar, nunca al revés', async () => {
      const orden = [];
      mockGetPlaylistsWithSong.mockResolvedValue([LISTA_MIA]);
      mockDeleteSong.mockImplementation(async () => { orden.push('borrar'); });
      mockRemoveSongFromPlaylists.mockImplementation(async () => {
        orden.push('limpiar');
        return { limpiadas: 1, fallidas: 0, ajenas: 0 };
      });

      await borrarLaPrimera();

      await waitFor(() => expect(orden).toEqual(['borrar', 'limpiar']));
    });

    it('no toca las listas si falla el borrado', async () => {
      mockGetPlaylistsWithSong.mockResolvedValue([LISTA_MIA]);
      mockDeleteSong.mockRejectedValue(new Error('sin permisos'));

      await borrarLaPrimera();

      expect(await screen.findByRole('alert')).toHaveTextContent(/Error al eliminar/i);
      expect(mockRemoveSongFromPlaylists).not.toHaveBeenCalled();
    });

    it('no toca las listas si el usuario cancela', async () => {
      mockGetPlaylistsWithSong.mockResolvedValue([LISTA_MIA]);
      vi.stubGlobal('confirm', vi.fn(() => false));

      await borrarLaPrimera();

      expect(mockDeleteSong).not.toHaveBeenCalled();
      expect(mockRemoveSongFromPlaylists).not.toHaveBeenCalled();
    });

    // La canción ya está borrada: el fallo de limpieza no se puede deshacer,
    // solo contar, para que el usuario sepa que le queda un hueco.
    it('avisa si alguna lista no se pudo limpiar', async () => {
      mockGetPlaylistsWithSong.mockResolvedValue([LISTA_MIA]);
      mockRemoveSongFromPlaylists.mockResolvedValue({ limpiadas: 0, fallidas: 1, ajenas: 0 });

      await borrarLaPrimera();

      expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo quitar de 1 lista/i);
      // Pero la canción sí se borró: no debe volver a aparecer.
      expect(screen.queryByText('Cristo Vive')).not.toBeInTheDocument();
    });

    // No poder mirar las listas no debe impedir borrar; pero tampoco se puede
    // callar y dar a entender que no esta en ninguna.
    it('deja borrar aunque falle la consulta, y lo dice', async () => {
      mockGetPlaylistsWithSong.mockRejectedValue(new Error('sin conexión'));

      await borrarLaPrimera();

      expect(confirm.mock.calls[0][0]).toMatch(/No se ha podido comprobar/i);
      await waitFor(() => expect(mockDeleteSong).toHaveBeenCalledWith('1'));
      expect(mockRemoveSongFromPlaylists).not.toHaveBeenCalled();
    });
  });

  describe('mensajeDeBorrado', () => {
    const lista = (name, isOwn) => ({ name, isOwn });

    it('sin listas, solo el aviso de siempre', () => {
      const texto = mensajeDeBorrado('Cristo Vive', []);
      expect(texto).toContain('Cristo Vive');
      expect(texto).not.toMatch(/lista/i);
    });

    it('cuenta y nombra las listas', () => {
      const texto = mensajeDeBorrado('Cristo Vive', [lista('Viernes', true), lista('Domingo', true)]);
      expect(texto).toContain('Está en 2 listas');
      expect(texto).toContain('Viernes');
      expect(texto).toContain('Domingo');
    });

    it('singular con una sola lista', () => {
      expect(mensajeDeBorrado('Cristo Vive', [lista('Viernes', true)]))
        .toContain('Está en 1 lista:');
    });

    it('promete limpiar solo las propias', () => {
      const texto = mensajeDeBorrado('Cristo Vive', [lista('Viernes', true), lista('Vientos', false)]);
      expect(texto).toContain('Se quitará de la que es tuya');
      expect(texto).toMatch(/1 es de otro músico/i);
    });

    // Si todas son ajenas no se puede limpiar ninguna: prometerlo sería
    // mentir, porque las reglas no dejan escribir en la lista de otro.
    it('no promete limpiar nada si ninguna es propia', () => {
      const texto = mensajeDeBorrado('Cristo Vive', [lista('Vientos', false)]);
      expect(texto).not.toMatch(/Se quitará/i);
      expect(texto).toMatch(/seguirá mostrando un hueco/i);
    });

    it('no menciona a otros músicos si todas son propias', () => {
      const texto = mensajeDeBorrado('Cristo Vive', [lista('Viernes', true)]);
      expect(texto).not.toMatch(/otro músico/i);
    });

    // null es "no se ha podido consultar", distinto de "no está en ninguna".
    it('distingue no saber de no haber ninguna', () => {
      expect(mensajeDeBorrado('Cristo Vive', null)).toMatch(/No se ha podido comprobar/i);
    });

    it('aguanta una lista sin nombre', () => {
      expect(mensajeDeBorrado('Cristo Vive', [lista(undefined, true)])).toContain('(sin nombre)');
    });
  });

  describe('orden alfabético', () => {
    // De entrada, los últimos cambios primero (updatedAt; crearla cuenta).
    // `tituloVisibles` filtra sobre SONGS, así que aquí se lee el DOM
    // directamente para ver el orden real.
    const ordenEnPantalla = () =>
      [...document.querySelectorAll('.recent-item-title, .list-item-title')].map((n) => n.textContent.trim());

    it('de entrada, los últimos cambios primero', async () => {
      await renderDashboard();
      // Cristo Vive hace 1 día, Al Que Está Sentado hace 2, Sublime Gracia hace 30
      expect(ordenEnPantalla()).toEqual(['Cristo Vive', 'Al Que Está Sentado', 'Sublime Gracia']);
    });

    // Llegan en dos consultas (las propias y las compartidas), cada una
    // ordenada por su cuenta: antes salían todas las propias antes que
    // cualquier compartida, aunque esta fuera más reciente
    it('las compartidas se mezclan por fecha con las propias', async () => {
      mockGetAllSongs.mockResolvedValue([...SONGS, AJENA]);
      await renderDashboard();
      expect(ordenEnPantalla()).toEqual(['Cristo Vive', 'Al Que Está Sentado', 'Renuévame', 'Sublime Gracia']);
    });

    it('crearla cuenta como cambio: sin updatedAt vale la de creación', async () => {
      mockGetAllSongs.mockResolvedValue([
        ...SONGS,
        { id: '9', title: 'Recién creada', key: 'LA', type: 'Júbilo', version: '', isOwn: true, public: true, createdAt: timestamp(hace(0)) }
      ]);
      await renderDashboard();
      expect(ordenEnPantalla()[0]).toBe('Recién creada');
    });

    it('ordena de la A a la Z', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole('button', { name: 'Ordenar de la A a la Z' }));

      await waitFor(() => {
        expect(ordenEnPantalla()).toEqual(['Al Que Está Sentado', 'Cristo Vive', 'Sublime Gracia']);
      });
    });

    it('ordena de la Z a la A', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole('button', { name: 'Ordenar de la Z a la A' }));

      await waitFor(() => {
        expect(ordenEnPantalla()).toEqual(['Sublime Gracia', 'Cristo Vive', 'Al Que Está Sentado']);
      });
    });

    it('se puede volver a los últimos cambios', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole('button', { name: 'Ordenar de la Z a la A' }));
      await waitFor(() => expect(ordenEnPantalla()[0]).toBe('Sublime Gracia'));

      await user.click(screen.getByRole('button', { name: 'Últimos cambios primero' }));

      await waitFor(() => {
        expect(ordenEnPantalla()).toEqual(['Cristo Vive', 'Al Que Está Sentado', 'Sublime Gracia']);
      });
    });

    it('las tildes no mandan la canción al final', async () => {
      // "Álvaro" va entre "Alabaré" y "Amor", no detrás de "Zacarías": es lo
      // que hace `Intl.Collator` en español y no una comparación de texto.
      mockGetAllSongs.mockResolvedValue(
        ['Zacarías', 'Álvaro', 'Amor eterno', 'Alabaré'].map((title, i) => ({
          id: String(i), title, key: 'DO', type: 'Júbilo', version: '',
          isOwn: true, public: true, updatedAt: timestamp(hace(1))
        }))
      );
      const user = userEvent.setup();
      render(<Dashboard />);
      await screen.findByText('Zacarías');

      await user.click(screen.getByRole('button', { name: 'Ordenar de la A a la Z' }));

      await waitFor(() => {
        expect(ordenEnPantalla()).toEqual(['Alabaré', 'Álvaro', 'Amor eterno', 'Zacarías']);
      });
    });

    it('los números se ordenan como números', async () => {
      // Comparando texto, "Salmo 21" iría antes que "Salmo 3".
      mockGetAllSongs.mockResolvedValue(
        ['Salmo 21', 'Salmo 3', 'Salmo 100'].map((title, i) => ({
          id: String(i), title, key: 'DO', type: 'Júbilo', version: '',
          isOwn: true, public: true, updatedAt: timestamp(hace(1))
        }))
      );
      const user = userEvent.setup();
      render(<Dashboard />);
      await screen.findByText('Salmo 21');

      await user.click(screen.getByRole('button', { name: 'Ordenar de la A a la Z' }));

      await waitFor(() => {
        expect(ordenEnPantalla()).toEqual(['Salmo 3', 'Salmo 21', 'Salmo 100']);
      });
    });

    it('recuerda la vista elegida (tarjetas o lista) entre visitas', async () => {
      const user = userEvent.setup();
      await renderDashboard();
      expect(document.querySelector('.recent-grid')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Vista de lista' }));
      expect(document.querySelector('.songs-list-view')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Vista de lista' })).toHaveAttribute('aria-pressed', 'true');

      // Segunda visita: se monta de cero, como al volver al Dashboard
      document.body.innerHTML = '';
      render(<Dashboard />);
      await screen.findByText('Cristo Vive');

      expect(document.querySelector('.songs-list-view')).toBeInTheDocument();
      expect(document.querySelector('.recent-grid')).not.toBeInTheDocument();
    });

    it('una vista guardada que no existe se ignora', async () => {
      localStorage.setItem('dashboardVista', 'mosaico');
      await renderDashboard();
      expect(document.querySelector('.recent-grid')).toBeInTheDocument();
    });

    it('recuerda el orden elegido entre visitas', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole('button', { name: 'Ordenar de la A a la Z' }));
      await waitFor(() => expect(ordenEnPantalla()[0]).toBe('Al Que Está Sentado'));

      // Segunda visita: se monta de cero, como al recargar la página
      screen.unmount?.();
      document.body.innerHTML = '';
      render(<Dashboard />);
      await screen.findByText('Cristo Vive');

      expect(ordenEnPantalla()).toEqual(['Al Que Está Sentado', 'Cristo Vive', 'Sublime Gracia']);
    });

    it('ignora un orden guardado que no existe', async () => {
      localStorage.setItem('dashboardOrden', 'por-tonalidad-inventada');
      await renderDashboard();
      expect(ordenEnPantalla()).toEqual(['Cristo Vive', 'Al Que Está Sentado', 'Sublime Gracia']);
    });

    it('funciona aunque localStorage falle (incógnito)', async () => {
      const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() { throw new Error('bloqueado'); }
      });

      try {
        const user = userEvent.setup();
        render(<Dashboard />);
        await screen.findByText('Cristo Vive');

        await user.click(screen.getByRole('button', { name: 'Ordenar de la A a la Z' }));

        await waitFor(() => {
          expect(ordenEnPantalla()).toEqual(['Al Que Está Sentado', 'Cristo Vive', 'Sublime Gracia']);
        });
      } finally {
        Object.defineProperty(window, 'localStorage', original);
      }
    });

    it('el orden convive con la búsqueda y con los filtros', async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.click(screen.getByRole('button', { name: 'Ordenar de la A a la Z' }));
      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'a');

      await waitFor(() => {
        const visibles = ordenEnPantalla();
        expect(visibles).toEqual([...visibles].sort((x, y) => x.localeCompare(y, 'es')));
        expect(visibles.length).toBeGreaterThan(1);
      });
    });
  });

  describe('tonalidades en C-D-E', () => {
    const EN_SIM = { ...SONGS[0], id: '9', title: 'Canción en si menor', key: 'SIm', lyricsOnly: '' };

    it('con anglosajona en el perfil, las tarjetas y el filtro las nombran en C-D-E', async () => {
      mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
      mockGetAllSongs.mockResolvedValue([...SONGS, EN_SIM]);
      await renderDashboard();

      await waitFor(() => expect(screen.getByText(/^Bm • /)).toBeInTheDocument());
      await userEvent.click(screen.getByRole('combobox', { name: 'Filtrar por tonalidad' }));
      const opciones = within(screen.getByRole('listbox'))
        .getAllByRole('option').map((o) => o.textContent);
      expect(opciones).toEqual(['Todas las tonalidades', 'C', 'D', 'G', 'Bm']);
    });

    it('buscar "Bm" encuentra la canción en SIm', async () => {
      const user = userEvent.setup();
      mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
      mockGetAllSongs.mockResolvedValue([...SONGS, EN_SIM]);
      await renderDashboard();
      await waitFor(() => expect(screen.getByText(/^Bm • /)).toBeInTheDocument());

      await user.type(screen.getByPlaceholderText('Buscar canciones...'), 'Bm');

      await waitFor(() => expect(tituloVisibles()).toEqual([]));
      expect(screen.getByText('Canción en si menor')).toBeInTheDocument();
    });

    it('en latina siguen como están', async () => {
      mockGetAllSongs.mockResolvedValue([...SONGS, EN_SIM]);
      await renderDashboard();
      expect(screen.getByText(/^SIm • /)).toBeInTheDocument();
    });
  });
});

// Con el repertorio entero (120 canciones) crear todas las tarjetas de golpe
// trababa la pantalla: se pintan por tandas al acercarse al final
describe('Dashboard: carga progresiva', () => {
  let alVer;
  class ObservadorFalso {
    constructor(cb) { alVer = cb; }
    observe() {}
    disconnect() {}
  }
  const MUCHAS = Array.from({ length: 60 }, (_, i) => ({
    id: `m${i}`, title: `Canción ${String(i).padStart(2, '0')}`, key: 'DO', type: 'Júbilo',
    isOwn: true, public: true, updatedAt: timestamp(hace(i)),
  }));
  const tarjetas = () => document.querySelectorAll('.recent-item, .list-item').length;

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
    mockGetAllSongs.mockResolvedValue(MUCHAS);
  });

  it('pinta la primera tanda y la siguiente al acercarse al final', async () => {
    render(<Dashboard />);
    await screen.findByText('Canción 00');
    expect(tarjetas()).toBe(24);
    act(() => alVer([{ isIntersecting: true }]));
    expect(tarjetas()).toBe(60);
  });

  it('al buscar, se busca entre todas, no solo entre las pintadas', async () => {
    render(<Dashboard />);
    await screen.findByText('Canción 00');
    await userEvent.type(screen.getByPlaceholderText(/buscar/i), 'Canción 59');
    expect(await screen.findByText('Canción 59')).toBeInTheDocument();
  });
});


describe('Dashboard: canciones que modulan', () => {
  const SION = { ...SONGS[0], id: '20', title: 'Mas tú, Jehová', key: 'SIm', tonalidades: ['SIm', 'DO#m'] };

  it('el filtro ofrece también las tonalidades de las modulaciones, y la encuentra por ellas', async () => {
    const user = userEvent.setup();
    mockGetAllSongs.mockResolvedValue([...SONGS, SION]);
    await renderDashboard();

    const selector = screen.getByRole('combobox', { name: 'Filtrar por tonalidad' });
    expect(opcionesDe(selector)).toEqual(expect.arrayContaining(['SIm', 'DO#m']));
    await elegirEnDesplegable(user, selector, 'DO#m');
    // Las del repertorio de prueba desaparecen y queda la que modula
    expect(tituloVisibles()).toEqual([]);
    expect(screen.getByText('Mas tú, Jehová')).toBeInTheDocument();
  });

  it('la tarjeta enseña todas sus tonalidades', async () => {
    mockGetAllSongs.mockResolvedValue([...SONGS, SION]);
    await renderDashboard();
    expect(screen.getAllByText(/SIm → DO#m/).length).toBeGreaterThan(0);
  });
});

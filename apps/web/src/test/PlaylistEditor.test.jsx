import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
const mockGetAllSongs = vi.fn();
const mockGetPlaylistById = vi.fn();
const mockCreatePlaylist = vi.fn();
const mockUpdatePlaylist = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@notesheet/api', () => ({
  getAllSongs: (...a) => mockGetAllSongs(...a),
  getPlaylistById: (...a) => mockGetPlaylistById(...a),
  createPlaylist: (...a) => mockCreatePlaylist(...a),
  updatePlaylist: (...a) => mockUpdatePlaylist(...a)
}));

const routeParams = {};
vi.mock('react-router-dom', () => ({
  useParams: () => routeParams,
  useNavigate: () => mockNavigate
}));

const mockAuth = { currentUser: { uid: 'user-1' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

// @hello-pangea/dnd no funciona en jsdom. Lo sustituimos por envoltorios que
// renderizan a los hijos y, de paso, capturamos el `onDragEnd` para poder
// invocar el reordenamiento directamente sin simular un arrastre real.
let capturedOnDragEnd = null;
vi.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }) => {
    capturedOnDragEnd = onDragEnd;
    return <div>{children}</div>;
  },
  Droppable: ({ children }) =>
    children({ droppableProps: {}, innerRef: () => {}, placeholder: null }),
  Draggable: ({ children }) =>
    children(
      { innerRef: () => {}, draggableProps: { style: {} }, dragHandleProps: {} },
      { isDragging: false }
    )
}));

const { default: PlaylistEditor } = await import('../pages/PlaylistEditor');

const SONGS = [
  { id: 's1', title: 'Cristo Vive', key: 'DO', type: 'Júbilo' },
  { id: 's2', title: 'Sublime Gracia', key: 'SOL', type: 'Adoración' },
  { id: 's3', title: 'Al Que Está Sentado', key: 'RE', type: 'Moderada' }
];

beforeEach(() => {
  vi.clearAllMocks();
  capturedOnDragEnd = null;
  routeParams.id = undefined;
  mockAuth.currentUser = { uid: 'user-1' };
  mockGetAllSongs.mockResolvedValue(SONGS);
  mockCreatePlaylist.mockResolvedValue({ id: 'p1' });
  mockUpdatePlaylist.mockResolvedValue({ id: 'p1' });
});

const renderNueva = async () => {
  render(<PlaylistEditor />);
  await screen.findByPlaceholderText('Nombre de la lista');
};

const tituloEnLista = () =>
  [...document.querySelectorAll('.selected-song-title')].map((el) => el.textContent);

const botonDisponible = (titulo) =>
  [...document.querySelectorAll('.available-song-item')]
    .find((b) => b.textContent.includes(titulo));

describe('PlaylistEditor', () => {
  describe('lista nueva', () => {
    it('carga las canciones disponibles del usuario', async () => {
      await renderNueva();
      expect(mockGetAllSongs).toHaveBeenCalledWith('user-1');
      SONGS.forEach((s) => {
        expect(botonDisponible(s.title)).toBeTruthy();
      });
    });

    it('arranca con la fecha de hoy y la lista vacía', async () => {
      await renderNueva();
      const hoy = new Date().toISOString().split('T')[0];
      expect(document.querySelector('input[type="date"]')).toHaveValue(hoy);
      expect(screen.getByText('Lista vacía')).toBeInTheDocument();
    });

    it('arranca como privada', async () => {
      await renderNueva();
      const privada = screen.getByRole('button', { name: /Privada/ });
      expect(privada.className).toContain('active');
    });

    it('no llama a la API si no hay usuario', async () => {
      mockAuth.currentUser = null;
      render(<PlaylistEditor />);
      await screen.findByPlaceholderText('Nombre de la lista');
      expect(mockGetAllSongs).not.toHaveBeenCalled();
      expect(screen.getByText('No hay canciones disponibles')).toBeInTheDocument();
    });
  });

  describe('añadir y quitar canciones', () => {
    it('añade una canción a la lista', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(botonDisponible('Cristo Vive'));

      await waitFor(() => {
        expect(tituloEnLista()).toEqual(['Cristo Vive']);
      });
      expect(screen.queryByText('Lista vacía')).not.toBeInTheDocument();
    });

    it('conserva el orden en que se añaden', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(botonDisponible('Sublime Gracia'));
      await user.click(botonDisponible('Cristo Vive'));

      await waitFor(() => {
        expect(tituloEnLista()).toEqual(['Sublime Gracia', 'Cristo Vive']);
      });
    });

    // Ojo con el alcance de este test: comprueba que el botón queda
    // deshabilitado, que es lo que de verdad impide el duplicado desde la UI.
    // El guard `exists` de addSong es defensivo y no se puede alcanzar
    // haciendo clic, así que ningún test de componente lo cubre.
    it('deshabilita una canción ya añadida', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(botonDisponible('Cristo Vive'));

      await waitFor(() => {
        expect(botonDisponible('Cristo Vive')).toBeDisabled();
      });
      expect(tituloEnLista()).toEqual(['Cristo Vive']);
    });

    it('quita una canción de la lista', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(botonDisponible('Cristo Vive'));
      await user.click(botonDisponible('Sublime Gracia'));
      await waitFor(() => expect(tituloEnLista()).toHaveLength(2));

      await user.click(document.querySelectorAll('.selected-song-remove')[0]);

      await waitFor(() => {
        expect(tituloEnLista()).toEqual(['Sublime Gracia']);
      });
      // Y vuelve a estar disponible
      expect(botonDisponible('Cristo Vive')).not.toBeDisabled();
    });

    it('muestra el contador de canciones', async () => {
      const user = userEvent.setup();
      await renderNueva();

      expect(screen.getByText('0 canciones')).toBeInTheDocument();
      await user.click(botonDisponible('Cristo Vive'));
      expect(await screen.findByText('1 canciones')).toBeInTheDocument();
    });
  });

  describe('tonalidad por canción', () => {
    it('toma la tonalidad original de la canción', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(botonDisponible('Sublime Gracia'));

      await waitFor(() => {
        expect(document.querySelector('.playlist-key-dropdown')).toHaveTextContent('SOL');
      });
    });

    it('permite cambiarla sin tocar la canción original', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(botonDisponible('Sublime Gracia'));
      await user.click(document.querySelector('.playlist-key-dropdown'));

      const opcionRE = [...document.querySelectorAll('.playlist-key-option, .playlist-key-item, button, div')]
        .filter((el) => el.textContent.trim() === 'RE' && el !== document.querySelector('.playlist-key-dropdown'))
        .pop();
      await user.click(opcionRE);

      await waitFor(() => {
        expect(document.querySelector('.playlist-key-dropdown')).toHaveTextContent('RE');
      });

      // La canción disponible sigue anunciando su tonalidad original
      expect(botonDisponible('Sublime Gracia').textContent).toContain('SOL');
    });
  });

  describe('reordenar', () => {
    const arrastrar = async (desde, hasta) => {
      await waitFor(() => expect(capturedOnDragEnd).toBeTypeOf('function'));
      capturedOnDragEnd({ source: { index: desde }, destination: { index: hasta } });
    };

    const conTresCanciones = async (user) => {
      await renderNueva();
      await user.click(botonDisponible('Cristo Vive'));
      await user.click(botonDisponible('Sublime Gracia'));
      await user.click(botonDisponible('Al Que Está Sentado'));
      await waitFor(() => expect(tituloEnLista()).toHaveLength(3));
    };

    it('mueve una canción de la primera a la última posición', async () => {
      const user = userEvent.setup();
      await conTresCanciones(user);

      await arrastrar(0, 2);

      await waitFor(() => {
        expect(tituloEnLista()).toEqual(['Sublime Gracia', 'Al Que Está Sentado', 'Cristo Vive']);
      });
    });

    it('mueve una canción hacia arriba', async () => {
      const user = userEvent.setup();
      await conTresCanciones(user);

      await arrastrar(2, 0);

      await waitFor(() => {
        expect(tituloEnLista()).toEqual(['Al Que Está Sentado', 'Cristo Vive', 'Sublime Gracia']);
      });
    });

    it('no cambia nada si se suelta fuera de la lista', async () => {
      const user = userEvent.setup();
      await conTresCanciones(user);
      const antes = tituloEnLista();

      await waitFor(() => expect(capturedOnDragEnd).toBeTypeOf('function'));
      capturedOnDragEnd({ source: { index: 0 }, destination: null });

      expect(tituloEnLista()).toEqual(antes);
    });

    it('no cambia nada si se suelta en la misma posición', async () => {
      const user = userEvent.setup();
      await conTresCanciones(user);
      const antes = tituloEnLista();

      await arrastrar(1, 1);

      expect(tituloEnLista()).toEqual(antes);
    });
  });

  describe('guardar', () => {
    it('exige un nombre', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      expect(await screen.findByText(/El nombre de la lista no puede estar vacío/i)).toBeInTheDocument();
      expect(mockCreatePlaylist).not.toHaveBeenCalled();
    });

    it('rechaza un nombre que son solo espacios', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.type(screen.getByPlaceholderText('Nombre de la lista'), '   ');
      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      expect(await screen.findByText(/no puede estar vacío/i)).toBeInTheDocument();
      expect(mockCreatePlaylist).not.toHaveBeenCalled();
    });

    it('crea la lista con sus canciones y vuelve al listado', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.type(screen.getByPlaceholderText('Nombre de la lista'), 'Domingo 21');
      await user.click(botonDisponible('Cristo Vive'));
      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      await waitFor(() => expect(mockCreatePlaylist).toHaveBeenCalled());

      const datos = mockCreatePlaylist.mock.calls[0][0];
      expect(datos.name).toBe('Domingo 21');
      expect(datos.creatorId).toBe('user-1');
      expect(datos.public).toBe(false);
      expect(datos.songs).toHaveLength(1);
      expect(datos.songs[0]).toMatchObject({ id: 's1', key: 'DO', originalKey: 'DO' });
      expect(mockNavigate).toHaveBeenCalledWith('/playlists');
    });

    it('guarda la visibilidad pública', async () => {
      const user = userEvent.setup();
      await renderNueva();

      await user.type(screen.getByPlaceholderText('Nombre de la lista'), 'Pública');
      await user.click(screen.getByRole('button', { name: /Pública/ }));
      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      await waitFor(() => expect(mockCreatePlaylist).toHaveBeenCalled());
      expect(mockCreatePlaylist.mock.calls[0][0].public).toBe(true);
    });

    it('muestra el error si falla el guardado y no navega', async () => {
      mockCreatePlaylist.mockRejectedValue(new Error('sin permisos'));
      const user = userEvent.setup();
      await renderNueva();

      await user.type(screen.getByPlaceholderText('Nombre de la lista'), 'Domingo 21');
      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      expect(await screen.findByText(/Error al guardar la lista/i)).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe('lista existente', () => {
    const PLAYLIST = {
      id: 'p1',
      name: 'Domingo pasado',
      date: { toDate: () => new Date('2026-09-13T00:00:00Z') },
      public: true,
      songs: [
        { id: 's2', title: 'Sublime Gracia', key: 'LA', originalKey: 'SOL' },
        { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' }
      ]
    };

    beforeEach(() => {
      routeParams.id = 'p1';
      mockGetPlaylistById.mockResolvedValue(PLAYLIST);
    });

    it('carga nombre, fecha, visibilidad y canciones', async () => {
      render(<PlaylistEditor />);
      await screen.findByDisplayValue('Domingo pasado');

      expect(mockGetPlaylistById).toHaveBeenCalledWith('p1');
      expect(document.querySelector('input[type="date"]')).toHaveValue('2026-09-13');
      expect(screen.getByRole('button', { name: /Pública/ }).className).toContain('active');
      expect(tituloEnLista()).toEqual(['Sublime Gracia', 'Cristo Vive']);
    });

    it('conserva la tonalidad transpuesta que se había guardado', async () => {
      render(<PlaylistEditor />);
      await screen.findByDisplayValue('Domingo pasado');

      const tonalidades = [...document.querySelectorAll('.playlist-key-dropdown')]
        .map((el) => el.textContent.trim());
      expect(tonalidades[0]).toContain('LA');
    });

    it('actualiza en vez de crear', async () => {
      const user = userEvent.setup();
      render(<PlaylistEditor />);
      await screen.findByDisplayValue('Domingo pasado');

      await user.click(screen.getByRole('button', { name: /Guardar/i }));

      await waitFor(() => expect(mockUpdatePlaylist).toHaveBeenCalled());
      expect(mockUpdatePlaylist.mock.calls[0][0]).toBe('p1');
      expect(mockCreatePlaylist).not.toHaveBeenCalled();
    });

    it('muestra el error si la lista no se puede cargar', async () => {
      mockGetPlaylistById.mockRejectedValue(new Error('no existe'));
      render(<PlaylistEditor />);

      expect(await screen.findByText(/Error al cargar la lista/i)).toBeInTheDocument();
    });
  });
});

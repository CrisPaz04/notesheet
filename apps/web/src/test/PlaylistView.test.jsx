import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// --- Mocks ---
const mockGetPlaylistById = vi.fn();
const mockGetSongById = vi.fn();

// `createSession` y `useNavigate` los necesita el botón de sesión en vivo que
// vive en la barra de acciones. Sin ellos el import falla y la página no
// llega a renderizar nada.
const mockCreateSession = vi.fn();
const mockGetUserPreferences = vi.fn();

vi.mock('@notesheet/api', () => ({
  getPlaylistById: (...a) => mockGetPlaylistById(...a),
  getSongById: (...a) => mockGetSongById(...a),
  createSession: (...a) => mockCreateSession(...a),
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: vi.fn().mockResolvedValue({})
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'p1' }),
  useNavigate: () => vi.fn(),
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
  localStorage.clear();
  mockGetUserPreferences.mockResolvedValue({});
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

  describe('notación del perfil', () => {
    it('sin preferencia, las notas salen en latina', async () => {
      await renderLista();
      expect(contenidoDeCancion(0)).toMatch(/LA\s+MI\s+FA#m\s+RE/);
    });

    it('con anglosajona en el perfil, las notas salen en anglosajona', async () => {
      mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
      await renderLista();

      // Cristo Vive, transpuesta a LA para esta lista y en C-D-E
      await waitFor(() => expect(contenidoDeCancion(0)).toMatch(/A\s+E\s+F#m\s+D/));
      expect(mockGetUserPreferences).toHaveBeenCalledWith('user-1');
      // No vuelve a descargar las canciones por cambiar la notación
      expect(mockGetSongById).toHaveBeenCalledTimes(2);
    });

    it('con anglosajona, la etiqueta de tonalidad también sale en C-D-E', async () => {
      mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
      await renderLista();
      await waitFor(() => {
        const etiquetas = [...document.querySelectorAll('.playlist-song-key')].map((el) => el.textContent.trim());
        expect(etiquetas).toEqual(['A', 'G']);
      });
    });

    it('si el perfil llega después que las canciones, las vuelve a pintar', async () => {
      let responder;
      mockGetUserPreferences.mockReturnValue(new Promise((r) => { responder = r; }));
      await renderLista();
      await waitFor(() => expect(contenidoDeCancion(0)).toMatch(/LA\s+MI\s+FA#m\s+RE/));

      responder({ defaultNotationSystem: 'english' });

      await waitFor(() => expect(contenidoDeCancion(0)).toMatch(/A\s+E\s+F#m\s+D/));
      expect(mockGetSongById).toHaveBeenCalledTimes(2);
    });
  });
});

// Notas, letra o acordes de todas las canciones a la vez, con la vista del
// instrumento de las preferencias al entrar.
describe('PlaylistView: qué se ve de cada canción', () => {
  // En la referencia de Sib la canción está en DO (SIb en concierto) y la
  // lista la sube a LA (SOL en concierto). Los acordes van en concierto.
  const CON_ACORDES = { ...CANCIONES.s1, acordes: 'SIb FA SOLm MIb' };

  beforeEach(() => {
    mockGetSongById.mockImplementation(async (id) => {
      if (id === 's1') return CON_ACORDES;
      return CANCIONES[id];
    });
  });

  const boton = (nombre) => screen.getByRole('button', { name: nombre });
  const textoDeLaLista = () => document.querySelector('#playlist-content')?.textContent
    ?? document.body.textContent;

  it('sin preferencias, las notas', async () => {
    await renderLista();
    expect(boton('Notas')).toHaveAttribute('aria-pressed', 'true');
    expect(contenidoDeCancion(0)).toMatch(/Cristo vive hoy/);
  });

  it('quien toca guitarra entra en los acordes, en concierto y transpuestos con la lista', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultInstrument: 'c_guitar' });
    await renderLista();

    await waitFor(() => expect(boton('Acordes')).toHaveAttribute('aria-pressed', 'true'));
    expect(contenidoDeCancion(0)).toBe('SOL RE MIm DO');
    // Y la tonalidad de la etiqueta es la que lee: SOL, no el LA de Sib
    expect(document.querySelectorAll('.playlist-song-key')[0]).toHaveTextContent('SOL');
  });

  it('una canción sin acordes enseña sus notas y lo dice', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultInstrument: 'c_guitar' });
    await renderLista();

    expect(await screen.findByText(/aún no tiene acordes: se muestran las notas/)).toBeInTheDocument();
    expect(textoDeLaLista()).toMatch(/Sublime gracia/);
  });

  it('quien canta entra en la letra, sin líneas de notas', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultInstrument: 'c_voice' });
    await renderLista();

    await waitFor(() => expect(boton('Letra')).toHaveAttribute('aria-pressed', 'true'));
    expect(contenidoDeCancion(0)).toMatch(/Cristo vive hoy/);
    expect(contenidoDeCancion(0)).not.toMatch(/SOL/);
  });

  it('se cambia para todas desde el selector', async () => {
    await renderLista();
    fireEvent.click(boton('Acordes'));

    expect(boton('Acordes')).toHaveAttribute('aria-pressed', 'true');
    // Para la trompeta, un tono arriba del concierto (SOL -> LA)
    expect(contenidoDeCancion(0)).toBe('LA MI FA#m RE');
  });
});

describe('PlaylistView: la voz de cada músico', () => {
  const A_DOS_VOCES = {
    ...CANCIONES.s1,
    primaryInstrument: 'bb_trumpet',
    primaryVoiceNumber: '1',
    voices: {
      bb_trumpet: {
        1: '## Verso\nDO SOL\nPrimera voz',
        2: '## Verso\nMI SI\nSegunda voz'
      }
    }
  };

  beforeEach(() => {
    mockGetSongById.mockImplementation(async (id) => (id === 's1' ? A_DOS_VOCES : CANCIONES[id]));
  });

  it('la trompeta 1 lee la primera voz', async () => {
    await renderLista();
    expect(contenidoDeCancion(0)).toMatch(/Primera voz/);
  });

  it('la trompeta 3 lee la segunda, la más alta que tiene la canción', async () => {
    localStorage.setItem('numeroDeVoz', '3');
    await renderLista();
    expect(contenidoDeCancion(0)).toMatch(/Segunda voz/);
  });

  it('se cambia desde "Mi voz" y se recuerda', async () => {
    await renderLista();
    fireEvent.click(screen.getByRole('combobox', { name: 'Mi voz' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: '2ª' }));

    await waitFor(() => expect(contenidoDeCancion(0)).toMatch(/Segunda voz/));
    expect(localStorage.getItem('numeroDeVoz')).toBe('2');
  });
});

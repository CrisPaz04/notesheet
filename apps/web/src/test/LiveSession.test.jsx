// Pantalla de sesión en vivo.
//
// Lo que más importa comprobar aquí es la frontera: qué controles escriben en
// la sesión (y le cambian la pantalla a los doce) y cuáles son de este
// dispositivo y no viajan a ningún sitio. Confundirlos es el fallo que dejaría
// a la banda entera leyendo el papel de trompeta.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const acciones = {
  irACancion: vi.fn(),
  siguiente: vi.fn(),
  anterior: vi.fn(),
  cambiarTonalidad: vi.fn(),
  moverCancion: vi.fn(),
  quitarCancion: vi.fn(),
  cerrarSesion: vi.fn(),
  salir: vi.fn(),
  anunciarInstrumento: vi.fn()
};

const SONGS = [
  { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' },
  { id: 's2', title: 'Sublime Gracia', key: 'SOL', originalKey: 'SOL' }
];

let estadoSesion;
let estadoCancion;

vi.mock('../hooks/useLiveSession', () => ({
  default: () => estadoSesion
}));

vi.mock('../hooks/useLiveSongContent', () => ({
  default: () => estadoCancion
}));

const mockGetUserPreferences = vi.fn();
const mockSignInAsGuest = vi.fn();
vi.mock('@notesheet/api', () => ({
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  signInAsGuest: (...a) => mockSignInAsGuest(...a),
  updateUserPreferences: vi.fn().mockResolvedValue({})
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useParams: () => ({ code: 'K7M2QX' }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

let auth;
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));

const { default: LiveSession } = await import('../pages/LiveSession');

const sesionEnVivo = (extra = {}) => ({
  session: { id: 'K7M2QX', name: 'Domingo', hostId: 'u1', updatedBy: { name: 'Ana' } },
  songs: SONGS,
  activeSongId: 's1',
  activeIndex: 0,
  activeSong: SONGS[0],
  estado: 'live',
  error: '',
  sinRed: false,
  participants: [{ uid: 'u1', name: 'Cristhian', isOnline: true }],
  isHost: false,
  ...acciones,
  ...extra
});

const cancionRenderizada = (extra = {}) => ({
  rendered: {
    displayKey: 'DO',
    formatted: { sections: [{ title: 'Verso', content: 'DO SOL\nCristo vive' }] }
  },
  voices: [
    { id: 'bb_trumpet-1', label: 'Trompeta en Sib 1' },
    { id: 'bb_trumpet-2', label: 'Trompeta en Sib 2' }
  ],
  voiceKey: 'bb_trumpet-1',
  loading: false,
  error: '',
  ...extra
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth = { currentUser: { uid: 'u1', displayName: 'Cristhian' }, loading: false };
  estadoSesion = sesionEnVivo();
  estadoCancion = cancionRenderizada();
  mockGetUserPreferences.mockResolvedValue({});
});

describe('quién puede entrar', () => {
  it('pide un nombre a quien llega sin cuenta', () => {
    auth = { currentUser: null, loading: false };
    render(<LiveSession />);

    expect(screen.getByText('Te invitaron a una sesión')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Tu nombre')).toBeInTheDocument();
  });

  it('el invitado entra con el nombre que puso', async () => {
    auth = { currentUser: null, loading: false };
    mockSignInAsGuest.mockResolvedValue({ uid: 'anon' });
    render(<LiveSession />);

    await userEvent.type(screen.getByPlaceholderText('Tu nombre'), 'Pedro');
    await userEvent.click(screen.getByRole('button', { name: /entrar a la sesión/i }));

    expect(mockSignInAsGuest).toHaveBeenCalledWith('Pedro');
  });

  // Si el proveedor anónimo no está habilitado en Firebase, el botón no puede
  // limitarse a no hacer nada.
  it('avisa si las entradas de invitado no están habilitadas', async () => {
    auth = { currentUser: null, loading: false };
    mockSignInAsGuest.mockRejectedValue(
      Object.assign(new Error('nope'), { code: 'auth/operation-not-allowed' })
    );
    render(<LiveSession />);

    await userEvent.click(screen.getByRole('button', { name: /entrar a la sesión/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no están habilitadas/i);
  });
});

describe('estados de la sesión', () => {
  it('dice que el código no existe', () => {
    estadoSesion = sesionEnVivo({ estado: 'missing' });
    render(<LiveSession />);

    expect(screen.getByText('No encontramos esa sesión')).toBeInTheDocument();
    expect(screen.getByText('K7M2QX')).toBeInTheDocument();
  });

  it('dice que la sesión terminó', () => {
    estadoSesion = sesionEnVivo({ estado: 'ended' });
    render(<LiveSession />);

    expect(screen.getByText('La sesión terminó')).toBeInTheDocument();
  });

  // Firestore sigue sirviendo desde la caché sin red: la pantalla se ve
  // perfecta mientras los cambios del director ya no llegan.
  it('avisa cuando se cayó la red', () => {
    estadoSesion = sesionEnVivo({ sinRed: true });
    render(<LiveSession />);

    expect(screen.getByRole('status')).toHaveTextContent(/sin conexión/i);
  });

  it('no avisa de nada si todo va bien', () => {
    render(<LiveSession />);
    expect(screen.queryByText(/sin conexión/i)).not.toBeInTheDocument();
  });
});

describe('la canción', () => {
  it('muestra el título y el contenido renderizado', () => {
    render(<LiveSession />);

    expect(screen.getByRole('heading', { name: 'Cristo Vive' })).toBeInTheDocument();
    expect(screen.getByText(/Cristo vive/)).toBeInTheDocument();
  });

  // Dos insignias porque son dos cosas distintas, y llamarlas igual es lo que
  // hace que dos músicos hablando de "la de RE" no hablen de lo mismo.
  it('separa la tonalidad de la banda de la que lee este músico', () => {
    estadoCancion = cancionRenderizada({
      rendered: { ...cancionRenderizada().rendered, displayKey: 'SOL' }
    });
    render(<LiveSession />);

    expect(screen.getByTitle(/igual para todos/i)).toHaveTextContent('DO');
    expect(screen.getByTitle(/lees tú/i)).toHaveTextContent('SOL');
  });

  it('no repite la insignia cuando coinciden', () => {
    render(<LiveSession />);
    expect(screen.queryByTitle(/lees tú/i)).not.toBeInTheDocument();
  });

  it('avisa si la canción no se pudo cargar', () => {
    estadoCancion = cancionRenderizada({ error: 'No se pudo cargar esta canción.' });
    render(<LiveSession />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo cargar/i);
  });
});

describe('lo compartido', () => {
  it('avanzar de canción le cambia la pantalla a todos', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(acciones.siguiente).toHaveBeenCalled();
  });

  it('no deja retroceder en la primera', () => {
    render(<LiveSession />);
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
  });

  it('no deja avanzar en la última', () => {
    estadoSesion = sesionEnVivo({ activeIndex: 1, activeSongId: 's2', activeSong: SONGS[1] });
    render(<LiveSession />);

    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
  });

  it('saltar a una canción desde la lista', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ir a Sublime Gracia' }));

    expect(acciones.irACancion).toHaveBeenCalledWith('s2');
  });

  // La tonalidad es lo que más se toca en vivo, y tiene que cambiar la de la
  // canción que se pulsó y no la de otra.
  it('cambiar la tonalidad de una canción concreta de la lista', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));

    // El desplegable de cada canción muestra su tonalidad actual.
    await userEvent.click(screen.getByRole('button', { name: 'SOL' }));
    await userEvent.click(screen.getByRole('button', { name: 'RE', exact: true }));

    expect(acciones.cambiarTonalidad).toHaveBeenCalledWith('s2', 'RE');
  });

  it('volver a la tonalidad original desde la lista', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'DO' }));
    await userEvent.click(screen.getByRole('button', { name: /Original \(DO\)/ }));

    expect(acciones.cambiarTonalidad).toHaveBeenCalledWith('s1', 'DO');
  });

  it('reordenar la lista', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));
    await userEvent.click(screen.getByRole('button', { name: /Bajar Cristo Vive/ }));

    expect(acciones.moverCancion).toHaveBeenCalledWith(0, 1);
  });

  it('quitar una canción', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));
    await userEvent.click(screen.getByRole('button', { name: /Quitar Cristo Vive/ }));

    expect(acciones.quitarCancion).toHaveBeenCalledWith('s1');
  });

  it('el anfitrión puede terminar la sesión', async () => {
    estadoSesion = sesionEnVivo({ isHost: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LiveSession />);

    await userEvent.click(screen.getByRole('button', { name: /terminar/i }));
    expect(acciones.cerrarSesion).toHaveBeenCalled();
  });

  it('terminar la sesión se puede cancelar', async () => {
    estadoSesion = sesionEnVivo({ isHost: true });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LiveSession />);

    await userEvent.click(screen.getByRole('button', { name: /terminar/i }));
    expect(acciones.cerrarSesion).not.toHaveBeenCalled();
  });

  it('quien no es anfitrión solo puede salir', () => {
    render(<LiveSession />);

    expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /terminar/i })).not.toBeInTheDocument();
  });
});

describe('lo mío', () => {
  // La frontera entera en un test: cambiar de instrumento no puede tocar la
  // sesión, o al saxo alto le cambiaría el papel a toda la banda.
  it('cambiar de instrumento no escribe en la sesión', async () => {
    render(<LiveSession />);

    await userEvent.selectOptions(
      screen.getByLabelText('Mi instrumento'),
      'eb_alto_sax'
    );

    expect(acciones.cambiarTonalidad).not.toHaveBeenCalled();
    expect(acciones.irACancion).not.toHaveBeenCalled();
    expect(acciones.moverCancion).not.toHaveBeenCalled();
  });

  it('el instrumento se recuerda en este dispositivo', async () => {
    render(<LiveSession />);
    await userEvent.selectOptions(screen.getByLabelText('Mi instrumento'), 'c_flute');

    expect(localStorage.getItem('live:instrumento')).toBe('c_flute');
  });

  it('la notación se recuerda en este dispositivo', async () => {
    render(<LiveSession />);
    await userEvent.selectOptions(screen.getByLabelText('Notación'), 'english');

    expect(localStorage.getItem('live:notacion')).toBe('english');
  });

  it('anuncia a los demás qué instrumento toco', async () => {
    render(<LiveSession />);

    await waitFor(() =>
      expect(acciones.anunciarInstrumento).toHaveBeenCalledWith('bb_trumpet', '1')
    );
  });

  it('ofrece elegir voz cuando la canción tiene varias', () => {
    render(<LiveSession />);
    expect(screen.getByLabelText('Mi voz')).toBeInTheDocument();
  });

  // Un selector con una sola opción no es una elección, es ruido en una
  // pantalla que se mira de reojo mientras se toca.
  it('no ofrece elegir voz cuando solo hay una', () => {
    estadoCancion = cancionRenderizada({ voices: [{ id: 'bb_trumpet-1', label: 'Única' }] });
    render(<LiveSession />);

    expect(screen.queryByLabelText('Mi voz')).not.toBeInTheDocument();
  });

  it('salir vuelve a las listas', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /salir/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/playlists'));
  });
});

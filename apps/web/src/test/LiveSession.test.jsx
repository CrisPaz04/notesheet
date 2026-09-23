// Pantalla de sesión en vivo.
//
// Dos cosas importan aquí. Una, la frontera: qué controles escriben en la
// sesión (y le cambian la pantalla a los doce) y cuáles son de este
// dispositivo. Dos, que se vean TODAS las canciones a la vez: en los enlaces
// rápidos hace falta el final de una y el principio de la siguiente.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const acciones = {
  irACancion: vi.fn(),
  siguiente: vi.fn(),
  anterior: vi.fn(),
  cambiarTonalidad: vi.fn(),
  moverCancion: vi.fn(),
  agregarCancion: vi.fn(),
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
let estadoLista;

// Lo que la página le pasa al hook de contenido: es la única forma de ver
// desde fuera que la voz se guarda por canción y no en común.
let argsLista;

vi.mock('../hooks/useLiveSession', () => ({ default: () => estadoSesion }));
vi.mock('../hooks/useLiveSetlistContent', () => ({
  default: (args) => { argsLista = args; return estadoLista; }
}));

const mockGetUserPreferences = vi.fn();
const mockGetAllSongs = vi.fn();
const mockSignInAsGuest = vi.fn();
const mockUpdateUserPreferences = vi.fn();
vi.mock('@notesheet/api', () => ({
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  getAllSongs: (...a) => mockGetAllSongs(...a),
  signInAsGuest: (...a) => mockSignInAsGuest(...a),
  updateUserPreferences: (...a) => mockUpdateUserPreferences(...a)
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
  estado: 'live',
  error: '',
  sinRed: false,
  participants: [{ uid: 'u1', name: 'Cristhian', isOnline: true }],
  isHost: false,
  ...acciones,
  ...extra
});

const cancion = (base, extra = {}) => ({
  ...base,
  voices: [],
  voiceKey: null,
  error: null,
  rendered: {
    displayKey: base.key,
    formatted: { sections: [{ title: 'Verso', content: `Acordes de ${base.title}` }] }
  },
  ...extra
});

const listaCargada = (extra = {}) => ({
  canciones: SONGS.map((s) => cancion(s)),
  loading: false,
  ...extra
});

/** La tarjeta de una canción concreta. */
const tarjeta = (titulo) =>
  screen.getByRole('heading', { name: titulo }).closest('article');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  auth = { currentUser: { uid: 'u1', displayName: 'Cristhian' }, loading: false };
  estadoSesion = sesionEnVivo();
  estadoLista = listaCargada();
  mockGetUserPreferences.mockResolvedValue({});
  mockUpdateUserPreferences.mockResolvedValue({});
  mockGetAllSongs.mockResolvedValue([]);
  // jsdom no implementa scrollIntoView.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('todas las canciones a la vez', () => {
  // El cambio de fondo: antes se veía una sola y en los enlaces rápidos eso
  // es justo cuando no se puede apartar la vista del papel.
  it('muestra la lista entera, no solo la activa', () => {
    render(<LiveSession />);

    expect(screen.getByRole('heading', { name: 'Cristo Vive' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sublime Gracia' })).toBeInTheDocument();
    expect(screen.getByText('Acordes de Cristo Vive')).toBeInTheDocument();
    expect(screen.getByText('Acordes de Sublime Gracia')).toBeInTheDocument();
  });

  it('marca cuál está sonando sin esconder las demás', () => {
    render(<LiveSession />);

    expect(within(tarjeta('Cristo Vive')).getByText('Ahora')).toBeInTheDocument();
    expect(within(tarjeta('Sublime Gracia')).queryByText('Ahora')).not.toBeInTheDocument();
    expect(tarjeta('Sublime Gracia')).toBeVisible();
  });

  it('avisa por canción cuando una no se pudo cargar', () => {
    estadoLista = listaCargada({
      canciones: [
        cancion(SONGS[0], { rendered: null, error: 'Esta canción no está disponible' }),
        cancion(SONGS[1])
      ]
    });
    render(<LiveSession />);

    expect(screen.getByRole('alert')).toHaveTextContent(/no está disponible/);
    expect(screen.getByText('Acordes de Sublime Gracia')).toBeInTheDocument();
  });
});

describe('navegación compartida', () => {
  it('siguiente mueve el puntero de todos', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(acciones.siguiente).toHaveBeenCalled();
  });

  it('no deja retroceder en la primera ni avanzar en la última', () => {
    render(<LiveSession />);
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();

    estadoSesion = sesionEnVivo({ activeIndex: 1, activeSongId: 's2' });
    render(<LiveSession />);
    expect(screen.getAllByRole('button', { name: /siguiente/i }).at(-1)).toBeDisabled();
  });

  // El scroll va detrás del puntero: pulsar Siguiente tiene que llevarte a la
  // canción, no solo marcarla.
  it('al cambiar de canción el scroll va detrás', async () => {
    const { rerender } = render(<LiveSession />);
    Element.prototype.scrollIntoView.mockClear();

    estadoSesion = sesionEnVivo({ activeSongId: 's2', activeIndex: 1 });
    rerender(<LiveSession />);

    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  });

  it('el índice deja saltar a una canción', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Ir a Sublime Gracia' }));

    expect(acciones.irACancion).toHaveBeenCalledWith('s2');
  });
});

describe('seguir al director', () => {
  // Quien va mirando dos canciones por delante no quiere que le devuelvan el
  // scroll cada vez que el director avanza.
  it('apagado, un cambio de otro no mueve el scroll', async () => {
    const { rerender } = render(<LiveSession />);
    await userEvent.click(screen.getByLabelText(/seguir al director/i));
    Element.prototype.scrollIntoView.mockClear();

    estadoSesion = sesionEnVivo({ activeSongId: 's2', activeIndex: 1 });
    rerender(<LiveSession />);

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  // El interruptor gobierna los cambios de OTROS. Si lo apago y luego pulso
  // Siguiente yo, tengo que ir a donde he pulsado: un botón que no te lleva a
  // donde dice es peor que no tenerlo.
  it('mi propio salto me lleva aunque lo tenga apagado', async () => {
    const { rerender } = render(<LiveSession />);
    await userEvent.click(screen.getByLabelText(/seguir al director/i));
    Element.prototype.scrollIntoView.mockClear();

    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    estadoSesion = sesionEnVivo({ activeSongId: 's2', activeIndex: 1 });
    rerender(<LiveSession />);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  // El efecto depende también del interruptor: sin guardar cuál fue la última
  // canción activa, tocarlo te devolvería el scroll a la que va la banda.
  it('tocar el interruptor no mueve el scroll', async () => {
    render(<LiveSession />);
    Element.prototype.scrollIntoView.mockClear();

    const toggle = screen.getByLabelText(/seguir al director/i);
    await userEvent.click(toggle);
    await userEvent.click(toggle);

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('se recuerda en este dispositivo', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByLabelText(/seguir al director/i));

    expect(localStorage.getItem('live:seguir')).toBe('no');
  });
});

describe('cabecera fija', () => {
  // El fallo que apareció usándolo: solo se pegaba la barra de estado, así que
  // al bajar por la canción había que volver arriba para pasar a la siguiente.
  it('la navegación va dentro de la cabecera que se queda fija', () => {
    render(<LiveSession />);

    const cabecera = document.querySelector('.live-header');
    expect(cabecera).toBeInTheDocument();
    expect(within(cabecera).getByRole('button', { name: /siguiente/i })).toBeInTheDocument();
    expect(within(cabecera).getByRole('button', { name: /anterior/i })).toBeInTheDocument();
    expect(within(cabecera).getByRole('button', { name: /compartir/i })).toBeInTheDocument();
  });

  // Las canciones no: son justo lo que tiene que poder scrollear.
  it('las canciones se quedan fuera de la cabecera', () => {
    render(<LiveSession />);

    const cabecera = document.querySelector('.live-header');
    expect(within(cabecera).queryByRole('heading', { name: 'Cristo Vive' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cristo Vive' })).toBeInTheDocument();
  });

  // Fijarlo todo tiene un precio en un móvil: instrumento, notación, tamaño y
  // seguir se comen la pantalla que hace falta para leer.
  it('los ajustes propios se pliegan y el dispositivo lo recuerda', async () => {
    render(<LiveSession />);
    expect(screen.getByLabelText('Mi instrumento')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: /mis ajustes/i }));

    expect(localStorage.getItem('live:ajustes')).toBe('no');
    expect(document.querySelector('.live-controls')).toHaveClass('plegado');
  });

  it('plegado sigue diciendo qué instrumento estás leyendo', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /mis ajustes/i }));

    expect(screen.getByRole('button', { name: /mis ajustes/i }))
      .toHaveTextContent(/Trompeta en Sib/);
  });

  it('arranca desplegado la primera vez', () => {
    render(<LiveSession />);

    expect(screen.getByRole('button', { name: /mis ajustes/i }))
      .toHaveAttribute('aria-expanded', 'true');
  });
});

describe('controles a la vista', () => {
  // La primera versión los escondió detrás de un botón que no parecía un
  // botón, y no los encontró nadie.
  it('cada canción trae su selector de tonalidad sin abrir nada', () => {
    render(<LiveSession />);

    expect(within(tarjeta('Cristo Vive')).getByRole('button', { name: 'DO' })).toBeInTheDocument();
    expect(within(tarjeta('Sublime Gracia')).getByRole('button', { name: 'SOL' })).toBeInTheDocument();
  });

  it('cambiar la tonalidad afecta a la canción que se pulsó', async () => {
    render(<LiveSession />);

    await userEvent.click(within(tarjeta('Sublime Gracia')).getByRole('button', { name: 'SOL' }));
    await userEvent.click(screen.getByRole('button', { name: 'RE' }));

    expect(acciones.cambiarTonalidad).toHaveBeenCalledWith('s2', 'RE');
  });

  it('quitar una canción desde su propia tarjeta', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /Quitar Cristo Vive/ }));

    expect(acciones.quitarCancion).toHaveBeenCalledWith('s1');
  });

  it('reordenar desde la tarjeta', async () => {
    render(<LiveSession />);
    await userEvent.click(screen.getByRole('button', { name: /Bajar Cristo Vive/ }));

    expect(acciones.moverCancion).toHaveBeenCalledWith(0, 1);
  });

  it('no deja subir la primera ni bajar la última', () => {
    render(<LiveSession />);

    expect(screen.getByRole('button', { name: /Subir Cristo Vive/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Bajar Sublime Gracia/ })).toBeDisabled();
  });

  // La voz es por canción: en una puedo leer la segunda trompeta y en la
  // siguiente la primera, y elegir en una no puede cambiar la otra.
  it('la voz elegida se guarda para esa canción sola', async () => {
    const VOCES = [
      { id: 'bb_trumpet-1', label: 'Trompeta 1' },
      { id: 'bb_trumpet-2', label: 'Trompeta 2' }
    ];
    estadoLista = listaCargada({
      canciones: SONGS.map((s) => cancion(s, { voices: VOCES, voiceKey: 'bb_trumpet-1' }))
    });
    render(<LiveSession />);

    await userEvent.selectOptions(
      screen.getByLabelText(/Voz para Cristo Vive/),
      'bb_trumpet-2'
    );

    expect(argsLista.voiceKeys).toEqual({ s1: 'bb_trumpet-2' });
  });

  it('cambiar de instrumento suelta las voces elegidas a mano', async () => {
    const VOCES = [
      { id: 'bb_trumpet-1', label: 'Trompeta 1' },
      { id: 'bb_trumpet-2', label: 'Trompeta 2' }
    ];
    estadoLista = listaCargada({
      canciones: SONGS.map((s) => cancion(s, { voices: VOCES, voiceKey: 'bb_trumpet-1' }))
    });
    render(<LiveSession />);

    await userEvent.selectOptions(screen.getByLabelText(/Voz para Cristo Vive/), 'bb_trumpet-2');
    await userEvent.selectOptions(screen.getByLabelText('Mi instrumento'), 'eb_alto_sax');

    expect(argsLista.voiceKeys).toEqual({});
  });

  it('la voz solo se ofrece en las canciones que tienen varias', () => {
    estadoLista = listaCargada({
      canciones: [
        cancion(SONGS[0], {
          voices: [
            { id: 'bb_trumpet-1', label: 'Trompeta 1' },
            { id: 'bb_trumpet-2', label: 'Trompeta 2' }
          ],
          voiceKey: 'bb_trumpet-1'
        }),
        cancion(SONGS[1])
      ]
    });
    render(<LiveSession />);

    expect(screen.getByLabelText(/Voz para Cristo Vive/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Voz para Sublime Gracia/)).not.toBeInTheDocument();
  });

  // Dos insignias porque son dos cosas distintas, y llamarlas igual es lo que
  // hace que dos músicos hablando de "la de RE" no hablen de lo mismo.
  it('separa la tonalidad de la banda de la que lee este músico', () => {
    estadoLista = listaCargada({
      canciones: [
        cancion(SONGS[0], {
          rendered: {
            displayKey: 'MI',
            formatted: { sections: [{ title: 'Verso', content: 'x' }] }
          }
        }),
        cancion(SONGS[1])
      ]
    });
    render(<LiveSession />);

    const card = tarjeta('Cristo Vive');
    expect(within(card).getByText('Banda')).toBeInTheDocument();
    expect(within(card).getByText('Tú')).toBeInTheDocument();
    expect(within(card).getByText('MI')).toBeInTheDocument();
  });

  it('no pinta la insignia propia cuando coincide', () => {
    render(<LiveSession />);
    expect(within(tarjeta('Cristo Vive')).queryByText('Tú')).not.toBeInTheDocument();
  });
});

describe('añadir canciones en vivo', () => {
  // No existía: la acción estaba en el hook y no había nada en pantalla que
  // la llamara.
  it('el repertorio se pide solo al abrir el panel', async () => {
    mockGetAllSongs.mockResolvedValue([{ id: 's9', title: 'Nueva', key: 'LA' }]);
    render(<LiveSession />);

    expect(mockGetAllSongs).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /añadir una canción/i }));
    await waitFor(() => expect(mockGetAllSongs).toHaveBeenCalledWith('u1'));
  });

  it('añade la canción elegida a la sesión', async () => {
    const NUEVA = { id: 's9', title: 'Nueva', key: 'LA' };
    mockGetAllSongs.mockResolvedValue([NUEVA]);
    render(<LiveSession />);

    await userEvent.click(screen.getByRole('button', { name: /añadir una canción/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Nueva/ }));

    expect(acciones.agregarCancion).toHaveBeenCalledWith(NUEVA);
  });

  it('no ofrece las que ya están en la sesión', async () => {
    mockGetAllSongs.mockResolvedValue([
      { id: 's1', title: 'Cristo Vive', key: 'DO' },
      { id: 's9', title: 'Nueva', key: 'LA' }
    ]);
    render(<LiveSession />);

    await userEvent.click(screen.getByRole('button', { name: /añadir una canción/i }));
    await screen.findByRole('button', { name: /Nueva/ });

    // Acotado a la lista de resultados: "Cristo Vive" sigue en pantalla como
    // tarjeta de la sesión, y buscarlo en todo el documento haría pasar el
    // test aunque el filtro no existiera.
    const resultados = screen.getByRole('list', { name: /canciones que puedes añadir/i });
    expect(within(resultados).getByRole('button', { name: /Nueva/ })).toBeInTheDocument();
    expect(within(resultados).queryByRole('button', { name: /Cristo Vive/ })).not.toBeInTheDocument();
  });

  it('busca por título', async () => {
    mockGetAllSongs.mockResolvedValue([
      { id: 's8', title: 'Alabaré', key: 'DO' },
      { id: 's9', title: 'Nueva', key: 'LA' }
    ]);
    render(<LiveSession />);

    await userEvent.click(screen.getByRole('button', { name: /añadir una canción/i }));
    await userEvent.type(await screen.findByLabelText(/buscar una canción/i), 'alab');

    expect(screen.getByRole('button', { name: /Alabaré/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nueva/ })).not.toBeInTheDocument();
  });
});

describe('lo mío', () => {
  it('cambiar de instrumento no escribe en la sesión', async () => {
    render(<LiveSession />);
    await userEvent.selectOptions(screen.getByLabelText('Mi instrumento'), 'eb_alto_sax');

    expect(acciones.cambiarTonalidad).not.toHaveBeenCalled();
    expect(acciones.irACancion).not.toHaveBeenCalled();
    expect(acciones.moverCancion).not.toHaveBeenCalled();
    expect(localStorage.getItem('live:instrumento')).toBe('eb_alto_sax');
  });

  it('la notación se recuerda en este dispositivo', async () => {
    render(<LiveSession />);
    await userEvent.selectOptions(screen.getByLabelText('Notación'), 'english');

    expect(localStorage.getItem('live:notacion')).toBe('english');
  });

  it('con cuenta, arranca con la notación del perfil', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
    render(<LiveSession />);

    await waitFor(() => expect(screen.getByLabelText('Notación')).toHaveValue('english'));
  });

  it('con cuenta, cambiarla la guarda también en el perfil', async () => {
    render(<LiveSession />);
    await userEvent.selectOptions(screen.getByLabelText('Notación'), 'english');

    await waitFor(() =>
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u1', { defaultNotationSystem: 'english' })
    );
  });

  it('en C-D-E, la tonalidad de la banda y el índice salen en C-D-E', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
    render(<LiveSession />);

    await waitFor(() => expect(screen.getByLabelText('Notación')).toHaveValue('english'));
    expect(within(tarjeta('Cristo Vive')).getByRole('button', { name: /^C$/ })).toBeInTheDocument();
    expect(within(tarjeta('Sublime Gracia')).getByRole('button', { name: /^G$/ })).toBeInTheDocument();
  });

  it('en C-D-E, el índice y el buscador para añadir también', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
    mockGetAllSongs.mockResolvedValue([{ id: 's9', title: 'Nueva', key: 'LA' }]);
    render(<LiveSession />);
    await waitFor(() => expect(screen.getByLabelText('Notación')).toHaveValue('english'));

    await userEvent.click(screen.getByRole('button', { name: /1 de 2/ }));
    const indice = document.querySelector('.live-setlist');
    expect([...indice.querySelectorAll('.live-setlist-key')].map((e) => e.textContent)).toEqual(['C', 'G']);

    await userEvent.click(screen.getByRole('button', { name: /añadir una canción/i }));
    const nueva = await screen.findByRole('button', { name: /Nueva/ });
    expect(nueva.querySelector('.live-add-meta')).toHaveTextContent(/^A$/);
  });

  it('un invitado sin cuenta conserva la que eligió en su dispositivo', async () => {
    auth = { currentUser: { uid: 'anon', isAnonymous: true }, loading: false };
    localStorage.setItem('live:notacion', 'english');
    render(<LiveSession />);

    expect(screen.getByLabelText('Notación')).toHaveValue('english');
    await userEvent.selectOptions(screen.getByLabelText('Notación'), 'latin');
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
    expect(localStorage.getItem('live:notacion')).toBe('latin');
  });

  it('anuncia a los demás qué instrumento toco', async () => {
    render(<LiveSession />);
    await waitFor(() =>
      expect(acciones.anunciarInstrumento).toHaveBeenCalledWith('bb_trumpet', null)
    );
  });
});

describe('estados de la sesión', () => {
  it('dice que el código no existe', () => {
    estadoSesion = sesionEnVivo({ estado: 'missing' });
    render(<LiveSession />);

    expect(screen.getByText('No encontramos esa sesión')).toBeInTheDocument();
  });

  it('dice que la sesión terminó', () => {
    estadoSesion = sesionEnVivo({ estado: 'ended' });
    render(<LiveSession />);

    expect(screen.getByText('La sesión terminó')).toBeInTheDocument();
  });

  it('avisa cuando se cayó la red', () => {
    estadoSesion = sesionEnVivo({ sinRed: true });
    render(<LiveSession />);

    expect(screen.getByRole('status')).toHaveTextContent(/sin conexión/i);
  });

  it('pide un nombre a quien llega sin cuenta', () => {
    auth = { currentUser: null, loading: false };
    render(<LiveSession />);

    expect(screen.getByText('Te invitaron a una sesión')).toBeInTheDocument();
  });

  it('el anfitrión puede terminar; el resto solo salir', async () => {
    render(<LiveSession />);
    expect(screen.getByRole('button', { name: /salir/i })).toBeInTheDocument();

    estadoSesion = sesionEnVivo({ isHost: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LiveSession />);

    await userEvent.click(screen.getAllByRole('button', { name: /terminar/i })[0]);
    expect(acciones.cerrarSesion).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
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
const mockGetUserPreferences = vi.fn();
const mockBuscarDatos = vi.fn();

vi.mock('@notesheet/api', () => ({
  getSongById: (...a) => mockGetSongById(...a),
  createSong: (...a) => mockCreateSong(...a),
  updateSong: (...a) => mockUpdateSong(...a),
  addVoiceToSong: (...a) => mockAddVoiceToSong(...a),
  removeVoiceFromSong: (...a) => mockRemoveVoiceFromSong(...a),
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: vi.fn().mockResolvedValue({}),
  buscarDatosDeCancion: (...a) => mockBuscarDatos(...a)
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
  mockGetUserPreferences.mockResolvedValue({});
  localStorage.clear();
  // handleRemoveVoice pide confirmación al usuario
  vi.stubGlobal('confirm', vi.fn(() => true));
});

const renderEditor = async () => {
  render(<SongEditor />);
  await screen.findByDisplayValue('Cristo Vive');
};

// Cada pestaña de voz son dos botones hermanos: el que la elige, que se
// llama como la voz, y el que la quita ("Quitar Trompeta en Sib 2").
const pestana = (n) => screen.getByRole('button', { name: new RegExp(`^Trompeta.*${n}`) });
const botonQuitar = (n) => screen.queryByRole('button', { name: new RegExp(`^Quitar Trompeta.*${n}`) });

describe('SongEditor', () => {
  it('carga los datos de una canción existente', async () => {
    await renderEditor();
    expect(screen.getByDisplayValue('Cristo Vive')).toBeInTheDocument();
    expect(mockGetSongById).toHaveBeenCalledWith('song-1');
  });

  it('muestra una pestaña por voz más la de solo letra', async () => {
    await renderEditor();
    expect(pestana(1)).toBeInTheDocument();
    expect(pestana(2)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Solo Letra/ })).toBeInTheDocument();
  });

  it('abre la voz primaria al cargar', async () => {
    await renderEditor();
    expect(screen.getByLabelText('editor')).toHaveValue('## Intro\nDO SOL\n');
  });

  it('cambia el contenido del editor al cambiar de pestaña', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(pestana(2));

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
    await user.click(pestana(2));
    await waitFor(() => {
      expect(screen.getByLabelText('editor')).toHaveValue('## Intro\nMI SI\n');
    });
  });

  it('elimina una voz secundaria y persiste el cambio', async () => {
    const user = userEvent.setup();
    await renderEditor();

    await user.click(botonQuitar(2));

    await waitFor(() => {
      expect(mockRemoveVoiceFromSong).toHaveBeenCalledWith('song-1', 'bb_trumpet', '2');
    });
    expect(screen.queryByRole('button', { name: /^Trompeta.*2/ })).not.toBeInTheDocument();
  });

  it('no ofrece cerrar la voz primaria', async () => {
    await renderEditor();
    expect(botonQuitar(2)).toBeInTheDocument();
    expect(botonQuitar(1)).not.toBeInTheDocument();
  });

  it('respeta la cancelación del usuario al eliminar una voz', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    const user = userEvent.setup();
    await renderEditor();

    await user.click(botonQuitar(2));

    expect(mockRemoveVoiceFromSong).not.toHaveBeenCalled();
    expect(pestana(2)).toBeInTheDocument();
  });

  it('quitar una voz no la selecciona', async () => {
    // Se cancela para que la pestaña siga ahí: si el clic en quitar llegara
    // también al de elegir, el editor habría saltado a la voz 2.
    vi.stubGlobal('confirm', vi.fn(() => false));
    const user = userEvent.setup();
    await renderEditor();
    expect(pestana(1)).toHaveAttribute('aria-current', 'true');

    await user.click(botonQuitar(2));

    expect(confirm).toHaveBeenCalled();
    expect(screen.getByLabelText('editor')).toHaveValue('## Intro\nDO SOL\n');
    expect(pestana(1)).toHaveAttribute('aria-current', 'true');
    expect(pestana(2)).not.toHaveAttribute('aria-current');
  });

  it('el botón de quitar no va dentro del de elegir', async () => {
    // Un botón dentro de otro es HTML inválido y el de dentro no se
    // alcanza bien con teclado ni con lector de pantalla.
    await renderEditor();
    expect(pestana(2)).not.toContainElement(botonQuitar(2));
    expect(document.querySelector('button button')).toBeNull();
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

describe('SongEditor: letra de una canción que no la tiene guardada', () => {
  it('la saca sin las notas de la banda y sin comerse palabras', async () => {
    const user = userEvent.setup();
    const content = '## Coro\nRe# Mi Fa# Sol#\nA Dios sea la gloria\nE ahí viene el Rey\n';
    mockGetSongById.mockResolvedValue({
      ...SONG, content, lyricsOnly: '', voices: { bb_trumpet: { 1: content } }
    });
    await renderEditor();

    await user.click(screen.getByRole('button', { name: /Solo Letra/ }));

    expect(screen.getByLabelText('editor')).toHaveValue(
      // La línea de notas deja un hueco, como en el resto de la app
      '## Coro\n\nA Dios sea la gloria\nE ahí viene el Rey'
    );
  });

  it('ya no ofrece el botón de generarla', async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.click(screen.getByRole('button', { name: /Solo Letra/ }));
    expect(screen.queryByRole('button', { name: /Generar letra/ })).not.toBeInTheDocument();
  });
});

describe('SongEditor: varios "versión de"', () => {
  const nombres = () => [...document.querySelectorAll('.version-chip')].map((e) => e.textContent.trim());

  it('una canción antigua con dos nombres separados por coma los muestra como dos', async () => {
    mockGetSongById.mockResolvedValue({ ...SONG, version: 'Ebenezer San Francisco, Jorge Jaenz' });
    await renderEditor();
    expect(nombres()).toEqual(['Ebenezer San Francisco', 'Jorge Jaenz']);
  });

  it('guarda la lista y el texto de siempre, con lo que quedó escrito sin Enter', async () => {
    const user = userEvent.setup();
    mockGetSongById.mockResolvedValue({ ...SONG, version: 'Ebenezer San Francisco' });
    await renderEditor();

    await user.type(screen.getByLabelText('Versión de'), 'Jorge Jaenz');
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    expect(mockUpdateSong.mock.calls.at(-1)[1]).toEqual(expect.objectContaining({
      versiones: ['Ebenezer San Francisco', 'Jorge Jaenz'],
      version: 'Ebenezer San Francisco, Jorge Jaenz'
    }));
  });

  it('sin ningún nombre guarda la lista vacía y el texto vacío', async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.click(screen.getByRole('button', { name: 'Quitar v1' }));
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));

    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    expect(mockUpdateSong.mock.calls.at(-1)[1]).toEqual(expect.objectContaining({
      versiones: [], version: ''
    }));
  });
});

describe('SongEditor: tonalidades en C-D-E', () => {
  const EN_RE = '## Intro\nRE MI FA# SOL LA SI DO# RE\nLA FA# RE MI FA# RE\n\nRE FA# LA RE LA FA# MI RE\n';

  it('el selector y la sugerencia las nombran en C-D-E, y guarda en latina', async () => {
    const user = userEvent.setup();
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
    mockGetSongById.mockResolvedValue({ ...SONG, voices: { bb_trumpet: { 1: EN_RE } } });
    await renderEditor();

    await waitFor(() => expect(screen.getByRole('button', { name: /^C$/ })).toBeInTheDocument());
    const usar = screen.getByRole('button', { name: 'Usar D' });

    await user.click(usar);
    expect(screen.getByRole('button', { name: /^D$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    expect(mockUpdateSong.mock.calls.at(-1)[1].key).toBe('RE');
  });
});

describe('SongEditor: tempo, compás y datos de la grabación', () => {
  const ultimoGuardado = () => mockUpdateSong.mock.calls.at(-1)[1];
  const guardar = async (user) => {
    await user.click(screen.getByRole('button', { name: /^Guardar$/ }));
    await waitFor(() => expect(mockUpdateSong).toHaveBeenCalled());
    return ultimoGuardado();
  };

  it('carga y guarda el tempo como número, y el compás', async () => {
    const user = userEvent.setup();
    mockGetSongById.mockResolvedValue({ ...SONG, tempo: 72, compas: '3/4' });
    await renderEditor();
    expect(screen.getByLabelText(/Tempo \(BPM\)/)).toHaveValue(72);
    expect(screen.getByLabelText(/Compás/)).toHaveValue('3/4');

    await user.clear(screen.getByLabelText(/Tempo \(BPM\)/));
    await user.type(screen.getByLabelText(/Tempo \(BPM\)/), '96');
    await user.selectOptions(screen.getByLabelText(/Compás/), '6/8');
    const guardado = await guardar(user);
    expect(guardado.tempo).toBe(96);
    expect(guardado.compas).toBe('6/8');
  });

  it('un tempo vacío o disparatado se guarda como null', async () => {
    const user = userEvent.setup();
    await renderEditor();
    await user.type(screen.getByLabelText(/Tempo \(BPM\)/), '5000');
    const guardado = await guardar(user);
    expect(guardado.tempo).toBeNull();
    expect(guardado.compas).toBeNull();
    expect(guardado.grabacion).toBeNull();
  });

  // Toca "Tap" en los instantes dados (ms). Solo se falsea el reloj de
  // `performance` y se avanza a mano entre toques: simular performance.now
  // con valores sueltos no sirve, porque React también lo llama al programar
  // sus renders y se come los valores.
  const tocarTap = (instantes) => {
    vi.useFakeTimers({ toFake: ['performance'] });
    try {
      let previo = instantes[0];
      for (const t of instantes) {
        vi.advanceTimersByTime(t - previo);
        previo = t;
        fireEvent.click(screen.getByRole('button', { name: 'Tap' }));
      }
    } finally {
      vi.useRealTimers();
    }
  };

  it('el botón Tap marca el tempo a toques', async () => {
    await renderEditor();
    tocarTap([0, 500, 1000, 1500]);
    expect(screen.getByLabelText(/Tempo \(BPM\)/)).toHaveValue(120);
  });

  it('tras una pausa larga el tap empieza de cero', async () => {
    await renderEditor();
    // Tres toques a 120 y, 4 s después, dos más: no bastan para un tempo
    // nuevo, y no se mezclan con los de antes (saldría 36)
    tocarTap([0, 500, 1000, 5000, 5500]);
    expect(screen.getByLabelText(/Tempo \(BPM\)/)).toHaveValue(120);
  });

  it('"Buscar datos" rellena el formulario con lo aceptado, y se guarda al pulsar Guardar', async () => {
    const user = userEvent.setup();
    mockBuscarDatos.mockResolvedValue({
      grabaciones: [{ fuente: 'itunes', id: '1', titulo: 'Cristo Vive', artista: 'Elim', album: 'En vivo', anio: 2010, duracion: 240, enlace: 'https://music.apple.com/x' }],
      tempos: [{ fuente: 'getsongbpm', id: 'g1', titulo: 'Cristo Vive', artista: 'Elim', tempo: 88, tonoConcierto: 'SOL', compas: '4/4', enlace: 'https://getsongbpm.com/song/g1' }],
      errores: {}
    });
    mockGetSongById.mockResolvedValue({ ...SONG, version: '' });
    await renderEditor();

    await user.click(screen.getByRole('button', { name: /Buscar datos/ }));
    await user.click(await screen.findByRole('radio', { name: /Cristo Vive — Elim\s*En vivo/ }));
    await user.click(within(screen.getByText('2. Tempo y tonalidad').closest('fieldset')).getByRole('radio'));
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(screen.getByLabelText(/Tempo \(BPM\)/)).toHaveValue(88);
    expect(screen.getByText('Elim · En vivo · 2010 · 4:00')).toBeInTheDocument();
    expect(mockUpdateSong).not.toHaveBeenCalled();

    const guardado = await guardar(user);
    expect(guardado.tempo).toBe(88);
    expect(guardado.compas).toBe('4/4');
    expect(guardado.versiones).toEqual(['Elim']);
    expect(guardado.grabacion).toMatchObject({ artista: 'Elim', tonoConcierto: 'SOL', bpm: 88 });
    // La tonalidad de la grabación no toca la de la canción
    expect(guardado.key).toBe('DO');
  });

  it('"Quitar" borra los datos de la grabación', async () => {
    const user = userEvent.setup();
    mockGetSongById.mockResolvedValue({ ...SONG, grabacion: { artista: 'Elim', album: 'En vivo', fuentes: {} } });
    await renderEditor();
    await user.click(screen.getByRole('button', { name: 'Quitar' }));
    expect(screen.getByText('Sin datos todavía.')).toBeInTheDocument();
    expect((await guardar(user)).grabacion).toBeNull();
  });
});

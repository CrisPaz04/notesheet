// Hook de sesión en vivo.
//
// El servicio está simulado, así que lo que se prueba aquí es la coreografía:
// cuándo se entra, qué se manda al pulsar cada botón, y qué pasa cuando dos
// músicos tocan algo a la vez o se cae la red.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

class SessionConflictError extends Error {
  constructor(cause) {
    super('conflicto');
    this.name = 'SessionConflictError';
    this.cause = cause;
  }
}

const mockJoin = vi.fn();
const mockLeave = vi.fn();
const mockTouch = vi.fn();
const mockUpdateParticipant = vi.fn();
const mockSetActiveSong = vi.fn();
const mockSetSongKey = vi.fn();
const mockSetSessionSongs = vi.fn();
const mockEndSession = vi.fn();

/** Empujan un snapshot desde el "servidor" a los listeners montados. */
let emitirSesion;
let emitirParticipantes;
const cancelarSesion = vi.fn();
const cancelarParticipantes = vi.fn();

vi.mock('@notesheet/api', () => ({
  subscribeToSession: (code, { onChange, onError }) => {
    emitirSesion = (datos, meta = { fromCache: false }) => onChange(datos, meta);
    emitirSesion.fallar = onError;
    return cancelarSesion;
  },
  subscribeToParticipants: (code, { onChange }) => {
    emitirParticipantes = onChange;
    return cancelarParticipantes;
  },
  joinSession: (...a) => mockJoin(...a),
  leaveSession: (...a) => mockLeave(...a),
  touchParticipant: (...a) => mockTouch(...a),
  updateParticipant: (...a) => mockUpdateParticipant(...a),
  setActiveSong: (...a) => mockSetActiveSong(...a),
  setSongKey: (...a) => mockSetSongKey(...a),
  setSessionSongs: (...a) => mockSetSessionSongs(...a),
  endSession: (...a) => mockEndSession(...a),
  isParticipantOnline: (p) => p.lastSeen === 'reciente',
  SessionConflictError
}));

const { default: useLiveSession } = await import('../hooks/useLiveSession');

const USER = { uid: 'u1', displayName: 'Cristhian' };

const SESION = {
  id: 'ABC123',
  code: 'ABC123',
  hostId: 'u1',
  status: 'live',
  version: 4,
  activeSongId: 's2',
  songs: [
    { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' },
    { id: 's2', title: 'Sublime Gracia', key: 'SOL', originalKey: 'SOL' },
    { id: 's3', title: 'Al Que Está Sentado', key: 'RE', originalKey: 'RE' }
  ]
};

/** Monta el hook y le entrega una sesión ya en marcha. */
const montarEnVivo = async (sesion = SESION, user = USER) => {
  const hook = renderHook(() => useLiveSession('ABC123', { user }));
  await act(async () => { emitirSesion(sesion); });
  await waitFor(() => expect(hook.result.current.entrado).toBe(true));
  return hook;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockJoin.mockResolvedValue(undefined);
  mockLeave.mockResolvedValue(undefined);
  mockTouch.mockResolvedValue(undefined);
  mockUpdateParticipant.mockResolvedValue(undefined);
  mockSetActiveSong.mockResolvedValue(undefined);
  mockSetSongKey.mockResolvedValue(undefined);
  mockSetSessionSongs.mockResolvedValue(undefined);
  mockEndSession.mockResolvedValue(undefined);
});

describe('arranque', () => {
  it('empieza cargando', () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: USER }));
    expect(result.current.estado).toBe('loading');
    expect(result.current.entrado).toBe(false);
  });

  it('no escucha nada sin usuario', () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: null }));
    expect(mockJoin).not.toHaveBeenCalled();
    expect(result.current.estado).toBe('loading');
  });

  it('entra cuando llega una sesión en marcha', async () => {
    const { result } = await montarEnVivo();

    expect(mockJoin).toHaveBeenCalledWith('ABC123', { user: USER });
    expect(result.current.estado).toBe('live');
    expect(result.current.isHost).toBe(true);
  });

  it('no entra si la sesión ya terminó', async () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: USER }));
    await act(async () => { emitirSesion({ ...SESION, status: 'ended' }); });

    expect(result.current.estado).toBe('ended');
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('no entra si se pide no entrar', async () => {
    renderHook(() => useLiveSession('ABC123', { user: USER, autoJoin: false }));
    await act(async () => { emitirSesion(SESION); });

    expect(mockJoin).not.toHaveBeenCalled();
  });

  // Al navegar de una sesión a otra la pantalla no se desmonta: `estado`
  // sigue valiendo "live" por la anterior, y sin comprobar de quién es el
  // snapshot entraríamos en la nueva sin haberla visto.
  it('no entra con un snapshot de otra sesión', async () => {
    renderHook(() => useLiveSession('ABC123', { user: USER }));
    await act(async () => { emitirSesion({ ...SESION, id: 'OTRA99' }); });

    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('marca que la sesión no existe', async () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: USER }));
    await act(async () => { emitirSesion(null, { fromCache: false }); });

    expect(result.current.estado).toBe('missing');
  });

  // Sin red y sin caché, Firestore entrega un snapshot vacío que no significa
  // "no existe" sino "todavía no lo sé". Mandar al músico a buscar un código
  // que está bien, en mitad del servicio, es el peor mensaje posible.
  it('un snapshot vacío desde la caché no es una sesión inexistente', async () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: USER }));
    await act(async () => { emitirSesion(null, { fromCache: true }); });

    expect(result.current.estado).toBe('loading');
    expect(result.current.sinRed).toBe(true);
  });

  it('avisa cuando los datos vienen de la caché', async () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: USER }));
    await act(async () => { emitirSesion(SESION, { fromCache: true }); });

    expect(result.current.sinRed).toBe(true);

    await act(async () => { emitirSesion(SESION, { fromCache: false }); });
    expect(result.current.sinRed).toBe(false);
  });

  it('no es anfitrión quien no abrió la sesión', async () => {
    const { result } = await montarEnVivo(SESION, { uid: 'u2', displayName: 'Ana' });
    expect(result.current.isHost).toBe(false);
  });
});

describe('estado derivado', () => {
  it('localiza la canción activa por id', async () => {
    const { result } = await montarEnVivo();

    expect(result.current.activeIndex).toBe(1);
    expect(result.current.activeSong.title).toBe('Sublime Gracia');
  });

  it('no se inventa una canción activa si ya no está en la lista', async () => {
    const { result } = await montarEnVivo({ ...SESION, activeSongId: 'borrada' });

    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.activeSong).toBeNull();
  });

  it('marca quién sigue conectado', async () => {
    const { result } = await montarEnVivo();
    await act(async () => {
      emitirParticipantes([
        { uid: 'u1', name: 'Cristhian', lastSeen: 'reciente' },
        { uid: 'u2', name: 'Ana', lastSeen: 'viejo' }
      ]);
    });

    expect(result.current.participants.map((p) => p.isOnline)).toEqual([true, false]);
    expect(result.current.me.name).toBe('Cristhian');
  });
});

describe('cambios sobre la lista', () => {
  it('manda la versión que traía el último snapshot', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.irACancion('s3'); });

    expect(mockSetActiveSong).toHaveBeenCalledWith('ABC123', {
      songId: 's3',
      expectedVersion: 4,
      user: USER
    });
  });

  // Si las acciones leyeran la sesión del estado en vez de una ref, seguirían
  // mandando la versión del render en que se crearon y chocarían siempre.
  it('usa la versión nueva después de un cambio de otro músico', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { emitirSesion({ ...SESION, version: 9 }); });
    await act(async () => { await result.current.irACancion('s3'); });

    expect(mockSetActiveSong.mock.calls[0][1].expectedVersion).toBe(9);
  });

  it('avanza a la siguiente canción', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.siguiente(); });

    expect(mockSetActiveSong.mock.calls[0][1].songId).toBe('s3');
  });

  it('retrocede a la anterior', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.anterior(); });

    expect(mockSetActiveSong.mock.calls[0][1].songId).toBe('s1');
  });

  it('no se pasa del final ni del principio', async () => {
    const { result } = await montarEnVivo({ ...SESION, activeSongId: 's3' });
    await act(async () => { await result.current.siguiente(); });
    expect(mockSetActiveSong).not.toHaveBeenCalled();

    await act(async () => { emitirSesion({ ...SESION, activeSongId: 's1' }); });
    await act(async () => { await result.current.anterior(); });
    expect(mockSetActiveSong).not.toHaveBeenCalled();
  });

  it('cambia la tonalidad pasando la lista actual', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.cambiarTonalidad('s1', 'MI'); });

    expect(mockSetSongKey).toHaveBeenCalledWith('ABC123', {
      songs: SESION.songs,
      songId: 's1',
      key: 'MI',
      expectedVersion: 4,
      user: USER
    });
  });

  it('reordena la lista', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.moverCancion(0, 2); });

    expect(mockSetSessionSongs.mock.calls[0][1].songs.map((s) => s.id))
      .toEqual(['s2', 's3', 's1']);
  });

  it('ignora un movimiento fuera de rango', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.moverCancion(0, 9); });

    expect(mockSetSessionSongs).not.toHaveBeenCalled();
  });

  it('añade una canción al final', async () => {
    const { result } = await montarEnVivo();
    await act(async () => {
      await result.current.agregarCancion({ id: 's4', title: 'Nueva', key: 'LA' });
    });

    const { songs } = mockSetSessionSongs.mock.calls[0][1];
    expect(songs.at(-1)).toEqual({
      id: 's4', title: 'Nueva', key: 'LA', originalKey: 'LA'
    });
  });

  it('no añade una canción que ya estaba', async () => {
    const { result } = await montarEnVivo();
    await act(async () => {
      await result.current.agregarCancion({ id: 's1', title: 'Cristo Vive', key: 'DO' });
    });

    expect(mockSetSessionSongs).not.toHaveBeenCalled();
  });

  it('quita una canción', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.quitarCancion('s1'); });

    expect(mockSetSessionSongs.mock.calls[0][1].songs.map((s) => s.id))
      .toEqual(['s2', 's3']);
  });

  it('cierra la sesión', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.cerrarSesion(); });

    expect(mockEndSession).toHaveBeenCalledWith('ABC123', {
      expectedVersion: 4,
      user: USER
    });
  });
});

describe('conflictos', () => {
  // Dos músicos tocando algo a la vez: el segundo manda una versión que acaba
  // de quedarse vieja y se la rechazan. Al repetir ya tiene la buena.
  it('reintenta una vez con la versión que haya llegado', async () => {
    mockSetActiveSong.mockRejectedValueOnce(new SessionConflictError());

    const { result } = await montarEnVivo();
    let devuelto;
    await act(async () => {
      const promesa = result.current.irACancion('s3');
      emitirSesion({ ...SESION, version: 5 });
      devuelto = await promesa;
    });

    expect(devuelto).toBe(true);
    expect(mockSetActiveSong).toHaveBeenCalledTimes(2);
    expect(mockSetActiveSong.mock.calls[1][1].expectedVersion).toBe(5);
  });

  it('se rinde y avisa si el segundo intento también choca', async () => {
    mockSetActiveSong.mockRejectedValue(new SessionConflictError());

    const { result } = await montarEnVivo();
    let devuelto;
    await act(async () => { devuelto = await result.current.irACancion('s3'); });

    expect(devuelto).toBe(false);
    expect(mockSetActiveSong).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeTruthy();
  });

  it('no reintenta un error que no sea de conflicto', async () => {
    mockSetActiveSong.mockRejectedValue(new Error('sin red'));

    const { result } = await montarEnVivo();
    await act(async () => { await result.current.irACancion('s3'); });

    expect(mockSetActiveSong).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('sin red');
  });

  it('no intenta nada si todavía no hay sesión', async () => {
    const { result } = renderHook(() => useLiveSession('ABC123', { user: USER }));
    let devuelto;
    await act(async () => { devuelto = await result.current.irACancion('s3'); });

    expect(devuelto).toBe(false);
    expect(mockSetActiveSong).not.toHaveBeenCalled();
  });
});

describe('lo mío', () => {
  it('anuncia el instrumento', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.anunciarInstrumento('bb_trumpet', '2'); });

    expect(mockUpdateParticipant).toHaveBeenCalledWith('ABC123', 'u1', {
      instrumentId: 'bb_trumpet',
      voiceNumber: '2'
    });
  });

  // Que no se pueda anunciar el instrumento no puede romper la pantalla: la
  // partitura se sigue viendo, solo que el resto no ve qué toco.
  it('no molesta al músico si no se puede anunciar', async () => {
    mockUpdateParticipant.mockRejectedValue(new Error('sin red'));

    const { result } = await montarEnVivo();
    let devuelto;
    await act(async () => { devuelto = await result.current.anunciarInstrumento('sax', '1'); });

    expect(devuelto).toBe(false);
    expect(result.current.error).toBe('');
  });

  it('salir borra la presencia y deja de estar dentro', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.salir(); });

    expect(mockLeave).toHaveBeenCalledWith('ABC123', 'u1');
    expect(result.current.entrado).toBe(false);
  });

  // El efecto de entrada se vuelve a evaluar en cuanto `entrado` pasa a false,
  // y sus condiciones siguen cumpliéndose: sin un freno, salir de la sesión la
  // volvería a abrir al instante.
  it('salir no vuelve a entrar sola', async () => {
    const { result } = await montarEnVivo();
    expect(mockJoin).toHaveBeenCalledTimes(1);

    await act(async () => { await result.current.salir(); });
    await act(async () => { emitirSesion({ ...SESION, version: 5 }); });

    expect(mockJoin).toHaveBeenCalledTimes(1);
    expect(result.current.entrado).toBe(false);
  });

  it('se puede volver a entrar sin recargar', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.salir(); });

    await act(async () => { result.current.entrar(); });
    await waitFor(() => expect(result.current.entrado).toBe(true));
    expect(mockJoin).toHaveBeenCalledTimes(2);
  });

  it('deja de latir después de salir', async () => {
    const { result } = await montarEnVivo();
    await act(async () => { await result.current.salir(); });

    mockTouch.mockClear();
    await new Promise((r) => setTimeout(r, 50));
    expect(mockTouch).not.toHaveBeenCalled();
  });
});

describe('presencia', () => {
  it('late cada treinta segundos mientras la sesión está viva', async () => {
    vi.useFakeTimers();
    try {
      const hook = renderHook(() => useLiveSession('ABC123', { user: USER }));
      await act(async () => { emitirSesion(SESION); });
      await act(async () => { await Promise.resolve(); });
      expect(hook.result.current.entrado).toBe(true);

      await act(async () => { vi.advanceTimersByTime(30 * 1000); });
      expect(mockTouch).toHaveBeenCalledWith('ABC123', 'u1');

      await act(async () => { vi.advanceTimersByTime(60 * 1000); });
      expect(mockTouch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deja de latir al desmontar', async () => {
    vi.useFakeTimers();
    try {
      const hook = renderHook(() => useLiveSession('ABC123', { user: USER }));
      await act(async () => { emitirSesion(SESION); });
      await act(async () => { await Promise.resolve(); });

      hook.unmount();
      await act(async () => { vi.advanceTimersByTime(120 * 1000); });

      expect(mockTouch).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('corta las escuchas al desmontar', async () => {
    const hook = await montarEnVivo();
    hook.unmount();

    expect(cancelarSesion).toHaveBeenCalled();
    expect(cancelarParticipantes).toHaveBeenCalled();
  });
});

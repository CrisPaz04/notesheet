import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// --- Mocks ---
// Solo se sustituye TunerEngine, que necesita getUserMedia y AnalyserNode.
// La matemática de detección (frecuencia -> nota -> cents) es la de verdad:
// es justo lo que interesa comprobar.
const engineInstances = [];
// Permite simular que el usuario deniega el micrófono
const engineConfig = { initializeError: null, contexto: null };

vi.mock('@notesheet/core/src/audio/tunerEngine', () => {
  class FakeTunerEngine {
    constructor() {
      this.initialize = vi.fn(async () => {
        if (engineConfig.initializeError) throw engineConfig.initializeError;
      });
      this.setReferenceFrequency = vi.fn();
      this.isRunning = false;
      this.audioContext = engineConfig.contexto;
      this.start = vi.fn((cb) => { this.pitchCallback = cb; this.isRunning = true; });
      this.stop = vi.fn(() => { this.isRunning = false; });
      this.liberarMicrofono = vi.fn(() => { this.isRunning = false; });
      this.destroy = vi.fn();
      this.playReferenceTone = vi.fn();
      this.stopReferenceTone = vi.fn();
      engineInstances.push(this);
    }
  }
  return { default: FakeTunerEngine };
});

const mockSavePrefs = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();
vi.mock('@notesheet/api', () => ({
  saveTunerPreferences: (...a) => mockSavePrefs(...a),
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: (...a) => mockUpdateUserPreferences(...a)
}));

const mockAuth = { currentUser: null };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: useTuner } = await import('../hooks/useTuner');

const engine = () => engineInstances[engineInstances.length - 1];

// Arranca el afinador y deja el callback de detección listo
const arrancar = async (result) => {
  await act(async () => { await result.current.start(); });
};

// Simula que el micrófono detecta una frecuencia (o silencio con null)
const detectar = (frecuencia) => {
  act(() => { engine().pitchCallback(frecuencia); });
};

beforeEach(() => {
  vi.clearAllMocks();
  engineInstances.length = 0;
  engineConfig.initializeError = null;
  engineConfig.contexto = null;
  mockAuth.currentUser = null;
  mockSavePrefs.mockResolvedValue({});
  mockGetUserPreferences.mockResolvedValue({});
  mockUpdateUserPreferences.mockResolvedValue({});
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  delete navigator.permissions;
  ponerVisibilidad('visible');
});

// El permiso del micrófono tal como lo contaría el navegador
const darPermiso = (state) => {
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn(async () => ({ state })) }
  });
};

const ponerVisibilidad = (estado) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado });
};
const cambiarVisibilidad = async (estado) => {
  ponerVisibilidad(estado);
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
};

// Un AudioContext que el navegador deja en pausa hasta un toque
const contextoEnPausa = () => {
  const oyentes = new Set();
  const ctx = {
    state: 'suspended',
    resume: vi.fn(async () => {}),
    addEventListener: (_, fn) => oyentes.add(fn),
    removeEventListener: (_, fn) => oyentes.delete(fn),
    arrancar() { this.state = 'running'; oyentes.forEach((fn) => fn()); }
  };
  return ctx;
};

describe('useTuner', () => {
  describe('estado inicial', () => {
    it('arranca parado y sin detección', () => {
      const { result } = renderHook(() => useTuner());
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      expect(result.current.detectedNote).toBeNull();
      expect(result.current.tuningStatus).toBe('detecting');
      expect(result.current.error).toBeNull();
    });

    it('usa 440 Hz y las notas de concierto por defecto', () => {
      const { result } = renderHook(() => useTuner());
      expect(result.current.referenceFrequency).toBe(440);
      expect(result.current.verNotasComo).toBe('concierto');
      expect(result.current.notationSystem).toBe('latin');
    });

    it('respeta las preferencias iniciales', () => {
      const { result } = renderHook(() =>
        useTuner({ referenceFrequency: 442, verNotasComo: 'f_horn' })
      );
      expect(result.current.referenceFrequency).toBe(442);
      expect(result.current.verNotasComo).toBe('f_horn');
    });
  });

  describe('inicialización y arranque', () => {
    it('pide acceso al micrófono al arrancar', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      expect(engine().initialize).toHaveBeenCalled();
      expect(engine().start).toHaveBeenCalled();
      expect(result.current.isRunning).toBe(true);
      expect(result.current.isInitialized).toBe(true);
    });

    it('pasa la frecuencia de referencia al engine al inicializar', async () => {
      const { result } = renderHook(() => useTuner({ referenceFrequency: 442 }));
      await arrancar(result);

      expect(engine().setReferenceFrequency).toHaveBeenCalledWith(442);
    });

    it('expone el error si se deniega el micrófono', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      engineConfig.initializeError = new Error('Permiso denegado');

      const { result } = renderHook(() => useTuner());
      await act(async () => { await result.current.start(); });

      expect(result.current.error).toBe('Permiso denegado');
      expect(result.current.isRunning).toBe(false);
      expect(result.current.isInitialized).toBe(false);
      errorSpy.mockRestore();
    });

    it('deja de estar cargando aunque falle', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      engineConfig.initializeError = new Error('Permiso denegado');

      const { result } = renderHook(() => useTuner());
      await act(async () => { await result.current.start(); });

      expect(result.current.loading).toBe(false);
      errorSpy.mockRestore();
    });

    it('no arranca dos veces', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      await arrancar(result);

      expect(engine().start).toHaveBeenCalledTimes(1);
    });

    it('stop limpia la detección', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(440);
      expect(result.current.detectedNote).not.toBeNull();

      act(() => { result.current.stop(); });

      expect(engine().stop).toHaveBeenCalled();
      expect(result.current.isRunning).toBe(false);
      expect(result.current.detectedNote).toBeNull();
      expect(result.current.centsDeviation).toBe(0);
      expect(result.current.tuningStatus).toBe('detecting');
    });

    it('toggle alterna arrancar y parar', async () => {
      const { result } = renderHook(() => useTuner());

      await act(async () => { await result.current.toggle(); });
      expect(result.current.isRunning).toBe(true);

      await act(async () => { await result.current.toggle(); });
      expect(result.current.isRunning).toBe(false);
    });

    it('libera el engine al desmontar', async () => {
      const { result, unmount } = renderHook(() => useTuner());
      await arrancar(result);
      const e = engine();

      unmount();

      expect(e.destroy).toHaveBeenCalled();
    });
  });

  describe('detección de notas', () => {
    it('identifica un LA4 a 440 Hz perfectamente afinado', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(440);

      expect(result.current.detectedFrequency).toBe(440);
      expect(result.current.detectedMidi).toBe(69);
      expect(result.current.detectedNote).toBe('LA4');
      expect(result.current.centsDeviation).toBeCloseTo(0, 5);
      expect(result.current.tuningStatus).toBe('in-tune');
    });

    it('identifica un DO4', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(261.63);

      expect(result.current.detectedMidi).toBe(60);
      expect(result.current.detectedNote).toBe('DO4');
    });

    it('distingue la octava', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(220);
      expect(result.current.detectedNote).toBe('LA3');
    });

    it('marca sharp cuando la nota está alta', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(445); // ~+19 cents sobre LA4

      expect(result.current.centsDeviation).toBeGreaterThan(5);
      expect(result.current.tuningStatus).toBe('sharp');
    });

    it('marca flat cuando la nota está baja', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(435); // ~-20 cents

      expect(result.current.centsDeviation).toBeLessThan(-5);
      expect(result.current.tuningStatus).toBe('flat');
    });

    it('tolera hasta 5 cents como afinado', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(441); // ~+4 cents
      expect(Math.abs(result.current.centsDeviation)).toBeLessThanOrEqual(5);
      expect(result.current.tuningStatus).toBe('in-tune');
    });

    it('limpia todo cuando deja de haber señal', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(440);

      detectar(null);

      expect(result.current.detectedFrequency).toBeNull();
      expect(result.current.detectedNote).toBeNull();
      expect(result.current.detectedMidi).toBeNull();
      expect(result.current.centsDeviation).toBe(0);
      expect(result.current.tuningStatus).toBe('detecting');
    });

    // El mismo caso en notación anglosajona: la nota mostrada sale de un
    // estado distinto (detectedNote en vez de detectedNoteLatin), así que
    // hay que comprobar que también se limpia.
    it('limpia la nota también en notación anglosajona', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      act(() => { result.current.toggleNotationSystem(); });
      detectar(440);
      expect(result.current.detectedNote).toBe('A4');

      detectar(null);

      expect(result.current.detectedNote).toBeNull();
    });

    it('muestra la nota en notación anglosajona al cambiar de sistema', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(440);
      expect(result.current.detectedNote).toBe('LA4');

      act(() => { result.current.toggleNotationSystem(); });

      expect(result.current.notationSystem).toBe('english');
      expect(result.current.detectedNote).toBe('A4');
    });

    it('arranca con la notación del perfil', async () => {
      mockAuth.currentUser = { uid: 'user-1' };
      mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
      const { result } = renderHook(() => useTuner());

      await waitFor(() => expect(result.current.notationSystem).toBe('english'));
    });

    it('cambiarla en el afinador la guarda en el perfil', async () => {
      mockAuth.currentUser = { uid: 'user-1' };
      const { result } = renderHook(() => useTuner());

      act(() => { result.current.toggleNotationSystem(); });

      await waitFor(() =>
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith('user-1', { defaultNotationSystem: 'english' })
      );
    });
  });

  describe('frecuencia de referencia', () => {
    it('la actualiza y avisa al engine', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      act(() => { result.current.updateReferenceFrequency(442); });

      expect(result.current.referenceFrequency).toBe(442);
      expect(engine().setReferenceFrequency).toHaveBeenLastCalledWith(442);
    });

    it('la limita al rango 430-450', () => {
      const { result } = renderHook(() => useTuner());

      act(() => { result.current.updateReferenceFrequency(400); });
      expect(result.current.referenceFrequency).toBe(430);

      act(() => { result.current.updateReferenceFrequency(500); });
      expect(result.current.referenceFrequency).toBe(450);
    });

    it('cae a 440 ante un valor no numérico', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateReferenceFrequency('abc'); });
      expect(result.current.referenceFrequency).toBe(440);
    });

    it('cambia los cents de una misma frecuencia', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      detectar(440);
      expect(result.current.centsDeviation).toBeCloseTo(0, 5);

      act(() => { result.current.updateReferenceFrequency(444); });
      detectar(440);

      // Con el diapasón en 444, un 440 real queda bajo
      expect(result.current.centsDeviation).toBeLessThan(-5);
      expect(result.current.tuningStatus).toBe('flat');
    });
  });

  // Antes había un interruptor "tono de concierto" que se guardaba pero no
  // cambiaba nada: la nota salía siempre en concierto
  describe('ver las notas como un instrumento', () => {
    it('la trompeta en Sib ve un tono más arriba: el SIb que suena es su DO', async () => {
      const { result } = renderHook(() => useTuner({ verNotasComo: 'bb_trumpet' }));
      await arrancar(result);
      detectar(233.08); // SIb3 de concierto

      expect(result.current.detectedNote).toBe('DO4');
      expect(result.current.notaConcierto).toBe('LA#3');
      // Los cents y el MIDI siguen siendo los de lo que suena
      expect(result.current.detectedMidi).toBe(58);
      expect(result.current.tuningStatus).toBe('in-tune');
    });

    it('el saxo alto ve una sexta mayor arriba', async () => {
      const { result } = renderHook(() => useTuner({ verNotasComo: 'eb_alto_sax' }));
      await arrancar(result);
      detectar(261.63); // DO4 de concierto
      expect(result.current.detectedNote).toBe('LA4');
    });

    it('en concierto no hay nota aparte', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(440);
      expect(result.current.detectedNote).toBe('LA4');
      expect(result.current.notaConcierto).toBeNull();
    });

    it('se cambia con el afinador escuchando, y la nota cambia al momento', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(233.08);
      act(() => { result.current.updateVerNotasComo('bb_trumpet'); });
      expect(result.current.detectedNote).toBe('DO4');
    });

    it('ignora un instrumento desconocido', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateVerNotasComo('ocarina'); });
      expect(result.current.verNotasComo).toBe('concierto');
    });
  });

  describe('tono de referencia', () => {
    // Antes solo sonaba tras haber iniciado el afinador (pedir el micrófono)
    it('suena sin haber iniciado el afinador, y sin pedir el micrófono', () => {
      const { result } = renderHook(() => useTuner());

      act(() => { result.current.playReferenceTone(440); });

      expect(engine().playReferenceTone).toHaveBeenCalledWith(440);
      expect(engine().initialize).not.toHaveBeenCalled();
      expect(result.current.isPlayingTone).toBe(true);
    });

    it('iniciar el afinador después usa el mismo engine y sí pide el micrófono', async () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.playReferenceTone(440); });
      await arrancar(result);
      expect(engineInstances).toHaveLength(1);
      expect(engine().initialize).toHaveBeenCalledTimes(1);
      expect(result.current.isRunning).toBe(true);
    });

    it('lo reproduce y lo detiene', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      act(() => { result.current.playReferenceTone(440); });
      expect(engine().playReferenceTone).toHaveBeenCalledWith(440);
      expect(result.current.isPlayingTone).toBe(true);

      act(() => { result.current.stopReferenceTone(); });
      expect(engine().stopReferenceTone).toHaveBeenCalled();
      expect(result.current.isPlayingTone).toBe(false);
    });

    it('toggle suena la nota detectada afinada', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(445); // LA4 desafinado

      act(() => { result.current.toggleReferenceTone(); });

      // Debe sonar el LA4 correcto (440), no los 445 detectados
      expect(engine().playReferenceTone).toHaveBeenCalledWith(expect.closeTo(440, 1));
      expect(result.current.isPlayingTone).toBe(true);
    });

    it('toggle lo apaga si ya está sonando', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      detectar(440);

      act(() => { result.current.toggleReferenceTone(); });
      act(() => { result.current.toggleReferenceTone(); });

      expect(engine().stopReferenceTone).toHaveBeenCalled();
      expect(result.current.isPlayingTone).toBe(false);
    });

    it('toggle no hace nada sin nota detectada', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);

      act(() => { result.current.toggleReferenceTone(); });

      expect(engine().playReferenceTone).not.toHaveBeenCalled();
      expect(result.current.isPlayingTone).toBe(false);
    });
  });

  describe('preferencias', () => {
    it('al montar no guarda nada: los valores con que arranca no son un cambio', () => {
      vi.useFakeTimers();
      mockAuth.currentUser = { uid: 'user-1' };
      renderHook(() => useTuner({ referenceFrequency: 442, verNotasComo: 'bb_trumpet' }));
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSavePrefs).not.toHaveBeenCalled();
      expect(localStorage.getItem('tunerPreferences')).toBeNull();
    });

    it('guarda cómo se ven las notas', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateVerNotasComo('eb_alto_sax'); });
      expect(JSON.parse(localStorage.getItem('tunerPreferences'))).toEqual({
        referenceFrequency: 440,
        verNotasComo: 'eb_alto_sax'
      });
    });

    it('guarda en localStorage al cambiar un ajuste', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateReferenceFrequency(442); });

      const guardado = JSON.parse(localStorage.getItem('tunerPreferences'));
      expect(guardado.referenceFrequency).toBe(442);
    });

    it('no escribe en Firebase sin usuario', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateReferenceFrequency(442); });
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSavePrefs).not.toHaveBeenCalled();
    });

    it('guarda en Firebase tras el debounce', () => {
      vi.useFakeTimers();
      mockAuth.currentUser = { uid: 'user-1' };
      const { result } = renderHook(() => useTuner());
      mockSavePrefs.mockClear();

      act(() => { result.current.updateReferenceFrequency(442); });
      expect(mockSavePrefs).not.toHaveBeenCalled();

      act(() => { vi.advanceTimersByTime(600); });

      expect(mockSavePrefs).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ referenceFrequency: 442 })
      );
    });
  });

  describe('siempre escuchando (arranque solo y pestaña oculta)', () => {
    it('con el permiso ya dado, escucha nada más abrirse', async () => {
      darPermiso('granted');
      const { result } = renderHook(() => useTuner());
      await waitFor(() => expect(result.current.isRunning).toBe(true));
      expect(engine().initialize).toHaveBeenCalledTimes(1);
    });

    // Si no, el aviso del navegador saltaría sin que nadie lo pidiera
    it.each(['prompt', 'denied'])('con el permiso en "%s", espera al botón', async (estado) => {
      darPermiso(estado);
      const { result } = renderHook(() => useTuner());
      await act(async () => { await Promise.resolve(); });
      expect(navigator.permissions.query).toHaveBeenCalled();
      expect(result.current.isRunning).toBe(false);
      expect(engineInstances).toHaveLength(0);
    });

    it('si el navegador no deja consultar el permiso, espera al botón', async () => {
      const { result } = renderHook(() => useTuner());
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isRunning).toBe(false);
    });

    it('arrancarSolo: false no arranca aunque haya permiso', async () => {
      darPermiso('granted');
      const { result } = renderHook(() => useTuner({}, { arrancarSolo: false }));
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isRunning).toBe(false);
    });

    it('con la pestaña oculta suelta el micrófono, y al volver escucha otra vez', async () => {
      darPermiso('granted');
      const { result } = renderHook(() => useTuner());
      await waitFor(() => expect(result.current.isRunning).toBe(true));

      await cambiarVisibilidad('hidden');
      expect(engine().liberarMicrofono).toHaveBeenCalledTimes(1);
      expect(result.current.isRunning).toBe(false);

      await cambiarVisibilidad('visible');
      await waitFor(() => expect(result.current.isRunning).toBe(true));
      // El micrófono se pidió de nuevo (se había soltado)
      expect(engine().initialize).toHaveBeenCalledTimes(2);
    });

    it('detenido a mano, al volver a la pestaña sigue parado', async () => {
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      act(() => result.current.stop());

      await cambiarVisibilidad('hidden');
      await cambiarVisibilidad('visible');
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isRunning).toBe(false);
      expect(engine().liberarMicrofono).not.toHaveBeenCalled();
    });

    it('abierto con la pestaña oculta, empieza a escuchar al mostrarse', async () => {
      darPermiso('granted');
      ponerVisibilidad('hidden');
      const { result } = renderHook(() => useTuner());
      await act(async () => { await Promise.resolve(); });
      expect(result.current.isRunning).toBe(false);

      await cambiarVisibilidad('visible');
      await waitFor(() => expect(result.current.isRunning).toBe(true));
    });

    it('con el audio en pausa avisa, y el primer toque lo reanuda', async () => {
      const ctx = contextoEnPausa();
      engineConfig.contexto = ctx;
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      expect(result.current.esperaToque).toBe(true);

      ctx.resume.mockClear();
      act(() => { document.dispatchEvent(new Event('pointerdown')); });
      expect(ctx.resume).toHaveBeenCalledTimes(1);

      act(() => ctx.arrancar());
      expect(result.current.esperaToque).toBe(false);
    });

    it('con el audio ya en marcha no hay aviso', async () => {
      engineConfig.contexto = { state: 'running', resume: vi.fn() };
      const { result } = renderHook(() => useTuner());
      await arrancar(result);
      expect(result.current.esperaToque).toBe(false);
    });
  });
});

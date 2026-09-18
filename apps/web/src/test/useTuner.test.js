import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- Mocks ---
// Solo se sustituye TunerEngine, que necesita getUserMedia y AnalyserNode.
// La matemática de detección (frecuencia -> nota -> cents) es la de verdad:
// es justo lo que interesa comprobar.
const engineInstances = [];
// Permite simular que el usuario deniega el micrófono
const engineConfig = { initializeError: null };

vi.mock('@notesheet/core/src/audio/tunerEngine', () => {
  class FakeTunerEngine {
    constructor() {
      this.initialize = vi.fn(async () => {
        if (engineConfig.initializeError) throw engineConfig.initializeError;
      });
      this.setReferenceFrequency = vi.fn();
      this.start = vi.fn((cb) => { this.pitchCallback = cb; });
      this.stop = vi.fn();
      this.destroy = vi.fn();
      this.playReferenceTone = vi.fn();
      this.stopReferenceTone = vi.fn();
      engineInstances.push(this);
    }
  }
  return { default: FakeTunerEngine };
});

const mockSavePrefs = vi.fn();
vi.mock('@notesheet/api', () => ({
  saveTunerPreferences: (...a) => mockSavePrefs(...a)
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
  mockAuth.currentUser = null;
  mockSavePrefs.mockResolvedValue({});
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

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

    it('usa 440 Hz y trompeta en Sib por defecto', () => {
      const { result } = renderHook(() => useTuner());
      expect(result.current.referenceFrequency).toBe(440);
      expect(result.current.currentInstrument).toBe('bb_trumpet');
      expect(result.current.showConcertPitch).toBe(true);
      expect(result.current.notationSystem).toBe('latin');
    });

    it('respeta las preferencias iniciales', () => {
      const { result } = renderHook(() =>
        useTuner({
          referenceFrequency: 442,
          lastInstrument: 'f_horn',
          showConcertPitch: false,
          stringModeEnabled: true,
          selectedTuning: 'bass_standard'
        })
      );
      expect(result.current.referenceFrequency).toBe(442);
      expect(result.current.currentInstrument).toBe('f_horn');
      expect(result.current.showConcertPitch).toBe(false);
      expect(result.current.stringModeEnabled).toBe(true);
      expect(result.current.selectedTuning).toBe('bass_standard');
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

  describe('instrumento y ajustes', () => {
    it('cambia de instrumento y expone su nombre', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateInstrument('f_horn'); });

      expect(result.current.currentInstrument).toBe('f_horn');
      expect(result.current.instrumentName).toBeTruthy();
      expect(result.current.instrumentName).not.toBe('Trompeta en Sib');
    });

    it('ignora un instrumento desconocido', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateInstrument('ocarina'); });
      expect(result.current.currentInstrument).toBe('bb_trumpet');
    });

    it('alterna la afinación de concierto', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.toggleConcertPitch(); });
      expect(result.current.showConcertPitch).toBe(false);

      act(() => { result.current.toggleConcertPitch(); });
      expect(result.current.showConcertPitch).toBe(true);
    });
  });

  describe('tono de referencia', () => {
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

  describe('modo cuerdas', () => {
    it('se activa y se desactiva', () => {
      const { result } = renderHook(() => useTuner());

      act(() => { result.current.toggleStringMode(true); });
      expect(result.current.stringModeEnabled).toBe(true);

      act(() => { result.current.toggleStringMode(false); });
      expect(result.current.stringModeEnabled).toBe(false);
    });

    it('al desactivarlo olvida la cuerda seleccionada', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.toggleStringMode(true); });
      act(() => { result.current.updateSelectedString(2); });
      expect(result.current.selectedString).toBe(2);

      act(() => { result.current.toggleStringMode(false); });
      expect(result.current.selectedString).toBeNull();
    });

    it('cambiar de afinación resetea la cuerda', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateSelectedString(3); });

      act(() => { result.current.updateSelectedTuning('bass_standard'); });

      expect(result.current.selectedTuning).toBe('bass_standard');
      expect(result.current.selectedString).toBeNull();
    });

    it('ignora una afinación desconocida', () => {
      const { result } = renderHook(() => useTuner());
      act(() => { result.current.updateSelectedTuning('inventada'); });
      expect(result.current.selectedTuning).toBe('guitar_standard');
    });
  });

  describe('preferencias', () => {
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
});

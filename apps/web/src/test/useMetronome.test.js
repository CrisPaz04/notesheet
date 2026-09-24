import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- Mocks ---
// MetronomeEngine usa Web Audio, que no existe en jsdom. Se sustituye por un
// doble que registra las llamadas; aquí interesa el estado del hook y lo que
// le pide al engine, no la síntesis de sonido.
const engineInstances = [];

vi.mock('@notesheet/core/src/audio/metronomeEngine', () => {
  class FakeEngine {
    constructor() {
      this.playing = false;
      this.setTempo = vi.fn();
      this.setTimeSignature = vi.fn();
      this.setSubdivision = vi.fn();
      this.setSoundPreset = vi.fn();
      this.setVolume = vi.fn();
      this.playTestSound = vi.fn().mockResolvedValue(undefined);
      this.start = vi.fn(async (cb) => {
        this.playing = true;
        this.beatCallback = cb;
      });
      this.stop = vi.fn(() => {
        this.playing = false;
      });
      this.getIsPlaying = vi.fn(() => this.playing);
      engineInstances.push(this);
    }
  }

  return {
    default: FakeEngine,
    TIME_SIGNATURES: {
      '4/4': { beats: 4, name: '4/4' },
      '3/4': { beats: 3, name: '3/4' },
      '6/8': { beats: 6, name: '6/8' }
    },
    SUBDIVISIONS: {
      quarter: { name: 'Negras' },
      eighth: { name: 'Corcheas' }
    },
    SOUND_PRESETS: {
      classic: { name: 'Clásico' },
      wood: { name: 'Madera' }
    }
  };
});

const mockSavePrefs = vi.fn();
vi.mock('@notesheet/api', () => ({
  saveMetronomePreferences: (...a) => mockSavePrefs(...a)
}));

const mockAuth = { currentUser: null };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: useMetronome } = await import('../hooks/useMetronome');

const ultimoEngine = () => engineInstances[engineInstances.length - 1];

beforeEach(() => {
  vi.clearAllMocks();
  engineInstances.length = 0;
  mockAuth.currentUser = null;
  mockSavePrefs.mockResolvedValue({});
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useMetronome', () => {
  describe('estado inicial', () => {
    it('usa los valores por defecto', () => {
      const { result } = renderHook(() => useMetronome());
      expect(result.current.bpm).toBe(120);
      expect(result.current.timeSignature).toBe('4/4');
      expect(result.current.subdivision).toBe('quarter');
      expect(result.current.soundPreset).toBe('classic');
      expect(result.current.volume).toBe(0.7);
      expect(result.current.isPlaying).toBe(false);
    });

    it('respeta las preferencias iniciales', () => {
      const { result } = renderHook(() =>
        useMetronome({ bpm: 90, timeSignature: '3/4', subdivision: 'eighth', soundPreset: 'wood', volume: 0.2 })
      );
      expect(result.current.bpm).toBe(90);
      expect(result.current.timeSignature).toBe('3/4');
      expect(result.current.subdivision).toBe('eighth');
      expect(result.current.soundPreset).toBe('wood');
      expect(result.current.volume).toBe(0.2);
    });

    it('acepta volumen 0 sin caer al valor por defecto', () => {
      const { result } = renderHook(() => useMetronome({ volume: 0 }));
      expect(result.current.volume).toBe(0);
    });

    it('expone los nombres legibles del compás, subdivisión y sonido', () => {
      const { result } = renderHook(() => useMetronome());
      expect(result.current.timeSignatureBeats).toBe(4);
      expect(result.current.subdivisionName).toBe('Negras');
      expect(result.current.soundPresetName).toBe('Clásico');
    });
  });

  describe('arranque y parada', () => {
    it('start arranca el engine', async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => { await result.current.start(); });

      expect(ultimoEngine().start).toHaveBeenCalled();
      expect(result.current.isPlaying).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('stop lo detiene y resetea el pulso visual', async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => { await result.current.start(); });
      act(() => { result.current.stop(); });

      expect(ultimoEngine().stop).toHaveBeenCalled();
      expect(result.current.isPlaying).toBe(false);
      expect(result.current.currentBeat).toBe(0);
    });

    it('toggle alterna entre arrancar y parar', async () => {
      const { result } = renderHook(() => useMetronome());

      await act(async () => { await result.current.toggle(); });
      expect(result.current.isPlaying).toBe(true);

      await act(async () => { await result.current.toggle(); });
      expect(result.current.isPlaying).toBe(false);
    });

    it('no arranca dos veces seguidas', async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => { await result.current.start(); });
      await act(async () => { await result.current.start(); });

      expect(ultimoEngine().start).toHaveBeenCalledTimes(1);
    });

    it('expone un error si el engine no arranca', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { result } = renderHook(() => useMetronome());
      ultimoEngine().start.mockRejectedValue(new Error('sin permiso de audio'));

      await act(async () => { await result.current.start(); });

      expect(result.current.error).toMatch(/No se pudo iniciar/);
      expect(result.current.isPlaying).toBe(false);
      errorSpy.mockRestore();
    });

    it('el callback de pulso actualiza el beat visible', async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => { await result.current.start(); });

      act(() => { ultimoEngine().beatCallback(3); });
      expect(result.current.currentBeat).toBe(3);
    });

    it('detiene el engine al desmontar si estaba sonando', async () => {
      const { result, unmount } = renderHook(() => useMetronome());
      await act(async () => { await result.current.start(); });
      const engine = ultimoEngine();

      unmount();

      expect(engine.stop).toHaveBeenCalled();
    });
  });

  describe('BPM', () => {
    it('actualiza el BPM y se lo pasa al engine', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm(150));

      expect(result.current.bpm).toBe(150);
      expect(ultimoEngine().setTempo).toHaveBeenCalledWith(150);
    });

    it('lo limita a un mínimo de 40', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm(10));
      expect(result.current.bpm).toBe(40);
    });

    it('lo limita a un máximo de 240', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm(500));
      expect(result.current.bpm).toBe(240);
    });

    it('cae a 120 ante un valor no numérico', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm('abc'));
      expect(result.current.bpm).toBe(120);
    });

    it('acepta un número en texto', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm('88'));
      expect(result.current.bpm).toBe(88);
    });

    it('incrementa y decrementa', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.incrementBpm(10));
      expect(result.current.bpm).toBe(130);

      act(() => result.current.decrementBpm(30));
      expect(result.current.bpm).toBe(100);
    });

    it('incrementa de uno en uno por defecto', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.incrementBpm());
      expect(result.current.bpm).toBe(121);
    });

    it('setPreset fija un tempo concreto', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.setPreset(60));
      expect(result.current.bpm).toBe(60);
    });
  });

  describe('compás, subdivisión, sonido y volumen', () => {
    it('cambia el compás y resetea el pulso', async () => {
      const { result } = renderHook(() => useMetronome());
      await act(async () => { await result.current.start(); });
      act(() => { ultimoEngine().beatCallback(2); });

      act(() => result.current.updateTimeSignature('3/4'));

      expect(result.current.timeSignature).toBe('3/4');
      expect(result.current.timeSignatureBeats).toBe(3);
      expect(result.current.currentBeat).toBe(0);
    });

    it('ignora un compás desconocido', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateTimeSignature('7/13'));
      expect(result.current.timeSignature).toBe('4/4');
    });

    it('cambia la subdivisión e ignora las desconocidas', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateSubdivision('eighth'));
      expect(result.current.subdivision).toBe('eighth');

      act(() => result.current.updateSubdivision('inventada'));
      expect(result.current.subdivision).toBe('eighth');
    });

    it('cambia el preset de sonido e ignora los desconocidos', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateSoundPreset('wood'));
      expect(result.current.soundPreset).toBe('wood');
      expect(result.current.soundPresetName).toBe('Madera');

      act(() => result.current.updateSoundPreset('inventado'));
      expect(result.current.soundPreset).toBe('wood');
    });

    it('limita el volumen al rango 0-1', () => {
      const { result } = renderHook(() => useMetronome());

      act(() => result.current.updateVolume(5));
      expect(result.current.volume).toBe(1);

      act(() => result.current.updateVolume(-2));
      expect(result.current.volume).toBe(0);

      act(() => result.current.updateVolume(0.35));
      expect(result.current.volume).toBe(0.35);
      expect(ultimoEngine().setVolume).toHaveBeenCalledWith(0.35);
    });

    it('testSound suena solo con el metrónomo parado', async () => {
      const { result } = renderHook(() => useMetronome());

      await act(async () => { await result.current.testSound(); });
      expect(ultimoEngine().playTestSound).toHaveBeenCalledTimes(1);

      await act(async () => { await result.current.start(); });
      await act(async () => { await result.current.testSound(); });
      expect(ultimoEngine().playTestSound).toHaveBeenCalledTimes(1);
    });
  });

  describe('tap tempo', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('un solo toque no cambia el BPM', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.tapTempo());
      expect(result.current.bpm).toBe(120);
    });

    it('calcula el BPM a partir del intervalo entre toques', () => {
      const { result } = renderHook(() => useMetronome());

      // 500 ms entre toques -> 120 BPM; usamos 600 ms -> 100 BPM
      act(() => result.current.tapTempo());
      act(() => { vi.advanceTimersByTime(600); });
      act(() => result.current.tapTempo());

      expect(result.current.bpm).toBe(100);
    });

    it('promedia varios toques', () => {
      const { result } = renderHook(() => useMetronome());

      act(() => result.current.tapTempo());
      act(() => { vi.advanceTimersByTime(500); });
      act(() => result.current.tapTempo());
      act(() => { vi.advanceTimersByTime(500); });
      act(() => result.current.tapTempo());

      expect(result.current.bpm).toBe(120);
    });

    it('ignora un tempo por debajo del mínimo', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm(100));

      // 1900 ms entre toques -> ~32 BPM, por debajo del mínimo de 40.
      // El intervalo se queda por debajo de los 2 s de inactividad a
      // propósito: si no, saltaría el reinicio de la serie y nunca se
      // llegaría a evaluar el rango.
      act(() => result.current.tapTempo());
      act(() => { vi.advanceTimersByTime(1900); });
      act(() => result.current.tapTempo());

      expect(result.current.bpm).toBe(100);
    });

    it('olvida los toques tras el tiempo de espera', () => {
      const { result } = renderHook(() => useMetronome());

      act(() => result.current.tapTempo());
      act(() => { vi.advanceTimersByTime(600); });
      act(() => result.current.tapTempo());
      expect(result.current.bpm).toBe(100);

      // Pasan más de 2 s: la serie se reinicia y un toque suelto no calcula nada
      act(() => { vi.advanceTimersByTime(2500); });
      act(() => result.current.tapTempo());
      expect(result.current.bpm).toBe(100);
    });
  });

  describe('preferencias', () => {
    it('guarda en localStorage al cambiar un ajuste', () => {
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm(144));

      const guardado = JSON.parse(localStorage.getItem('metronomePreferences'));
      expect(guardado.bpm).toBe(144);
    });

    it('al montar no guarda nada: los valores con que arranca no son un cambio', () => {
      vi.useFakeTimers();
      mockAuth.currentUser = { uid: 'user-1' };
      // Abierto desde una canción a 72: ese tempo es de la canción, no del músico
      renderHook(() => useMetronome({ bpm: 72, timeSignature: '6/8' }));
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSavePrefs).not.toHaveBeenCalled();
      expect(localStorage.getItem('metronomePreferences')).toBeNull();
    });

    it('no escribe en Firebase sin usuario', () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useMetronome());
      act(() => result.current.updateBpm(144));
      act(() => { vi.advanceTimersByTime(1000); });

      expect(mockSavePrefs).not.toHaveBeenCalled();
    });

    it('guarda en Firebase con usuario, tras el debounce', () => {
      vi.useFakeTimers();
      mockAuth.currentUser = { uid: 'user-1' };
      const { result } = renderHook(() => useMetronome());

      act(() => result.current.updateBpm(144));
      expect(mockSavePrefs).not.toHaveBeenCalled(); // aún dentro del debounce

      act(() => { vi.advanceTimersByTime(600); });

      expect(mockSavePrefs).toHaveBeenCalledWith('user-1', expect.objectContaining({ bpm: 144 }));
    });

    it('agrupa cambios seguidos en una sola escritura', () => {
      vi.useFakeTimers();
      mockAuth.currentUser = { uid: 'user-1' };
      const { result } = renderHook(() => useMetronome());
      mockSavePrefs.mockClear();

      act(() => result.current.updateBpm(130));
      act(() => { vi.advanceTimersByTime(100); });
      act(() => result.current.updateBpm(140));
      act(() => { vi.advanceTimersByTime(100); });
      act(() => result.current.updateBpm(150));
      act(() => { vi.advanceTimersByTime(600); });

      expect(mockSavePrefs).toHaveBeenCalledTimes(1);
      expect(mockSavePrefs).toHaveBeenCalledWith('user-1', expect.objectContaining({ bpm: 150 }));
    });
  });
});

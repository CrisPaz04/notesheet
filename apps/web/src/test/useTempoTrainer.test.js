import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useTempoTrainer from '../hooks/useTempoTrainer';

// El hook recibe el engine por parámetro, así que basta con un doble que
// registre el callback de fin de compás y permita dispararlo a mano.
const crearEngine = () => {
  const engine = {
    onMeasureComplete: null,
    setOnMeasureComplete: vi.fn((cb) => {
      engine.onMeasureComplete = cb;
    })
  };
  return engine;
};

let engine;
let updateBpm;

const montar = (isMetronomePlaying = true) => {
  engine = crearEngine();
  updateBpm = vi.fn();
  return renderHook(
    ({ playing }) => useTempoTrainer(engine, updateBpm, playing),
    { initialProps: { playing: isMetronomePlaying } }
  );
};

// Simula que el metrónomo completa N compases.
//
// Cada compás va en su propio act() a propósito: el hook lleva la cuenta en
// un ref que sincroniza con useEffect, así que necesita que los efectos se
// vacíen entre una llamada y la siguiente. En la práctica eso siempre se
// cumple, porque entre compases pasan segundos.
const completarCompases = (n) => {
  for (let i = 0; i < n; i++) {
    act(() => {
      engine.onMeasureComplete?.();
    });
  }
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTempoTrainer', () => {
  describe('configuración', () => {
    it('arranca con la configuración por defecto e inactivo', () => {
      const { result } = montar();
      expect(result.current.config).toEqual({
        startBpm: 80,
        targetBpm: 120,
        incrementBpm: 5,
        barsPerIncrement: 4
      });
      expect(result.current.isActive).toBe(false);
      expect(result.current.currentTrainingBpm).toBe(80);
    });

    it('updateConfig hace merge parcial', () => {
      const { result } = montar();
      act(() => result.current.updateConfig({ targetBpm: 160 }));

      expect(result.current.config.targetBpm).toBe(160);
      expect(result.current.config.startBpm).toBe(80);
    });
  });

  describe('iniciar', () => {
    it('activa el entrenamiento y fija el BPM inicial', () => {
      const { result } = montar();
      act(() => {
        expect(result.current.startTraining()).toBe(true);
      });

      expect(result.current.isActive).toBe(true);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.currentTrainingBpm).toBe(80);
      expect(updateBpm).toHaveBeenCalledWith(80);
    });

    it('rechaza un BPM inicial mayor o igual que el objetivo', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = montar();
      act(() => result.current.updateConfig({ startBpm: 140, targetBpm: 120 }));

      act(() => {
        expect(result.current.startTraining()).toBe(false);
      });

      expect(result.current.isActive).toBe(false);
      expect(updateBpm).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('rechaza un incremento no positivo', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = montar();
      act(() => result.current.updateConfig({ incrementBpm: 0 }));

      act(() => {
        expect(result.current.startTraining()).toBe(false);
      });

      expect(result.current.isActive).toBe(false);
      warn.mockRestore();
    });

    it('registra el callback de compás en el engine al activarse', () => {
      const { result } = montar();
      act(() => result.current.startTraining());

      expect(engine.onMeasureComplete).toBeTypeOf('function');
    });
  });

  describe('progresión del tempo', () => {
    it('no sube el BPM antes de completar los compases configurados', () => {
      const { result } = montar();
      act(() => result.current.startTraining());
      updateBpm.mockClear();

      completarCompases(3); // hacen falta 4

      expect(result.current.currentTrainingBpm).toBe(80);
      expect(updateBpm).not.toHaveBeenCalled();
    });

    it('sube el BPM al completar los compases', () => {
      const { result } = montar();
      act(() => result.current.startTraining());
      updateBpm.mockClear();

      completarCompases(4);

      expect(result.current.currentTrainingBpm).toBe(85);
      expect(updateBpm).toHaveBeenCalledWith(85);
    });

    it('encadena varios incrementos', () => {
      const { result } = montar();
      act(() => result.current.startTraining());

      completarCompases(4);
      expect(result.current.currentTrainingBpm).toBe(85);

      completarCompases(4);
      expect(result.current.currentTrainingBpm).toBe(90);

      completarCompases(4);
      expect(result.current.currentTrainingBpm).toBe(95);
    });

    it('cuenta los compases completados', () => {
      const { result } = montar();
      act(() => result.current.startTraining());

      completarCompases(6);
      expect(result.current.barsCompleted).toBe(6);
    });

    it('no pasa del BPM objetivo', () => {
      const { result } = montar();
      act(() => result.current.updateConfig({ startBpm: 100, targetBpm: 110, incrementBpm: 8 }));
      act(() => result.current.startTraining());

      completarCompases(4); // 100 -> 108
      expect(result.current.currentTrainingBpm).toBe(108);

      completarCompases(4); // 108 + 8 = 116 >= 110, se queda en 110
      expect(result.current.currentTrainingBpm).toBe(110);
      expect(updateBpm).toHaveBeenLastCalledWith(110);
    });

    it('marca hasReachedTarget al llegar al objetivo', () => {
      const { result } = montar();
      act(() => result.current.updateConfig({ startBpm: 100, targetBpm: 110, incrementBpm: 10 }));
      act(() => result.current.startTraining());
      expect(result.current.hasReachedTarget).toBe(false);

      completarCompases(4);
      expect(result.current.hasReachedTarget).toBe(true);
    });

    it('respeta un barsPerIncrement distinto', () => {
      const { result } = montar();
      act(() => result.current.updateConfig({ barsPerIncrement: 2 }));
      act(() => result.current.startTraining());

      completarCompases(2);
      expect(result.current.currentTrainingBpm).toBe(85);
    });
  });

  describe('pausa', () => {
    it('deja de contar compases mientras está en pausa', () => {
      const { result } = montar();
      act(() => result.current.startTraining());
      act(() => result.current.pauseTraining());

      completarCompases(8);

      expect(result.current.barsCompleted).toBe(0);
      expect(result.current.currentTrainingBpm).toBe(80);
    });

    it('reanuda desde donde se quedó', () => {
      const { result } = montar();
      act(() => result.current.startTraining());

      completarCompases(2);
      act(() => result.current.pauseTraining());
      completarCompases(5); // ignorados
      act(() => result.current.resumeTraining());
      completarCompases(2); // 2 + 2 = 4 -> incremento

      expect(result.current.barsCompleted).toBe(4);
      expect(result.current.currentTrainingBpm).toBe(85);
    });

    it('togglePause alterna el estado', () => {
      const { result } = montar();
      act(() => result.current.startTraining());

      act(() => result.current.togglePause());
      expect(result.current.isPaused).toBe(true);

      act(() => result.current.togglePause());
      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('detener', () => {
    it('reinicia el estado al BPM inicial', () => {
      const { result } = montar();
      act(() => result.current.startTraining());
      completarCompases(4);

      act(() => result.current.stopTraining());

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.barsCompleted).toBe(0);
      expect(result.current.currentTrainingBpm).toBe(80);
    });

    it('se detiene solo si el metrónomo para', () => {
      const { result, rerender } = montar(true);
      act(() => result.current.startTraining());
      expect(result.current.isActive).toBe(true);

      rerender({ playing: false });

      expect(result.current.isActive).toBe(false);
      expect(result.current.isPaused).toBe(false);
    });

    it('desregistra el callback del engine al desmontar', () => {
      const { result, unmount } = montar();
      act(() => result.current.startTraining());

      unmount();

      expect(engine.setOnMeasureComplete).toHaveBeenLastCalledWith(null);
    });
  });

  describe('progreso', () => {
    it('es 0 mientras no está activo', () => {
      const { result } = montar();
      expect(result.current.progress).toBe(0);
    });

    it('avanza conforme sube el BPM', () => {
      const { result } = montar();
      act(() => result.current.startTraining());
      const inicial = result.current.progress;

      completarCompases(4);

      expect(result.current.progress).toBeGreaterThan(inicial);
    });

    it('nunca pasa de 100', () => {
      const { result } = montar();
      act(() => result.current.updateConfig({ startBpm: 100, targetBpm: 110, incrementBpm: 10 }));
      act(() => result.current.startTraining());

      completarCompases(40);

      expect(result.current.progress).toBeLessThanOrEqual(100);
    });
  });
});

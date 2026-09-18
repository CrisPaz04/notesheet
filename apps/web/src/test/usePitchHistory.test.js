import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import usePitchHistory from '../hooks/usePitchHistory';

// Añade una serie de desviaciones en cents de una sola tacada
const alimentar = (result, valores) => {
  act(() => {
    valores.forEach((v) => result.current.addSample(v));
  });
};

const repetir = (valor, veces) => new Array(veces).fill(valor);

describe('usePitchHistory', () => {
  describe('buffer', () => {
    it('arranca vacío', () => {
      const { result } = renderHook(() => usePitchHistory());
      expect(result.current.history).toEqual([]);
      expect(result.current.sampleCount).toBe(0);
      expect(result.current.hasEnoughData).toBe(false);
    });

    it('acumula muestras con su marca de tiempo', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, [5, -3]);

      expect(result.current.sampleCount).toBe(2);
      expect(result.current.history[0].cents).toBe(5);
      expect(result.current.history[1].cents).toBe(-3);
      expect(typeof result.current.history[0].timestamp).toBe('number');
    });

    it('descarta las muestras viejas al llenarse (buffer circular)', () => {
      const { result } = renderHook(() => usePitchHistory(5));
      alimentar(result, [1, 2, 3, 4, 5, 6, 7]);

      expect(result.current.sampleCount).toBe(5);
      expect(result.current.history.map((s) => s.cents)).toEqual([3, 4, 5, 6, 7]);
    });

    it('clearHistory vacía el buffer', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, [1, 2, 3]);
      act(() => result.current.clearHistory());

      expect(result.current.history).toEqual([]);
      expect(result.current.sampleCount).toBe(0);
    });

    it('se puede seguir usando después de limpiarlo', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, [1, 2, 3]);
      act(() => result.current.clearHistory());
      alimentar(result, [9]);

      expect(result.current.history.map((s) => s.cents)).toEqual([9]);
    });

    it('hasEnoughData se activa a partir de 10 muestras', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(0, 9));
      expect(result.current.hasEnoughData).toBe(false);

      alimentar(result, [0]);
      expect(result.current.hasEnoughData).toBe(true);
    });
  });

  describe('tendencia', () => {
    it('es null con menos de 10 muestras', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(0, 9));
      expect(result.current.trend).toBeNull();
    });

    it('detecta afinación estable', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(0, 10));
      expect(result.current.trend).toBe('stable');
    });

    it('detecta que la afinación sube', () => {
      const { result } = renderHook(() => usePitchHistory());
      // Primeras 5 en 0, últimas 5 en 20 -> diferencia de +20
      alimentar(result, [...repetir(0, 5), ...repetir(20, 5)]);
      expect(result.current.trend).toBe('rising');
    });

    it('detecta que la afinación baja', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, [...repetir(0, 5), ...repetir(-20, 5)]);
      expect(result.current.trend).toBe('falling');
    });

    it('considera estable una variación menor de 2 cents', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, [...repetir(0, 5), ...repetir(1, 5)]);
      expect(result.current.trend).toBe('stable');
    });

    it('solo mira las 10 muestras más recientes', () => {
      const { result } = renderHook(() => usePitchHistory());
      // Un tramo antiguo muy desviado que debe quedar fuera del cálculo
      alimentar(result, repetir(-50, 20));
      alimentar(result, repetir(0, 10));
      expect(result.current.trend).toBe('stable');
    });
  });

  describe('estabilidad', () => {
    it('es null con menos de 30 muestras', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(0, 29));
      expect(result.current.stability).toBeNull();
      expect(result.current.stabilityRating).toBeNull();
    });

    it('una señal constante tiene desviación cero', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(7, 30));
      expect(result.current.stability).toBe(0);
      expect(result.current.stabilityRating).toBe('excellent');
    });

    it('califica de excellent una variación pequeña', () => {
      const { result } = renderHook(() => usePitchHistory());
      // Alterna 0 y 2 -> desviación típica 1
      alimentar(result, Array.from({ length: 30 }, (_, i) => (i % 2 ? 2 : 0)));
      expect(result.current.stability).toBeLessThan(3);
      expect(result.current.stabilityRating).toBe('excellent');
    });

    it('califica de good una variación media', () => {
      const { result } = renderHook(() => usePitchHistory());
      // Alterna -5 y 5 -> desviación típica 5
      alimentar(result, Array.from({ length: 30 }, (_, i) => (i % 2 ? 5 : -5)));
      expect(result.current.stability).toBeCloseTo(5, 5);
      expect(result.current.stabilityRating).toBe('good');
    });

    it('califica de fair una variación amplia', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, Array.from({ length: 30 }, (_, i) => (i % 2 ? 10 : -10)));
      expect(result.current.stability).toBeCloseTo(10, 5);
      expect(result.current.stabilityRating).toBe('fair');
    });

    it('califica de poor una afinación muy inestable', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, Array.from({ length: 30 }, (_, i) => (i % 2 ? 40 : -40)));
      expect(result.current.stability).toBeGreaterThan(15);
      expect(result.current.stabilityRating).toBe('poor');
    });

    it('solo mira las 30 muestras más recientes', () => {
      const { result } = renderHook(() => usePitchHistory(100));
      alimentar(result, repetir(-80, 40)); // tramo antiguo, muy desviado
      alimentar(result, repetir(3, 30));   // tramo reciente, constante

      expect(result.current.stability).toBe(0);
      expect(result.current.stabilityRating).toBe('excellent');
    });
  });

  describe('promedio de cents', () => {
    it('es null con menos de 5 muestras', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(10, 4));
      expect(result.current.averageCents).toBeNull();
    });

    it('promedia las muestras recientes', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(10, 5));
      expect(result.current.averageCents).toBe(10);
    });

    it('redondea a un decimal', () => {
      const { result } = renderHook(() => usePitchHistory());
      // 6 muestras que suman 1 -> media 0.1666... -> 0.2
      alimentar(result, [0, 0, 0, 0, 0, 1]);
      expect(result.current.averageCents).toBe(0.2);
    });

    it('promedia positivos y negativos', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, [-10, 10, -10, 10, 0]);
      expect(result.current.averageCents).toBe(0);
    });

    it('solo mira las 15 muestras más recientes', () => {
      const { result } = renderHook(() => usePitchHistory());
      alimentar(result, repetir(100, 20)); // queda fuera de la ventana
      alimentar(result, repetir(4, 15));

      expect(result.current.averageCents).toBe(4);
    });
  });
});

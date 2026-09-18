import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useSelectedSongs from '../hooks/useSelectedSongs';

const CANCION = { id: 's1', title: 'Cristo Vive', key: 'DO', type: 'Júbilo' };
const OTRA = { id: 's2', title: 'Sublime Gracia', key: 'SOL', type: 'Adoración' };
const TERCERA = { id: 's3', title: 'Al Que Está Sentado', key: 'RE' };

const ids = (result) => result.current.selectedSongs.map((s) => s.id);

const conTres = () => {
  const hook = renderHook(() => useSelectedSongs());
  act(() => {
    hook.result.current.addSong(CANCION);
  });
  act(() => {
    hook.result.current.addSong(OTRA);
  });
  act(() => {
    hook.result.current.addSong(TERCERA);
  });
  return hook;
};

describe('useSelectedSongs', () => {
  describe('añadir', () => {
    it('arranca vacío', () => {
      const { result } = renderHook(() => useSelectedSongs());
      expect(result.current.selectedSongs).toEqual([]);
    });

    it('acepta una lista inicial', () => {
      const { result } = renderHook(() => useSelectedSongs([{ id: 's9', key: 'MI' }]));
      expect(ids(result)).toEqual(['s9']);
    });

    it('añade una canción con su tonalidad original', () => {
      const { result } = renderHook(() => useSelectedSongs());
      act(() => { result.current.addSong(CANCION); });

      expect(result.current.selectedSongs).toEqual([
        { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' }
      ]);
    });

    it('no arrastra campos ajenos a la lista', () => {
      const { result } = renderHook(() => useSelectedSongs());
      act(() => { result.current.addSong(CANCION); });

      expect(result.current.selectedSongs[0]).not.toHaveProperty('type');
    });

    it('conserva el orden de inserción', () => {
      const { result } = conTres();
      expect(ids(result)).toEqual(['s1', 's2', 's3']);
    });

    // Este camino no se puede alcanzar desde la interfaz, porque el botón de
    // la canción ya añadida queda deshabilitado. Aquí sí se puede probar.
    it('rechaza una canción duplicada', () => {
      const { result } = renderHook(() => useSelectedSongs());

      let primera, segunda;
      act(() => { primera = result.current.addSong(CANCION); });
      act(() => { segunda = result.current.addSong(CANCION); });

      expect(primera).toBe(true);
      expect(segunda).toBe(false);
      expect(ids(result)).toEqual(['s1']);
    });

    it('ignora una canción sin id', () => {
      const { result } = renderHook(() => useSelectedSongs());

      let devuelto;
      act(() => { devuelto = result.current.addSong({ title: 'Sin id' }); });

      expect(devuelto).toBe(false);
      expect(result.current.selectedSongs).toEqual([]);
    });
  });

  describe('quitar', () => {
    it('elimina la canción indicada', () => {
      const { result } = conTres();
      act(() => { result.current.removeSong('s2'); });
      expect(ids(result)).toEqual(['s1', 's3']);
    });

    it('no hace nada con un id desconocido', () => {
      const { result } = conTres();
      act(() => { result.current.removeSong('inexistente'); });
      expect(ids(result)).toEqual(['s1', 's2', 's3']);
    });

    it('permite volver a añadir lo quitado', () => {
      const { result } = conTres();
      act(() => { result.current.removeSong('s1'); });
      act(() => { result.current.addSong(CANCION); });

      expect(ids(result)).toEqual(['s2', 's3', 's1']);
    });
  });

  describe('tonalidad', () => {
    it('transpone una canción de la lista', () => {
      const { result } = conTres();
      act(() => { result.current.changeKey('s2', 'LA'); });

      const cancion = result.current.selectedSongs.find((s) => s.id === 's2');
      expect(cancion.key).toBe('LA');
    });

    it('conserva la tonalidad original tras transponer', () => {
      const { result } = conTres();
      act(() => { result.current.changeKey('s2', 'LA'); });

      const cancion = result.current.selectedSongs.find((s) => s.id === 's2');
      expect(cancion.originalKey).toBe('SOL');
    });

    it('no toca a las demás canciones', () => {
      const { result } = conTres();
      act(() => { result.current.changeKey('s2', 'LA'); });

      expect(result.current.selectedSongs.find((s) => s.id === 's1').key).toBe('DO');
      expect(result.current.selectedSongs.find((s) => s.id === 's3').key).toBe('RE');
    });

    it('ignora un id desconocido', () => {
      const { result } = conTres();
      const antes = result.current.selectedSongs;
      act(() => { result.current.changeKey('inexistente', 'LA'); });

      expect(result.current.selectedSongs.map((s) => s.key)).toEqual(
        antes.map((s) => s.key)
      );
    });
  });

  describe('reordenar', () => {
    it('mueve del principio al final', () => {
      const { result } = conTres();
      act(() => { result.current.moveSong(0, 2); });
      expect(ids(result)).toEqual(['s2', 's3', 's1']);
    });

    it('mueve del final al principio', () => {
      const { result } = conTres();
      act(() => { result.current.moveSong(2, 0); });
      expect(ids(result)).toEqual(['s3', 's1', 's2']);
    });

    it('mueve a una posición intermedia', () => {
      const { result } = conTres();
      act(() => { result.current.moveSong(0, 1); });
      expect(ids(result)).toEqual(['s2', 's1', 's3']);
    });

    it('no cambia nada al mover a la misma posición', () => {
      const { result } = conTres();
      act(() => { result.current.moveSong(1, 1); });
      expect(ids(result)).toEqual(['s1', 's2', 's3']);
    });

    it('ignora índices fuera de rango', () => {
      const { result } = conTres();
      act(() => { result.current.moveSong(0, 99); });
      expect(ids(result)).toEqual(['s1', 's2', 's3']);

      act(() => { result.current.moveSong(-1, 0); });
      expect(ids(result)).toEqual(['s1', 's2', 's3']);
    });

    it('handleDragEnd reordena a partir del resultado del arrastre', () => {
      const { result } = conTres();
      act(() => {
        result.current.handleDragEnd({ source: { index: 0 }, destination: { index: 2 } });
      });
      expect(ids(result)).toEqual(['s2', 's3', 's1']);
    });

    it('handleDragEnd ignora un soltar fuera de la lista', () => {
      const { result } = conTres();
      act(() => {
        result.current.handleDragEnd({ source: { index: 0 }, destination: null });
      });
      expect(ids(result)).toEqual(['s1', 's2', 's3']);
    });

    it('handleDragEnd no revienta con un resultado vacío', () => {
      const { result } = conTres();
      expect(() => {
        act(() => { result.current.handleDragEnd(undefined); });
      }).not.toThrow();
      expect(ids(result)).toEqual(['s1', 's2', 's3']);
    });
  });

  describe('isSelected', () => {
    it('distingue lo que está en la lista de lo que no', () => {
      const { result } = renderHook(() => useSelectedSongs());
      act(() => { result.current.addSong(CANCION); });

      expect(result.current.isSelected('s1')).toBe(true);
      expect(result.current.isSelected('s2')).toBe(false);
    });

    it('se actualiza al quitar una canción', () => {
      const { result } = conTres();
      act(() => { result.current.removeSong('s1'); });
      expect(result.current.isSelected('s1')).toBe(false);
    });
  });

  describe('setSelectedSongs', () => {
    it('permite cargar una lista guardada de golpe', () => {
      const { result } = renderHook(() => useSelectedSongs());
      act(() => {
        result.current.setSelectedSongs([
          { id: 's5', title: 'Guardada', key: 'LA', originalKey: 'SOL' }
        ]);
      });

      expect(ids(result)).toEqual(['s5']);
      expect(result.current.selectedSongs[0].key).toBe('LA');
    });
  });
});

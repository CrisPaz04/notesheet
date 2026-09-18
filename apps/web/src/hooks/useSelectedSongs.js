import { useState, useCallback } from "react";

/**
 * Gestiona las canciones que componen una lista: alta, baja, tonalidad de
 * cada una y orden.
 *
 * Una canción dentro de una lista no es la canción original: lleva su propia
 * tonalidad (`key`), que el director puede transponer para esa ocasión sin
 * tocar la canción del repertorio. `originalKey` conserva la de partida para
 * poder volver a ella.
 */
export default function useSelectedSongs(inicial = []) {
  const [selectedSongs, setSelectedSongs] = useState(inicial);

  /**
   * Añade una canción al final de la lista, con su tonalidad original.
   * @returns {boolean} false si la canción ya estaba
   */
  const addSong = useCallback((song) => {
    if (!song?.id) return false;

    let added = false;
    setSelectedSongs((prev) => {
      if (prev.some((s) => s.id === song.id)) return prev;

      added = true;
      return [...prev, {
        id: song.id,
        title: song.title,
        key: song.key,
        originalKey: song.key
      }];
    });

    return added;
  }, []);

  const removeSong = useCallback((songId) => {
    setSelectedSongs((prev) => prev.filter((song) => song.id !== songId));
  }, []);

  /** Transpone una canción solo dentro de esta lista. */
  const changeKey = useCallback((songId, newKey) => {
    setSelectedSongs((prev) => prev.map((song) => (
      song.id === songId ? { ...song, key: newKey } : song
    )));
  }, []);

  /** Mueve una canción de una posición a otra. */
  const moveSong = useCallback((from, to) => {
    setSelectedSongs((prev) => {
      if (from === to) return prev;
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;

      const reordenadas = Array.from(prev);
      const [movida] = reordenadas.splice(from, 1);
      reordenadas.splice(to, 0, movida);
      return reordenadas;
    });
  }, []);

  /** Handler para @hello-pangea/dnd. */
  const handleDragEnd = useCallback((result) => {
    if (!result?.destination) return;
    moveSong(result.source.index, result.destination.index);
  }, [moveSong]);

  const isSelected = useCallback(
    (songId) => selectedSongs.some((s) => s.id === songId),
    [selectedSongs]
  );

  return {
    selectedSongs,
    setSelectedSongs,
    addSong,
    removeSong,
    changeKey,
    moveSong,
    handleDragEnd,
    isSelected
  };
}

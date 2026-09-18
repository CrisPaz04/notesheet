import { useState } from "react";
import { addVoiceToSong, removeVoiceFromSong } from "@notesheet/api";
import { parseVoiceKey } from "@notesheet/core";

export const LYRICS_TAB = "lyrics";

/**
 * Gestiona las voces de una canción en el editor: alta, baja, pestaña activa
 * y contenido de cada voz. Persiste en Firestore solo si la canción ya existe;
 * en una canción nueva todo vive en memoria hasta que se guarda.
 *
 * La pestaña de letra (`LYRICS_TAB`) no es una voz: su contenido lo lleva el
 * componente, y el hook lo delega a `lyrics.value` / `lyrics.onChange`.
 *
 * @param {Object} options
 * @param {string|undefined} options.songId - Id de la canción, si ya existe
 * @param {boolean} options.isNewSong - Si aún no se ha guardado
 * @param {Function} options.onError - Recibe el mensaje de error a mostrar
 * @param {Object} options.lyrics - `{ value, onChange }` para la pestaña de letra
 */
export default function useSongVoices({
  songId,
  isNewSong,
  onError = () => {},
  lyrics = { value: "", onChange: () => {} }
} = {}) {
  const [voices, setVoices] = useState({ bb_trumpet: { "1": "" } });
  const [currentTab, setCurrentTab] = useState("bb_trumpet-1");
  const [primaryInstrument, setPrimaryInstrument] = useState("bb_trumpet");
  const [primaryVoiceNumber, setPrimaryVoiceNumber] = useState("1");

  const isPersisted = !isNewSong && Boolean(songId);

  /**
   * Añade una voz con el contenido indicado y la deja como pestaña activa.
   * @returns {boolean} false si la voz ya existía
   */
  const addVoice = async (instrumentId, voiceNumber, content = "") => {
    if (!instrumentId || !voiceNumber) return false;

    if (voices[instrumentId]?.[voiceNumber] !== undefined) {
      onError("Esta voz ya existe");
      return false;
    }

    setVoices({
      ...voices,
      [instrumentId]: { ...(voices[instrumentId] || {}), [voiceNumber]: content }
    });
    setCurrentTab(`${instrumentId}-${voiceNumber}`);

    if (isPersisted) {
      try {
        await addVoiceToSong(songId, instrumentId, voiceNumber, content);
      } catch (error) {
        console.error("Error adding voice:", error);
        onError("Error al añadir la voz: " + error.message);
      }
    }

    return true;
  };

  /**
   * Elimina una voz. La voz principal no se puede eliminar.
   * @returns {boolean} false si no se eliminó
   */
  const removeVoice = async (instrumentId, voiceNumber) => {
    if (instrumentId === primaryInstrument && voiceNumber === primaryVoiceNumber) {
      onError("No puedes eliminar la voz principal");
      return false;
    }

    if (voices[instrumentId]?.[voiceNumber] === undefined) return false;

    const updated = { ...voices, [instrumentId]: { ...voices[instrumentId] } };
    delete updated[instrumentId][voiceNumber];

    // Si el instrumento se queda sin voces, desaparece del mapa
    if (Object.keys(updated[instrumentId]).length === 0) {
      delete updated[instrumentId];
    }

    setVoices(updated);

    // Si estábamos editando la voz eliminada, volver a la principal
    if (currentTab === `${instrumentId}-${voiceNumber}`) {
      setCurrentTab(`${primaryInstrument}-${primaryVoiceNumber}`);
    }

    if (isPersisted) {
      try {
        await removeVoiceFromSong(songId, instrumentId, voiceNumber);
      } catch (error) {
        console.error("Error removing voice:", error);
        onError("Error al eliminar la voz: " + error.message);
      }
    }

    return true;
  };

  const getCurrentTabContent = () => {
    if (currentTab === LYRICS_TAB) return lyrics.value;

    const parsed = parseVoiceKey(currentTab);
    if (!parsed) return "";
    return voices[parsed.instrumentId]?.[parsed.voiceNumber] || "";
  };

  const updateCurrentTabContent = (newContent) => {
    if (currentTab === LYRICS_TAB) {
      lyrics.onChange(newContent);
      return;
    }

    const parsed = parseVoiceKey(currentTab);
    if (!parsed) return;

    const { instrumentId, voiceNumber } = parsed;
    setVoices({
      ...voices,
      [instrumentId]: { ...(voices[instrumentId] || {}), [voiceNumber]: newContent }
    });
  };

  return {
    voices,
    setVoices,
    currentTab,
    setCurrentTab,
    primaryInstrument,
    setPrimaryInstrument,
    primaryVoiceNumber,
    setPrimaryVoiceNumber,
    addVoice,
    removeVoice,
    getCurrentTabContent,
    updateCurrentTabContent
  };
}

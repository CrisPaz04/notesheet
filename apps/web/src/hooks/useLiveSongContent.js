import { useState, useEffect, useRef, useMemo } from "react";
import { getSongById } from "@notesheet/api";
import {
  renderSongContent,
  buildVoicesList,
  resolveInitialVoice,
  parseVoiceKey,
  TRANSPOSING_INSTRUMENTS
} from "@notesheet/core";

/**
 * Carga la canción activa de una sesión y la deja lista para esta pantalla.
 *
 * Es la pieza que junta lo compartido con lo de cada quien: la tonalidad viene
 * de la sesión (es de concierto, igual para todos) y el instrumento, la voz y
 * la notación son locales. Dos músicos mirando la misma sesión ven la misma
 * canción en la misma tonalidad sonando, pero cada uno en su papel.
 *
 * Las canciones cargadas se quedan en una caché mientras la pantalla siga
 * abierta. En el servicio se va y se vuelve entre canciones todo el rato, y
 * volver atrás no debería mostrar un spinner ni gastar una lectura más.
 *
 * @param {Object} options
 * @param {Object|null} options.song - Entrada de la sesión: `{ id, key }`
 * @param {string} options.instrument - Instrumento del músico
 * @param {string} options.notationSystem - 'latin' o 'english'
 * @param {string|null} options.voiceKey - Voz elegida, ej. "bb_trumpet-2"
 */
export default function useLiveSongContent({
  song,
  instrument,
  notationSystem = "latin",
  voiceKey = null
} = {}) {
  const [cargada, setCargada] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cache = useRef(new Map());
  const songId = song?.id || null;

  useEffect(() => {
    if (!songId) {
      setCargada(null);
      return undefined;
    }

    const enCache = cache.current.get(songId);
    if (enCache) {
      setCargada(enCache);
      setError("");
      return undefined;
    }

    let cancelado = false;
    setLoading(true);
    setError("");

    getSongById(songId)
      .then((doc) => {
        if (cancelado) return;
        cache.current.set(songId, doc);
        setCargada(doc);
      })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error cargando la canción de la sesión:", e);
        // Firestore devuelve `permission-denied` en dos casos que desde el
        // cliente son indistinguibles: la canción existe pero no está
        // publicada, o ya no existe (borrada del repertorio y todavía
        // referenciada por una lista vieja). En los dos la regla evalúa
        // `resource.data` y deniega. Por eso el mensaje no afirma cuál es:
        // decir "no está publicada" de una canción borrada manda al músico a
        // buscar un botón de publicar que no va a encontrar.
        setError(
          "Esta canción no está disponible: puede que se haya borrado del " +
          "repertorio o que no esté compartida. Quien abrió la sesión puede " +
          "quitarla de la lista."
        );
        setCargada(null);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => { cancelado = true; };
  }, [songId]);

  const voices = useMemo(
    () => buildVoicesList(cargada?.voices, TRANSPOSING_INSTRUMENTS),
    [cargada]
  );

  /**
   * Voz que toca este músico.
   *
   * Se prefiere la que eligió a mano; si no hay, `resolveInitialVoice` elige
   * la principal de la canción. Cuando el músico cambia de instrumento y ese
   * instrumento tiene voz escrita, se salta a ella: el saxo alto no quiere
   * leer el papel de la trompeta transpuesto si tiene el suyo.
   */
  const voiceKeyEfectiva = useMemo(() => {
    if (!cargada) return null;
    if (voiceKey && parseVoiceKey(voiceKey)) return voiceKey;

    const delInstrumento = voices.find((v) => v.instrumentId === instrument);
    if (delInstrumento) return delInstrumento.id;

    return resolveInitialVoice(cargada, null).voiceKey;
  }, [cargada, voices, voiceKey, instrument]);

  const contenido = useMemo(() => {
    if (!cargada) return "";
    return resolveInitialVoice(cargada, voiceKeyEfectiva).content;
  }, [cargada, voiceKeyEfectiva]);

  /**
   * El pipeline de siempre, en su orden: tonalidad, instrumento, notación.
   *
   * `baseKey` es la de la canción del repertorio y `targetKey` la que decidió
   * la sesión. La voz elegida puede ser la de otro instrumento, y entonces
   * `renderSongContent` la transpone desde la referencia: es lo correcto,
   * porque las voces se escriben siempre en trompeta en Sib.
   */
  const rendered = useMemo(() => {
    if (!cargada) return null;

    return renderSongContent(contenido, {
      baseKey: cargada.key,
      targetKey: song?.key || cargada.key,
      instrument,
      notationSystem
    });
  }, [cargada, contenido, song?.key, instrument, notationSystem]);

  return {
    song: cargada,
    rendered,
    voices,
    voiceKey: voiceKeyEfectiva,
    loading,
    error
  };
}

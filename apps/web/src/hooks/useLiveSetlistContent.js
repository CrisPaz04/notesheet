import { useState, useEffect, useRef, useMemo } from "react";
import { getSongById } from "@notesheet/api";
import {
  renderSongContent,
  buildVoicesList,
  resolveInitialVoice,
  parseVoiceKey,
  TRANSPOSING_INSTRUMENTS,
  isPdfSong,
  resolveScore,
  buildScoreVoicesList
} from "@notesheet/core";

/**
 * Carga y renderiza TODAS las canciones de la sesión, no solo la activa.
 *
 * Que se vean todas seguidas no es un capricho de diseño: en los enlaces
 * rápidos entre canciones hace falta ver el final de una y el principio de la
 * siguiente a la vez. Con una sola canción en pantalla, ese momento —que es
 * justo cuando no se puede apartar la vista del papel— es el que peor queda.
 *
 * La canción activa sigue siendo compartida, pero pasa de ser un filtro a ser
 * un puntero: marca dónde va la banda y lleva el scroll ahí, sin esconder lo
 * demás.
 *
 * Es la pieza que junta lo compartido con lo de cada quien: la tonalidad viene
 * de la sesión (es de concierto, igual para todos) y el instrumento, la voz y
 * la notación son locales.
 *
 * @param {Object} options
 * @param {Array} options.songs - Canciones de la sesión: `[{ id, key }]`
 * @param {string} options.instrument - Instrumento del músico
 * @param {string} options.notationSystem - 'latin' o 'english'
 * @param {Object} options.voiceKeys - Voz elegida a mano por canción
 */
export default function useLiveSetlistContent({
  songs = [],
  instrument,
  notationSystem = "latin",
  voiceKeys = {}
} = {}) {
  const [cargadas, setCargadas] = useState({});
  const [errores, setErrores] = useState({});
  const [loading, setLoading] = useState(false);

  /**
   * Caché viva mientras la pantalla siga abierta.
   *
   * Durante el servicio se añaden y quitan canciones sobre la marcha; volver a
   * pedir a Firestore las que ya estaban sería gastar lecturas y meter un
   * parpadeo en mitad de la partitura que alguien está leyendo.
   */
  const cache = useRef(new Map());

  // Los ids en una cadena estable: el array de la sesión es nuevo en cada
  // snapshot aunque las canciones sean las mismas, y comparar por referencia
  // relanzaría la carga con cada latido de presencia de cualquiera.
  const ids = useMemo(() => songs.map((s) => s.id).filter(Boolean), [songs]);
  const clave = ids.join(",");

  useEffect(() => {
    const pendientes = ids.filter((id) => !cache.current.has(id));

    if (pendientes.length === 0) {
      // Puede haber cambiado el orden sin cambiar el contenido: se vuelca la
      // caché igual para que el render tenga todo lo que necesita.
      setCargadas(Object.fromEntries(cache.current));
      return undefined;
    }

    let cancelado = false;
    setLoading(true);

    Promise.all(pendientes.map(async (id) => {
      try {
        const doc = await getSongById(id);
        cache.current.set(id, doc);
      } catch (e) {
        console.error(`Error cargando la canción ${id} de la sesión:`, e);
        // Firestore devuelve `permission-denied` en dos casos que desde el
        // cliente son indistinguibles: la canción existe pero no está
        // compartida, o ya no existe. Por eso el mensaje no afirma cuál es.
        if (!cancelado) {
          setErrores((prev) => ({
            ...prev,
            [id]: "Esta canción no está disponible: puede que se haya borrado " +
                  "del repertorio o que no esté compartida."
          }));
        }
      }
    })).then(() => {
      if (cancelado) return;
      setCargadas(Object.fromEntries(cache.current));
      setLoading(false);
    });

    return () => { cancelado = true; };
    // `clave` resume los ids; `ids` cambia de identidad en cada snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  /**
   * Cada canción de la sesión, ya renderizada para este músico.
   *
   * Se recalcula entero al cambiar de instrumento o de notación, que es lo
   * correcto: son cambios que afectan a todas las canciones a la vez y pasan
   * una vez cada mucho, no en cada render.
   */
  const preparadas = useMemo(() => songs.map((entrada) => {
    const doc = cargadas[entrada.id];

    if (!doc) {
      return {
        ...entrada,
        cargada: null,
        rendered: null,
        voices: [],
        voiceKey: null,
        error: errores[entrada.id] || null
      };
    }

    // Una partitura en PDF no pasa por el pipeline: no hay texto que
    // transponer. Lo que hace el instrumento es elegir el archivo, como en la
    // vista de la canción, y la voz elegida a mano manda sobre él.
    if (isPdfSong(doc)) {
      const score = resolveScore(doc, { voiceKey: voiceKeys[entrada.id] || null, instrument });
      return {
        ...entrada,
        cargada: doc,
        rendered: null,
        pdf: { path: score.path },
        voices: buildScoreVoicesList(doc.pdfs, TRANSPOSING_INSTRUMENTS),
        voiceKey: score.voiceKey,
        error: null
      };
    }

    const voices = buildVoicesList(doc.voices, TRANSPOSING_INSTRUMENTS);

    // Se prefiere la voz que eligió a mano para esta canción; si no hay, la
    // escrita para su instrumento; si tampoco, la principal. Un saxo alto no
    // quiere leer el papel de trompeta transpuesto si tiene el suyo.
    const elegida = voiceKeys[entrada.id];
    let voiceKey = null;

    if (elegida && parseVoiceKey(elegida)) {
      voiceKey = elegida;
    } else {
      const delInstrumento = voices.find((v) => v.instrumentId === instrument);
      voiceKey = delInstrumento ? delInstrumento.id : resolveInitialVoice(doc, null).voiceKey;
    }

    const { content } = resolveInitialVoice(doc, voiceKey);

    // El pipeline en su orden: tonalidad, instrumento, notación. `baseKey` es
    // la de la canción del repertorio y `targetKey` la que decidió la sesión.
    const rendered = renderSongContent(content, {
      baseKey: doc.key,
      targetKey: entrada.key || doc.key,
      instrument,
      notationSystem
    });

    return { ...entrada, cargada: doc, rendered, voices, voiceKey, error: null };
  }), [songs, cargadas, errores, instrument, notationSystem, voiceKeys]);

  return { canciones: preparadas, loading };
}

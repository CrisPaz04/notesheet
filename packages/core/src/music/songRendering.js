// packages/core/src/music/songRendering.js
//
// Pipeline de renderizado de una canción para su visualización.
//
// Antes esta secuencia estaba duplicada cinco veces dentro de SongView.jsx
// (carga inicial, transposición, cambio de notación, cambio de voz y cambio
// de instrumento), cada copia con pequeñas diferencias. De ahí salieron los
// bugs del selector de voces y de las dobles alteraciones. Aquí vive una
// sola versión, pura y testeable.

import { transposeContent } from './transposition';
import { convertNotationSystem, formatSong } from './notation';
import {
  transposeForInstrument,
  transposeBySemitones,
  transposeKeyBySemitones,
  getVisualKeyForInstrument
} from './transposition-helper';
import { splitChordSegment } from './chords';

// Las voces se escriben siempre en la tonalidad de trompeta en Sib; el resto
// de instrumentos se obtiene transponiendo desde esa referencia.
export const SOURCE_INSTRUMENT = 'bb_trumpet';

/**
 * Funde varias secciones en una sola.
 *
 * Las cabeceras `##` son de la vista de acordes: marcan dónde entra cada
 * instrumento, y se pintan como tarjetas sueltas, con el título en mayúsculas
 * y tres rem de aire entre una y la siguiente. A quien viene a cantar eso le
 * parte la letra en trozos y le multiplica el scroll. Aquí el título se queda
 * como una línea más dentro del mismo bloque, que es como está escrita una
 * hoja de letra de toda la vida.
 *
 * Una sección que se queda sin contenido —un "Intro" o un interludio al que se
 * le han quitado los acordes— desaparece entera: su título suelto no le dice
 * nada a quien viene a leer la letra.
 *
 * @param {Array<{title: string, content: string}>} sections
 * @returns {Array<{title: string, content: string}>} Cero o una sección
 */
const unirSecciones = (sections) => {
  const bloques = sections
    .map((section) => {
      const texto = (section.content || '').trim();
      if (!texto) return '';
      return section.title ? `${section.title}\n${texto}` : texto;
    })
    .filter(Boolean);

  const content = bloques.join('\n\n');
  return content ? [{ title: '', content }] : [];
};

/**
 * Elimina los acordes de una canción ya formateada, dejando solo la letra.
 * Opera sobre el objeto que devuelve `formatSong`, no sobre texto plano
 * (para eso existe `extractLyricsOnly` en notation.js).
 *
 * Devuelve **una sola sección**, aunque la canción venga partida en muchas
 * (ver `unirSecciones`).
 *
 * @param {Object} formattedSong - Resultado de `formatSong`
 * @returns {Object|null} Misma estructura, con la letra entera en `sections[0]`
 */
export const extractLyricsSections = (formattedSong) => {
  if (!formattedSong || !formattedSong.sections) return null;

  // Se quitan las líneas de acordes enteras en vez de borrar nota a nota:
  // splitChordSegment distingue un acorde de una palabra, así que "LAm" o
  // "Cmaj7" desaparecen sin tocar letra como "Amor" o "Dame".
  const sinAcordes = formattedSong.sections.map((section) => ({
    ...section,
    content: section.content
      .split('\n')
      .map((line) => (splitChordSegment(line) ? '' : line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }));

  return { ...formattedSong, sections: unirSecciones(sinAcordes) };
};

/**
 * Formatea un texto que ya es solo letra —el campo `lyricsOnly`, que en las
 * canciones en PDF es la única vista de texto que hay— en un único bloque.
 *
 * No pasa por `extractLyricsSections` a propósito: ahí no hay acordes que
 * quitar, y quitarlos se llevaría por delante una línea de letra que por mala
 * suerte se pareciera a una de acordes.
 *
 * @param {string} content - Texto de la letra
 * @returns {Object|null} Estructura de `formatSong` con la letra en `sections[0]`
 */
export const formatLyrics = (content) => {
  if (!content || !content.trim()) return null;

  const formatted = formatSong(content);
  return { ...formatted, sections: unirSecciones(formatted.sections) };
};

/**
 * Aplica transposición de tonalidad, transposición por instrumento, capo y
 * conversión de notación, y devuelve el contenido listo para mostrar.
 *
 * El orden importa: primero se cambia de tonalidad, después se adapta al
 * instrumento, luego el capo, y solo al final se traduce la notación.
 * Invertirlo produce dobles alteraciones.
 *
 * **El capo no cambia lo que suena, cambia lo que se lee.** Con la cejilla en
 * el traste 3, el guitarrista toca las formas tres semitonos por debajo y la
 * cejilla las devuelve a su sitio. Por eso se resta: `displayKey` es lo que
 * el músico lee y `soundingKey` lo que la banda oye, y con capo no coinciden.
 *
 * @param {string} content - Contenido original de la voz seleccionada
 * @param {Object} options
 * @param {string} options.baseKey - Tonalidad en la que está escrita la canción
 * @param {string} options.targetKey - Tonalidad a la que se quiere transponer
 * @param {string} options.instrument - Instrumento de destino
 * @param {string} options.notationSystem - 'latin' o 'english'
 * @param {number} options.capo - Traste de la cejilla (0 = sin capo)
 * @returns {{ formatted: Object, lyricsOnly: Object, displayKey: string, soundingKey: string }}
 */
export const renderSongContent = (content, {
  baseKey,
  targetKey,
  instrument = SOURCE_INSTRUMENT,
  notationSystem = 'latin',
  capo = 0
} = {}) => {
  let processed = content || '';

  if (targetKey && baseKey && targetKey !== baseKey) {
    processed = transposeContent(processed, baseKey, targetKey);
  }

  if (instrument !== SOURCE_INSTRUMENT) {
    processed = transposeForInstrument(processed, SOURCE_INSTRUMENT, instrument);
  }

  // Un capo negativo o no numérico no significa nada: se ignora.
  const trasteCapo = Number.isInteger(capo) && capo > 0 ? capo : 0;
  if (trasteCapo) {
    processed = transposeBySemitones(processed, -trasteCapo);
  }

  // `convertNotationSystem` es idempotente: aplicarla siempre mantiene el
  // sistema elegido aunque la canción se haya escrito en el otro.
  processed = convertNotationSystem(processed, notationSystem);

  const formatted = formatSong(processed);
  const soundingKey = getVisualKeyForInstrument(targetKey || baseKey, instrument);

  return {
    formatted,
    lyricsOnly: extractLyricsSections(formatted),
    displayKey: transposeKeyBySemitones(soundingKey, -trasteCapo),
    soundingKey
  };
};

/**
 * La referencia en la que se guardan los acordes (`song.acordes`): el tono
 * de concierto, lo que suena y lo que toca la guitarra sin cejilla.
 *
 * No la de la trompeta en Sib, como las notas. Así el guitarrista escribe lo
 * que toca, y lo que escribe es lo que se guarda: convertir a Sib al guardar
 * y deshacerlo al abrir el editor cambiaba la ortografía (SIb subía a DO y
 * bajaba como LA#), porque el transpositor conserva el bemol o el sostenido
 * de cada nota y DO no tiene ninguno.
 */
export const CHORDS_SOURCE_INSTRUMENT = 'c_guitar';

/**
 * Prepara los acordes de una canción para mostrarlos, con el mismo recorrido
 * que las notas: tonalidad, instrumento, cejilla y notación.
 *
 * Las tonalidades (`baseKey`, `targetKey`) son las de la canción, que están en
 * la referencia de Sib como `key`. Se pasan a concierto antes de transponer:
 * la distancia es la misma, pero `transposeContent` elige bemoles o
 * sostenidos según la tonalidad, y la buena es la que están escritos.
 *
 * @param {string} acordes - `song.acordes`, en concierto
 * @param {Object} options - Las mismas de `renderSongContent`
 * @returns {Object|null} Estructura de `formatSong`, o null si no hay acordes
 */
export const renderChordChart = (acordes, {
  baseKey,
  targetKey,
  instrument = SOURCE_INSTRUMENT,
  notationSystem = 'latin',
  capo = 0
} = {}) => {
  if (!acordes || !acordes.trim()) return null;

  let processed = acordes;

  if (targetKey && baseKey && targetKey !== baseKey) {
    processed = transposeContent(
      processed,
      getVisualKeyForInstrument(baseKey, CHORDS_SOURCE_INSTRUMENT),
      getVisualKeyForInstrument(targetKey, CHORDS_SOURCE_INSTRUMENT)
    );
  }

  if (instrument !== CHORDS_SOURCE_INSTRUMENT) {
    processed = transposeForInstrument(processed, CHORDS_SOURCE_INSTRUMENT, instrument);
  }

  const trasteCapo = Number.isInteger(capo) && capo > 0 ? capo : 0;
  if (trasteCapo) {
    processed = transposeBySemitones(processed, -trasteCapo);
  }

  return formatSong(convertNotationSystem(processed, notationSystem));
};

/**
 * Construye la lista plana de voces disponibles de una canción a partir de
 * `song.voices`, ordenada por instrumento y número de voz.
 *
 * @param {Object} voices - Mapa `{ instrumentId: { voiceNumber: contenido } }`
 * @param {Object} instrumentCatalog - Mapa de instrumentos para los nombres
 * @returns {Array<{id: string, instrumentId: string, voiceNumber: string, label: string}>}
 */
export const buildVoicesList = (voices, instrumentCatalog = {}) => {
  if (!voices) return [];

  const list = [];
  Object.entries(voices).forEach(([instrumentId, instrumentVoices]) => {
    Object.keys(instrumentVoices).sort().forEach((voiceNumber) => {
      const instrumentName = instrumentCatalog[instrumentId]?.name || instrumentId;
      list.push({
        id: `${instrumentId}-${voiceNumber}`,
        instrumentId,
        voiceNumber,
        label: `${instrumentName} ${voiceNumber}`
      });
    });
  });

  return list;
};

/**
 * Separa una clave de voz ("bb_trumpet-1") en instrumento y número.
 * Usa el último guión porque los ids de instrumento contienen guiones.
 *
 * @param {string} voiceKey
 * @returns {{instrumentId: string, voiceNumber: string}|null}
 */
export const parseVoiceKey = (voiceKey) => {
  if (!voiceKey) return null;
  const lastDash = voiceKey.lastIndexOf('-');
  if (lastDash <= 0) return null;
  return {
    instrumentId: voiceKey.substring(0, lastDash),
    voiceNumber: voiceKey.substring(lastDash + 1)
  };
};

/**
 * Resuelve qué voz mostrar al abrir una canción: la que ya estaba
 * seleccionada, la voz primaria, la primera disponible, o el contenido
 * plano de la canción como último recurso.
 *
 * @param {Object} song - Canción cargada
 * @param {string|null} preferredVoiceKey - Voz previamente seleccionada
 * @returns {{content: string, voiceKey: string|null}}
 */
export const resolveInitialVoice = (song, preferredVoiceKey = null) => {
  const voices = song?.voices;
  const hasVoices = voices && Object.keys(voices).length > 0;

  if (hasVoices && preferredVoiceKey) {
    const parsed = parseVoiceKey(preferredVoiceKey);
    const content = parsed && voices[parsed.instrumentId]?.[parsed.voiceNumber];
    if (content) return { content, voiceKey: preferredVoiceKey };
  }

  if (hasVoices) {
    const instrumentId = song.primaryInstrument || Object.keys(voices)[0];
    const voiceNumber = song.primaryVoiceNumber || Object.keys(voices[instrumentId] || {})[0];
    const content = voices[instrumentId]?.[voiceNumber];
    if (content) {
      return { content, voiceKey: `${instrumentId}-${voiceNumber}` };
    }
  }

  return { content: song?.content || '', voiceKey: null };
};

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
import { transposeForInstrument, getVisualKeyForInstrument } from './transposition-helper';
import { splitChordSegment } from './chords';

// Las voces se escriben siempre en la tonalidad de trompeta en Sib; el resto
// de instrumentos se obtiene transponiendo desde esa referencia.
export const SOURCE_INSTRUMENT = 'bb_trumpet';

/**
 * Elimina los acordes de una canción ya formateada, dejando solo la letra.
 * Opera sobre el objeto que devuelve `formatSong`, no sobre texto plano
 * (para eso existe `extractLyricsOnly` en notation.js).
 *
 * @param {Object} formattedSong - Resultado de `formatSong`
 * @returns {Object|null} Misma estructura, con las secciones sin acordes
 */
export const extractLyricsSections = (formattedSong) => {
  if (!formattedSong || !formattedSong.sections) return null;

  // Se quitan las líneas de acordes enteras en vez de borrar nota a nota:
  // splitChordSegment distingue un acorde de una palabra, así que "LAm" o
  // "Cmaj7" desaparecen sin tocar letra como "Amor" o "Dame".
  const sections = formattedSong.sections.map((section) => ({
    ...section,
    content: section.content
      .split('\n')
      .map((line) => (splitChordSegment(line) ? '' : line))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }));

  return { ...formattedSong, sections };
};

/**
 * Aplica transposición de tonalidad, transposición por instrumento y
 * conversión de notación, y devuelve el contenido listo para mostrar.
 *
 * El orden importa: primero se cambia de tonalidad, después se adapta al
 * instrumento y solo al final se traduce la notación. Invertirlo produce
 * dobles alteraciones.
 *
 * @param {string} content - Contenido original de la voz seleccionada
 * @param {Object} options
 * @param {string} options.baseKey - Tonalidad en la que está escrita la canción
 * @param {string} options.targetKey - Tonalidad a la que se quiere transponer
 * @param {string} options.instrument - Instrumento de destino
 * @param {string} options.notationSystem - 'latin' o 'english'
 * @returns {{ formatted: Object, lyricsOnly: Object, displayKey: string }}
 */
export const renderSongContent = (content, {
  baseKey,
  targetKey,
  instrument = SOURCE_INSTRUMENT,
  notationSystem = 'latin'
} = {}) => {
  let processed = content || '';

  if (targetKey && baseKey && targetKey !== baseKey) {
    processed = transposeContent(processed, baseKey, targetKey);
  }

  if (instrument !== SOURCE_INSTRUMENT) {
    processed = transposeForInstrument(processed, SOURCE_INSTRUMENT, instrument);
  }

  // `convertNotationSystem` es idempotente: aplicarla siempre mantiene el
  // sistema elegido aunque la canción se haya escrito en el otro.
  processed = convertNotationSystem(processed, notationSystem);

  const formatted = formatSong(processed);

  return {
    formatted,
    lyricsOnly: extractLyricsSections(formatted),
    displayKey: getVisualKeyForInstrument(targetKey || baseKey, instrument)
  };
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

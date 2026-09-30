// packages/core/src/music/transposition-helper.js
import { transposeContent } from './transposition';
import { mapChordLine, countChordRoots } from './chords';
import { TRANSPOSING_INSTRUMENTS } from './instruments';
import { transponerTonalidad, nombrarNota } from './ortografia';

/**
 * Transpone el contenido un número de semitonos, sin pasar por tonalidades.
 *
 * Es el motor que hay debajo de `transposeForInstrument`, y lo usa también el
 * capo, que no es un cambio de tonalidad sino un desplazamiento fijo: con la
 * cejilla en el traste 3 se tocan las formas tres semitonos por debajo de lo
 * que suena.
 *
 * Respeta el sistema de notación predominante de la canción. Con `ortografia`
 * (la de `ortografiaDe`, de la tonalidad en la que se va a leer) cada nota se
 * escribe como en esa tonalidad: SIb en FA, LA# en SI. Sin ella conserva el
 * bemol o el sostenido de cada nota, que es lo que hacía antes y deja LA# donde
 * se escribe SIb (DO no tiene alteración que conservar).
 *
 * @param {string} content - Contenido de la canción
 * @param {number} semitones - Semitonos a desplazar (puede ser negativo)
 * @param {string[]|null} [ortografia] - Cómo se escribe cada tecla
 * @returns {string} - Contenido transpuesto
 */
export function transposeBySemitones(content, semitones, ortografia = null) {
  if (!content || !semitones) return content;

  const transpositionInterval = semitones;

  // Definimos las escalas completas
  const LATIN_NOTES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
  const LATIN_NOTES_FLAT = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'SOLb', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
  const ENGLISH_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const ENGLISH_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  
  // Mapa de notas para una búsqueda más sencilla
  const noteToIndexMap = {
    // Notas latinas (incluyendo enarmónicas poco comunes)
    'DO': 0, 'DO#': 1, 'REb': 1, 'RE': 2, 'RE#': 3, 'MIb': 3, 'MI': 4, 'MI#': 5,
    'FAb': 4, 'FA': 5, 'FA#': 6, 'SOLb': 6, 'SOL': 7, 'SOL#': 8, 'LAb': 8,
    'LA': 9, 'LA#': 10, 'SIb': 10, 'SI': 11, 'SI#': 0, 'DOb': 11,
    // Notas inglesas (incluyendo enarmónicas poco comunes)
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'E#': 5,
    'Fb': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'B#': 0, 'Cb': 11
  };
  
  // Determinar el sistema de notación predominante contando las raíces de
  // acorde de las líneas de acordes (así "LAm" o "Cmaj7" también cuentan)
  const rootCounts = countChordRoots(content);
  const isLatinPredominant = rootCounts.latin >= rootCounts.english;
  
  // Procesar línea por línea
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    // Ignorar las líneas de metadatos (que comienzan con #)
    if (line.trim().startsWith('#')) {
      return line;
    }
    
    // Reemplazar la raíz de cada acorde por su versión transpuesta.
    // mapChordLine conserva sufijos ("m", "7", "sus4") y bajos ("/SOL").
    return mapChordLine(line, root => {
      const noteIndex = noteToIndexMap[root];
      if (noteIndex === undefined) {
        console.warn(`Nota no reconocida: ${root}`);
        return root;
      }

      // Calcular el nuevo índice después de transposición
      const newIndex = ((noteIndex + transpositionInterval) % 12 + 12) % 12;

      if (ortografia) {
        return nombrarNota(newIndex, ortografia, isLatinPredominant ? 'latin' : 'english');
      }

      // Usar el sistema de notación predominante para todas las notas,
      // respetando la preferencia de bemoles de la nota original
      const useFlats = root.includes('b');
      const targetArray = isLatinPredominant
        ? (useFlats ? LATIN_NOTES_FLAT : LATIN_NOTES)
        : (useFlats ? ENGLISH_NOTES_FLAT : ENGLISH_NOTES);

      return targetArray[newIndex];
    });
  });

  return processedLines.join('\n');
}

/**
 * Transpone el contenido de un instrumento a otro
 * @param {string} content - Contenido de la canción
 * @param {string} fromInstrument - ID del instrumento de origen
 * @param {string} toInstrument - ID del instrumento de destino
 * @returns {string} - Contenido transpuesto para el instrumento de destino
 */
export function transposeForInstrument(content, fromInstrument, toInstrument) {
  // Si los instrumentos son iguales, no hay transposición
  if (fromInstrument === toInstrument) return content;

  const fromTransposition = TRANSPOSING_INSTRUMENTS[fromInstrument]?.transposition || 0;
  const toTransposition = TRANSPOSING_INSTRUMENTS[toInstrument]?.transposition || 0;

  // La transposición necesaria es la diferencia entre ambos instrumentos
  return transposeBySemitones(content, toTransposition - fromTransposition);
}

/**
 * Desplaza una tonalidad un número de semitonos y le da su nombre habitual
 * (`transponerTonalidad`, en ortografia.js): "DO" dos semitonos abajo es
 * "SIb", no "LA#". Antes conservaba el bemol o el sostenido de la de partida,
 * y como DO no tiene ninguno, la tonalidad de concierto salía LA#.
 *
 * Conserva el modo (mayor o menor). Es el motor de `getVisualKeyForInstrument`
 * y lo usa también el capo, que baja la tonalidad que se lee sin tocar la que
 * suena.
 *
 * @param {string} key - Tonalidad de partida ("RE", "LAm", "MIb", "Am"...)
 * @param {number} semitones - Semitonos a desplazar (puede ser negativo)
 * @returns {string} - Tonalidad desplazada, o la original si no se reconoce
 */
export function transposeKeyBySemitones(key, semitones) {
  if (!key || !semitones) return key;

  const transpuesta = transponerTonalidad(key, semitones);
  if (transpuesta === null) {
    console.warn(`Tonalidad no reconocida: ${key}`);
    return key; // Fallback a la tonalidad original
  }
  return transpuesta;
}

/**
 * Calcula la tonalidad visual para un instrumento
 * @param {string} baseKey - Tonalidad base (en referencia a trompeta)
 * @param {string} instrument - ID del instrumento
 * @returns {string} - Tonalidad visual para ese instrumento
 */
export function getVisualKeyForInstrument(baseKey, instrument) {
  if (!baseKey || !instrument || instrument === "bb_trumpet") {
    return baseKey; // Para trompeta, la tonalidad visual es la misma
  }

  return transposeKeyBySemitones(
    baseKey,
    TRANSPOSING_INSTRUMENTS[instrument]?.transposition ?? 0
  );
}
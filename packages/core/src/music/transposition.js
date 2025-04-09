// packages/core/src/music/transposition.js

// Definición de notas en notación latina y anglosajona
const LATIN_NOTES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
const ENGLISH_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Mapeo de bemoles a sostenidos equivalentes
const FLAT_TO_SHARP = {
  'DOb': 'SI', 'REb': 'DO#', 'MIb': 'RE#', 'FAb': 'MI', 
  'SOLb': 'FA#', 'LAb': 'SOL#', 'SIb': 'LA#',
  'Db': 'C#', 'Eb': 'D#', 'Fb': 'E', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

// Mapeo de tonalidades a sus índices
const KEY_TO_INDEX = {
  // Tonalidades mayores en notación latina
  'DO': 0, 'DO#': 1, 'RE': 2, 'RE#': 3, 'MI': 4, 'FA': 5, 
  'FA#': 6, 'SOL': 7, 'SOL#': 8, 'LA': 9, 'LA#': 10, 'SI': 11,
  
  // Tonalidades mayores en notación anglosajona
  'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 
  'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
  
  // Añadir bemoles para ambas notaciones
  'DOb': 11, 'REb': 1, 'MIb': 3, 'FAb': 4, 'SOLb': 6, 'LAb': 8, 'SIb': 10,
  'Db': 1, 'Eb': 3, 'Fb': 4, 'Gb': 6, 'Ab': 8, 'Bb': 10
};

/**
 * Determina si una nota está en notación latina o anglosajona
 * @param {string} note - La nota a evaluar
 * @returns {string} 'latin' o 'english'
 */
const getNoteSystem = (note) => {
  const normalizedNote = note.replace('b', '').replace('#', '');
  return LATIN_NOTES.includes(normalizedNote) ? 'latin' : 'english';
};

/**
 * Transpone una nota individual a una nueva tonalidad
 * @param {string} note - La nota a transponer
 * @param {number} semitones - Cantidad de semitonos a transponer (positivo: subir, negativo: bajar)
 * @param {string} targetSystem - Sistema de notación objetivo ('latin' o 'english')
 * @returns {string} La nota transpuesta
 */
export const transposeNote = (note, semitones, targetSystem = null) => {
  // Normalizar bemoles a sostenidos equivalentes
  let normalizedNote = note;
  if (note.includes('b')) {
    normalizedNote = FLAT_TO_SHARP[note] || note;
  }
  
  // Determinar el sistema de notación de origen y destino
  const sourceSystem = getNoteSystem(normalizedNote);
  const outputSystem = targetSystem || sourceSystem;
  
  // Obtener el índice de la nota en el array
  const noteIndex = KEY_TO_INDEX[normalizedNote];
  if (noteIndex === undefined) return note; // No es una nota válida
  
  // Calcular el nuevo índice después de transponer
  const notesArray = sourceSystem === 'latin' ? LATIN_NOTES : ENGLISH_NOTES;
  const totalNotes = notesArray.length;
  const newIndex = (noteIndex + semitones + totalNotes) % totalNotes;
  
  // Obtener la nueva nota en el sistema destino
  const targetArray = outputSystem === 'latin' ? LATIN_NOTES : ENGLISH_NOTES;
  return targetArray[newIndex];
};

/**
 * Transpone una tonalidad completa a otra
 * @param {string} sourceKey - Tonalidad de origen
 * @param {string} targetKey - Tonalidad de destino
 * @returns {number} Diferencia en semitonos entre las tonalidades
 */
export const getKeyDistance = (sourceKey, targetKey) => {
  // Normalizar bemoles
  const normSource = sourceKey.includes('b') ? FLAT_TO_SHARP[sourceKey] || sourceKey : sourceKey;
  const normTarget = targetKey.includes('b') ? FLAT_TO_SHARP[targetKey] || targetKey : targetKey;
  
  // Obtener índices
  const sourceIndex = KEY_TO_INDEX[normSource];
  const targetIndex = KEY_TO_INDEX[normTarget];
  
  if (sourceIndex === undefined || targetIndex === undefined) {
    throw new Error('Tonalidad inválida');
  }
  
  // Calcular diferencia
  return (targetIndex - sourceIndex + 12) % 12;
};

/**
 * Transpone una línea de texto con notación musical
 * @param {string} line - Línea de texto con notación musical
 * @param {number} semitones - Cantidad de semitonos a transponer
 * @param {string} targetSystem - Sistema de notación objetivo ('latin' o 'english')
 * @returns {string} Línea transpuesta
 */
export const transposeLine = (line, semitones, targetSystem = null) => {
  // Expresión regular para detectar notas musicales
  const noteRegex = /\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?\b/g;
  
  return line.replace(noteRegex, (match) => {
    return transposeNote(match, semitones, targetSystem);
  });
};

/**
 * Transpone el contenido completo de una canción
 * @param {string} content - Contenido de la canción con notación musical
 * @param {string} sourceKey - Tonalidad de origen
 * @param {string} targetKey - Tonalidad de destino
 * @param {string} targetSystem - Sistema de notación objetivo ('latin' o 'english')
 * @returns {string} Contenido transpuesto
 */
export const transposeContent = (content, sourceKey, targetKey, targetSystem = null) => {
  try {
    const semitones = getKeyDistance(sourceKey, targetKey);
    
    // Procesar línea por línea
    return content
      .split('\n')
      .map(line => transposeLine(line, semitones, targetSystem))
      .join('\n');
  } catch (error) {
    console.error('Error transponiendo contenido:', error);
    return content; // Devolver el contenido original si hay error
  }
};
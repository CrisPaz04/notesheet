// packages/core/src/music/transposition.js (versión actualizada)

// Definición de notas en notación latina y anglosajona
const LATIN_NOTES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
const ENGLISH_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Mapeo entre sostenidos y bemoles
const SHARP_TO_FLAT = {
  'DO#': 'REb', 'RE#': 'MIb', 'FA#': 'SOLb', 'SOL#': 'LAb', 'LA#': 'SIb',
  'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb'
};

const FLAT_TO_SHARP = {
  'REb': 'DO#', 'MIb': 'RE#', 'SOLb': 'FA#', 'LAb': 'SOL#', 'SIb': 'LA#',
  'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'
};

// Definición de tonalidades que usan sostenidos y bemoles
const SHARP_KEYS = ['SOL', 'RE', 'LA', 'MI', 'SI', 'FA#', 'DO#', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];
const FLAT_KEYS = ['FA', 'SIb', 'MIb', 'LAb', 'REb', 'SOLb', 'DOb', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

// Mapeo de tonalidades a sus índices
const KEY_TO_INDEX = {
  // Tonalidades mayores en notación latina
  'DO': 0, 'DO#': 1, 'REb': 1, 'RE': 2, 'RE#': 3, 'MIb': 3, 'MI': 4, 
  'FA': 5, 'FA#': 6, 'SOLb': 6, 'SOL': 7, 'SOL#': 8, 'LAb': 8, 
  'LA': 9, 'LA#': 10, 'SIb': 10, 'SI': 11, 'DOb': 11,
  
  // Tonalidades mayores en notación anglosajona
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 
  'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 
  'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11,
  
  // Tonalidades menores
  'DOm': 0, 'DO#m': 1, 'REbm': 1, 'REm': 2, 'RE#m': 3, 'MIbm': 3, 'MIm': 4, 
  'FAm': 5, 'FA#m': 6, 'SOLbm': 6, 'SOLm': 7, 'SOL#m': 8, 'LAbm': 8, 
  'LAm': 9, 'LA#m': 10, 'SIbm': 10, 'SIm': 11, 'DObm': 11,
  
  'Cm': 0, 'C#m': 1, 'Dbm': 1, 'Dm': 2, 'D#m': 3, 'Ebm': 3, 'Em': 4, 
  'Fm': 5, 'F#m': 6, 'Gbm': 6, 'Gm': 7, 'G#m': 8, 'Abm': 8, 
  'Am': 9, 'A#m': 10, 'Bbm': 10, 'Bm': 11, 'Cbm': 11
};

/**
 * Determina si una tonalidad usa sostenidos o bemoles
 * @param {string} key - La tonalidad a evaluar
 * @returns {string} 'sharp' o 'flat'
 */
const getKeySignature = (key) => {
  // Eliminar "m" si es una tonalidad menor
  const baseKey = key.replace('m', '');
  
  if (SHARP_KEYS.includes(baseKey)) {
    return 'sharp';
  } else if (FLAT_KEYS.includes(baseKey)) {
    return 'flat';
  } else {
    // DO/C no tiene sostenidos ni bemoles
    return 'natural';
  }
};

/**
 * Determina si una nota está en notación latina o anglosajona
 * @param {string} note - La nota a evaluar
 * @returns {string} 'latin' o 'english'
 */
const getNoteSystem = (note) => {
  const normalizedNote = note.replace('b', '').replace('#', '').replace('m', '');
  return normalizedNote.length > 1 && normalizedNote !== 'SI' ? 'latin' : 'english';
};

/**
 * Convierte una nota a su forma con sostenidos o bemoles según la tonalidad
 * @param {string} note - La nota a convertir
 * @param {string} keySignature - 'sharp' o 'flat'
 * @returns {string} Nota con la notación adecuada
 */
const convertNoteToSignature = (note, keySignature) => {
  if (keySignature === 'sharp' && note in FLAT_TO_SHARP) {
    return FLAT_TO_SHARP[note];
  } else if (keySignature === 'flat' && note in SHARP_TO_FLAT) {
    return SHARP_TO_FLAT[note];
  }
  return note;
};

/**
 * Transpone una nota individual a una nueva tonalidad
 * @param {string} note - La nota a transponer
 * @param {number} semitones - Cantidad de semitonos a transponer
 * @param {string} targetSystem - Sistema de notación objetivo ('latin' o 'english')
 * @param {string} keySignature - 'sharp' o 'flat' para determinar notación
 * @returns {string} La nota transpuesta
 */
export const transposeNote = (note, semitones, targetSystem = null, keySignature = 'natural') => {
  // Verificar si es una nota menor
  let isMinor = false;
  let normalizedNote = note;
  if (note.endsWith('m')) {
    isMinor = true;
    normalizedNote = note.slice(0, -1);
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
  let transposedNote = targetArray[newIndex];
  
  // Aplicar la notación adecuada (sostenidos o bemoles)
  transposedNote = convertNoteToSignature(transposedNote, keySignature);
  
  // Añadir 'm' si era una nota menor
  return isMinor ? transposedNote + 'm' : transposedNote;
};

/**
 * Transpone una tonalidad completa a otra
 * @param {string} sourceKey - Tonalidad de origen
 * @param {string} targetKey - Tonalidad de destino
 * @returns {number} Diferencia en semitonos entre las tonalidades
 */
export const getKeyDistance = (sourceKey, targetKey) => {
  // Manejar tonalidades menores
  let sourceIsMinor = false;
  let targetIsMinor = false;
  let sourceKeyBase = sourceKey;
  let targetKeyBase = targetKey;
  
  if (sourceKey.endsWith('m')) {
    sourceIsMinor = true;
    sourceKeyBase = sourceKey.slice(0, -1);
  }
  
  if (targetKey.endsWith('m')) {
    targetIsMinor = true;
    targetKeyBase = targetKey.slice(0, -1);
  }
  
  // Obtener índices
  const sourceIndex = KEY_TO_INDEX[sourceKeyBase];
  const targetIndex = KEY_TO_INDEX[targetKeyBase];
  
  if (sourceIndex === undefined || targetIndex === undefined) {
    throw new Error('Tonalidad inválida');
  }
  
  // Calcular diferencia de semitonos
  let semitones = (targetIndex - sourceIndex + 12) % 12;
  
  // Para escalas menores naturales, usamos la misma lógica que las mayores
  // ya que la transposición de notas ocurrirá individualmente
  
  return semitones;
};

/**
 * Transpone una línea de texto con notación musical
 * @param {string} line - Línea de texto con notación musical
 * @param {number} semitones - Cantidad de semitonos a transponer
 * @param {string} targetSystem - Sistema de notación objetivo
 * @param {string} keySignature - 'sharp' o 'flat' para determinar notación
 * @returns {string} Línea transpuesta
 */
export const transposeLine = (line, semitones, targetSystem = null, keySignature = 'natural') => {
  // Expresión regular para detectar notas musicales (incluyendo menores)
  const noteRegex = /\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?(?:m)?\b/g;
  
  return line.replace(noteRegex, (match) => {
    return transposeNote(match, semitones, targetSystem, keySignature);
  });
};

/**
 * Transpone el contenido completo de una canción
 * @param {string} content - Contenido de la canción con notación musical
 * @param {string} sourceKey - Tonalidad de origen
 * @param {string} targetKey - Tonalidad de destino
 * @param {string} targetSystem - Sistema de notación objetivo
 * @returns {string} Contenido transpuesto
 */
export const transposeContent = (content, sourceKey, targetKey, targetSystem = null) => {
  try {
    const semitones = getKeyDistance(sourceKey, targetKey);
    
    // Determinar si usar sostenidos o bemoles basado en la tonalidad destino
    const keySignature = getKeySignature(targetKey);
    
    // Procesar línea por línea
    return content
      .split('\n')
      .map(line => transposeLine(line, semitones, targetSystem, keySignature))
      .join('\n');
  } catch (error) {
    console.error('Error transponiendo contenido:', error);
    return content; // Devolver el contenido original si hay error
  }
};

/**
 * Detecta automáticamente el sistema de notación usado en un contenido
 * @param {string} content - Contenido de la canción
 * @returns {string} 'latin' o 'english'
 */
export const detectNotationSystem = (content) => {
  const latinRegex = /\b(DO|RE|MI|FA|SOL|LA|SI)(?:#|b)?\b/g;
  const englishRegex = /\b([A-G])(?:#|b)?\b/g;
  
  const latinMatches = content.match(latinRegex) || [];
  const englishMatches = content.match(englishRegex) || [];
  
  // Si hay más coincidencias latinas que inglesas, es latino
  return latinMatches.length >= englishMatches.length ? 'latin' : 'english';
};
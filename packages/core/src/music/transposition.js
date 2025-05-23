// packages/core/src/music/transposition.js

// Definición de notas en notación latina y anglosajona
const LATIN_NOTES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
const ENGLISH_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Arrays de pares de tonalidades relativas (mayor y menor)
const RELATIVE_KEYS = [
  { major: "DO", minor: "LAm", english: { major: "C", minor: "Am" } },
  { major: "SOL", minor: "MIm", english: { major: "G", minor: "Em" } },
  { major: "RE", minor: "SIm", english: { major: "D", minor: "Bm" } },
  { major: "LA", minor: "FA#m", english: { major: "A", minor: "F#m" } },
  { major: "MI", minor: "DO#m", english: { major: "E", minor: "C#m" } },
  { major: "SI", minor: "SOL#m", english: { major: "B", minor: "G#m" } },
  { major: "FA#", minor: "RE#m", english: { major: "F#", minor: "D#m" } },
  { major: "DO#", minor: "LA#m", english: { major: "C#", minor: "A#m" } },
  { major: "FA", minor: "REm", english: { major: "F", minor: "Dm" } },
  { major: "SIb", minor: "SOLm", english: { major: "Bb", minor: "Gm" } },
  { major: "MIb", minor: "DOm", english: { major: "Eb", minor: "Cm" } },
  { major: "LAb", minor: "FAm", english: { major: "Ab", minor: "Fm" } },
  { major: "REb", minor: "SIbm", english: { major: "Db", minor: "Bbm" } },
  { major: "SOLb", minor: "MIbm", english: { major: "Gb", minor: "Ebm" } },
  { major: "DOb", minor: "LAbm", english: { major: "Cb", minor: "Abm" } }
];

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
 * @returns {string} 'sharp', 'flat' o 'natural'
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
 * Obtiene el par de relativas para una tonalidad dada
 * @param {string} key - Tonalidad a buscar
 * @returns {Object|null} - Par de tonalidades relativas o null si no se encuentra
 */
const getRelativeKeyPair = (key) => {
  const isMinor = key.includes('m');
  for (const pair of RELATIVE_KEYS) {
    if (isMinor && pair.minor === key) return pair;
    if (!isMinor && pair.major === key) return pair;
  }
  return null;
};

/**
 * Transpone una tonalidad completa a otra
 * @param {string} sourceKey - Tonalidad de origen
 * @param {string} targetKey - Tonalidad de destino
 * @returns {number} Diferencia en semitonos entre las tonalidades
 */
export const getKeyDistance = (sourceKey, targetKey) => {
  // Manejar tonalidades menores
  let sourceIsMinor = sourceKey.endsWith('m');
  let targetIsMinor = targetKey.endsWith('m');
  
  // Obtener las tonalidades relativas para calcular la transposición correcta
  let sourceKeyForCalc = sourceKey;
  let targetKeyForCalc = targetKey;
  
  // Si ambas son menores o ambas son mayores, calculamos directamente
  if (sourceIsMinor === targetIsMinor) {
    // Eliminar 'm' si son menores para obtener el índice
    if (sourceIsMinor) {
      sourceKeyForCalc = sourceKey.slice(0, -1);
      targetKeyForCalc = targetKey.slice(0, -1);
    }
  } else {
    // Si una es mayor y otra menor, obtenemos sus relativas
    const sourcePair = getRelativeKeyPair(sourceKey);
    const targetPair = getRelativeKeyPair(targetKey);
    
    if (sourcePair && targetPair) {
      // Usamos las mayores para calcular la distancia
      sourceKeyForCalc = sourceIsMinor ? sourcePair.major : sourceKey;
      targetKeyForCalc = targetIsMinor ? targetPair.major : targetKey;
    }
  }
  
  // Obtener índices
  const sourceIndex = KEY_TO_INDEX[sourceKeyForCalc];
  const targetIndex = KEY_TO_INDEX[targetKeyForCalc];
  
  if (sourceIndex === undefined || targetIndex === undefined) {
    throw new Error('Tonalidad inválida');
  }
  
  // Calcular diferencia de semitonos
  let semitones = (targetIndex - sourceIndex + 12) % 12;
  
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
    // Detectar el sistema de notación actual si no se proporciona uno
    const detectedSystem = targetSystem || detectNotationSystem(content);
    
    // Determinar si las tonalidades son mayores o menores
    const sourceIsMinor = sourceKey.includes('m');
    const targetIsMinor = targetKey.includes('m');
    
    // Obtener las tonalidades relativas para calcular la transposición correcta
    let sourceKeyForCalc = sourceKey;
    let targetKeyForCalc = targetKey;
    
    // Determinar el tipo de notación (sostenidos o bemoles) para la tonalidad destino
    let keySignature;
    
    // Si estamos transponiendo entre relativas (mayor a menor o viceversa)
    if (sourceIsMinor !== targetIsMinor) {
      // Encontrar el par de relativas correspondiente
      const sourcePair = RELATIVE_KEYS.find(pair => 
        sourceIsMinor ? pair.minor === sourceKey : pair.major === sourceKey
      );
      
      const targetPair = RELATIVE_KEYS.find(pair => 
        targetIsMinor ? pair.minor === targetKey : pair.major === targetKey
      );
      
      if (sourcePair && targetPair) {
        // Para transposiciones entre relativas, usar la firma de la tonalidad mayor
        const majorKey = targetIsMinor ? 
          targetPair.major : // Si el destino es menor, obtener su relativa mayor
          targetKey;         // Si el destino es mayor, usarlo directamente
        
        keySignature = getKeySignature(majorKey);
        
        // Usar las mayores para calcular la distancia
        sourceKeyForCalc = sourceIsMinor ? sourcePair.major : sourceKey;
        targetKeyForCalc = targetIsMinor ? targetPair.major : targetKey;
      }
    } else {
      // Si ambas son del mismo tipo (mayor-mayor o menor-menor)
      keySignature = getKeySignature(targetKey);
    }
    
    // Calcular la diferencia de semitonos usando las tonalidades ajustadas
    const semitones = getKeyDistance(sourceKeyForCalc, targetKeyForCalc);
    
    // Procesar línea por línea manteniendo el mismo sistema de notación
    const transposedContent = content
      .split('\n')
      .map(line => transposeLine(line, semitones, detectedSystem, keySignature))
      .join('\n');
    
    return transposedContent;
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
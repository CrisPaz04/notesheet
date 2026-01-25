// packages/core/src/music/transposition-helper.js
import { transposeContent } from './transposition';
import { TRANSPOSING_INSTRUMENTS } from './instruments';

/**
 * Transpone el contenido de un instrumento a otro
 * @param {string} content - Contenido de la canción
 * @param {string} fromInstrument - ID del instrumento de origen
 * @param {string} toInstrument - ID del instrumento de destino
 * @returns {string} - Contenido transpuesto para el instrumento de destino
 */
// Corrección para mantener consistencia en el sistema de notación
export function transposeForInstrument(content, fromInstrument, toInstrument) {
  // Si los instrumentos son iguales, no hay transposición
  if (fromInstrument === toInstrument) return content;
  
  // Calculamos el intervalo de transposición entre instrumentos
  const fromTransposition = TRANSPOSING_INSTRUMENTS[fromInstrument]?.transposition || 0;
  const toTransposition = TRANSPOSING_INSTRUMENTS[toInstrument]?.transposition || 0;
  
  // La transposición necesaria es la diferencia entre ambos instrumentos
  const transpositionInterval = toTransposition - fromTransposition;
  
  // Si no hay diferencia de transposición, retornamos el contenido original
  if (transpositionInterval === 0) return content;
  
  // Expresión regular para detectar notas musicales (incluyendo menores)
  // Usamos lookahead negativo para evitar problemas con \b y accidentales
  const noteRegex = /\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(#|b)?(m)?(?![#b\w])/g;
  
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
  
  // Detectar el sistema de notación predominante (latino o anglosajón)
  const latinNoteRegex = /\b(DO|RE|MI|FA|SOL|LA|SI)(#|b)?(?![#b\w])/g;
  const englishNoteRegex = /\b(C|D|E|F|G|A|B)(#|b)?(?![#b\w])/g;
  
  const latinMatches = content.match(latinNoteRegex) || [];
  const englishMatches = content.match(englishNoteRegex) || [];
  
  // Determinar el sistema de notación predominante
  const isLatinPredominant = latinMatches.length >= englishMatches.length;
  
  // Procesar línea por línea
  const lines = content.split('\n');
  const processedLines = lines.map(line => {
    // Ignorar las líneas de metadatos (que comienzan con #)
    if (line.trim().startsWith('#')) {
      return line;
    }
    
    // Reemplazar cada nota con su versión transpuesta
    return line.replace(noteRegex, match => {
      try {
        // Verificar si es una nota menor
        let isMinor = false;
        let normalizedNote = match;
        if (match.endsWith('m')) {
          isMinor = true;
          normalizedNote = match.slice(0, -1);
        }
        
        // Determinar si es notación latina o anglosajona
        const isLatinNote = normalizedNote.length > 1 && normalizedNote !== 'SI' && normalizedNote !== 'MI';
        
        // Obtener el índice de la nota usando el mapa
        let noteIndex = noteToIndexMap[normalizedNote];
        
        // Si no encontramos la nota en el mapa, intento especial para SI y MI
        if (noteIndex === undefined) {
          // Tratamiento especial para 'SI' y 'MI'
          if (normalizedNote === 'SI') {
            noteIndex = 11;  // SI es la nota 11 en la escala cromática
          } else if (normalizedNote === 'MI') {
            noteIndex = 4;   // MI es la nota 4 en la escala cromática
          } else {
            console.warn(`Nota no reconocida: ${normalizedNote}`);
            return match;  // Devolver la nota original si no la reconocemos
          }
        }
        
        // Calcular el nuevo índice después de transposición
        const newIndex = (noteIndex + transpositionInterval + 12) % 12;
        
        // Usar el sistema de notación predominante para todas las notas
        let targetArray;
        if (isLatinPredominant) {
          // Usar notación latina para todas las notas
          targetArray = normalizedNote.includes('b') ? LATIN_NOTES_FLAT : LATIN_NOTES;
        } else {
          // Usar notación anglosajona para todas las notas
          targetArray = normalizedNote.includes('b') ? ENGLISH_NOTES_FLAT : ENGLISH_NOTES;
        }
        
        // Obtener la nueva nota
        let transposedNote = targetArray[newIndex];
        
        // Añadir 'm' si era una nota menor
        if (isMinor) {
          transposedNote += 'm';
        }
        
        return transposedNote;
      } catch (error) {
        console.error("Error transposing note:", match, error);
        return match; // Devolver la nota original en caso de error
      }
    });
  });
  
  return processedLines.join('\n');
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
  
  // Definimos las escalas completas en notación latina
  const KEYS_MAJOR = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
  const KEYS_MAJOR_ALT = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'SOLb', 'SOL', 'LAb', 'LA', 'SIb', 'SI', 'DOb'];
  
  // Mapa de tonalidades para una búsqueda más sencilla
  const keyToIndexMap = {
    // Tonalidades mayores con sostenidos
    'DO': 0, 'DO#': 1, 'RE': 2, 'RE#': 3, 'MI': 4, 'FA': 5,
    'FA#': 6, 'SOL': 7, 'SOL#': 8, 'LA': 9, 'LA#': 10, 'SI': 11,
    // Tonalidades mayores con bemoles
    'REb': 1, 'MIb': 3, 'SOLb': 6, 'LAb': 8, 'SIb': 10, 'DOb': 11,
    // Tonalidades menores con sostenidos
    'DOm': 0, 'DO#m': 1, 'REm': 2, 'RE#m': 3, 'MIm': 4, 'FAm': 5,
    'FA#m': 6, 'SOLm': 7, 'SOL#m': 8, 'LAm': 9, 'LA#m': 10, 'SIm': 11,
    // Tonalidades menores con bemoles
    'REbm': 1, 'MIbm': 3, 'SOLbm': 6, 'LAbm': 8, 'SIbm': 10, 'DObm': 11,
    // Tonalidades inglesas
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
    'Db': 1, 'Eb': 3, 'Gb': 6, 'Ab': 8, 'Bb': 10, 'Cb': 11,
    'Cm': 0, 'C#m': 1, 'Dm': 2, 'D#m': 3, 'Em': 4, 'Fm': 5,
    'F#m': 6, 'Gm': 7, 'G#m': 8, 'Am': 9, 'A#m': 10, 'Bm': 11,
    'Dbm': 1, 'Ebm': 3, 'Gbm': 6, 'Abm': 8, 'Bbm': 10, 'Cbm': 11
  };
  
  // Identificar si es menor
  const isMinor = baseKey.includes('m');
  
  // Identificar si usa bemoles o sostenidos
  const usesFlats = baseKey.includes('b');
  
  // Obtener el índice de la tonalidad base
  let keyIndex = keyToIndexMap[baseKey];
  
  if (keyIndex === undefined) {
    console.warn(`Tonalidad no reconocida: ${baseKey}`);
    return baseKey; // Fallback a la tonalidad original
  }
  
  // Aplicar transposición del instrumento
  const instrumentTransposition = TRANSPOSING_INSTRUMENTS[instrument].transposition;
  const newIndex = (keyIndex + instrumentTransposition + 12) % 12;
  
  // Determinar si la nueva tonalidad debe usar sostenidos o bemoles (mantener la preferencia original)
  let targetScale;
  if (isMinor) {
    if (usesFlats) {
      // Escala menor con bemoles
      targetScale = ['DOm', 'REbm', 'REm', 'MIbm', 'MIm', 'FAm', 'SOLbm', 'SOLm', 'LAbm', 'LAm', 'SIbm', 'SIm'];
    } else {
      // Escala menor con sostenidos
      targetScale = ['DOm', 'DO#m', 'REm', 'RE#m', 'MIm', 'FAm', 'FA#m', 'SOLm', 'SOL#m', 'LAm', 'LA#m', 'SIm'];
    }
  } else {
    if (usesFlats) {
      // Escala mayor con bemoles
      targetScale = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'SOLb', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
    } else {
      // Escala mayor con sostenidos
      targetScale = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
    }
  }
  
  // Obtener la nueva tonalidad
  return targetScale[newIndex];
}
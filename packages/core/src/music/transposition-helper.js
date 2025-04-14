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
// Corregir en packages/core/src/music/transposition-helper.js
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
  
  // Para la transposición de instrumentos necesitamos encontrar todas las notas musicales
  // en el contenido y transponerlas manualmente

  // Expresión regular para detectar notas musicales (incluyendo menores)
  const noteRegex = /\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?(?:m)?\b/g;
  
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
        // Implementación directa de transposición de nota
        // sin depender de transposeContent con parámetros nulos
        if (match.length === 0) return match;
        
        // Verificar si es una nota menor
        let isMinor = false;
        let normalizedNote = match;
        if (match.endsWith('m')) {
          isMinor = true;
          normalizedNote = match.slice(0, -1);
        }
        
        // Determine si es notación latina o anglosajona
        const isLatin = normalizedNote.length > 1 && normalizedNote !== 'SI';
        
        // Definir las escalas según el sistema
        const LATIN_NOTES = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
        const ENGLISH_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        
        // Mapear la nota a un índice
        const sourceArray = isLatin ? LATIN_NOTES : ENGLISH_NOTES;
        
        // Buscar la nota base (sin alteraciones)
        let baseNote = normalizedNote;
        let alteration = '';
        
        if (normalizedNote.includes('#')) {
          baseNote = normalizedNote.replace('#', '');
          alteration = '#';
        } else if (normalizedNote.includes('b')) {
          baseNote = normalizedNote.replace('b', '');
          alteration = 'b';
        }
        
        // Buscar el índice de la nota
        let noteIndex = -1;
        for (let i = 0; i < sourceArray.length; i++) {
          if (sourceArray[i] === baseNote + alteration) {
            noteIndex = i;
            break;
          }
        }
        
        if (noteIndex === -1) {
          // Si no encontramos la nota exacta, buscar la nota base
          for (let i = 0; i < sourceArray.length; i++) {
            if (sourceArray[i] === baseNote) {
              noteIndex = i;
              break;
            }
          }
          
          // Ajustar por la alteración
          if (alteration === '#') noteIndex++;
          if (alteration === 'b') noteIndex--;
        }
        
        // Si todavía no encontramos la nota, devolver la original
        if (noteIndex === -1) return match;
        
        // Calcular el nuevo índice después de transposición
        const newIndex = (noteIndex + transpositionInterval + 12) % 12;
        
        // Obtener la nueva nota
        let transposedNote = sourceArray[newIndex];
        
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
  const KEYS_MAJOR_ALT = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'SOLb', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
  
  // Identificar si el key tiene sostenidos, bemoles o es natural
  const isSharp = baseKey.includes('#');
  const isFlat = baseKey.includes('b');
  const isMinor = baseKey.includes('m');
  
  // Normalizar la tonalidad base
  let normalizedKey = baseKey;
  if (isMinor) {
    normalizedKey = baseKey.slice(0, -1); // Quitar 'm' para tonalidades menores
  }
  
  // Elegir la escala correcta para evitar enarmónicos incorrectos
  const keysScale = isFlat ? KEYS_MAJOR_ALT : KEYS_MAJOR;
  
  // Buscar el índice de la tonalidad en la escala
  let keyIndex = -1;
  for (let i = 0; i < keysScale.length; i++) {
    if (keysScale[i] === normalizedKey) {
      keyIndex = i;
      break;
    }
  }
  
  if (keyIndex === -1) {
    console.error(`Tonalidad no reconocida: ${baseKey}`);
    return baseKey; // Fallback a la tonalidad original
  }
  
  // Aplicar transposición del instrumento
  const instrumentTransposition = TRANSPOSING_INSTRUMENTS[instrument].transposition;
  const newIndex = (keyIndex + instrumentTransposition + 12) % 12; // +12 para evitar índices negativos
  
  // Obtener la nueva tonalidad
  let transposedKey = keysScale[newIndex];
  
  // Si es menor, añadir 'm' de nuevo
  if (isMinor) {
    transposedKey += 'm';
  }
  
  return transposedKey;
}
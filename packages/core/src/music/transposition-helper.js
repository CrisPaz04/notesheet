// packages/core/src/music/transposition-helper.js
import { transposeContent } from './transposition';
import { TRANSPOSING_INSTRUMENTS } from './instruments';

/**
 * Transpone el contenido de un instrumento a otro
 * @param {string} content - Contenido de la canción
 * @param {string} fromInstrument - ID del instrumento de origen
 * @param {string} toInstrument - ID del instrumento de destino
 * @param {string} currentKey - Tonalidad actual (opcional)
 * @returns {string} - Contenido transpuesto para el instrumento de destino
 */
export const transposeForInstrument = (content, fromInstrument, toInstrument, currentKey = null) => {
  // Si los instrumentos son iguales, no hay transposición
  if (fromInstrument === toInstrument) return content;
  
  // Calculamos el intervalo de transposición entre instrumentos
  const fromTransposition = TRANSPOSING_INSTRUMENTS[fromInstrument]?.transposition || 0;
  const toTransposition = TRANSPOSING_INSTRUMENTS[toInstrument]?.transposition || 0;
  
  // La transposición necesaria es la diferencia entre ambos instrumentos
  const transpositionInterval = toTransposition - fromTransposition;
  
  // Si no hay diferencia de transposición, retornamos el contenido original
  if (transpositionInterval === 0) return content;
  
  // Aplicamos la transposición usando la función existente
  // El cuarto parámetro es el intervalo directo en semitonos
  return transposeContent(content, null, null, transpositionInterval);
};

/**
 * Calcula la tonalidad visual para un instrumento
 * @param {string} baseKey - Tonalidad base (en referencia a trompeta)
 * @param {string} instrument - ID del instrumento
 * @returns {string} - Tonalidad visual para ese instrumento
 */
export const getVisualKeyForInstrument = (baseKey, instrument) => {
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
};
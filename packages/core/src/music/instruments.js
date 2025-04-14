// packages/core/src/music/instruments.js

/**
 * Definición de instrumentos transpositores y sus intervalos de transposición
 * IMPORTANTE: Las transposiciones están definidas en relación con la trompeta en Sib
 * (no en relación con el tono de concierto)
 */
export const TRANSPOSING_INSTRUMENTS = {
  "bb_trumpet": {
    name: "Trompeta en Sib",
    transposition: 0, // Referencia base (0 semitonos)
    description: "Instrumento de referencia (partitura estándar)"
  },
  "concert": {
    name: "Instrumento en DO / Concierto",
    transposition: -2, // 2 semitonos hacia abajo (un tono)
    description: "Piano, Guitarra, Bajo, Flauta (suena un tono más bajo)"
  },
  "eb_alto_sax": {
    name: "Saxofón Alto en Mib",
    transposition: 9, // Sube una sexta mayor (9 semitonos)
    description: "Sube una sexta mayor desde trompeta (DO → LA)"
  },
  "bb_tenor_sax": {
    name: "Saxofón Tenor en Sib",
    transposition: 12, // Una octava exacta
    description: "Sube una octava desde trompeta (DO → DO octava arriba)"
  },
  "bb_trombone": {
    name: "Trombón en Sib",
    transposition: 0, // Igual que la trompeta
    description: "Misma transposición que la trompeta"
  }
};

// Agrupaciones lógicas para el selector de UI
export const INSTRUMENT_GROUPS = [
  {
    name: "Instrumentos de Referencia",
    instruments: ["bb_trumpet"]
  },
  {
    name: "Instrumentos en Sib",
    instruments: ["bb_trombone", "bb_tenor_sax"]
  },
  {
    name: "Instrumentos en Mib",
    instruments: ["eb_alto_sax"]
  },
  {
    name: "Instrumentos en DO (Concierto)",
    instruments: ["concert"]
  }
];

/**
 * Calcula la transposición correcta entre dos instrumentos
 * @param {string} fromInstrument - ID del instrumento de origen
 * @param {string} toInstrument - ID del instrumento de destino
 * @returns {number} - Diferencia en semitonos entre los instrumentos
 */
export const calculateTranspositionInterval = (fromInstrument, toInstrument) => {
  const fromTransposition = TRANSPOSING_INSTRUMENTS[fromInstrument]?.transposition || 0;
  const toTransposition = TRANSPOSING_INSTRUMENTS[toInstrument]?.transposition || 0;
  
  // La diferencia es la transposición de destino menos la de origen
  return toTransposition - fromTransposition;
};

/**
 * Obtiene la tonalidad visual para mostrar al usuario según el instrumento
 * Por ejemplo, una canción en DO para trompeta sería SOL para saxofón alto
 * @param {string} key - Tonalidad base (como se ve para trompeta)
 * @param {string} instrument - ID del instrumento seleccionado
 * @returns {string} - Tonalidad a mostrar para ese instrumento
 */
export const getVisualKeyForInstrument = (key, instrument) => {
  if (instrument === "bb_trumpet" || !key) return key;
  
  // Implementar lógica para calcular la tonalidad visual
  // Esto podría requerir una función más compleja que utilice
  // las funciones de transposición existentes
  
  return key + " (transpuesto)"; // Placeholder
};
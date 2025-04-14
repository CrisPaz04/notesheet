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
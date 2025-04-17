export const TRANSPOSING_INSTRUMENTS = {
  "bb_trumpet": {
    name: "Trompeta en Sib",
    transposition: 0, // Referencia base (0 semitonos)
    description: "Instrumento de referencia"
  },
  "bb_trombone": {
    name: "Trombón en Sib",
    transposition: 0, // Igual que la trompeta
    description: "Misma transposición que la trompeta"
  },
  "bb_clarinet": {
    name: "Clarinete en Sib",
    transposition: 0, // Misma transposición que la trompeta en Sib
    description: "Misma transposición que la trompeta"
  },
  "bb_tenor_sax": {
    name: "Saxofón Tenor en Sib",
    transposition: 12, // Una octava exacta
    description: "Misma transposición que la trompeta"
  },
  "bb_soprano_sax": {
    name: "Saxofón Soprano en Sib",
    transposition: 0, // Misma transposición que la trompeta
    description: "Misma transposición que la trompeta"
  },
  "eb_alto_sax": {
    name: "Saxofón Alto en Mib",
    transposition: 7, // Sube una quinta justa (7 semitonos)
    description: "Sube una quinta justa desde trompeta (DO → SOL)"
  },
  "eb_baritone_sax": {
    name: "Saxofón Barítono en Mib",
    transposition: -5, // 5 semitonos hacia abajo desde el saxo alto
    description: "Misma transposición que el saxo alto"
  },
  "c_flute": {
    name: "Flauta en DO",
    transposition: -2, // 2 semitonos hacia abajo (un tono)
    description: "Instrumento en DO (suena un tono más bajo que Sib)"
  },
  "f_horn": {
    name: "Corno Francés en Fa",
    transposition: -7, // Baja una quinta justa (7 semitonos)
    description: "Baja una quinta justa desde trompeta (DO → FA)"
  }
};

// Agrupaciones lógicas para el selector de UI
export const INSTRUMENT_GROUPS = [
  {
    name: "Instrumentos en Sib",
    instruments: ["bb_trumpet", "bb_trombone", "bb_clarinet", "bb_tenor_sax", "bb_soprano_sax"]
  },
  {
    name: "Instrumentos en Mib",
    instruments: ["eb_alto_sax", "eb_baritone_sax"]
  },
  {
    name: "Instrumentos en DO",
    instruments: ["c_flute"]
  },
  {
    name: "Otros Instrumentos Transpositores",
    instruments: ["f_horn"]
  }
];
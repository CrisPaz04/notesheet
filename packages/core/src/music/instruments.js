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
  },

  // --- Instrumentos que leen la hoja de acordes -------------------------
  //
  // Guitarra, piano, bajo y voz están en DO, igual que la flauta: -2 desde la
  // trompeta en Sib, que es la referencia en la que se escriben las voces.
  //
  // Lo que los separa del resto no es la transposición, es QUÉ leen. Un
  // trompetista lee su voz —una línea numerada—; un guitarrista lee los
  // acordes y no le dice nada un selector de "voz 1 / voz 2". Eso lo marca
  // `readsChordChart`, y la interfaz decide con él qué controles ofrecer.
  //
  // Antes de que existieran, un guitarrista tenía que elegir "Flauta en DO"
  // para ver los acordes en tono de concierto.
  "c_guitar": {
    name: "Guitarra",
    transposition: -2,
    description: "Instrumento en DO (tono de concierto)",
    readsChordChart: true,
    capo: true // Es el único de la lista al que se le pone cejilla
  },
  "c_piano": {
    name: "Piano / Teclado",
    transposition: -2,
    description: "Instrumento en DO (tono de concierto)",
    readsChordChart: true
  },
  "c_bass": {
    name: "Bajo",
    transposition: -2,
    description: "Instrumento en DO (tono de concierto)",
    readsChordChart: true
  },
  "c_voice": {
    name: "Voz",
    transposition: -2,
    description: "Tono de concierto",
    readsChordChart: true
  }
};

/**
 * ¿Este instrumento lee la hoja de acordes en vez de una voz numerada?
 *
 * La ausencia de la marca cuenta como "no", igual que la de `format` cuenta
 * como `"chords"`: los instrumentos de viento, que son la mayoría, no llevan
 * nada.
 *
 * @param {string} instrumentId
 * @returns {boolean}
 */
export const readsChordChart = (instrumentId) =>
  Boolean(TRANSPOSING_INSTRUMENTS[instrumentId]?.readsChordChart);

/**
 * La vista con la que se abre una canción, según el instrumento del músico
 * (el de sus preferencias):
 * - la voz, la letra; y si no hay, los acordes;
 * - guitarra, piano y bajo, los acordes;
 * - los vientos, sus notas.
 * Nunca una vista vacía: si no hay lo suyo, la principal (notas o partitura).
 *
 * @param {string} instrumentId
 * @param {{hayLetra?: boolean, hayAcordes?: boolean}} [contenido]
 * @returns {'principal'|'letra'|'acordes'}
 */
export const vistaPreferida = (instrumentId, { hayLetra = false, hayAcordes = false } = {}) => {
  if (instrumentId === 'c_voice') {
    if (hayLetra) return 'letra';
    return hayAcordes ? 'acordes' : 'principal';
  }
  if (readsChordChart(instrumentId) && hayAcordes) return 'acordes';
  return 'principal';
};

/**
 * ¿A este instrumento se le puede poner cejilla?
 *
 * @param {string} instrumentId
 * @returns {boolean}
 */
export const supportsCapo = (instrumentId) =>
  Boolean(TRANSPOSING_INSTRUMENTS[instrumentId]?.capo);

// Lo que suena y lo que se lee sin transponer ("ver las notas en concierto")
export const VER_EN_CONCIERTO = 'concierto';

// Los que se escriben una o más octavas por encima de lo que da la
// referencia de Sib (`transposition` solo sirve para el nombre de la nota)
const ESCRITO_CON_OCTAVA = {
  bb_tenor_sax: 14, // novena mayor
  eb_baritone_sax: 21, // octava y sexta mayor
  c_guitar: 12,
  c_bass: 12
};

/**
 * Cuántos semitonos por encima de lo que **suena** está lo que **lee** un
 * instrumento: la trompeta en Sib lee un tono más alto (su DO suena SIb), el
 * saxo alto una sexta mayor, la guitarra una octava. Es lo que usa el
 * afinador para decir la nota como la llama el músico, con su octava.
 *
 * @param {string} instrumentId - O `VER_EN_CONCIERTO`
 * @returns {number}
 */
export const semitonosAEscrito = (instrumentId) => {
  if (instrumentId in ESCRITO_CON_OCTAVA) return ESCRITO_CON_OCTAVA[instrumentId];
  const t = TRANSPOSING_INSTRUMENTS[instrumentId]?.transposition;
  // La referencia de Sib lee 2 por encima de lo que suena
  return t === undefined ? 0 : (((2 + t) % 12) + 12) % 12;
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
  },
  // Van al final y en su propio grupo aunque musicalmente sean "en DO": quien
  // busca "Guitarra" no la busca bajo ese epígrafe.
  {
    name: "Guitarra, piano y voz",
    instruments: ["c_guitar", "c_piano", "c_bass", "c_voice"]
  }
];
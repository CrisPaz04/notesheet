// packages/core/src/music/ortografia.js
//
// Cómo se escribe cada nota: SIb o LA#, MIb o RE#.
//
// Antes la transposición conservaba la alteración de la nota de partida, y
// DO, FA o SOL no tienen ninguna: el DO de la trompeta en Sib bajaba a LA# en
// un instrumento en DO, y la tonalidad "DO" de la trompeta se leía "LA#" en
// concierto, cuando todo músico la escribe SIb. Aquí la ortografía sale de la
// tonalidad en la que se va a leer, que es como se escribe en una partitura:
// con bemoles en las de bemoles, con sostenidos en las de sostenidos.
//
// Todo en notación latina; la anglosajona se traduce al final, como el resto
// del recorrido (`convertNotationSystem`).

const SOSTENIDOS = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
const BEMOLES = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'SOLb', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];

/**
 * Sin armadura (DO mayor) o sin tonalidad: la de los vientos. DO# y FA#, pero
 * MIb, LAb y SIb, que es como las nombra cualquier trompetista o saxofonista
 * (y como las leen los afinadores de banda).
 */
export const ORTOGRAFIA_NEUTRA = ['DO', 'DO#', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];

// El nombre habitual de cada tonalidad: la de menos alteraciones (REb y no
// DO#, SI y no DOb, SOL#m y no LAbm). En los dos empates (FA#/SOLb y RE#m/MIbm,
// seis alteraciones cada una) decide la tonalidad de partida.
const MAYORES = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
const MENORES = ['DOm', 'DO#m', 'REm', 'MIbm', 'MIm', 'FAm', 'FA#m', 'SOLm', 'SOL#m', 'LAm', 'SIbm', 'SIm'];

// Las mayores con sostenidos en la armadura; las demás que no son DO, bemoles
const MAYORES_CON_SOSTENIDOS = new Set(['SOL', 'RE', 'LA', 'MI', 'SI', 'FA#', 'DO#', 'SOL#', 'RE#', 'LA#', 'MI#', 'SI#']);

// Las siete letras y su tecla sin alteración
const LETRAS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];
const NATURALES = [0, 2, 4, 5, 7, 9, 11];
const LETRA_LATINA = { DO: 0, RE: 1, MI: 2, FA: 3, SOL: 4, LA: 5, SI: 6 };
const LETRA_INGLESA = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Los grados de la escala mayor, en semitonos desde la tónica
const ESCALA_MAYOR = [0, 2, 4, 5, 7, 9, 11];

/**
 * Una letra alterada para que suene en una tecla: SI en la tecla de DO es
 * "SI#", DO en la de SI es "DOb". null si haría falta doble alteración.
 */
function conLetra(letra, tecla) {
  let d = (((tecla - NATURALES[letra]) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  if (d === 0) return LETRAS[letra];
  if (d === 1) return `${LETRAS[letra]}#`;
  if (d === -1) return `${LETRAS[letra]}b`;
  return null;
}

/**
 * Lee una tonalidad escrita a mano ("SIb", "Bbm", "fa#m", "RE#m").
 *
 * @param {string} key
 * @returns {{indice: number, menor: boolean, alteracion: '#'|'b'|'', letra: number}|null}
 *   `letra`: 0 = DO … 6 = SI
 */
export function leerTonalidad(key) {
  const texto = (key || '').trim();
  const latina = texto.match(/^(DO|RE|MI|FA|SOL|LA|SI)(#|b)?(m)?$/i);
  const inglesa = texto.match(/^([A-G])(#|b)?(m)?$/);
  const m = latina || inglesa;
  if (!m) return null;

  const letra = latina ? LETRA_LATINA[m[1].toUpperCase()] : LETRA_INGLESA[m[1]];
  const alteracion = m[2] || '';
  const desplazamiento = alteracion === '#' ? 1 : alteracion === 'b' ? -1 : 0;
  return { indice: (NATURALES[letra] + desplazamiento + 12) % 12, menor: Boolean(m[3]), alteracion, letra };
}

/**
 * El nombre habitual de la tonalidad en una tecla dada.
 *
 * @param {number} indice - 0 = DO … 11 = SI
 * @param {boolean} menor
 * @param {'#'|'b'|''} [preferencia] - Para los empates: hacia dónde va la
 *   tonalidad de la que se viene
 * @returns {string}
 */
export function nombreDeTonalidad(indice, menor, preferencia = '') {
  const i = ((indice % 12) + 12) % 12;
  if (!menor && i === 6) return preferencia === 'b' ? 'SOLb' : 'FA#';
  if (menor && i === 3) return preferencia === '#' ? 'RE#m' : 'MIbm';
  return menor ? MENORES[i] : MAYORES[i];
}

/**
 * Desplaza una tonalidad y le da su nombre habitual: "DO" dos semitonos abajo
 * es "SIb", no "LA#". Conserva el modo, y la tonalidad de partida solo
 * desempata FA#/SOLb y RE#m/MIbm (hacia sostenidos o bemoles, como ella).
 *
 * @param {string} key
 * @param {number} semitonos
 * @returns {string|null} null si `key` no es una tonalidad
 */
export function transponerTonalidad(key, semitonos) {
  const t = leerTonalidad(key);
  if (!t) return null;
  return nombreDeTonalidad(t.indice + semitonos, t.menor, t.alteracion || direccionDe(key));
}

/**
 * Hacia dónde va la armadura: '#' (SOL, MIm…), 'b' (FA, REm…) o '' (DO, LAm).
 * Desempata cuando la tonalidad no lleva la alteración escrita: SIm sube a
 * RE#m, no a MIbm.
 */
function direccionDe(key) {
  const o = ortografiaDe(key);
  if (!o) return '';
  if (o[10] === 'LA#') return '#';
  if (o[1] === 'REb' || o[6] === 'SOLb') return 'b';
  return '';
}

/**
 * Cómo se escribe cada una de las doce notas leyendo en una tonalidad.
 *
 * - Las notas de la escala, **como las pide la armadura**, una letra por
 *   grado: FA# mayor lleva MI# (no FA), SOLb mayor lleva DOb (no SI), DO#
 *   mayor lleva MI# y SI#.
 * - Las que no son de la escala: sostenidos si la armadura lleva sostenidos,
 *   bemoles si lleva bemoles, y la neutra en DO.
 * - Menores: las de su relativa mayor, y la sensible (un semitono por debajo
 *   de la tónica) sube la séptima letra: en REm se escribe DO#, no REb; en
 *   LAm, SOL#, no LAb. Es la nota de la menor armónica, la que más sale.
 *
 * Nunca dobles alteraciones: donde la escala pediría una (la sensible de
 * SOL#m es FA##), se usa el nombre sencillo de la tecla (SOL).
 *
 * @param {string} key - La tonalidad en la que se va a leer
 * @returns {string[]|null} Doce nombres (índice = tecla), o null si no se
 *   reconoce la tonalidad
 */
export function ortografiaDe(key) {
  const t = leerTonalidad(key);
  if (!t) return null;

  const relativaMayor = t.menor ? (t.indice + 3) % 12 : t.indice;
  // La armadura sale de la relativa mayor tal como se llama en esta
  // tonalidad: RE#m es relativa de FA# (sostenidos); MIbm, de SOLb (bemoles)
  const nombreMayor = nombreDeTonalidad(relativaMayor, false, t.alteracion);

  let base;
  if (nombreMayor === 'DO') base = ORTOGRAFIA_NEUTRA;
  else if (MAYORES_CON_SOSTENIDOS.has(nombreMayor)) base = SOSTENIDOS;
  else base = BEMOLES;

  // Una tonalidad escrita con otra alteración que la habitual ("LA#" en vez de
  // "SIb", "LA#m" en vez de "SIbm") se respeta: quien la escribió así quiere
  // leer sostenidos
  if (t.alteracion === '#' && base !== SOSTENIDOS) base = SOSTENIDOS;
  if (t.alteracion === 'b' && base !== BEMOLES) base = BEMOLES;

  // Las notas de la escala de la mayor (o de la relativa mayor), cada una
  // con su letra: la relativa mayor está una tercera más arriba, dos letras
  const nombres = [...base];
  const letraMayor = t.menor ? (t.letra + 2) % 7 : t.letra;
  ESCALA_MAYOR.forEach((semitonos, grado) => {
    const tecla = (relativaMayor + semitonos) % 12;
    const nombre = conLetra((letraMayor + grado) % 7, tecla);
    if (nombre) nombres[tecla] = nombre;
  });

  if (t.menor) {
    const sensible = (t.indice + 11) % 12;
    const nombre = conLetra((t.letra + 6) % 7, sensible);
    if (nombre) nombres[sensible] = nombre;
  }
  return nombres;
}

/** Las doce notas en anglosajona, en el mismo orden que las latinas */
const A_INGLES = {
  DO: 'C', 'DO#': 'C#', REb: 'Db', RE: 'D', 'RE#': 'D#', MIb: 'Eb', MI: 'E', FA: 'F',
  'FA#': 'F#', SOLb: 'Gb', SOL: 'G', 'SOL#': 'G#', LAb: 'Ab', LA: 'A', 'LA#': 'A#', SIb: 'Bb', SI: 'B',
  // Las que pide alguna armadura (FA# mayor, SOLb mayor…)
  'MI#': 'E#', 'SI#': 'B#', FAb: 'Fb', DOb: 'Cb'
};

/**
 * El nombre de una tecla con una ortografía, en la notación pedida.
 *
 * @param {number} indice - 0 = DO … 11 = SI
 * @param {string[]} [ortografia] - La de `ortografiaDe`; por defecto, la neutra
 * @param {'latin'|'english'} [sistema]
 */
export function nombrarNota(indice, ortografia = ORTOGRAFIA_NEUTRA, sistema = 'latin') {
  const latina = ortografia[((indice % 12) + 12) % 12];
  return sistema === 'english' ? A_INGLES[latina] : latina;
}

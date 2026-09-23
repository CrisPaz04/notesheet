// packages/core/src/music/keySuggestion.js
//
// Sugerir la tonalidad de una canción a partir de las notas que ya tiene
// escritas. Es para el editor: una canción nueva nace en DO y es fácil
// guardarla así sin darse cuenta de que las notas dicen otra cosa.
//
// Contar alteraciones no basta, y se probó: las partes de la banda no son
// melodías de libro. "Cristo no está muerto" está en RE y usa Do natural a
// propósito; "Hagamos fiesta" está en SOLm y escribe RE# donde la armadura
// diría MIb. Contando armaduras se acertaba el par mayor/relativa en 87 de
// 112 canciones del repertorio y la tonalidad exacta en solo 61.
//
// Lo que se usa es el método de Krumhansl-Schmuckler: se cuenta cuántas
// veces sale cada nota y se compara con el perfil típico de cada una de las
// 24 tonalidades (en una melodía en RE, el RE, el LA y el FA# salen mucho; el
// SOL# casi nunca). Con los perfiles de Aarden, medidos sobre melodías y no
// sobre obras para piano, es el que mejor sale con este repertorio.
//
// Y no se pregunta "¿cuál es la tonalidad?", que falla una de cada tres
// veces, sino "¿la elegida es claramente peor que la mejor?". Así solo se
// avisa cuando la diferencia es grande (ver `MARGEN_PARA_AVISAR`).

import { mapChordLine } from './chords';
import { identificarTonalidad } from './transposition';

// Semitonos desde DO de cada letra, en las dos notaciones
const SEMITONOS = {
  DO: 0, RE: 2, MI: 4, FA: 5, SOL: 7, LA: 9, SI: 11,
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

// Perfiles de Aarden (Aarden 2003): con qué frecuencia aparece cada grado de
// la escala cromática, empezando por la tónica, en melodías mayores y menores
const PERFIL_MAYOR = [17.77, 0.15, 14.93, 0.16, 19.8, 11.36, 0.29, 22.06, 0.15, 8.15, 0.23, 4.95];
const PERFIL_MENOR = [18.26, 0.74, 14.05, 16.86, 0.7, 14.44, 0.7, 18.62, 4.57, 1.93, 7.38, 1.76];

// Cómo se escribe cada tonalidad, por semitono desde DO. Donde hay dos
// nombres de uso corriente (DO# y REb) se elige según lo que ya usa la
// canción: la banda escribe casi siempre con sostenidos.
const MAYORES = ['DO', ['DO#', 'REb'], 'RE', 'MIb', 'MI', 'FA', ['FA#', 'SOLb'], 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
const MENORES = ['DOm', 'DO#m', 'REm', ['RE#m', 'MIbm'], 'MIm', 'FAm', 'FA#m', 'SOLm', ['SOL#m', 'LAbm'], 'LAm', ['LA#m', 'SIbm'], 'SIm'];

// Con menos notas no se puede decidir: una frase corta no pasa por las notas
// que distinguen una tonalidad de la de al lado.
export const MIN_NOTAS_PARA_SUGERIR = 16;

// Cuánto peor (en correlación, de -1 a 1) tiene que encajar la tonalidad
// elegida que la mejor para avisar. Medido sobre las 118 canciones del
// repertorio: con 0,3 avisa en falso en 4 de 114 que ya están bien, y si se
// hubieran quedado en DO por descuido avisaría en 81 de 103. Bajarlo caza
// más descuidos a cambio de molestar más: con 0,2 serían 11 falsos avisos.
export const MARGEN_PARA_AVISAR = 0.3;

/**
 * Las notas de las líneas de notas, en semitonos desde DO (0-11).
 * La letra se ignora: "La", "Mi" y "Si" también son palabras.
 * @param {string} texto
 * @returns {Array<{semitono: number, alteracion: string}>}
 */
export const extraerNotas = (texto) => {
  const notas = [];
  for (const linea of (texto || '').split('\n')) {
    mapChordLine(linea, (raiz) => {
      const [, nombre, alteracion] = /^(.+?)([#b]?)$/.exec(raiz);
      const base = SEMITONOS[nombre];
      if (base !== undefined) {
        const desvio = alteracion === '#' ? 1 : alteracion === 'b' ? -1 : 0;
        notas.push({ semitono: (base + desvio + 12) % 12, alteracion });
      }
      return raiz;
    });
  }
  return notas;
};

// La última nota de cada frase (bloque separado por una línea en blanco o
// por una cabecera). Una melodía descansa sobre su tónica, así que estas
// cuentan doble: es lo que más ayuda a distinguir una mayor de su relativa.
const finalesDeFrase = (texto) =>
  (texto || '')
    .split(/\n\s*\n|\n(?=##)/)
    .map(extraerNotas)
    .filter((notas) => notas.length)
    .map((notas) => notas[notas.length - 1]);

const correlacion = (a, b) => {
  const media = (v) => v.reduce((x, y) => x + y, 0) / v.length;
  const ma = media(a);
  const mb = media(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
};

/**
 * Cuánto encaja la canción en cada una de las 24 tonalidades.
 * @param {string|string[]} contenido - Una voz o varias
 * @returns {Map<string, number>|null} De `identificarTonalidad` ("2", "11m"…)
 *   a correlación, o null si no hay notas suficientes
 */
export const puntuarTonalidades = (contenido) => {
  const textos = (Array.isArray(contenido) ? contenido : [contenido]).filter(Boolean);
  const notas = textos.flatMap(extraerNotas);
  if (notas.length < MIN_NOTAS_PARA_SUGERIR) return null;

  const cuantas = new Array(12).fill(0);
  for (const nota of notas) cuantas[nota.semitono]++;
  for (const nota of textos.flatMap(finalesDeFrase)) cuantas[nota.semitono]++;

  const puntos = new Map();
  for (let tonica = 0; tonica < 12; tonica++) {
    const girar = (perfil) => perfil.map((_, i) => perfil[(i - tonica + 12) % 12]);
    puntos.set(`${tonica}`, correlacion(cuantas, girar(PERFIL_MAYOR)));
    puntos.set(`${tonica}m`, correlacion(cuantas, girar(PERFIL_MENOR)));
  }
  return puntos;
};

const nombrar = (id, prefiereBemoles) => {
  const tonica = parseInt(id, 10);
  const nombre = (id.endsWith('m') ? MENORES : MAYORES)[tonica];
  if (!Array.isArray(nombre)) return nombre;
  return prefiereBemoles ? nombre[1] : nombre[0];
};

/**
 * ¿Hay que sugerir otra tonalidad?
 *
 * @param {string|string[]} contenido - Una voz o varias. Con varias se suman
 *   las notas de todas: las voces de una canción están escritas en la misma
 *   tonalidad (la de la trompeta en Sib), y cuantas más notas, mejor.
 * @param {string} tonalidadActual - La elegida en el editor
 * @returns {string[]|null} Una o dos tonalidades, la más probable primero,
 *   o null si la elegida ya encaja o no hay notas para opinar
 */
export const sugerirTonalidad = (contenido, tonalidadActual) => {
  const puntos = puntuarTonalidades(contenido);
  if (!puntos) return null;

  const orden = [...puntos.entries()].sort((a, b) => b[1] - a[1]);
  const mejor = orden[0][1];
  const actual = identificarTonalidad(tonalidadActual);
  // Una tonalidad que no se reconoce (o vacía) encaja peor que cualquiera
  const puntosActual = actual !== null ? puntos.get(actual) : -1;
  if (mejor - puntosActual <= MARGEN_PARA_AVISAR) return null;

  const textos = Array.isArray(contenido) ? contenido : [contenido];
  const notas = textos.flatMap(extraerNotas);
  const bemoles = notas.filter((n) => n.alteracion === 'b').length;
  const sostenidos = notas.filter((n) => n.alteracion === '#').length;

  return orden
    .slice(0, 2)
    .map(([id]) => id)
    .filter((id) => id !== actual)
    .map((id) => nombrar(id, bemoles > sostenidos));
};

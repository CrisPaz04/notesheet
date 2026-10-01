// packages/core/src/music/modulaciones.js
//
// Canciones que cambian de tonalidad a media canción.
//
// Una cabecera de sección puede llevar al final una tonalidad entre corchetes:
//
//   ## Modulación [SIm]
//   ## Coro [DO#m]
//   ## [SIm]          ← sin nombre: solo cambia la tonalidad
//
// Desde ahí, y hasta la siguiente cabecera con corchetes, el texto está
// escrito en esa tonalidad, en la misma referencia que el resto del texto
// (Sib en las notas y las voces, concierto en los acordes). Es como ya lo
// escribía la banda: las notas de después de una modulación van en la
// tonalidad nueva, y la sección se llamaba "Ascenso" o "Si menor". Lo que
// faltaba era decir a qué tonalidad, para enseñarla en la de cada instrumento
// y escribir esa parte con su armadura.
//
// `key` sigue siendo la tonalidad del principio: nada de lo anterior migra.
//
// Puro: no toca Firebase ni el DOM.

import { identificarTonalidad } from './transposition';
import { convertNotationSystem } from './notation';
import { normalizarNotas } from './chords';

// "## Título [X]" o "## [X]". Sin espacio tras `##` no es cabecera (como en
// `parseSongSections`), y `###` tampoco.
const CABECERA_CON_CORCHETES = /^##\s+(.*?)\s*\[([^\]\n]+)\]\s*$/;

/**
 * La tonalidad de unos corchetes, en latina y en su forma única ("Bm" →
 * "SIm", "Sim" → "SIm"), o null si no es una tonalidad.
 */
const leerTonalidad = (texto) => {
  const limpia = (texto || '').trim();
  if (!limpia || /\s/.test(limpia)) return null;
  const latina = convertNotationSystem(normalizarNotas(limpia), 'latin');
  return identificarTonalidad(latina) === null ? null : latina;
};

/**
 * ¿Es esta línea una cabecera de modulación?
 *
 * Lo que va entre corchetes tiene que ser una tonalidad: `## Solo [2 veces]`
 * es un título normal.
 *
 * @param {string} linea
 * @returns {{titulo: string, tonalidad: string}|null}
 */
export const leerModulacion = (linea) => {
  const m = typeof linea === 'string' && linea.match(CABECERA_CON_CORCHETES);
  if (!m) return null;
  const tonalidad = leerTonalidad(m[2]);
  return tonalidad ? { titulo: m[1].trim(), tonalidad } : null;
};

/**
 * Parte un texto en tramos de una sola tonalidad.
 *
 * El primero (número 0) va en `keyInicial` y no tiene cabecera; cada
 * modulación abre otro (1, 2…) con su cabecera y su tonalidad. Si el texto
 * empieza modulando, no hay tramo 0.
 *
 * Volver a unir `cabecera.linea` y `cuerpo` de cada tramo con saltos de línea
 * devuelve el texto tal cual (`cuerpo` es null en una cabecera que no tiene
 * nada detrás).
 *
 * @param {string} texto
 * @param {string} keyInicial - La tonalidad en la que empieza (`key`)
 * @returns {Array<{numero: number, key: string, cabecera: Object|null, cuerpo: string|null}>}
 */
export const partirEnTramos = (texto, keyInicial) => {
  const tramos = [];
  let actual = { numero: 0, key: keyInicial, cabecera: null, lineas: [] };
  let numero = 0;

  for (const linea of (texto || '').split('\n')) {
    const modulacion = leerModulacion(linea);
    if (!modulacion) {
      actual.lineas.push(linea);
      continue;
    }
    if (actual.cabecera || actual.lineas.length) tramos.push(actual);
    numero += 1;
    actual = {
      numero,
      key: modulacion.tonalidad,
      cabecera: { linea, ...modulacion },
      lineas: []
    };
  }
  tramos.push(actual);

  return tramos.map(({ lineas, ...tramo }) => ({
    ...tramo,
    cuerpo: tramo.cabecera && !lineas.length ? null : lineas.join('\n')
  }));
};

/** Cuántas modulaciones tiene un texto. */
export const contarModulaciones = (texto) =>
  (texto || '').split('\n').filter((linea) => leerModulacion(linea)).length;

/**
 * Todas las tonalidades de una canción, en orden y sin repetir (SIb y LA#
 * cuentan como una). Es lo que se guarda en `tonalidades` para buscar y
 * filtrar; la fuente de verdad sigue siendo el texto.
 *
 * @param {string} texto
 * @param {string} key - La del principio
 * @returns {string[]}
 */
export const tonalidadesDe = (texto, key) => {
  const todas = [key, ...partirEnTramos(texto, key).filter((t) => t.numero > 0).map((t) => t.key)];
  const vistas = new Set();
  return todas.filter((tonalidad) => {
    const id = identificarTonalidad(tonalidad);
    if (id === null || vistas.has(id)) return false;
    vistas.add(id);
    return true;
  });
};

/**
 * Las secciones que salen de `formatSong` llevan los corchetes en el título
 * ("Modulación [DO#m]"). Aquí se quitan y la tonalidad queda aparte, en
 * `tonalidad`, para que cada vista la enseñe a su manera (en la notación del
 * músico, con `nombrarTonalidad`). Las demás secciones no cambian.
 *
 * @param {Array<{title: string, content: string}>} secciones
 * @returns {Array<{title: string, content: string, tonalidad?: string}>}
 */
export const separarTonalidadDelTitulo = (secciones) =>
  (secciones || []).map((seccion) => {
    const modulacion = leerModulacion(`## ${seccion.title || ''}`);
    return modulacion ? { ...seccion, title: modulacion.titulo, tonalidad: modulacion.tonalidad } : seccion;
  });

// ── Ajustes de una lista o una sesión ─────────────────────────────────────
//
// Una lista o una sesión pueden llevar cada modulación a otra tonalidad
// (`modulaciones`: número de modulación → semitonos). El ajuste se cuenta
// desde donde iría la modulación sin él, moviéndose con la canción: así 0 es
// "como siempre", la modulación conserva su modo (una de LAm que modula a DO
// mayor no se vuelve menor), y "sin modulación" lo sigue siendo aunque luego
// se cambie la tonalidad de la canción.

const indiceDe = (tonalidad) => {
  const id = identificarTonalidad(tonalidad);
  return id === null ? null : parseInt(id, 10);
};

// De -6 a 5: el camino corto, y una octava no cuenta
const acotar = (semitonos) => {
  const resto = ((semitonos % 12) + 12) % 12;
  return resto >= 6 ? resto - 12 : resto;
};

/**
 * Los semitonos que hay que mover una modulación para que vaya de
 * `porDefecto` a `elegida`, o null si alguna no es una tonalidad.
 */
export const ajusteHacia = (porDefecto, elegida) => {
  const desde = indiceDe(porDefecto);
  const hasta = indiceDe(elegida);
  if (desde === null || hasta === null) return null;
  return acotar(hasta - desde);
};

/**
 * El mapa de ajustes tal como se guarda: solo números enteros, acotados a
 * una octava, sin los ceros (son el valor por defecto) y con claves de
 * modulación válidas (1, 2…). Null si no queda nada.
 *
 * @param {*} modulaciones
 * @returns {Object|null}
 */
export const limpiarModulaciones = (modulaciones) => {
  if (!modulaciones || typeof modulaciones !== 'object' || Array.isArray(modulaciones)) return null;
  const limpias = {};
  for (const [numero, ajuste] of Object.entries(modulaciones)) {
    if (!/^[1-9]\d*$/.test(numero) || !Number.isInteger(ajuste)) continue;
    const acotado = acotar(ajuste);
    if (acotado !== 0) limpias[numero] = acotado;
  }
  return Object.keys(limpias).length ? limpias : null;
};

/**
 * Las tonalidades de una canción para buscarla y filtrarla: las de
 * `tonalidades` (que se calculan al guardar una que modula) o, si no hay,
 * la de `key`. Las canciones de antes no tienen el campo hasta que se
 * vuelven a guardar.
 *
 * @param {Object|null} cancion
 * @returns {string[]}
 */
export const tonalidadesDeCancion = (cancion) => {
  if (Array.isArray(cancion?.tonalidades) && cancion.tonalidades.length) return cancion.tonalidades;
  return cancion?.key ? [cancion.key] : [];
};

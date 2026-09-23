// packages/core/src/music/versiones.js
//
// "Versión de": a quién se acredita la versión que toca la banda. A veces
// son varios (una persona y un grupo, o dos personas: "Ebenezer San
// Francisco, Jorge Jaenz"), así que se guarda como lista en `versiones`.
//
// El campo de siempre, `version`, se sigue guardando con los nombres unidos
// por comas. Así nada de lo que ya lo lee (las tarjetas, la búsqueda del
// Dashboard, el visor) necesita cambiar, y las canciones anteriores, que
// solo tienen `version`, no hay que migrarlas: su lista se saca de ahí.

const SEPARADOR = ', ';

/**
 * Quita espacios sobrantes, vacíos y repetidos (sin distinguir mayúsculas
 * ni tildes: "Elim Honduras" y "elim honduras" son la misma), respetando el
 * orden en que se escribieron.
 * @param {string[]} nombres
 * @returns {string[]}
 */
export const limpiarVersiones = (nombres) => {
  const vistos = new Set();
  const resultado = [];
  for (const nombre of Array.isArray(nombres) ? nombres : []) {
    const limpio = String(nombre ?? '').replace(/\s+/g, ' ').trim();
    if (!limpio) continue;
    const clave = limpio.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    resultado.push(limpio);
  }
  return resultado;
};

/**
 * La lista de "versión de" de una canción.
 *
 * Si la canción no tiene `versiones` (todas las anteriores a este cambio),
 * se saca de `version` separando por comas: quien ya escribió dos nombres
 * con coma en el campo de texto los ve como dos.
 *
 * @param {{versiones?: string[], version?: string}} cancion
 * @returns {string[]}
 */
export const leerVersiones = (cancion) => {
  if (Array.isArray(cancion?.versiones) && cancion.versiones.length > 0) {
    return limpiarVersiones(cancion.versiones);
  }
  return limpiarVersiones(String(cancion?.version ?? '').split(','));
};

/**
 * El texto que va en `version`: los nombres unidos por comas.
 * @param {string[]} nombres
 * @returns {string}
 */
export const unirVersiones = (nombres) => limpiarVersiones(nombres).join(SEPARADOR);

// packages/core/src/music/busqueda.js

import { nombrarTonalidad } from './notation';

/**
 * Buscar canciones del repertorio como las recuerda el músico: por el título,
 * por quién la canta, por el álbum o por un verso suelto de la letra, sin
 * depender de tildes ni mayúsculas. La usan el Dashboard y el selector de
 * canciones de las listas, para que las dos encuentren lo mismo.
 */

// Minúsculas y sin tildes: nadie escribe tildes buscando ("corazon" encuentra
// "corazón"), y la letra de las canciones va acentuada
export const normalizarBusqueda = (texto) => (texto || '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

// Ordenar por título con las reglas del español: "Alégrate" va entre "Alabaré"
// y "Alístate", no al final por llevar tilde; "Salmo 3" antes que "Salmo 21"
const porTitulo = new Intl.Collator('es', { sensitivity: 'base', numeric: true });
export const compararTitulos = (a, b) => porTitulo.compare(a?.title || '', b?.title || '');

/**
 * Cuánto encaja una canción con lo buscado: 0 si no encaja, y más cuanto
 * mejor, para poner primero lo más probable (lo que se añade con Enter).
 *
 * @param {Object} cancion
 * @param {string} termino - Ya pasado por `normalizarBusqueda`
 * @param {{ notacion?: string }} [opciones]
 */
export function puntuarCancion(cancion, termino, { notacion = 'latin' } = {}) {
  if (!termino) return 1;
  const titulo = normalizarBusqueda(cancion.title);
  if (titulo === termino) return 100;
  if (titulo.startsWith(termino)) return 80;
  // Al principio de una palabra del título: "vive" en "Cristo vive"
  if (titulo.split(/[^a-z0-9]+/).some((palabra) => palabra.startsWith(termino))) return 60;
  if (titulo.includes(termino)) return 50;
  if (normalizarBusqueda(cancion.version).includes(termino)) return 40;
  if (normalizarBusqueda(cancion.album).includes(termino)) return 30;
  if (normalizarBusqueda(cancion.type).includes(termino)) return 20;
  if (normalizarBusqueda(cancion.key).includes(termino)) return 20;
  // Quien lee en C-D-E busca "Bm", no "SIm"
  if (notacion === 'english' && normalizarBusqueda(nombrarTonalidad(cancion.key, notacion)).includes(termino)) return 20;
  // Por un verso suelto, solo a partir de 4 letras: los nombres de nota (DO,
  // RE, MI...) aparecen dentro de cualquier palabra, y "re" devolvía
  // "siempre" y "adoraré"
  if (termino.length >= 4 && normalizarBusqueda(cancion.lyricsOnly).includes(termino)) return 10;
  return 0;
}

/**
 * Las canciones que encajan con `texto`, las mejores primero y, a igualdad,
 * por título. Sin texto, todas por título.
 */
export function buscarCanciones(canciones, texto, opciones = {}) {
  const termino = normalizarBusqueda(texto).trim();
  return canciones
    .map((cancion) => ({ cancion, puntos: puntuarCancion(cancion, termino, opciones) }))
    .filter(({ puntos }) => puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || compararTitulos(a.cancion, b.cancion))
    .map(({ cancion }) => cancion);
}

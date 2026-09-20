// packages/api/src/services/scores.js
//
// Subida, borrado y lectura de las partituras en PDF en Cloud Storage.
//
// En Firestore se guarda **la ruta**, no la URL de descarga, y la URL se pide
// al mostrar con `getScoreUrl`. Asi manda siempre la regla de `storage.rules`:
// una URL de `getDownloadURL` lleva un token dentro y vale para cualquiera que
// la tenga, incluso despues de hacer privada la cancion.

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import { buildScorePath, SCORE_VARIANTS } from '@notesheet/core';
import { storage } from '../firebase/config';

// Mismo tope que en `storage.rules`. Se comprueba tambien aqui para poder
// decir por que no se sube, en vez de soltar un error de permisos.
export const MAX_SCORE_BYTES = 20 * 1024 * 1024;

/**
 * Sube una partitura a la casilla instrumento x voz x variante de una
 * cancion. Si ya habia algo en esa casilla se sobrescribe: la ruta la fija el
 * codigo, no el nombre del archivo.
 *
 * @param {Object} params
 * @param {string} params.songId - La cancion tiene que existir ya: la regla
 *   de Storage la consulta en Firestore para decidir el permiso.
 * @param {string} params.instrumentId
 * @param {string|number} params.voiceNumber
 * @param {string} params.variant - 'partitura' | 'conNotas'
 * @param {File} params.file
 * @returns {Promise<string>} La ruta guardada (no la URL)
 */
export const uploadScore = async ({
  songId,
  instrumentId,
  voiceNumber,
  variant,
  file
}) => {
  if (!songId) throw new Error('Guarda la canción antes de subir partituras');
  if (!file) throw new Error('No hay ningún archivo que subir');
  if (!SCORE_VARIANTS.includes(variant)) {
    throw new Error(`Variante desconocida: ${variant}`);
  }
  if (file.type !== 'application/pdf') {
    throw new Error('Solo se aceptan archivos PDF');
  }
  if (file.size > MAX_SCORE_BYTES) {
    const mb = Math.round(MAX_SCORE_BYTES / (1024 * 1024));
    throw new Error(`El PDF no puede pasar de ${mb} MB`);
  }

  const path = buildScorePath(songId, instrumentId, voiceNumber, variant);
  await uploadBytes(ref(storage, path), file, { contentType: 'application/pdf' });

  return path;
};

/**
 * URL de descarga de una partitura. Caduca con la sesion y la regla decide
 * si se concede, asi que no se guarda en ningun sitio.
 *
 * @param {string} path
 * @returns {Promise<string>}
 */
export const getScoreUrl = async (path) => {
  if (!path) throw new Error('Ruta de partitura vacía');
  return getDownloadURL(ref(storage, path));
};

/**
 * Borra una partitura de Storage.
 *
 * Que el archivo ya no este no es un error: puede haberse borrado a mano o en
 * un intento anterior que fallo a medias. Lo que importa es que despues de
 * esto no exista.
 *
 * @param {string} path
 * @returns {Promise<void>}
 */
export const deleteScore = async (path) => {
  if (!path) return;

  try {
    await deleteObject(ref(storage, path));
  } catch (error) {
    if (error?.code === 'storage/object-not-found') return;
    throw error;
  }
};

/**
 * Borra varias partituras. Se usa al borrar una cancion entera: sin esto los
 * archivos quedarian en Storage sin dueno.
 *
 * Los fallos no cortan el resto ni tumban el borrado de la cancion: un PDF
 * huerfano es un problema menor, y la regla de Storage ya lo deja ilegible en
 * cuanto la cancion desaparece de Firestore.
 *
 * @param {string[]} paths
 * @returns {Promise<void>}
 */
export const deleteScores = async (paths = []) => {
  await Promise.all(paths.map((path) => (
    deleteScore(path).catch((error) => {
      console.error('No se pudo borrar la partitura', path, error);
    })
  )));
};

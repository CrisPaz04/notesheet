// packages/api/src/services/importarPartituras.js
//
// Subir muchas partituras de golpe a una canción, y crear la canción si no
// existe. Qué archivo va a qué casilla lo decide core (`repartirPdfs`, a
// partir de los nombres); aquí solo se sube y se guarda.

import {
  setScoreInMap,
  SONG_FORMAT_PDF,
  limpiarVersiones,
  unirVersiones,
  TEMPO_MIN,
  TEMPO_MAX
} from '@notesheet/core';
import { uploadScore } from './scores';
import { createSong, updateSong } from './songs';

/**
 * Sube una tanda de partituras a una canción que ya existe.
 *
 * El documento se actualiza **tras cada archivo**, no al final: si la red se
 * cae a mitad, lo que ya subió queda apuntado y no hay archivos en Storage
 * que la canción no conozca. Un archivo que falla no para los demás; se
 * devuelve en `errores`.
 *
 * Además de `pdfs`, se asegura de que cada voz tenga su casilla en `voices`:
 * es lo que el editor usa para sacar las pestañas.
 *
 * @param {Object} params
 * @param {Object} params.song - La canción (con `id`, y `pdfs`/`voices` si los tiene)
 * @param {Array<{archivo: File, instrumentId: string, voiceNumber: string, variant: string}>} params.asignados
 *   Lo que devuelve `repartirPdfs`
 * @param {(progreso: {hechos: number, total: number, actual?: string}) => void} [params.onProgreso]
 * @returns {Promise<{pdfs: Object, voices: Object, subidos: number, errores: Array<{archivo: File, mensaje: string}>}>}
 */
export const subirVariasPartituras = async ({ song, asignados, onProgreso = () => {} }) => {
  let pdfs = song.pdfs || {};
  let voices = song.voices || {};
  let primaryInstrument = song.primaryInstrument || null;
  let primaryVoiceNumber = song.primaryVoiceNumber || null;
  const errores = [];
  let subidos = 0;
  const total = asignados.length;

  for (let i = 0; i < total; i += 1) {
    const { archivo, instrumentId, voiceNumber, variant } = asignados[i];
    onProgreso({ hechos: i, total, actual: archivo.name });

    try {
      const path = await uploadScore({ songId: song.id, instrumentId, voiceNumber, variant, file: archivo });

      pdfs = setScoreInMap(pdfs, instrumentId, voiceNumber, variant, path);
      if (voices[instrumentId]?.[voiceNumber] === undefined) {
        voices = { ...voices, [instrumentId]: { ...(voices[instrumentId] || {}), [voiceNumber]: '' } };
      }
      if (!primaryInstrument) {
        primaryInstrument = instrumentId;
        primaryVoiceNumber = voiceNumber;
      }

      await updateSong(song.id, {
        pdfs,
        voices,
        format: SONG_FORMAT_PDF,
        primaryInstrument,
        primaryVoiceNumber
      });
      subidos += 1;
    } catch (error) {
      errores.push({ archivo, mensaje: error.message });
    }
  }

  onProgreso({ hechos: total, total });
  return { pdfs, voices, subidos, errores };
};

/**
 * Crea una canción en PDF, vacía, lista para subirle las partituras.
 *
 * Con los datos del formulario de la importación (los mismos campos que el
 * editor, `CamposCancion`). Lo que no se rellenó queda como en una canción
 * nueva del editor.
 *
 * @param {Object} params
 * @param {Object} params.datos - `{ title, versiones, album, type, key, tempo, compas, isPublic, grabacion }`
 * @param {string} params.userId
 * @returns {Promise<Object>} La canción creada, con su `id`
 */
export const crearCancionPdf = ({ datos, userId }) => {
  const versiones = limpiarVersiones(datos.versiones || []);
  const tempo = Math.round(Number(String(datos.tempo ?? '').replace(',', '.')));

  return createSong({
    title: (datos.title || '').trim(),
    versiones,
    version: unirVersiones(versiones),
    key: datos.key || '',
    type: datos.type || '',
    album: (datos.album || '').trim(),
    tempo: Number.isFinite(tempo) && tempo >= TEMPO_MIN && tempo <= TEMPO_MAX ? tempo : null,
    compas: datos.compas || null,
    grabacion: datos.grabacion || null,
    content: '',
    lyricsOnly: '',
    acordes: '',
    voices: {},
    pdfs: {},
    format: SONG_FORMAT_PDF,
    public: datos.isPublic !== false,
    userId
  });
};

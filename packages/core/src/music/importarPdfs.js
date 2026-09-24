// packages/core/src/music/importarPdfs.js
//
// Subir muchas partituras de golpe a partir de cómo se llaman los archivos.
//
// La banda las guarda así, una carpeta por canción:
//
//   Coalo Zamorano--Alégrense--Bb_Trumpet_1.pdf
//   Coalo Zamorano--Alégrense--Bb_Trumpet_1--NN.pdf   (con los nombres de
//                                                       las notas encima)
//   Coalo Zamorano--Alégrense--Sax_Alto.pdf            (sin número: voz 1)
//   Coalo Zamorano--Alégrense--Score.pdf               (la completa: no se sube)
//
// Todo lo de aquí es puro: de nombres a casillas instrumento × voz ×
// variante, y de canciones a la que ya existe en el repertorio. La subida la
// hace la web con `uploadScore`.

import { normalizarTexto } from './setlist';
import { leerVersiones } from './versiones';

// Palabras sueltas que nombran un instrumento. Las del saxo van aparte: "Sax"
// solo no dice cuál.
const INSTRUMENTOS = [
  { id: 'bb_trumpet', palabras: ['trumpet', 'trompeta', 'tpt'] },
  { id: 'bb_trombone', palabras: ['trombone', 'trombon', 'tbn'] },
  { id: 'bb_clarinet', palabras: ['clarinet', 'clarinete', 'cl'] },
  { id: 'c_flute', palabras: ['flute', 'flauta', 'fl'] },
  { id: 'f_horn', palabras: ['horn', 'corno', 'trompa'] },
  { id: 'c_guitar', palabras: ['guitar', 'guitarra'] },
  { id: 'c_piano', palabras: ['piano', 'keyboard', 'keys', 'teclado'] },
  { id: 'c_bass', palabras: ['bass', 'bajo'] },
  { id: 'c_voice', palabras: ['voice', 'voz', 'vocal', 'vocals'] }
];

const SAXOS = [
  { id: 'eb_alto_sax', palabras: ['alto'] },
  { id: 'bb_tenor_sax', palabras: ['tenor'] },
  { id: 'bb_soprano_sax', palabras: ['soprano'] },
  { id: 'eb_baritone_sax', palabras: ['baritone', 'baritono', 'bari'] }
];

// La partitura completa, la del director
const PALABRAS_SCORE = ['score', 'full', 'completa', 'general', 'director'];

/**
 * El instrumento y la voz de la parte del nombre ("Bb_Trumpet_2",
 * "Sax_Alto", "Score").
 *
 * @param {string} parte
 * @returns {{instrumentId: string|null, voiceNumber: string, esScore: boolean}}
 */
export const interpretarParte = (parte) => {
  const palabras = normalizarTexto(String(parte || '').replace(/_/g, ' ')).split(' ').filter(Boolean);

  // La voz es el número del final; sin número, la 1
  let voiceNumber = '1';
  if (palabras.length && /^\d+$/.test(palabras[palabras.length - 1])) {
    voiceNumber = String(Number(palabras.pop()));
  }

  if (palabras.some((p) => PALABRAS_SCORE.includes(p))) {
    return { instrumentId: null, voiceNumber, esScore: true };
  }

  const tiene = (lista) => lista.some((p) => palabras.includes(p));
  const esSaxo = tiene(['sax', 'saxo', 'saxophone', 'saxofon']);

  // "Alto" solo, sin "Sax", también es el saxo alto: no hay otro alto
  const saxo = SAXOS.find((s) => tiene(s.palabras) && (esSaxo || s.id === 'eb_alto_sax'));
  if (saxo) return { instrumentId: saxo.id, voiceNumber, esScore: false };

  const instrumento = INSTRUMENTOS.find((i) => tiene(i.palabras));
  return { instrumentId: instrumento?.id || null, voiceNumber, esScore: false };
};

/**
 * Lee el nombre de un archivo de partitura.
 *
 * @param {string} nombre - "Coalo Zamorano--Alégrense--Bb_Trumpet_1--NN.pdf"
 * @returns {{nombre: string, autor: string, titulo: string,
 *            instrumentId: string|null, voiceNumber: string,
 *            variant: 'partitura'|'conNotas', esScore: boolean}}
 */
export const interpretarNombrePdf = (nombre) => {
  const sinExtension = String(nombre || '').replace(/\.pdf$/i, '');
  const trozos = sinExtension.split('--').map((t) => t.trim()).filter(Boolean);

  let variant = 'partitura';
  if (trozos.length > 1 && /^nn$/i.test(trozos[trozos.length - 1])) {
    variant = 'conNotas';
    trozos.pop();
  }

  const parte = trozos.length > 1 ? trozos.pop() : (trozos.pop() || '');
  // Lo que queda: "Autor--Título", o solo el título
  const titulo = trozos.length ? trozos[trozos.length - 1] : '';
  const autor = trozos.length > 1 ? trozos.slice(0, -1).join(' ') : '';

  return { nombre, autor, titulo, variant, ...interpretarParte(parte) };
};

/**
 * Reparte una tanda de archivos de una canción en sus casillas.
 *
 * Nunca se sube nada que no se entienda: lo que no se reconoce, la partitura
 * completa y lo que caería dos veces en la misma casilla se aparta con su
 * motivo, para enseñarlo antes de subir.
 *
 * @param {Array<{name: string}>} archivos - Los `File` elegidos
 * @returns {{asignados: Array<{archivo: Object, instrumentId: string, voiceNumber: string, variant: string}>,
 *            apartados: Array<{archivo: Object, motivo: string}>}}
 */
export const repartirPdfs = (archivos) => {
  const asignados = [];
  const apartados = [];
  const ocupadas = new Set();

  (archivos || []).forEach((archivo) => {
    if (!/\.pdf$/i.test(archivo?.name || '')) {
      apartados.push({ archivo, motivo: 'No es un PDF' });
      return;
    }
    const leido = interpretarNombrePdf(archivo.name);
    if (leido.esScore) {
      apartados.push({ archivo, motivo: 'Partitura completa: no se sube' });
      return;
    }
    if (!leido.instrumentId) {
      apartados.push({ archivo, motivo: 'No se reconoce el instrumento' });
      return;
    }
    const casilla = `${leido.instrumentId}-${leido.voiceNumber}-${leido.variant}`;
    if (ocupadas.has(casilla)) {
      apartados.push({ archivo, motivo: 'Repetido: ya hay otro para esa voz' });
      return;
    }
    ocupadas.add(casilla);
    asignados.push({
      archivo,
      instrumentId: leido.instrumentId,
      voiceNumber: leido.voiceNumber,
      variant: leido.variant
    });
  });

  // En el orden en que se leen: por instrumento y voz, la normal antes
  const orden = (a) => `${a.instrumentId}-${a.voiceNumber.padStart(3, '0')}-${a.variant === 'partitura' ? 0 : 1}`;
  asignados.sort((a, b) => orden(a).localeCompare(orden(b)));

  return { asignados, apartados };
};

/**
 * Agrupa los archivos de una carpeta con subcarpetas (la de "Partituras"
 * entera) en canciones, por el autor y el título de sus nombres.
 *
 * @param {Array<{name: string}>} archivos
 * @returns {Array<{autor: string, titulo: string, archivos: Array}>}
 */
export const agruparPorCancion = (archivos) => {
  const grupos = new Map();
  (archivos || []).forEach((archivo) => {
    if (!/\.pdf$/i.test(archivo?.name || '')) return;
    const { autor, titulo } = interpretarNombrePdf(archivo.name);
    if (!titulo) return;
    const clave = `${normalizarTexto(autor)}|${normalizarTexto(titulo)}`;
    if (!grupos.has(clave)) grupos.set(clave, { autor, titulo, archivos: [] });
    grupos.get(clave).archivos.push(archivo);
  });
  return [...grupos.values()].sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
};

/**
 * La canción del repertorio a la que añadir los PDF: la del mismo título.
 * Si hay varias, la que tiene al autor en su "Versión de".
 *
 * @param {Array<Object>} canciones - Las que el músico puede editar
 * @param {{titulo: string, autor?: string}} buscada
 * @returns {Object|null}
 */
export const buscarCancionParaPdfs = (canciones, { titulo, autor = '' }) => {
  const t = normalizarTexto(titulo);
  if (!t) return null;
  const mismas = (canciones || []).filter((c) => normalizarTexto(c.title) === t);
  if (mismas.length <= 1) return mismas[0] || null;

  const a = normalizarTexto(autor);
  return mismas.find((c) => a && leerVersiones(c).some((v) => {
    const nv = normalizarTexto(v);
    return nv && (nv.includes(a) || a.includes(nv));
  })) || mismas[0];
};

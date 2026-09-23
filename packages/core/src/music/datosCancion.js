// packages/core/src/music/datosCancion.js
//
// Datos de la grabación original de una canción, traídos de fuera:
// MusicBrainz e iTunes (título, artista, álbum, año, duración) y GetSongBPM
// (tempo, tonalidad, compás). El porqué de estas fuentes y de las descartadas
// está en PLAN-ACORDES-Y-DATOS.md.
//
// Aquí solo se traducen sus respuestas a una forma común y se hacen las
// cuentas; las llamadas de red viven en packages/api (datosCanciones.js).
//
// **Todo lo que viene de fuera está en tonalidad de concierto.** `key` y
// `content` de la canción están en la referencia de la trompeta en Sib, así
// que nada de aquí se mezcla con ellos sin convertir.

import { convertNotationSystem } from './notation';
import { identificarTonalidad } from './transposition';
import { transposeKeyBySemitones } from './transposition-helper';
import { TRANSPOSING_INSTRUMENTS } from './instruments';

// El instrumento que lee en concierto: la flauta (y la guitarra, el piano...)
const INSTRUMENTO_EN_CONCIERTO = 'c_flute';

/** Segundos, redondeados, o null si no hay un número con sentido. */
const segundos = (ms) => (Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null);

/** El año de una fecha "2006-11-07" o "2003-01-01T12:00:00Z". */
const anioDe = (fecha) => {
  const m = /^(\d{4})/.exec(String(fecha || ''));
  return m ? Number(m[1]) : null;
};

/**
 * Las grabaciones de una búsqueda de MusicBrainz (`/ws/2/recording`).
 * Solo se usan sus datos de base, que son CC0; las etiquetas y valoraciones
 * no (tienen otra licencia).
 */
export const normalizarMusicBrainz = (respuesta) =>
  (respuesta?.recordings || []).map((r) => ({
    fuente: 'musicbrainz',
    id: r.id,
    titulo: r.title || '',
    // Varios artistas vienen en trozos con su "joinphrase" (" & ", " feat. ")
    artista: (r['artist-credit'] || [])
      .map((c) => `${c.name ?? c.artist?.name ?? ''}${c.joinphrase ?? ''}`)
      .join('')
      .trim(),
    album: r.releases?.[0]?.title || '',
    anio: anioDe(r['first-release-date'] || r.releases?.[0]?.date),
    duracion: segundos(r.length),
    enlace: r.id ? `https://musicbrainz.org/recording/${r.id}` : null
  }));

/** Las canciones de una búsqueda de iTunes (`/search?entity=song`). */
export const normalizarItunes = (respuesta) =>
  (respuesta?.results || [])
    .filter((r) => r.kind === undefined || r.kind === 'song')
    .map((r) => ({
      fuente: 'itunes',
      id: r.trackId != null ? String(r.trackId) : '',
      titulo: r.trackName || '',
      artista: r.artistName || '',
      album: r.collectionName || '',
      anio: anioDe(r.releaseDate),
      duracion: segundos(r.trackTimeMillis),
      // Apple la ofrece para promocionar su tienda: si se guarda algo de
      // iTunes, va con el enlace a Apple Music al lado.
      enlace: r.trackViewUrl || null
    }));

/**
 * La tonalidad que da una fuente ("G♯", "Em", "B♭m") en el formato de la
 * app ("SOL#", "MIm", "SIbm"), o null si no se entiende.
 */
export const tonalidadDeFuente = (valor) => {
  const limpia = String(valor || '')
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/\s*(minor|min)$/i, 'm')
    .replace(/\s*(major|maj)$/i, '');
  if (!limpia) return null;
  const latina = convertNotationSystem(limpia, 'latin').trim();
  return identificarTonalidad(latina) ? latina : null;
};

/** Los resultados de una búsqueda de GetSongBPM (`/search/`). */
export const normalizarGetSongBpm = (respuesta) => {
  const lista = Array.isArray(respuesta?.search) ? respuesta.search : [];
  return lista.map((r) => {
    const tempo = Number(r.tempo);
    return {
      fuente: 'getsongbpm',
      id: r.id || '',
      titulo: r.title || '',
      artista: r.artist?.name || '',
      album: r.album?.title || '',
      tempo: Number.isFinite(tempo) && tempo > 0 ? Math.round(tempo) : null,
      tonoConcierto: tonalidadDeFuente(r.key_of),
      compas: /^\d+\/\d+$/.test(r.time_sig || '') ? r.time_sig : null,
      enlace: r.uri || 'https://getsongbpm.com'
    };
  });
};

/**
 * La tonalidad de concierto de una grabación, escrita para un instrumento:
 * lo que ve un trompetista es un tono por encima de lo que suena.
 * Para los que leen en concierto (flauta, guitarra, piano) no cambia.
 */
export const tonalidadParaInstrumento = (tonoConcierto, instrumento) => {
  if (!tonoConcierto) return tonoConcierto;
  const destino = TRANSPOSING_INSTRUMENTS[instrumento];
  const origen = TRANSPOSING_INSTRUMENTS[INSTRUMENTO_EN_CONCIERTO];
  if (!destino || !origen) return tonoConcierto;
  const semitonos = destino.transposition - origen.transposition;
  return semitonos ? transposeKeyBySemitones(tonoConcierto, semitonos) : tonoConcierto;
};

/** ¿Lee este instrumento en otra tonalidad que la de concierto? */
export const esTranspositor = (instrumento) => {
  const destino = TRANSPOSING_INSTRUMENTS[instrumento];
  const origen = TRANSPOSING_INSTRUMENTS[INSTRUMENTO_EN_CONCIERTO];
  return Boolean(destino && origen && destino.transposition !== origen.transposition);
};

const comparable = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

/**
 * Se queda con los resultados cuyo título contiene el buscado (o al revés),
 * sin mirar mayúsculas, tildes ni signos. La búsqueda de iTunes es muy
 * amplia y devuelve otras canciones del mismo artista.
 *
 * Si el filtro no deja ninguno, devuelve todos: puede que el título esté
 * escrito de otra forma, y mejor enseñar de más que no enseñar nada.
 */
export const filtrarPorTitulo = (candidatos, titulo) => {
  const buscado = comparable(titulo);
  if (!buscado) return candidatos;
  const coinciden = candidatos.filter((c) => {
    const t = comparable(c.titulo);
    return t && (t.includes(buscado) || buscado.includes(t));
  });
  return coinciden.length ? coinciden : candidatos;
};

/** "4:53" a partir de segundos. */
export const formatearDuracion = (seg) => {
  if (!Number.isFinite(seg) || seg <= 0) return '';
  return `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`;
};

// Tempos con sentido para una canción; fuera de aquí, un toque de más o de
// menos, o un dato roto de una fuente.
export const TEMPO_MIN = 30;
export const TEMPO_MAX = 300;

/**
 * El tempo que marcan unos toques (instantes en ms), como el tap tempo del
 * metrónomo: la media de los intervalos. Hacen falta al menos 3 toques, y
 * un resultado fuera de 30-300 se descarta.
 * @param {number[]} toques
 * @returns {number|null}
 */
export const tempoDesdeToques = (toques) => {
  if (!Array.isArray(toques) || toques.length < 3) return null;
  const intervalos = [];
  for (let i = 1; i < toques.length; i++) intervalos.push(toques[i] - toques[i - 1]);
  const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
  if (!(media > 0)) return null;
  const tempo = Math.round(60000 / media);
  return tempo >= TEMPO_MIN && tempo <= TEMPO_MAX ? tempo : null;
};

/**
 * Enlaces para consultar a mano la canción en webs que no se pueden leer
 * desde la app (no tienen API y sus términos prohíben el scraping). Abren su
 * búsqueda con título y artista; el músico mira y copia lo que quiera.
 *
 * songbpm solo busca por POST, así que su enlace abre la portada.
 */
export const enlacesVerEn = (titulo, artista = '') => {
  const q = [titulo, artista].map((s) => String(s || '').trim()).filter(Boolean).join(' ');
  if (!q) return [];
  const e = encodeURIComponent(q);
  return [
    { nombre: 'YouTube', url: `https://www.youtube.com/results?search_query=${e}` },
    { nombre: 'Cifra Club', url: `https://www.cifraclub.com/?q=${e}` },
    { nombre: 'LaCuerda', url: `https://acordes.lacuerda.net/busca.php?exp=${e}` },
    { nombre: 'Tunebat', url: `https://tunebat.com/Search?q=${e}` },
    { nombre: 'songbpm', url: 'https://songbpm.com/' },
    { nombre: 'MultiTracks', url: `https://www.multitracks.com/search/?q=${e}` },
    { nombre: 'Chordify', url: `https://chordify.net/search/${e}` }
  ];
};

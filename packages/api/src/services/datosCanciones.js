// packages/api/src/services/datosCanciones.js
//
// Busca los datos de la grabación original de una canción en MusicBrainz,
// iTunes y GetSongBPM. Las tres admiten CORS, así que se llaman desde el
// navegador, sin backend. Lo que devuelven lo traduce packages/core
// (datosCancion.js); aquí solo va la red.
//
// Se lanza a mano con el botón "Buscar datos" del editor, una búsqueda cada
// vez, así que los límites de las fuentes (1 petición/s en MusicBrainz, unas
// 20/min en iTunes, 3000/h en GetSongBPM) no se acercan.

import {
  normalizarMusicBrainz,
  normalizarItunes,
  normalizarGetSongBpm,
  filtrarPorTitulo
} from '@notesheet/core';

// GetSongBPM es gratis a cambio de un enlace visible a su web (está en el
// pie y en index.html). La clave acaba en el código de la web: es lo que
// tiene llamar desde el navegador, y está asumido (ver el plan).
const CLAVE_GETSONGBPM = import.meta.env?.VITE_GETSONGBPM_API_KEY || '';

const pedirJson = async (url, fetchImpl) => {
  const respuesta = await fetchImpl(url);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.json();
};

// Las comillas de la consulta de MusicBrainz (sintaxis de Lucene) no pueden
// ir dentro del texto buscado.
const sinComillas = (s) => String(s || '').replace(/"/g, ' ').trim();

export const buscarEnMusicBrainz = async (titulo, artista, fetchImpl = fetch) => {
  const partes = [`recording:"${sinComillas(titulo)}"`];
  if (artista) partes.push(`artist:"${sinComillas(artista)}"`);
  const url = 'https://musicbrainz.org/ws/2/recording?' + new URLSearchParams({
    query: partes.join(' AND '),
    fmt: 'json',
    limit: '10'
  });
  return normalizarMusicBrainz(await pedirJson(url, fetchImpl));
};

export const buscarEnItunes = async (titulo, artista, fetchImpl = fetch) => {
  const url = 'https://itunes.apple.com/search?' + new URLSearchParams({
    term: [titulo, artista].filter(Boolean).join(' '),
    entity: 'song',
    limit: '10'
  });
  return normalizarItunes(await pedirJson(url, fetchImpl));
};

export const buscarEnGetSongBpm = async (titulo, artista, fetchImpl = fetch, clave = CLAVE_GETSONGBPM) => {
  if (!clave) throw new Error('Falta la clave de GetSongBPM (VITE_GETSONGBPM_API_KEY)');
  // Con artista se busca por los dos: solo por título, un título común
  // ("Fuego") trae 30 canciones de otros y la buena puede no estar.
  const params = artista
    ? { type: 'both', lookup: `song:${titulo} artist:${artista}` }
    : { type: 'song', lookup: titulo };
  const url = 'https://api.getsong.co/search/?' + new URLSearchParams({ api_key: clave, ...params });
  const json = await pedirJson(url, fetchImpl);
  // Una clave mala llega como { error }. "No encontrado" llega como
  // { search: { error: "no result" } }, con 200, y normalizarGetSongBpm ya
  // lo convierte en una lista vacía.
  if (json?.error) throw new Error(json.error);
  return normalizarGetSongBpm(json);
};

/**
 * Busca en las tres fuentes a la vez. Que una falle no tumba las otras: su
 * error se devuelve aparte, para decirlo en pantalla.
 *
 * @returns {Promise<{grabaciones: Object[], tempos: Object[], errores: Object}>}
 *   `grabaciones`, de MusicBrainz e iTunes; `tempos`, de GetSongBPM;
 *   `errores`, por fuente.
 */
export const buscarDatosDeCancion = async ({ titulo, artista = '' }, opciones = {}) => {
  const fetchImpl = opciones.fetchImpl || fetch;
  const t = String(titulo || '').trim();
  const a = String(artista || '').trim();
  if (!t) return { grabaciones: [], tempos: [], errores: {} };

  const [mb, it, gs] = await Promise.allSettled([
    buscarEnMusicBrainz(t, a, fetchImpl),
    buscarEnItunes(t, a, fetchImpl),
    buscarEnGetSongBpm(t, a, fetchImpl, opciones.claveGetSongBpm ?? CLAVE_GETSONGBPM)
  ]);

  const errores = {};
  const valor = (r, fuente) => {
    if (r.status === 'fulfilled') return r.value;
    errores[fuente] = r.reason?.message || String(r.reason);
    return [];
  };

  return {
    grabaciones: filtrarPorTitulo([...valor(it, 'itunes'), ...valor(mb, 'musicbrainz')], t),
    tempos: valor(gs, 'getsongbpm'),
    errores
  };
};

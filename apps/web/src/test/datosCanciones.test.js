import { describe, it, expect, vi } from 'vitest';
import {
  buscarEnMusicBrainz,
  buscarEnItunes,
  buscarEnGetSongBpm,
  buscarDatosDeCancion
} from '../../../../packages/api/src/services/datosCanciones.js';

// Un fetch falso que responde según el dominio y apunta las URLs pedidas
const fetchFalso = (respuestas) => {
  const pedidas = [];
  const impl = vi.fn(async (url) => {
    pedidas.push(url);
    const host = new URL(url).host;
    const r = respuestas[host];
    if (r instanceof Error) throw r;
    if (r?.status && r.status !== 200) return { ok: false, status: r.status, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => r ?? {} };
  });
  return { impl, pedidas };
};

const params = (url) => Object.fromEntries(new URL(url).searchParams);

describe('buscarEnMusicBrainz', () => {
  it('busca por grabación y artista, en JSON', async () => {
    const { impl, pedidas } = fetchFalso({ 'musicbrainz.org': { recordings: [] } });
    await buscarEnMusicBrainz('Agnus Dei', 'Marco Barrientos', impl);
    const p = params(pedidas[0]);
    expect(pedidas[0]).toMatch(/^https:\/\/musicbrainz\.org\/ws\/2\/recording\?/);
    expect(p.query).toBe('recording:"Agnus Dei" AND artist:"Marco Barrientos"');
    expect(p.fmt).toBe('json');
  });

  it('sin artista busca solo la grabación, y las comillas no rompen la consulta', async () => {
    const { impl, pedidas } = fetchFalso({ 'musicbrainz.org': { recordings: [] } });
    await buscarEnMusicBrainz('Dijo "sí"', '', impl);
    expect(params(pedidas[0]).query).toBe('recording:"Dijo  sí"');
  });
});

describe('buscarEnItunes', () => {
  it('busca canciones con título y artista juntos', async () => {
    const { impl, pedidas } = fetchFalso({ 'itunes.apple.com': { results: [] } });
    await buscarEnItunes('Agnus Dei', 'Marco Barrientos', impl);
    const p = params(pedidas[0]);
    expect(p.term).toBe('Agnus Dei Marco Barrientos');
    expect(p.entity).toBe('song');
  });
});

describe('buscarEnGetSongBpm', () => {
  it('con artista busca por los dos, y manda la clave', async () => {
    const { impl, pedidas } = fetchFalso({ 'api.getsong.co': { search: [] } });
    await buscarEnGetSongBpm('Oceans', 'Hillsong', impl, 'CLAVE');
    const p = params(pedidas[0]);
    expect(p).toEqual({ api_key: 'CLAVE', type: 'both', lookup: 'song:Oceans artist:Hillsong' });
  });

  it('sin artista busca solo por título', async () => {
    const { impl, pedidas } = fetchFalso({ 'api.getsong.co': { search: [] } });
    await buscarEnGetSongBpm('Oceans', '', impl, 'CLAVE');
    expect(params(pedidas[0])).toEqual({ api_key: 'CLAVE', type: 'song', lookup: 'Oceans' });
  });

  it('"no result" (que llega con 200) es una lista vacía, no un error', async () => {
    const { impl } = fetchFalso({ 'api.getsong.co': { search: { error: 'no result' } } });
    await expect(buscarEnGetSongBpm('Nada', 'Nadie', impl, 'CLAVE')).resolves.toEqual([]);
  });

  it('una clave mala sí es un error', async () => {
    const { impl } = fetchFalso({ 'api.getsong.co': { error: 'Invalid API Key, or inactive.' } });
    await expect(buscarEnGetSongBpm('X', '', impl, 'MALA')).rejects.toThrow('Invalid API Key');
  });

  it('sin clave no llama a nadie', async () => {
    const { impl } = fetchFalso({});
    await expect(buscarEnGetSongBpm('X', '', impl, '')).rejects.toThrow(/Falta la clave/);
    expect(impl).not.toHaveBeenCalled();
  });
});

describe('buscarDatosDeCancion', () => {
  const RESPUESTAS = {
    'musicbrainz.org': { recordings: [{ id: 'mb1', title: 'Agnus dei', 'artist-credit': [{ name: 'Marco Barrientos' }], releases: [] }] },
    'itunes.apple.com': { results: [{ kind: 'song', trackId: 1, trackName: 'Agnus Dei', artistName: 'Marco Barrientos' }] },
    'api.getsong.co': { search: [{ id: 'g1', title: 'Agnus Dei', tempo: '67', key_of: 'A', time_sig: '4/4', artist: { name: 'Marco Barrientos' } }] }
  };

  it('junta las tres fuentes: grabaciones (iTunes primero) y tempos', async () => {
    const { impl } = fetchFalso(RESPUESTAS);
    const r = await buscarDatosDeCancion({ titulo: 'Agnus Dei', artista: 'Marco Barrientos' }, { fetchImpl: impl, claveGetSongBpm: 'K' });
    expect(r.grabaciones.map((g) => g.fuente)).toEqual(['itunes', 'musicbrainz']);
    expect(r.tempos).toHaveLength(1);
    expect(r.tempos[0].tonoConcierto).toBe('LA');
    expect(r.errores).toEqual({});
  });

  it('descarta otras canciones del mismo artista que cuela iTunes', async () => {
    const { impl } = fetchFalso({
      ...RESPUESTAS,
      'itunes.apple.com': { results: [
        { kind: 'song', trackId: 1, trackName: 'Agnus Dei', artistName: 'Marco Barrientos' },
        { kind: 'song', trackId: 2, trackName: 'Aclame al Señor', artistName: 'Marco Barrientos' }
      ] }
    });
    const r = await buscarDatosDeCancion({ titulo: 'Agnus Dei', artista: 'Marco Barrientos' }, { fetchImpl: impl, claveGetSongBpm: 'K' });
    expect(r.grabaciones.map((g) => g.titulo)).toEqual(['Agnus Dei', 'Agnus dei']);
  });

  it('una fuente caída no tumba las demás: su error va aparte', async () => {
    const { impl } = fetchFalso({ ...RESPUESTAS, 'musicbrainz.org': { status: 503 } });
    const r = await buscarDatosDeCancion({ titulo: 'Agnus Dei' }, { fetchImpl: impl, claveGetSongBpm: 'K' });
    expect(r.grabaciones.map((g) => g.fuente)).toEqual(['itunes']);
    expect(r.tempos).toHaveLength(1);
    expect(r.errores).toEqual({ musicbrainz: 'HTTP 503' });
  });

  it('sin red, las tres dan error y la búsqueda no revienta', async () => {
    const sinRed = new TypeError('Failed to fetch');
    const { impl } = fetchFalso({ 'musicbrainz.org': sinRed, 'itunes.apple.com': sinRed, 'api.getsong.co': sinRed });
    const r = await buscarDatosDeCancion({ titulo: 'X' }, { fetchImpl: impl, claveGetSongBpm: 'K' });
    expect(r.grabaciones).toEqual([]);
    expect(Object.keys(r.errores).sort()).toEqual(['getsongbpm', 'itunes', 'musicbrainz']);
  });

  it('sin título no busca', async () => {
    const { impl } = fetchFalso(RESPUESTAS);
    const r = await buscarDatosDeCancion({ titulo: '  ' }, { fetchImpl: impl });
    expect(r).toEqual({ grabaciones: [], tempos: [], errores: {} });
    expect(impl).not.toHaveBeenCalled();
  });
});

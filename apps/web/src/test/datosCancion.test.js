import { describe, it, expect } from 'vitest';
import {
  normalizarMusicBrainz,
  normalizarItunes,
  normalizarGetSongBpm,
  tonalidadDeFuente,
  tonalidadParaInstrumento,
  esTranspositor,
  formatearDuracion,
  tempoDesdeToques,
  enlacesVerEn,
  filtrarPorTitulo
} from '@notesheet/core';

// Recortes de respuestas reales (2026-09-23)
const MB = {
  recordings: [{
    id: '82538847-6ce7-4f81-bf67-95638753f89c',
    title: 'Agnus dei',
    length: 635013,
    'first-release-date': '2006-11-07',
    'artist-credit': [{ name: 'Marco Barrientos', artist: { name: 'Marco Barrientos' } }],
    releases: [{ title: 'Muéstrame tu gloria', date: '2006-11-07' }]
  }, {
    id: 'x2',
    title: 'Juntos',
    'artist-credit': [
      { name: 'Marcos Witt', joinphrase: ' & ' },
      { name: 'Danilo Montero' }
    ],
    releases: []
  }]
};

const ITUNES = {
  results: [{
    kind: 'song',
    trackId: 206308804,
    trackName: 'Agnus Dei',
    artistName: 'Marco Barrientos',
    collectionName: 'Muéstrame Tu Gloria',
    trackTimeMillis: 635013,
    releaseDate: '2003-01-01T12:00:00Z',
    trackViewUrl: 'https://music.apple.com/us/album/agnus-dei/206308705?i=206308804&uo=4'
  }, { kind: 'music-video', trackName: 'no es una canción' }]
};

const GSB = {
  search: [{
    id: 'abc',
    title: 'Goodness of God',
    uri: 'https://getsongbpm.com/song/goodness-of-god/abc',
    tempo: '63',
    time_sig: '4/4',
    key_of: 'G♯',
    artist: { name: 'Bethel Music' },
    album: { title: 'Victory' }
  }, {
    id: 'def', title: 'Rara', tempo: 'x', key_of: '??', time_sig: 'raro', artist: {}
  }]
};

describe('normalizarMusicBrainz', () => {
  it('saca título, artista, álbum, año, duración en segundos y enlace', () => {
    expect(normalizarMusicBrainz(MB)[0]).toEqual({
      fuente: 'musicbrainz',
      id: '82538847-6ce7-4f81-bf67-95638753f89c',
      titulo: 'Agnus dei',
      artista: 'Marco Barrientos',
      album: 'Muéstrame tu gloria',
      anio: 2006,
      duracion: 635,
      enlace: 'https://musicbrainz.org/recording/82538847-6ce7-4f81-bf67-95638753f89c'
    });
  });

  it('une varios artistas con su "joinphrase"', () => {
    expect(normalizarMusicBrainz(MB)[1].artista).toBe('Marcos Witt & Danilo Montero');
  });

  it('sin duración ni álbum no inventa nada', () => {
    const r = normalizarMusicBrainz(MB)[1];
    expect(r.duracion).toBeNull();
    expect(r.album).toBe('');
    expect(r.anio).toBeNull();
  });

  it('aguanta una respuesta vacía', () => {
    expect(normalizarMusicBrainz({})).toEqual([]);
    expect(normalizarMusicBrainz(undefined)).toEqual([]);
  });
});

describe('normalizarItunes', () => {
  it('saca los datos y el enlace a Apple Music, y descarta lo que no es canción', () => {
    const r = normalizarItunes(ITUNES);
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({
      fuente: 'itunes',
      id: '206308804',
      titulo: 'Agnus Dei',
      artista: 'Marco Barrientos',
      album: 'Muéstrame Tu Gloria',
      anio: 2003,
      duracion: 635,
      enlace: 'https://music.apple.com/us/album/agnus-dei/206308705?i=206308804&uo=4'
    });
  });
});

describe('normalizarGetSongBpm', () => {
  it('saca tempo, tonalidad en latina y compás', () => {
    expect(normalizarGetSongBpm(GSB)[0]).toEqual({
      fuente: 'getsongbpm',
      id: 'abc',
      titulo: 'Goodness of God',
      artista: 'Bethel Music',
      album: 'Victory',
      tempo: 63,
      tonoConcierto: 'SOL#',
      compas: '4/4',
      enlace: 'https://getsongbpm.com/song/goodness-of-god/abc'
    });
  });

  it('descarta tempo, tonalidad y compás que no se entienden, y enlaza a su web', () => {
    const r = normalizarGetSongBpm(GSB)[1];
    expect(r.tempo).toBeNull();
    expect(r.tonoConcierto).toBeNull();
    expect(r.compas).toBeNull();
    expect(r.enlace).toBe('https://getsongbpm.com');
  });

  it('"no encontrado" (search es un objeto) es una lista vacía', () => {
    expect(normalizarGetSongBpm({ search: { error: 'no result' } })).toEqual([]);
  });
});

describe('tonalidadDeFuente', () => {
  it('pasa la notación de las fuentes a la de la app', () => {
    expect(tonalidadDeFuente('G♯')).toBe('SOL#');
    expect(tonalidadDeFuente('Em')).toBe('MIm');
    expect(tonalidadDeFuente('B♭m')).toBe('SIbm');
    expect(tonalidadDeFuente('D')).toBe('RE');
    expect(tonalidadDeFuente('F# minor')).toBe('FA#m');
    expect(tonalidadDeFuente('C major')).toBe('DO');
  });

  it('lo que no es una tonalidad da null', () => {
    expect(tonalidadDeFuente('')).toBeNull();
    expect(tonalidadDeFuente(undefined)).toBeNull();
    expect(tonalidadDeFuente('??')).toBeNull();
    expect(tonalidadDeFuente('H')).toBeNull();
  });
});

describe('tonalidadParaInstrumento', () => {
  it('a un instrumento en Sib le sube un tono', () => {
    expect(tonalidadParaInstrumento('DO', 'bb_trumpet')).toBe('RE');
    expect(tonalidadParaInstrumento('LAm', 'bb_clarinet')).toBe('SIm');
  });

  it('a uno en Mib le sube una sexta mayor', () => {
    expect(tonalidadParaInstrumento('DO', 'eb_alto_sax')).toBe('LA');
  });

  it('a los que leen en concierto no les cambia nada', () => {
    expect(tonalidadParaInstrumento('DO', 'c_flute')).toBe('DO');
    expect(tonalidadParaInstrumento('SOL', 'c_guitar')).toBe('SOL');
  });

  it('sin tonalidad o con un instrumento desconocido, la deja', () => {
    expect(tonalidadParaInstrumento(null, 'bb_trumpet')).toBeNull();
    expect(tonalidadParaInstrumento('DO', 'arpa_celta')).toBe('DO');
  });
});

describe('esTranspositor', () => {
  it('trompeta y saxo sí; flauta y guitarra no', () => {
    expect(esTranspositor('bb_trumpet')).toBe(true);
    expect(esTranspositor('eb_alto_sax')).toBe(true);
    expect(esTranspositor('c_flute')).toBe(false);
    expect(esTranspositor('c_guitar')).toBe(false);
    expect(esTranspositor('arpa_celta')).toBe(false);
  });
});

describe('formatearDuracion', () => {
  it('minutos y segundos con dos cifras', () => {
    expect(formatearDuracion(293)).toBe('4:53');
    expect(formatearDuracion(65)).toBe('1:05');
    expect(formatearDuracion(null)).toBe('');
    expect(formatearDuracion(0)).toBe('');
  });
});

describe('tempoDesdeToques', () => {
  it('la media de los intervalos', () => {
    expect(tempoDesdeToques([0, 500, 1000, 1500])).toBe(120);
    expect(tempoDesdeToques([0, 1000, 2000])).toBe(60);
  });

  it('con menos de tres toques no hay tempo', () => {
    expect(tempoDesdeToques([0, 500])).toBeNull();
    expect(tempoDesdeToques([])).toBeNull();
  });

  it('fuera de 30-300 se descarta', () => {
    expect(tempoDesdeToques([0, 3000, 6000])).toBeNull();
    expect(tempoDesdeToques([0, 100, 200])).toBeNull();
  });
});

describe('enlacesVerEn', () => {
  it('abre la búsqueda de cada web con título y artista', () => {
    const enlaces = enlacesVerEn('Agnus Dei', 'Marco Barrientos');
    const porNombre = Object.fromEntries(enlaces.map((e) => [e.nombre, e.url]));
    expect(Object.keys(porNombre)).toEqual(['YouTube', 'Cifra Club', 'LaCuerda', 'Tunebat', 'songbpm', 'MultiTracks', 'Chordify']);
    expect(porNombre['Cifra Club']).toBe('https://www.cifraclub.com/?q=Agnus%20Dei%20Marco%20Barrientos');
    expect(porNombre.LaCuerda).toBe('https://acordes.lacuerda.net/busca.php?exp=Agnus%20Dei%20Marco%20Barrientos');
    expect(porNombre.YouTube).toBe('https://www.youtube.com/results?search_query=Agnus%20Dei%20Marco%20Barrientos');
    // songbpm solo busca por POST
    expect(porNombre.songbpm).toBe('https://songbpm.com/');
  });

  it('sin artista busca solo el título; sin nada, no hay enlaces', () => {
    expect(enlacesVerEn('Fuego')[0].url).toBe('https://www.youtube.com/results?search_query=Fuego');
    expect(enlacesVerEn('', '')).toEqual([]);
  });

  it('escapa lo que rompería la URL', () => {
    expect(enlacesVerEn('Tú & yo?')[1].url).toBe('https://www.cifraclub.com/?q=T%C3%BA%20%26%20yo%3F');
  });
});

describe('filtrarPorTitulo', () => {
  const C = [
    { titulo: 'Cantaré Al Señor Por Siempre' },
    { titulo: 'Yo te Adoro Señor/Yo te Amo/Cantaré Al Señor por Siempre' },
    { titulo: 'El Dios de Israel es Poderoso' }
  ];

  it('se queda con los que contienen el título, sin mirar tildes ni mayúsculas', () => {
    expect(filtrarPorTitulo(C, 'cantare al senor por siempre').map((c) => c.titulo)).toEqual([
      'Cantaré Al Señor Por Siempre',
      'Yo te Adoro Señor/Yo te Amo/Cantaré Al Señor por Siempre'
    ]);
  });

  it('también si el buscado es más largo que el resultado', () => {
    expect(filtrarPorTitulo([{ titulo: 'Oceans' }, { titulo: 'Otra' }], 'Oceans (Where Feet May Fail)')).toEqual([{ titulo: 'Oceans' }]);
  });

  it('si no queda ninguno, los devuelve todos', () => {
    expect(filtrarPorTitulo(C, 'Tu eres mi todo')).toEqual(C);
    expect(filtrarPorTitulo(C, '')).toEqual(C);
  });
});

import { describe, it, expect } from 'vitest';
import {
  SCORE_VARIANTS,
  DEFAULT_SCORE_VARIANT,
  getSongFormat,
  isPdfSong,
  buildScorePath,
  buildScoreVoicesList,
  resolveScore,
  setScoreInMap,
  removeScoreFromMap,
  listScorePaths
} from '@notesheet/core';
import { TRANSPOSING_INSTRUMENTS } from '@notesheet/core';

// Una canción de ejemplo con la matriz típica: dos instrumentos, una voz con
// las dos variantes y otra solo con la normal.
const PDFS = {
  bb_trumpet: {
    1: {
      partitura: 'partituras/s1/bb_trumpet-1-partitura.pdf',
      conNotas: 'partituras/s1/bb_trumpet-1-conNotas.pdf'
    },
    2: { partitura: 'partituras/s1/bb_trumpet-2-partitura.pdf' }
  },
  bb_trombone: {
    1: { conNotas: 'partituras/s1/bb_trombone-1-conNotas.pdf' }
  }
};

const SONG = {
  id: 's1',
  title: 'Popurrí de alabanza',
  format: 'pdf',
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1',
  pdfs: PDFS
};

describe('getSongFormat / isPdfSong', () => {
  it('trata la ausencia de `format` como canción de acordes', () => {
    // Las 118 importadas no tienen el campo y no se van a migrar
    expect(getSongFormat({ title: 'Vieja' })).toBe('chords');
    expect(isPdfSong({ title: 'Vieja' })).toBe(false);
  });

  it('reconoce una canción en PDF', () => {
    expect(getSongFormat({ format: 'pdf' })).toBe('pdf');
    expect(isPdfSong({ format: 'pdf' })).toBe(true);
  });

  it('cualquier otro valor cuenta como acordes, no como PDF', () => {
    expect(getSongFormat({ format: 'PDF' })).toBe('chords');
    expect(getSongFormat({ format: 'midi' })).toBe('chords');
    expect(isPdfSong(null)).toBe(false);
    expect(isPdfSong(undefined)).toBe(false);
  });
});

describe('buildScorePath', () => {
  it('compone la ruta con los tres ejes y el id de la canción', () => {
    expect(buildScorePath('abc123', 'eb_alto_sax', '2', 'conNotas'))
      .toBe('partituras/abc123/eb_alto_sax-2-conNotas.pdf');
  });

  it('dos subidas a la misma casilla dan la misma ruta, así se pisan', () => {
    const a = buildScorePath('abc', 'bb_trumpet', '1', 'partitura');
    const b = buildScorePath('abc', 'bb_trumpet', '1', 'partitura');
    expect(a).toBe(b);
  });

  it('el songId va en la ruta: la regla de Storage lo saca de ahí', () => {
    expect(buildScorePath('abc', 'bb_trumpet', '1', 'partitura'))
      .toMatch(/^partituras\/abc\//);
  });
});

describe('buildScoreVoicesList', () => {
  it('lista las voces con PDF, ordenadas y con sus variantes', () => {
    const lista = buildScoreVoicesList(PDFS, TRANSPOSING_INSTRUMENTS);

    expect(lista.map((v) => v.id)).toEqual([
      'bb_trombone-1',
      'bb_trumpet-1',
      'bb_trumpet-2'
    ]);
    expect(lista[1].variants).toEqual(['partitura', 'conNotas']);
    expect(lista[2].variants).toEqual(['partitura']);
    expect(lista[0].variants).toEqual(['conNotas']);
  });

  it('usa el nombre del instrumento del catálogo para la etiqueta', () => {
    const lista = buildScoreVoicesList(PDFS, TRANSPOSING_INSTRUMENTS);
    expect(lista.find((v) => v.id === 'bb_trumpet-2').label)
      .toBe('Trompeta en Sib 2');
  });

  it('sin catálogo cae al id del instrumento, no a undefined', () => {
    const lista = buildScoreVoicesList({ raro: { 1: { partitura: 'x.pdf' } } });
    expect(lista[0].label).toBe('raro 1');
  });

  it('omite las casillas sin ninguna variante', () => {
    const lista = buildScoreVoicesList({
      bb_trumpet: { 1: {}, 2: { partitura: 'x.pdf' } }
    });
    expect(lista.map((v) => v.id)).toEqual(['bb_trumpet-2']);
  });

  it('ordena las voces por número, no como texto', () => {
    // Un `.sort()` pelado pondría la 10 antes que la 2
    const lista = buildScoreVoicesList({
      bb_trumpet: {
        10: { partitura: 'diez.pdf' },
        2: { partitura: 'dos.pdf' },
        1: { partitura: 'uno.pdf' }
      }
    });
    expect(lista.map((v) => v.voiceNumber)).toEqual(['1', '2', '10']);
  });

  it('una voz no numérica va detrás de las numeradas, no en medio', () => {
    const lista = buildScoreVoicesList({
      bb_trumpet: {
        bis: { partitura: 'bis.pdf' },
        2: { partitura: 'dos.pdf' }
      }
    });
    expect(lista.map((v) => v.voiceNumber)).toEqual(['2', 'bis']);
  });

  it('devuelve lista vacía si no hay mapa', () => {
    expect(buildScoreVoicesList(null)).toEqual([]);
    expect(buildScoreVoicesList(undefined)).toEqual([]);
    expect(buildScoreVoicesList({})).toEqual([]);
  });

  it('ignora las variantes desconocidas que hubiera en el documento', () => {
    const lista = buildScoreVoicesList({
      bb_trumpet: { 1: { inventada: 'x.pdf' } }
    });
    expect(lista).toEqual([]);
  });
});

describe('resolveScore', () => {
  it('respeta la voz ya seleccionada', () => {
    const r = resolveScore(SONG, { voiceKey: 'bb_trumpet-2' });
    expect(r.voiceKey).toBe('bb_trumpet-2');
    expect(r.path).toBe('partituras/s1/bb_trumpet-2-partitura.pdf');
  });

  it('el instrumento del músico elige el archivo: el trombonista ve trombón', () => {
    const r = resolveScore(SONG, { instrument: 'bb_trombone' });
    expect(r.voiceKey).toBe('bb_trombone-1');
    expect(r.path).toBe('partituras/s1/bb_trombone-1-conNotas.pdf');
  });

  it('con el instrumento del músico prefiere la voz principal de la canción', () => {
    const conDos = {
      ...SONG,
      primaryVoiceNumber: '2',
      pdfs: {
        bb_trumpet: {
          1: { partitura: 'a.pdf' },
          2: { partitura: 'b.pdf' }
        }
      }
    };
    const r = resolveScore(conDos, { instrument: 'bb_trumpet' });
    expect(r.voiceKey).toBe('bb_trumpet-2');
  });

  it('si el instrumento del músico no tiene PDF, cae a la voz principal', () => {
    const r = resolveScore(SONG, { instrument: 'c_flute' });
    expect(r.voiceKey).toBe('bb_trumpet-1');
  });

  it('sin instrumento ni voz previa usa la voz principal de la canción', () => {
    const r = resolveScore(SONG);
    expect(r.voiceKey).toBe('bb_trumpet-1');
  });

  it('sin voz principal usable cae a la primera que haya', () => {
    const huerfana = { ...SONG, primaryInstrument: 'f_horn', primaryVoiceNumber: '9' };
    const r = resolveScore(huerfana);
    expect(r.voiceKey).toBe('bb_trombone-1');
  });

  it('una voz seleccionada que ya no existe no deja la pantalla en blanco', () => {
    const r = resolveScore(SONG, { voiceKey: 'c_flute-7' });
    expect(r.voiceKey).toBe('bb_trumpet-1');
    expect(r.path).toBeTruthy();
  });

  it('sirve la variante pedida cuando existe, sin avisar de nada', () => {
    const r = resolveScore(SONG, { voiceKey: 'bb_trumpet-1', variant: 'conNotas' });
    expect(r.variant).toBe('conNotas');
    expect(r.path).toBe('partituras/s1/bb_trumpet-1-conNotas.pdf');
    expect(r.variantFallback).toBe(false);
  });

  it('si falta la variante pedida cae a la que hay Y lo marca', () => {
    // Quien no lee partitura pide `conNotas` siempre; en trompeta 2 solo está
    // la normal. Que salga esa es correcto, pero callárselo no.
    const r = resolveScore(SONG, { voiceKey: 'bb_trumpet-2', variant: 'conNotas' });
    expect(r.variant).toBe('partitura');
    expect(r.path).toBe('partituras/s1/bb_trumpet-2-partitura.pdf');
    expect(r.variantFallback).toBe(true);
    expect(r.requestedVariant).toBe('conNotas');
  });

  it('el fallback funciona también al revés', () => {
    const r = resolveScore(SONG, { voiceKey: 'bb_trombone-1', variant: 'partitura' });
    expect(r.variant).toBe('conNotas');
    expect(r.variantFallback).toBe(true);
  });

  it('una variante inventada se trata como la de por defecto', () => {
    const r = resolveScore(SONG, { voiceKey: 'bb_trumpet-1', variant: 'inventada' });
    expect(r.requestedVariant).toBe(DEFAULT_SCORE_VARIANT);
    expect(r.variant).toBe(DEFAULT_SCORE_VARIANT);
    expect(r.variantFallback).toBe(false);
  });

  it('una canción sin PDF devuelve todo a nulo, no revienta', () => {
    expect(resolveScore({ id: 'x' }).path).toBeNull();
    expect(resolveScore({ id: 'x', pdfs: {} }).voiceKey).toBeNull();
    expect(resolveScore(null).path).toBeNull();
  });
});

describe('setScoreInMap', () => {
  it('añade una variante sin tocar el resto del mapa', () => {
    const nuevo = setScoreInMap(PDFS, 'bb_trumpet', '2', 'conNotas', 'nuevo.pdf');

    expect(nuevo.bb_trumpet['2']).toEqual({
      partitura: 'partituras/s1/bb_trumpet-2-partitura.pdf',
      conNotas: 'nuevo.pdf'
    });
    expect(nuevo.bb_trombone).toEqual(PDFS.bb_trombone);
  });

  it('no muta el mapa original', () => {
    const antes = JSON.stringify(PDFS);
    setScoreInMap(PDFS, 'c_flute', '1', 'partitura', 'x.pdf');
    expect(JSON.stringify(PDFS)).toBe(antes);
  });

  it('crea el instrumento y la voz si no existían', () => {
    const nuevo = setScoreInMap(undefined, 'c_flute', 3, 'partitura', 'x.pdf');
    expect(nuevo).toEqual({ c_flute: { 3: { partitura: 'x.pdf' } } });
  });

  it('sustituye la ruta si la casilla ya estaba ocupada', () => {
    const nuevo = setScoreInMap(PDFS, 'bb_trumpet', '1', 'partitura', 'otra.pdf');
    expect(nuevo.bb_trumpet['1'].partitura).toBe('otra.pdf');
    expect(nuevo.bb_trumpet['1'].conNotas).toBe(PDFS.bb_trumpet[1].conNotas);
  });
});

describe('removeScoreFromMap', () => {
  it('quita solo la variante indicada', () => {
    const nuevo = removeScoreFromMap(PDFS, 'bb_trumpet', '1', 'conNotas');
    expect(nuevo.bb_trumpet['1']).toEqual({
      partitura: 'partituras/s1/bb_trumpet-1-partitura.pdf'
    });
  });

  it('la casilla desaparece cuando se queda sin variantes', () => {
    const nuevo = removeScoreFromMap(PDFS, 'bb_trumpet', '2', 'partitura');
    expect(nuevo.bb_trumpet['2']).toBeUndefined();
    expect(nuevo.bb_trumpet['1']).toBeDefined();
  });

  it('el instrumento desaparece cuando se queda sin voces', () => {
    const nuevo = removeScoreFromMap(PDFS, 'bb_trombone', '1', 'conNotas');
    expect(nuevo.bb_trombone).toBeUndefined();
    expect(Object.keys(nuevo)).toEqual(['bb_trumpet']);
  });

  it('no muta el mapa original', () => {
    const antes = JSON.stringify(PDFS);
    removeScoreFromMap(PDFS, 'bb_trombone', '1', 'conNotas');
    expect(JSON.stringify(PDFS)).toBe(antes);
  });

  it('quitar algo que no está deja el mapa como estaba', () => {
    expect(removeScoreFromMap(PDFS, 'c_flute', '1', 'partitura')).toEqual(PDFS);
    expect(removeScoreFromMap(undefined, 'c_flute', '1', 'partitura')).toEqual({});
  });
});

describe('listScorePaths', () => {
  it('devuelve todas las rutas, para poder borrarlas de Storage', () => {
    const rutas = listScorePaths(PDFS);
    expect(rutas).toHaveLength(4);
    expect(rutas).toContain('partituras/s1/bb_trumpet-1-partitura.pdf');
    expect(rutas).toContain('partituras/s1/bb_trumpet-1-conNotas.pdf');
    expect(rutas).toContain('partituras/s1/bb_trumpet-2-partitura.pdf');
    expect(rutas).toContain('partituras/s1/bb_trombone-1-conNotas.pdf');
  });

  it('sin mapa devuelve lista vacía', () => {
    expect(listScorePaths(null)).toEqual([]);
    expect(listScorePaths({})).toEqual([]);
  });
});

describe('SCORE_VARIANTS', () => {
  it('la variante por defecto es una de las válidas', () => {
    expect(SCORE_VARIANTS).toContain(DEFAULT_SCORE_VARIANT);
  });

  it('la normal va primero: es la que espera quien sí lee partitura', () => {
    expect(SCORE_VARIANTS[0]).toBe('partitura');
  });
});

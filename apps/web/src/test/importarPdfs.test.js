import { describe, it, expect } from 'vitest';
import {
  interpretarNombrePdf,
  interpretarParte,
  repartirPdfs,
  agruparPorCancion,
  buscarCancionParaPdfs
} from '@notesheet/core';

// Los nombres tal cual los guarda la banda, una carpeta por canción
const CARPETA = [
  'Coalo Zamorano--Alégrense--Bb_Trombone.pdf',
  'Coalo Zamorano--Alégrense--Bb_Trombone--NN.pdf',
  'Coalo Zamorano--Alégrense--Bb_Trumpet_1.pdf',
  'Coalo Zamorano--Alégrense--Bb_Trumpet_1--NN.pdf',
  'Coalo Zamorano--Alégrense--Bb_Trumpet_2.pdf',
  'Coalo Zamorano--Alégrense--Bb_Trumpet_2--NN.pdf',
  'Coalo Zamorano--Alégrense--Flute.pdf',
  'Coalo Zamorano--Alégrense--Flute--NN.pdf',
  'Coalo Zamorano--Alégrense--Sax_Alto.pdf',
  'Coalo Zamorano--Alégrense--Sax_Alto--NN.pdf',
  'Coalo Zamorano--Alégrense--Score.pdf'
].map((name) => ({ name }));

describe('interpretarNombrePdf', () => {
  it('autor, título, instrumento, voz y versión', () => {
    expect(interpretarNombrePdf('Coalo Zamorano--Alégrense--Bb_Trumpet_2--NN.pdf')).toMatchObject({
      autor: 'Coalo Zamorano',
      titulo: 'Alégrense',
      instrumentId: 'bb_trumpet',
      voiceNumber: '2',
      variant: 'conNotas',
      esScore: false
    });
  });

  it('sin número es la voz 1, y sin NN la partitura normal', () => {
    expect(interpretarNombrePdf('Coalo Zamorano--Alégrense--Sax_Alto.pdf')).toMatchObject({
      instrumentId: 'eb_alto_sax', voiceNumber: '1', variant: 'partitura'
    });
  });

  it('reconoce la partitura completa', () => {
    expect(interpretarNombrePdf('Coalo Zamorano--Alégrense--Score.pdf').esScore).toBe(true);
  });

  it('sin autor, el título; y la extensión en mayúsculas', () => {
    expect(interpretarNombrePdf('Alégrense--Flute.PDF')).toMatchObject({ autor: '', titulo: 'Alégrense', instrumentId: 'c_flute' });
  });
});

describe('interpretarParte', () => {
  it.each([
    ['Bb_Trumpet_1', 'bb_trumpet', '1'],
    ['Trompeta 3', 'bb_trumpet', '3'],
    ['Bb_Trombone_2', 'bb_trombone', '2'],
    ['Sax_Tenor', 'bb_tenor_sax', '1'],
    ['Tenor_Sax_2', 'bb_tenor_sax', '2'],
    ['Alto_Sax', 'eb_alto_sax', '1'],
    ['Eb_Baritone_Sax', 'eb_baritone_sax', '1'],
    ['Clarinet_1', 'bb_clarinet', '1'],
    ['F_Horn', 'f_horn', '1'],
    ['Flauta', 'c_flute', '1'],
    ['Guitarra', 'c_guitar', '1'],
    ['Piano', 'c_piano', '1']
  ])('%s → %s %s', (parte, instrumentId, voiceNumber) => {
    expect(interpretarParte(parte)).toMatchObject({ instrumentId, voiceNumber });
  });

  it('"Tenor" sin "Sax" no es un saxo: no se adivina', () => {
    expect(interpretarParte('Tenor').instrumentId).toBeNull();
  });

  it('lo que no se reconoce, sin instrumento', () => {
    expect(interpretarParte('Kazoo').instrumentId).toBeNull();
  });
});

describe('repartirPdfs', () => {
  it('la carpeta de Alégrense: diez en su casilla, la Score aparte', () => {
    const { asignados, apartados } = repartirPdfs(CARPETA);

    expect(asignados).toHaveLength(10);
    expect(apartados.map((a) => a.motivo)).toEqual(['Partitura completa: no se sube']);
    expect(asignados.map((a) => `${a.instrumentId}-${a.voiceNumber}-${a.variant}`)).toEqual([
      'bb_trombone-1-partitura', 'bb_trombone-1-conNotas',
      'bb_trumpet-1-partitura', 'bb_trumpet-1-conNotas',
      'bb_trumpet-2-partitura', 'bb_trumpet-2-conNotas',
      'c_flute-1-partitura', 'c_flute-1-conNotas',
      'eb_alto_sax-1-partitura', 'eb_alto_sax-1-conNotas'
    ]);
  });

  it('aparta lo que no entiende, lo repetido y lo que no es PDF', () => {
    const { asignados, apartados } = repartirPdfs([
      { name: 'X--Kazoo.pdf' },
      { name: 'X--Flute.pdf' },
      { name: 'X--Flauta.pdf' },
      { name: 'notas.txt' }
    ]);
    expect(asignados).toHaveLength(1);
    expect(apartados.map((a) => a.motivo)).toEqual([
      'No se reconoce el instrumento',
      'Repetido: ya hay otro para esa voz',
      'No es un PDF'
    ]);
  });
});

describe('agruparPorCancion', () => {
  it('una canción por autor y título, sin fijarse en tildes', () => {
    const grupos = agruparPorCancion([
      ...CARPETA,
      { name: 'Coalo Zamorano--Alegrense--Bb_Trumpet_3.pdf' },
      { name: 'Marcos Witt--Al que es digno--Flute.pdf' },
      { name: 'desktop.ini' }
    ]);
    expect(grupos.map((g) => [g.titulo, g.archivos.length])).toEqual([
      ['Al que es digno', 1],
      ['Alégrense', 12]
    ]);
    expect(grupos[1].autor).toBe('Coalo Zamorano');
  });
});

describe('buscarCancionParaPdfs', () => {
  const REPERTORIO = [
    { id: 'a', title: 'Alegrense', version: 'Otro Autor' },
    { id: 'b', title: 'Alégrense', versiones: ['Coalo Zamorano'] },
    { id: 'c', title: 'Cristo Vive' }
  ];

  it('la del mismo título; si hay varias, la de su autor', () => {
    expect(buscarCancionParaPdfs(REPERTORIO, { titulo: 'Alégrense', autor: 'Coalo Zamorano' }).id).toBe('b');
    expect(buscarCancionParaPdfs(REPERTORIO, { titulo: 'CRISTO VIVE' }).id).toBe('c');
  });

  it('el autor corto del nombre ("Coalo") también vale', () => {
    expect(buscarCancionParaPdfs(REPERTORIO, { titulo: 'Alégrense', autor: 'Coalo' }).id).toBe('b');
  });

  it('si no hay ninguna, nada: se creará', () => {
    expect(buscarCancionParaPdfs(REPERTORIO, { titulo: 'Nueva' })).toBeNull();
  });
});

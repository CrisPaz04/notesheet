import { describe, it, expect } from 'vitest';
import { buscarCanciones, puntuarCancion, normalizarBusqueda } from '@notesheet/core';

const REPERTORIO = [
  { id: 'a', title: 'Cristo vive', version: 'Ebenezer', key: 'FA#m', type: 'Júbilo' },
  { id: 'b', title: 'Vive en mí', version: 'Coalo Zamorano', key: 'RE', type: 'Moderada' },
  { id: 'c', title: 'Al que está sentado', version: 'Marcos Witt', key: 'SIm', type: 'Adoración', lyricsOnly: 'Al que está sentado en el trono' },
  { id: 'd', title: 'Te alabaré', version: 'Vive Worship', key: 'MI', type: 'Adoración', lyricsOnly: 'En mi corazón hay una canción' },
  { id: 'e', title: 'Siempre', version: '', key: 'DO', type: 'Júbilo', lyricsOnly: 'Siempre te adoraré' }
];
const ids = (lista) => lista.map((c) => c.id);

describe('buscarCanciones', () => {
  it('sin texto, todas por título (orden del español)', () => {
    expect(ids(buscarCanciones(REPERTORIO, ''))).toEqual(['c', 'a', 'e', 'd', 'b']);
  });

  it('sin tildes ni mayúsculas', () => {
    expect(ids(buscarCanciones(REPERTORIO, 'ALABARE'))).toEqual(['d']);
    expect(ids(buscarCanciones(REPERTORIO, 'corazon'))).toEqual(['d']);
  });

  // Lo que se añade con Enter es la primera: tiene que ser la más probable
  it('primero el título que empieza así, luego la palabra, luego el artista', () => {
    expect(ids(buscarCanciones(REPERTORIO, 'vive'))).toEqual(['b', 'a', 'd']);
  });

  it('por quien la canta', () => {
    expect(ids(buscarCanciones(REPERTORIO, 'witt'))).toEqual(['c']);
  });

  it('por un verso de la letra, desde 4 letras', () => {
    expect(ids(buscarCanciones(REPERTORIO, 'trono'))).toEqual(['c']);
    expect(ids(buscarCanciones(REPERTORIO, 'adorare'))).toEqual(['e']);
    // Con menos, no se mira la letra (los nombres de nota están dentro de
    // cualquier palabra): "ado" encuentra el tipo Adoración, no "adoraré"
    expect(ids(buscarCanciones(REPERTORIO, 'ado'))).toEqual(['c', 'd']);
  });

  it('en C-D-E encuentra por la tonalidad en C-D-E', () => {
    expect(ids(buscarCanciones(REPERTORIO, 'bm', { notacion: 'english' }))).toEqual(['c']);
    expect(ids(buscarCanciones(REPERTORIO, 'bm'))).toEqual([]);
  });

  it('ignora espacios de más alrededor', () => {
    expect(ids(buscarCanciones(REPERTORIO, '  witt '))).toEqual(['c']);
  });
});

describe('puntuarCancion', () => {
  it('0 si no encaja', () => {
    expect(puntuarCancion(REPERTORIO[0], normalizarBusqueda('zzz'))).toBe(0);
  });

  it('el título exacto gana a que empiece así', () => {
    const exacta = puntuarCancion({ title: 'Vive' }, 'vive');
    const empieza = puntuarCancion({ title: 'Vive en mí' }, 'vive');
    expect(exacta).toBeGreaterThan(empieza);
  });
});

describe('búsqueda por las tonalidades de una canción que modula', () => {
  const SION = { id: 'm', title: 'Mas tú, Jehová', key: 'SIm', tonalidades: ['SIm', 'DO#m'], type: 'Adoración' };

  it('la encuentra por la tonalidad de la modulación, no solo por la del principio', () => {
    expect(puntuarCancion(SION, normalizarBusqueda('DO#m'))).toBe(20);
    expect(puntuarCancion(SION, normalizarBusqueda('SIm'))).toBe(20);
  });

  it('en C-D-E también', () => {
    expect(puntuarCancion(SION, normalizarBusqueda('C#m'), { notacion: 'english' })).toBe(20);
  });
});

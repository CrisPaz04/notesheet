import { describe, it, expect } from 'vitest';
import { acotar, ladoPorPosicion, separar, alturaInicial, HUECO } from '../components/herramientas/colocarPaneles';

const LIM = { minTop: 8, maxBottom: 724 };

describe('colocarPaneles', () => {
  it('ladoPorPosicion: la mitad de la pantalla decide', () => {
    expect(ladoPorPosicion(100, 1200)).toBe('izquierda');
    expect(ladoPorPosicion(900, 1200)).toBe('derecha');
  });

  it('acotar: dentro de la pantalla, y si no cabe manda la cabecera', () => {
    expect(acotar(-50, 200, LIM)).toBe(8);
    expect(acotar(700, 200, LIM)).toBe(524);
    expect(acotar(300, 200, LIM)).toBe(300);
    expect(acotar(300, 900, LIM)).toBe(8);
  });

  it('separar: el que se suelta se queda y el que pisa se aparta hacia abajo', () => {
    const r = separar([
      { id: 'a', top: 100, alto: 200 },
      { id: 'b', top: 150, alto: 100 }
    ], 'a', LIM);
    expect(r.a).toBe(100);
    expect(r.b).toBe(300 + HUECO);
  });

  it('separar: el de encima se aparta hacia arriba', () => {
    const r = separar([
      { id: 'a', top: 300, alto: 200 },
      { id: 'b', top: 250, alto: 100 }
    ], 'a', LIM);
    expect(r.a).toBe(300);
    expect(r.b).toBe(300 - HUECO - 100);
  });

  it('separar: los que no se tocan se quedan donde estaban', () => {
    const r = separar([
      { id: 'a', top: 100, alto: 100 },
      { id: 'b', top: 500, alto: 100 }
    ], 'a', LIM);
    expect(r).toEqual({ a: 100, b: 500 });
  });

  it('separar: si el de debajo no cabe, sube el fijo lo justo', () => {
    // El caso real: el metrónomo crece al cargar y el afinador ya está abajo
    const r = separar([
      { id: 'a', top: 500, alto: 200 },
      { id: 'b', top: 550, alto: 200 }
    ], 'a', LIM);
    expect(r.b).toBe(524);
    expect(r.a).toBe(524 - HUECO - 200);
  });

  it('separar: si no caben ni así, se quedan en el borde aunque se solapen', () => {
    const r = separar([
      { id: 'a', top: 100, alto: 600 },
      { id: 'b', top: 500, alto: 300 }
    ], 'a', LIM);
    expect(r.a).toBe(8);
    expect(r.b).toBe(424);
  });

  it('alturaInicial: el primero abajo del todo; el siguiente, encima', () => {
    expect(alturaInicial([], 200, LIM)).toBe(524);
    expect(alturaInicial([{ top: 524, alto: 200 }], 150, LIM)).toBe(524 - HUECO - 150);
  });

  it('alturaInicial: si encima no cabe, abajo', () => {
    expect(alturaInicial([{ top: 50, alto: 600 }], 150, LIM)).toBe(574);
  });

  // Las fronteras exactas: los encontró una campaña de mutantes, que cambiaba
  // un >= por > (o un < por <=) sin que ningún test lo notara

  it('alturaInicial: si cabe justo hasta arriba, encima', () => {
    expect(alturaInicial([{ top: 8 + HUECO + 150, alto: 100 }], 150, LIM)).toBe(8);
  });

  it('ladoPorPosicion: justo en la mitad, a la derecha', () => {
    expect(ladoPorPosicion(600, 1200)).toBe('derecha');
  });

  it('separar: soltado arriba con otro encima, y caben justos', () => {
    // 100 + 12 + 604 = 716, el alto exacto entre los límites
    const r = separar([
      { id: 'a', top: 8, alto: 604 },
      { id: 'b', top: 0, alto: 100 }
    ], 'a', LIM);
    expect(r.b).toBe(8);
    expect(r.a).toBe(8 + 100 + HUECO);
  });
});

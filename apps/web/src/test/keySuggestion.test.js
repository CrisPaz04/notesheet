import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { cwd } from 'node:process';
import {
  sugerirTonalidad,
  puntuarTonalidades,
  extraerNotas,
  identificarTonalidad,
  MARGEN_PARA_AVISAR
} from '@notesheet/core';

// Una frase en RE mayor que termina en RE, repetida para pasar del mínimo
const EN_RE = `RE MI FA# SOL LA SI DO# RE
LA FA# RE MI FA# RE

RE FA# LA RE LA FA# MI RE`;

// Una frase en SIm (misma armadura que RE) que descansa en SI
const EN_SIM = `SI DO# RE MI FA# SOL LA# SI
FA# RE SI DO# RE SI

SI RE FA# SI FA# RE DO# SI`;

describe('extraerNotas', () => {
  it('saca las notas de las líneas de notas, en semitonos', () => {
    expect(extraerNotas('Re# Mi Fa#').map((n) => n.semitono)).toEqual([3, 4, 6]);
  });

  it('entiende la notación anglosajona y los bemoles', () => {
    expect(extraerNotas('Bb C D').map((n) => n.semitono)).toEqual([10, 0, 2]);
    expect(extraerNotas('SIb DO').map((n) => n.semitono)).toEqual([10, 0]);
  });

  it('ignora la letra aunque lleve nombres de nota', () => {
    expect(extraerNotas('Si la voz de mi amado')).toEqual([]);
  });

  it('no se atraganta con los adornos de las partes: _ // (2)', () => {
    expect(extraerNotas('//Re Mi_ Fa#(2)//').map((n) => n.semitono)).toEqual([2, 4, 6]);
  });
});

describe('sugerirTonalidad', () => {
  it('no dice nada si la tonalidad elegida encaja', () => {
    expect(sugerirTonalidad(EN_RE, 'RE')).toBeNull();
    expect(sugerirTonalidad(EN_SIM, 'SIm')).toBeNull();
  });

  it('avisa si la canción se quedó en DO y las notas dicen RE', () => {
    const sugerencia = sugerirTonalidad(EN_RE, 'DO');
    expect(sugerencia[0]).toBe('RE');
  });

  it('distingue la mayor de su relativa por dónde descansan las frases', () => {
    expect(sugerirTonalidad(EN_SIM, 'DO')[0]).toBe('SIm');
  });

  it('da como mucho dos opciones y nunca la que ya está elegida', () => {
    const sugerencia = sugerirTonalidad(EN_RE, 'FA');
    expect(sugerencia.length).toBeGreaterThanOrEqual(1);
    expect(sugerencia.length).toBeLessThanOrEqual(2);
    expect(sugerencia).not.toContain('FA');
  });

  it('si la elegida es la segunda más probable, no la ofrece como opción', () => {
    // LAm encaja claramente mejor que MIm, que queda segunda y a más del
    // margen: hay que avisar, pero "Usar MIm" con MIm ya elegida sobra.
    const enLam = 'DO LA DO LA LA SI DO DO LA MI MI DO LA SI DO LA SI MI SI MI MI';
    expect(sugerirTonalidad(enLam, 'MIm')).toEqual(['LAm']);
  });

  it('con pocas notas no opina', () => {
    expect(sugerirTonalidad('RE FA# LA RE', 'DO')).toBeNull();
    expect(sugerirTonalidad('', 'DO')).toBeNull();
    expect(sugerirTonalidad(undefined, 'DO')).toBeNull();
  });

  it('suma las notas de varias voces', () => {
    // Ninguna de las dos llega sola al mínimo de notas; juntas, sí
    const voz1 = 'RE MI FA# SOL LA SI DO# RE\nLA FA# RE MI FA# RE';
    const voz2 = 'RE FA# LA RE LA FA# MI RE';
    expect(sugerirTonalidad(voz1, 'DO')).toBeNull();
    expect(sugerirTonalidad(voz2, 'DO')).toBeNull();
    expect(sugerirTonalidad([voz1, voz2], 'DO')[0]).toBe('RE');
  });

  it('una tonalidad vacía o inválida siempre recibe sugerencia', () => {
    expect(sugerirTonalidad(EN_RE, '')[0]).toBe('RE');
    expect(sugerirTonalidad(EN_RE, 'Adoración')[0]).toBe('RE');
  });

  it('escribe la tonalidad con bemoles si la canción los usa', () => {
    const conBemoles = 'SOLb LAb SIb DOb REb MIb FA SOLb\nREb SIb SOLb LAb SIb SOLb\n\nSOLb SIb REb SOLb REb SIb LAb SOLb';
    const conSostenidos = 'FA# SOL# LA# SI DO# RE# MI# FA#\nDO# LA# FA# SOL# LA# FA#\n\nFA# LA# DO# FA# DO# LA# SOL# FA#';
    expect(sugerirTonalidad(conBemoles, 'DO')[0]).toBe('SOLb');
    expect(sugerirTonalidad(conSostenidos, 'DO')[0]).toBe('FA#');
  });
});

// El repertorio de la banda es la prueba de verdad: sus 118 canciones traen
// la tonalidad bien puesta. Los números se midieron al elegir el método y el
// margen (ver el comentario de `MARGEN_PARA_AVISAR`); si alguien toca el
// perfil, el margen o cómo se sacan las notas y empeora, salta aquí.
describe('contra el repertorio', () => {
  const buscarArriba = (relativa) => {
    let dir = resolve(cwd());
    for (let i = 0; i < 6; i += 1) {
      const candidata = join(dir, relativa);
      if (existsSync(candidata)) return candidata;
      const padre = dirname(dir);
      if (padre === dir) break;
      dir = padre;
    }
    throw new Error(`No se encontró ${relativa} desde ${cwd()}`);
  };
  const CANCIONES = JSON.parse(readFileSync(buscarArriba('scripts/repertorio/repertorio.json'), 'utf8'));

  it('casi nunca avisa en falso sobre una canción que ya está bien', () => {
    const falsas = CANCIONES.filter((s) => sugerirTonalidad(s.content, s.key));
    expect(falsas.length).toBeLessThanOrEqual(4);
  });

  it('si una canción se hubiera quedado en DO, casi siempre avisa', () => {
    const noDo = CANCIONES.filter(
      (s) => puntuarTonalidades(s.content) && !['0', '9m'].includes(identificarTonalidad(s.key))
    );
    const avisadas = noDo.filter((s) => sugerirTonalidad(s.content, 'DO'));
    expect(avisadas.length).toBeGreaterThanOrEqual(81);
  });

  it('y cuando avisa, la buena suele estar entre las dos opciones', () => {
    const avisadas = CANCIONES
      .filter((s) => !['0', '9m'].includes(identificarTonalidad(s.key)))
      .map((s) => ({ s, sugerencia: sugerirTonalidad(s.content, 'DO') }))
      .filter((x) => x.sugerencia);
    const aciertos = avisadas.filter(({ s, sugerencia }) =>
      sugerencia.some((k) => identificarTonalidad(k) === identificarTonalidad(s.key))
    );
    expect(aciertos.length).toBeGreaterThanOrEqual(67);
  });

  it('la más probable es la exacta en al menos 74 canciones', () => {
    // Contar doble la nota en que acaba cada frase sube esto de 72 a 74:
    // es lo que ayuda a separar una mayor de su relativa.
    const exactas = CANCIONES.filter((s) => {
      const sugerencia = sugerirTonalidad(s.content, '');
      return sugerencia && identificarTonalidad(sugerencia[0]) === identificarTonalidad(s.key);
    });
    expect(exactas.length).toBeGreaterThanOrEqual(74);
  });

  it('el margen es el que se midió', () => {
    expect(MARGEN_PARA_AVISAR).toBe(0.3);
  });
});

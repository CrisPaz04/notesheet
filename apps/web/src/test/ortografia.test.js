import { describe, it, expect } from 'vitest';
import {
  ortografiaDe,
  transponerTonalidad,
  nombreDeTonalidad,
  leerTonalidad,
  ORTOGRAFIA_NEUTRA,
  nombrarNota,
  transposeKeyBySemitones,
  getVisualKeyForInstrument,
  renderSongContent,
  renderChordChart,
  TRANSPOSING_INSTRUMENTS
} from '@notesheet/core';

// Las alteradas de una ortografía, para leerla de un vistazo
const alteradas = (key) => [1, 3, 6, 8, 10].map((i) => ortografiaDe(key)[i]);

describe('ortografía: cómo se escribe cada nota en una tonalidad', () => {
  it('mayores con bemoles, con bemoles', () => {
    expect(alteradas('FA')).toEqual(['REb', 'MIb', 'SOLb', 'LAb', 'SIb']);
    expect(alteradas('SIb')).toEqual(['REb', 'MIb', 'SOLb', 'LAb', 'SIb']);
    expect(alteradas('Eb')).toEqual(['REb', 'MIb', 'SOLb', 'LAb', 'SIb']);
  });

  it('mayores con sostenidos, con sostenidos', () => {
    expect(alteradas('SOL')).toEqual(['DO#', 'RE#', 'FA#', 'SOL#', 'LA#']);
    expect(alteradas('MI')).toEqual(['DO#', 'RE#', 'FA#', 'SOL#', 'LA#']);
    expect(alteradas('B')).toEqual(['DO#', 'RE#', 'FA#', 'SOL#', 'LA#']);
  });

  // Sin armadura: como las nombra un trompetista
  it('DO, la de los vientos: DO#, MIb, FA#, LAb, SIb', () => {
    expect(alteradas('DO')).toEqual(['DO#', 'MIb', 'FA#', 'LAb', 'SIb']);
    expect(ORTOGRAFIA_NEUTRA).toEqual(ortografiaDe('DO'));
  });

  // La sensible de la menor armónica: la nota que más se ve en una menor
  it('las menores escriben la sensible con sostenido', () => {
    expect(ortografiaDe('REm')[1]).toBe('DO#'); // no REb
    expect(ortografiaDe('SOLm')[6]).toBe('FA#'); // no SOLb
    expect(ortografiaDe('LAm')[8]).toBe('SOL#'); // no LAb
    expect(ortografiaDe('Dm')[1]).toBe('DO#');
    // El resto, como su relativa mayor
    expect(ortografiaDe('REm')[10]).toBe('SIb');
    expect(ortografiaDe('MIm')[6]).toBe('FA#');
  });

  // Ortografía estricta: cada grado de la escala con su letra, como la armadura
  it('las notas de la escala se escriben como las pide la armadura', () => {
    const escala = (key, grados) => grados.map((t) => ortografiaDe(key)[t]);
    // FA# mayor: FA# SOL# LA# SI DO# RE# MI# (no FA)
    expect(escala('FA#', [6, 8, 10, 11, 1, 3, 5])).toEqual(['FA#', 'SOL#', 'LA#', 'SI', 'DO#', 'RE#', 'MI#']);
    // SOLb mayor: SOLb LAb SIb DOb REb MIb FA (no SI)
    expect(escala('SOLb', [6, 8, 10, 11, 1, 3, 5])).toEqual(['SOLb', 'LAb', 'SIb', 'DOb', 'REb', 'MIb', 'FA']);
    // DO# mayor, si la banda la escribe así: MI# y SI#
    expect(escala('DO#', [5, 0])).toEqual(['MI#', 'SI#']);
    // RE#m (relativa de FA#) también lleva MI#
    expect(ortografiaDe('RE#m')[5]).toBe('MI#');
    // MIbm (relativa de SOLb) lleva DOb
    expect(ortografiaDe('MIbm')[11]).toBe('DOb');
  });

  it('nunca dobles alteraciones: la sensible de SOL#m (FA##) se escribe SOL', () => {
    expect(ortografiaDe('SOL#m')[7]).toBe('SOL');
    expect(ortografiaDe('RE#m')[2]).toBe('RE'); // DO## sería la sensible
    for (const key of ['DO', 'FA#', 'SOLb', 'DO#', 'LA#', 'SOL#m', 'RE#m', 'LA#m', 'MIbm']) {
      for (const nombre of ortografiaDe(key)) expect(nombre, key).not.toMatch(/##|bb/);
    }
  });

  it('en anglosajona también: E#, Cb', () => {
    expect(nombrarNota(5, ortografiaDe('FA#'), 'english')).toBe('E#');
    expect(nombrarNota(11, ortografiaDe('SOLb'), 'english')).toBe('Cb');
  });

  it('una tonalidad escrita con la alteración poco habitual se respeta', () => {
    expect(alteradas('LA#')).toEqual(['DO#', 'RE#', 'FA#', 'SOL#', 'LA#']);
    expect(alteradas('SOLb')).toEqual(['REb', 'MIb', 'SOLb', 'LAb', 'SIb']);
    expect(ortografiaDe('LA#m')[10]).toBe('LA#');
  });

  it('lo que no es una tonalidad no tiene ortografía', () => {
    expect(ortografiaDe('')).toBeNull();
    expect(ortografiaDe('Amor')).toBeNull();
    expect(leerTonalidad('H')).toBeNull();
  });
});

describe('ortografía: el nombre de una tonalidad transpuesta', () => {
  // El caso de siempre: la trompeta en DO suena en SIb, no en LA#
  it('DO de trompeta es SIb de concierto', () => {
    expect(transponerTonalidad('DO', -2)).toBe('SIb');
    expect(transposeKeyBySemitones('DO', -2)).toBe('SIb');
    expect(getVisualKeyForInstrument('DO', 'c_guitar')).toBe('SIb');
    expect(getVisualKeyForInstrument('DO', 'eb_alto_sax')).toBe('SOL');
  });

  it('cada tecla, con su nombre habitual (el de menos alteraciones)', () => {
    const mayores = Array.from({ length: 12 }, (_, i) => nombreDeTonalidad(i, false));
    expect(mayores).toEqual(['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'SIb', 'SI']);
    const menores = Array.from({ length: 12 }, (_, i) => nombreDeTonalidad(i, true));
    expect(menores).toEqual(['DOm', 'DO#m', 'REm', 'MIbm', 'MIm', 'FAm', 'FA#m', 'SOLm', 'SOL#m', 'LAm', 'SIbm', 'SIm']);
  });

  it('en los empates decide la de partida', () => {
    expect(transponerTonalidad('LAb', -2)).toBe('SOLb');
    expect(transponerTonalidad('MI', 2)).toBe('FA#');
    // Sin alteración escrita decide la armadura: SIm y MIm van con sostenidos
    expect(transponerTonalidad('SIm', 4)).toBe('RE#m');
    expect(transponerTonalidad('MIm', -1)).toBe('RE#m');
    expect(transponerTonalidad('DOm', 3)).toBe('MIbm');
    expect(transponerTonalidad('FA', 1)).toBe('SOLb');
    expect(transponerTonalidad('SOL', -1)).toBe('FA#');
    // Y DO, que no va hacia ningún lado, al habitual
    expect(transponerTonalidad('DO', 6)).toBe('FA#');
  });

  it('conserva el modo y lee también la anglosajona', () => {
    expect(transponerTonalidad('LAm', -2)).toBe('SOLm');
    expect(transponerTonalidad('Bbm', 2)).toBe('DOm');
    expect(transponerTonalidad('Am', 1)).toBe('SIbm');
  });

  it('sin mover, la tonalidad se queda como la escribió la banda', () => {
    expect(transposeKeyBySemitones('LA#', 0)).toBe('LA#');
    expect(getVisualKeyForInstrument('LA#', 'bb_trumpet')).toBe('LA#');
  });
});

// Lo que se rompió la otra vez que se intentó arreglar solo las tonalidades:
// la etiqueta dejó de coincidir con el primer acorde. Aquí se comprueba en
// todas las tonalidades, todos los instrumentos y con y sin cejilla.
describe('ortografía: la tonalidad anunciada casa con lo que se lee', () => {
  const MAYORES = ['DO', 'REb', 'RE', 'MIb', 'MI', 'FA', 'FA#', 'SOL', 'LAb', 'LA', 'SIb', 'SI'];
  const MENORES = MAYORES.map((_, i) => nombreDeTonalidad(i, true));
  const INSTRUMENTOS = Object.keys(TRANSPOSING_INSTRUMENTS);
  const raiz = (key) => key.replace(/m$/, '');
  const primera = (formatted) => formatted.sections[0].content.trim().split(/\s+/)[0];

  // Empieza por la tónica: DO en DO, LA en LAm
  const MELODIA_MAYOR = '## Intro\nDO RE MI FA SOL LA SI DO\nSIb LAb MIb FA# DO#';
  const MELODIA_MENOR = '## Intro\nLA SI DO RE MI FA SOL# LA';

  it.each(INSTRUMENTOS)('notas en %s', (instrument) => {
    for (const [base, melodia, destinos] of [['DO', MELODIA_MAYOR, MAYORES], ['LAm', MELODIA_MENOR, MENORES]]) {
      for (const targetKey of destinos) {
        for (const capo of [0, 2]) {
          const r = renderSongContent(melodia, { baseKey: base, targetKey, instrument, capo, notationSystem: 'latin' });
          if (r.displayKey === base && raiz(base) === primera(r.formatted)) continue;
          expect(primera(r.formatted), `${base}→${targetKey} ${instrument} capo ${capo}`).toBe(raiz(r.displayKey));
          // Nunca dobles alteraciones
          expect(r.formatted.sections[0].content).not.toMatch(/(##|bb)/);
        }
      }
    }
  });

  it('los acordes de la guitarra, igual', () => {
    for (const targetKey of MAYORES) {
      for (const capo of [0, 1, 3]) {
        // Acordes en concierto: la canción está en DO de trompeta, SIb de concierto
        const acordes = renderChordChart('## Intro\nSIb MIb FA SIb', {
          baseKey: 'DO', targetKey, instrument: 'c_guitar', capo, notationSystem: 'latin'
        });
        const tonoLeido = transposeKeyBySemitones(getVisualKeyForInstrument(targetKey, 'c_guitar'), -capo);
        expect(primera(acordes), `${targetKey} capo ${capo}`).toBe(raiz(tonoLeido));
      }
    }
  });

  // Sin movimiento no se reescribe nada: se lee lo que escribió la banda,
  // aunque sea LA# en DO. Tampoco con una octava justa (mismo nombre de nota).
  it('sin transponer (o a una octava), las notas quedan como se escribieron', () => {
    const octava = Object.keys(TRANSPOSING_INSTRUMENTS).find((id) => TRANSPOSING_INSTRUMENTS[id].transposition === 12);
    for (const instrument of ['bb_trumpet', octava]) {
      const r = renderSongContent('## Intro\nDO LA# SI', { baseKey: 'DO', targetKey: 'DO', instrument, notationSystem: 'latin' });
      expect(r.formatted.sections[0].content.trim(), instrument).toBe('DO LA# SI');
    }
  });

  it('en notación anglosajona también', () => {
    const r = renderSongContent('## Intro\nDO RE MI', { baseKey: 'DO', targetKey: 'DO', instrument: 'c_guitar', notationSystem: 'english' });
    expect(primera(r.formatted)).toBe('Bb');
  });
});

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  leerModulacion,
  partirEnTramos,
  tonalidadesDe,
  contarModulaciones,
  separarTonalidadDelTitulo,
} from '@notesheet/core';

/**
 * Modulaciones: una cabecera `## Título [SIm]` dice que desde ahí el texto
 * está escrito en otra tonalidad. La banda ya escribía las notas de después
 * en la tonalidad nueva; lo que faltaba era decirlo.
 */

describe('leerModulacion', () => {
  it('lee el título y la tonalidad de los corchetes', () => {
    expect(leerModulacion('## Modulación [SIm]')).toEqual({ titulo: 'Modulación', tonalidad: 'SIm' });
    expect(leerModulacion('## Coro [DO#m]')).toEqual({ titulo: 'Coro', tonalidad: 'DO#m' });
  });

  it('una cabecera solo con la tonalidad no tiene título', () => {
    expect(leerModulacion('## [SIm]')).toEqual({ titulo: '', tonalidad: 'SIm' });
  });

  it('escribe la tonalidad en latina y en su forma única', () => {
    expect(leerModulacion('## Ascenso [Bm]')).toEqual({ titulo: 'Ascenso', tonalidad: 'SIm' });
    expect(leerModulacion('## Ascenso [Sim]')).toEqual({ titulo: 'Ascenso', tonalidad: 'SIm' });
    expect(leerModulacion('## Ascenso [ MIb ]')).toEqual({ titulo: 'Ascenso', tonalidad: 'MIb' });
  });

  it('lo que va entre corchetes y no es una tonalidad es parte del título', () => {
    expect(leerModulacion('## Solo [2 veces]')).toBeNull();
    expect(leerModulacion('## Solo (tres veces)')).toBeNull();
    expect(leerModulacion('## Solo')).toBeNull();
  });

  it('solo en una cabecera de verdad', () => {
    expect(leerModulacion('##[SIm]')).toBeNull();
    expect(leerModulacion('### Coro [SIm]')).toBeNull();
    expect(leerModulacion('Coro [SIm]')).toBeNull();
    expect(leerModulacion('DO RE MI [SIm]')).toBeNull();
    expect(leerModulacion(undefined)).toBeNull();
  });
});

describe('partirEnTramos', () => {
  const texto = [
    '## Intro',
    'LA SI DO',
    '',
    '## Modulación [SIm]',
    'SI DO# RE',
    '## Solo',
    'FA# MI',
    '## Final [DOm]',
    'DO RE MIb',
  ].join('\n');

  it('cada modulación abre un tramo con su tonalidad y su número', () => {
    const tramos = partirEnTramos(texto, 'LAm');
    expect(tramos.map((t) => [t.numero, t.key])).toEqual([[0, 'LAm'], [1, 'SIm'], [2, 'DOm']]);
  });

  it('una cabecera sin corchetes no cambia de tramo', () => {
    const [, segundo] = partirEnTramos(texto, 'LAm');
    expect(segundo.cuerpo).toBe('SI DO# RE\n## Solo\nFA# MI');
    expect(segundo.cabecera).toEqual({ linea: '## Modulación [SIm]', titulo: 'Modulación', tonalidad: 'SIm' });
  });

  it('el tramo del principio no tiene cabecera', () => {
    const [primero] = partirEnTramos(texto, 'LAm');
    expect(primero.cabecera).toBeNull();
    expect(primero.cuerpo).toBe('## Intro\nLA SI DO\n');
  });

  it('si el texto empieza modulando, no hay tramo vacío del principio', () => {
    const tramos = partirEnTramos('## [SIm]\nSI DO#', 'LAm');
    expect(tramos.map((t) => t.numero)).toEqual([1]);
  });

  it('sin modulaciones es un solo tramo con todo el texto', () => {
    expect(partirEnTramos('DO RE MI\nFA', 'DO')).toEqual([
      { numero: 0, key: 'DO', cabecera: null, cuerpo: 'DO RE MI\nFA' },
    ]);
    expect(partirEnTramos('', 'DO')).toEqual([{ numero: 0, key: 'DO', cabecera: null, cuerpo: '' }]);
  });

  // Ida y vuelta: partir y volver a unir devuelve el texto tal cual
  it('partir y unir devuelve el mismo texto, sea cual sea', () => {
    const linea = fc.oneof(
      fc.constantFrom('## Modulación [SIm]', '## [DO]', '## Coro', '##', '## Solo [2 veces]', 'DO RE MI', '', 'Letra'),
      fc.string({ maxLength: 12 }).filter((s) => !s.includes('\n'))
    );
    fc.assert(fc.property(fc.array(linea, { maxLength: 15 }), (lineas) => {
      const original = lineas.join('\n');
      const tramos = partirEnTramos(original, 'LA');
      const unido = tramos
        .map((t) => [t.cabecera?.linea, t.cuerpo].filter((x) => x != null).join('\n'))
        .join('\n');
      expect(unido).toBe(original);
    }));
  });
});

describe('tonalidadesDe y contarModulaciones', () => {
  it('todas las tonalidades de la canción, en orden y sin repetir', () => {
    const texto = 'DO\n## Modulación [RE]\nRE\n## Otra [Re]\nRE\n## Final [MI]\nMI';
    expect(tonalidadesDe(texto, 'DO')).toEqual(['DO', 'RE', 'MI']);
    expect(contarModulaciones(texto)).toBe(3);
  });

  it('SIb y LA# son la misma tonalidad', () => {
    expect(tonalidadesDe('X\n## [LA#]\nY', 'SIb')).toEqual(['SIb']);
  });

  it('sin modulaciones, la de la canción; sin tonalidad, ninguna', () => {
    expect(tonalidadesDe('DO RE', 'LAm')).toEqual(['LAm']);
    expect(tonalidadesDe('DO RE', '')).toEqual([]);
    expect(contarModulaciones('DO RE')).toBe(0);
    expect(contarModulaciones(undefined)).toBe(0);
  });
});

describe('separarTonalidadDelTitulo', () => {
  it('quita los corchetes del título y deja la tonalidad aparte', () => {
    const secciones = [
      { title: 'Intro', content: 'DO' },
      { title: 'Modulación [SIm]', content: 'SI' },
      { title: '[DO#m]', content: 'DO#' },
      { title: 'Solo [2 veces]', content: 'MI' },
    ];
    expect(separarTonalidadDelTitulo(secciones)).toEqual([
      { title: 'Intro', content: 'DO' },
      { title: 'Modulación', content: 'SI', tonalidad: 'SIm' },
      { title: '', content: 'DO#', tonalidad: 'DO#m' },
      { title: 'Solo [2 veces]', content: 'MI' },
    ]);
  });
});

// ── Transponer y pintar por tramos ────────────────────────────────────────
import { renderSongContent, renderChordChart } from '@notesheet/core';

const secciones = (r) => r.formatted.sections.map(({ title, content, tonalidad }) =>
  (tonalidad ? { title, content, tonalidad } : { title, content }));

// Como «Regocíjate Sión»: en LAm, y el ascenso ya escrito en SIm
const SION = 'LA SI DO\n## Ascenso [SIm]\nSI DO# RE';

describe('renderSongContent con modulaciones', () => {
  it('sin mover nada, la modulación enseña su tonalidad aparte del título', () => {
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'LAm' });
    expect(secciones(r)).toEqual([
      { title: '', content: 'LA SI DO' },
      { title: 'Ascenso', content: 'SI DO# RE', tonalidad: 'SIm' },
    ]);
    expect(r.displayKey).toBe('LAm');
    expect(r.tonalidadesLeidas).toEqual(['LAm', 'SIm']);
  });

  it('al bajar la canción, la modulación baja lo mismo', () => {
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'SOLm' });
    expect(secciones(r)[1]).toEqual({ title: 'Ascenso', content: 'LA SI DO', tonalidad: 'LAm' });
    expect(r.tonalidadesLeidas).toEqual(['SOLm', 'LAm']);
  });

  it('cada instrumento la lee en la suya', () => {
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'LAm', instrument: 'eb_alto_sax' });
    expect(secciones(r)).toEqual([
      { title: '', content: 'MI FA# SOL' },
      { title: 'Ascenso', content: 'FA# SOL# LA', tonalidad: 'FA#m' },
    ]);
    expect(r.tonalidadesLeidas).toEqual(['MIm', 'FA#m']);
  });

  it('cada tramo se escribe con la armadura de su tonalidad', () => {
    // En RE, y modula a MIb. Subida un tono: MI (sostenidos) y FA (un bemol).
    // Con la armadura de MI para todo, el SIb de FA salía como LA#.
    const texto = 'RE MI FA#\n## Modulación [MIb]\nMIb FA SOL LAb SIb DO RE';
    const r = renderSongContent(texto, { baseKey: 'RE', targetKey: 'MI' });
    expect(secciones(r)).toEqual([
      { title: '', content: 'MI FA# SOL#' },
      { title: 'Modulación', content: 'FA SOL LA SIb DO RE MI', tonalidad: 'FA' },
    ]);
  });

  it('un ajuste lleva la modulación a otra tonalidad, sin tocar el principio', () => {
    // -2: "esta vez sin modulación", el ascenso se queda en LAm
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'LAm', modulaciones: { 1: -2 } });
    expect(secciones(r)).toEqual([
      { title: '', content: 'LA SI DO' },
      { title: 'Ascenso', content: 'LA SI DO', tonalidad: 'LAm' },
    ]);
    expect(r.tonalidadesLeidas).toEqual(['LAm']);
  });

  it('el ajuste se suma a lo que se mueva la canción', () => {
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'SOLm', modulaciones: { '1': -2 } });
    expect(secciones(r)[1]).toEqual({ title: 'Ascenso', content: 'SOL LA SIb', tonalidad: 'SOLm' });
  });

  it('la cejilla mueve también la modulación', () => {
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'LAm', capo: 2 });
    expect(secciones(r)[1]).toEqual({ title: 'Ascenso', content: 'LA SI DO', tonalidad: 'LAm' });
  });

  it('en la letra queda el nombre de la sección, sin tonalidad', () => {
    const r = renderSongContent('Canto\nLA SI\n## Ascenso [SIm]\nAleluya\nSI DO#', { baseKey: 'LAm', targetKey: 'LAm' });
    expect(r.lyricsOnly.sections[0].content).toBe('Canto\n\nAscenso\nAleluya');
  });

  it('la notación C-D-E llega también a la modulación (la tonalidad se nombra en la vista)', () => {
    const r = renderSongContent(SION, { baseKey: 'LAm', targetKey: 'LAm', notationSystem: 'english' });
    expect(secciones(r)[1]).toEqual({ title: 'Ascenso', content: 'B C# D', tonalidad: 'SIm' });
  });
});

describe('renderChordChart con modulaciones', () => {
  // Los acordes van en concierto; la canción en SIm de trompeta es LAm de concierto
  const ACORDES = 'LAm MI\n## Modulación [SIm]\nSIm FA#';

  it('la guitarra los lee en concierto, con la tonalidad de la modulación', () => {
    const r = renderChordChart(ACORDES, { baseKey: 'SIm', targetKey: 'SIm', instrument: 'c_guitar' });
    expect(r.sections[1]).toEqual({ title: 'Modulación', content: 'SIm FA#', tonalidad: 'SIm' });
  });

  it('la trompeta los lee en la suya', () => {
    const r = renderChordChart(ACORDES, { baseKey: 'SIm', targetKey: 'SIm', instrument: 'bb_trumpet' });
    expect(r.sections[1]).toEqual({ title: 'Modulación', content: 'DO#m SOL#', tonalidad: 'DO#m' });
  });

  it('con ajuste, igual que las notas', () => {
    const r = renderChordChart(ACORDES, { baseKey: 'SIm', targetKey: 'SIm', instrument: 'c_guitar', modulaciones: { 1: -2 } });
    expect(r.sections[1]).toEqual({ title: 'Modulación', content: 'LAm MI', tonalidad: 'LAm' });
  });
});

// Oráculo: la modulación, pintada dentro de la canción, sale igual que ese
// tramo pintado solo, como si fuera una canción en su tonalidad movida lo
// mismo que la canción entera.
import { transposeKeyBySemitones } from '@notesheet/core';

describe('propiedad: cada tramo se mueve como una canción suelta', () => {
  const TONOS = ['DO', 'RE', 'MIb', 'MI', 'FA', 'SOL', 'LAb', 'LA', 'SIb', 'SI', 'LAm', 'MIm', 'REm', 'SIm', 'FA#m', 'DOm'];
  const NOTAS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI', 'DO#', 'MIb', 'FA#', 'LAb', 'SIb'];
  const INSTRUMENTOS = ['bb_trumpet', 'eb_alto_sax', 'c_flute', 'f_horn', 'c_guitar'];

  it('en cualquier tonalidad, salto, instrumento y ajuste', () => {
    fc.assert(fc.property(
      fc.constantFrom(...TONOS),
      fc.integer({ min: 1, max: 11 }),
      fc.integer({ min: -6, max: 6 }),
      fc.integer({ min: -3, max: 3 }),
      fc.constantFrom(...INSTRUMENTOS),
      fc.array(fc.constantFrom(...NOTAS), { minLength: 1, maxLength: 8 }),
      (key, salto, mover, ajuste, instrument, notas) => {
        const keyMod = transposeKeyBySemitones(key, salto);
        const cuerpo = notas.join(' ');
        const texto = `${notas.join(' ')}\n## Modulación [${keyMod}]\n${cuerpo}`;
        const targetKey = transposeKeyBySemitones(key, mover);
        const r = renderSongContent(texto, { baseKey: key, targetKey, instrument, modulaciones: { 1: ajuste } });

        const suelta = renderSongContent(cuerpo, {
          baseKey: keyMod,
          targetKey: transposeKeyBySemitones(keyMod, mover + ajuste),
          instrument,
        });
        const modulacion = r.formatted.sections.find((s) => s.tonalidad);
        expect(modulacion.content).toBe(suelta.formatted.sections[0].content);
        expect(modulacion.tonalidad).toBe(suelta.displayKey);
      }
    ));
  });
});

// ── Ajustes de una lista o una sesión ─────────────────────────────────────
import { ajusteHacia, limpiarModulaciones, modulacionesDeLaEntrada } from '@notesheet/core';

describe('ajusteHacia: semitonos desde donde iría por defecto', () => {
  it('cero si es la misma; el camino corto si no', () => {
    expect(ajusteHacia('SIm', 'SIm')).toBe(0);
    expect(ajusteHacia('SIm', 'LAm')).toBe(-2);
    expect(ajusteHacia('SIm', 'DOm')).toBe(1);
    expect(ajusteHacia('DO', 'SOL')).toBe(-5);
    expect(ajusteHacia('DO', 'FA#')).toBe(-6);
    expect(ajusteHacia('DO', 'FA')).toBe(5);
  });

  it('null si alguna no es una tonalidad', () => {
    expect(ajusteHacia('SIm', 'X')).toBeNull();
    expect(ajusteHacia('', 'DO')).toBeNull();
  });
});

describe('limpiarModulaciones: lo que se guarda en la lista o la sesión', () => {
  it('quita los ceros (son el valor por defecto) y lo que no es un número entero', () => {
    expect(limpiarModulaciones({ 1: -2, 2: 0, 3: 'x', 4: 1.5, 0: 3, '-1': 2 })).toEqual({ 1: -2 });
  });

  it('sin nada que guardar, null', () => {
    expect(limpiarModulaciones({ 1: 0 })).toBeNull();
    expect(limpiarModulaciones(null)).toBeNull();
    expect(limpiarModulaciones('basura')).toBeNull();
  });

  it('acota a una octava', () => {
    expect(limpiarModulaciones({ 1: 30 })).toEqual({ 1: -6 });
    expect(limpiarModulaciones({ 1: -14 })).toEqual({ 1: -2 });
  });
});

describe('modulacionesDeLaEntrada: los selectores de la lista y la sesión', () => {
  const CANCION = {
    key: 'LAm',
    primaryInstrument: 'bb_trumpet',
    primaryVoiceNumber: '1',
    voices: { bb_trumpet: { 1: 'LA\n## Ascenso [SIm]\nSI\n## Final [DOm]\nDO' } },
  };

  it('cada modulación, a dónde iría con la canción y a dónde va con el ajuste', () => {
    expect(modulacionesDeLaEntrada(CANCION, 'SOLm', { 2: 1 })).toEqual([
      { numero: 1, titulo: 'Ascenso', porDefecto: 'LAm', tonalidad: 'LAm', ajuste: 0 },
      { numero: 2, titulo: 'Final', porDefecto: 'SIbm', tonalidad: 'SIm', ajuste: 1 },
    ]);
  });

  it('una canción sin modulaciones, o sin texto, no tiene ninguna', () => {
    expect(modulacionesDeLaEntrada({ key: 'DO', content: 'DO RE' }, 'DO')).toEqual([]);
    expect(modulacionesDeLaEntrada(null, 'DO')).toEqual([]);
    expect(modulacionesDeLaEntrada({ key: 'DO', format: 'pdf', pdfs: {} }, 'DO')).toEqual([]);
  });
});

import { tonalidadesDeCancion } from '@notesheet/core';

describe('tonalidadesDeCancion', () => {
  it('las guardadas si las hay; si no, la de la canción', () => {
    expect(tonalidadesDeCancion({ key: 'SIm', tonalidades: ['SIm', 'DO#m'] })).toEqual(['SIm', 'DO#m']);
    expect(tonalidadesDeCancion({ key: 'SIm' })).toEqual(['SIm']);
    expect(tonalidadesDeCancion({ key: 'SIm', tonalidades: [] })).toEqual(['SIm']);
    expect(tonalidadesDeCancion({})).toEqual([]);
    expect(tonalidadesDeCancion(null)).toEqual([]);
  });
});

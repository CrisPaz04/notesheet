import { describe, it, expect } from 'vitest';
import {
  renderSongContent,
  extractLyricsSections,
  formatLyrics,
  buildVoicesList,
  parseVoiceKey,
  resolveInitialVoice,
  SOURCE_INSTRUMENT,
  TRANSPOSING_INSTRUMENTS
} from '@notesheet/core';

const SONG = `# Canción: Prueba
# Tonalidad: DO

## Intro
DO SOL LAm FA

## Verso
DO        SOL
Cristo vive hoy
LAm       FA
para siempre
`;

describe('parseVoiceKey', () => {
  it('separa instrumento y número de voz', () => {
    expect(parseVoiceKey('bb_trumpet-1')).toEqual({
      instrumentId: 'bb_trumpet',
      voiceNumber: '1'
    });
  });

  it('usa el último guión para ids con guiones', () => {
    expect(parseVoiceKey('eb_alto_sax-2')).toEqual({
      instrumentId: 'eb_alto_sax',
      voiceNumber: '2'
    });
  });

  it('devuelve null para entradas inválidas', () => {
    expect(parseVoiceKey('')).toBeNull();
    expect(parseVoiceKey(null)).toBeNull();
    expect(parseVoiceKey('sinGuion')).toBeNull();
  });
});

describe('buildVoicesList', () => {
  const voices = {
    bb_trumpet: { 1: 'contenido 1', 2: 'contenido 2' },
    f_horn: { 1: 'contenido corno' }
  };

  it('aplana el mapa de voces', () => {
    const list = buildVoicesList(voices, TRANSPOSING_INSTRUMENTS);
    expect(list).toHaveLength(3);
    expect(list.map((v) => v.id)).toEqual([
      'bb_trumpet-1',
      'bb_trumpet-2',
      'f_horn-1'
    ]);
  });

  it('usa el nombre del catálogo en la etiqueta', () => {
    const list = buildVoicesList(voices, TRANSPOSING_INSTRUMENTS);
    expect(list[0].label).toBe(`${TRANSPOSING_INSTRUMENTS.bb_trumpet.name} 1`);
  });

  it('cae al id cuando el instrumento no está en el catálogo', () => {
    const list = buildVoicesList({ ocarina: { 1: 'x' } }, TRANSPOSING_INSTRUMENTS);
    expect(list[0].label).toBe('ocarina 1');
  });

  it('devuelve lista vacía sin voces', () => {
    expect(buildVoicesList(null)).toEqual([]);
    expect(buildVoicesList({})).toEqual([]);
  });
});

describe('resolveInitialVoice', () => {
  const song = {
    content: 'contenido plano',
    voices: {
      bb_trumpet: { 1: 'trompeta 1', 2: 'trompeta 2' },
      f_horn: { 1: 'corno 1' }
    },
    primaryInstrument: 'f_horn',
    primaryVoiceNumber: '1'
  };

  it('respeta la voz previamente seleccionada', () => {
    expect(resolveInitialVoice(song, 'bb_trumpet-2')).toEqual({
      content: 'trompeta 2',
      voiceKey: 'bb_trumpet-2'
    });
  });

  it('usa la voz primaria cuando no hay selección previa', () => {
    expect(resolveInitialVoice(song)).toEqual({
      content: 'corno 1',
      voiceKey: 'f_horn-1'
    });
  });

  it('ignora una voz seleccionada que ya no existe', () => {
    expect(resolveInitialVoice(song, 'tuba-9')).toEqual({
      content: 'corno 1',
      voiceKey: 'f_horn-1'
    });
  });

  it('usa la primera voz si no hay instrumento primario', () => {
    const sinPrimario = { voices: { bb_trumpet: { 1: 'trompeta 1' } } };
    expect(resolveInitialVoice(sinPrimario)).toEqual({
      content: 'trompeta 1',
      voiceKey: 'bb_trumpet-1'
    });
  });

  it('cae al contenido plano cuando la canción no tiene voces', () => {
    expect(resolveInitialVoice({ content: 'solo contenido', voices: {} })).toEqual({
      content: 'solo contenido',
      voiceKey: null
    });
  });

  it('no revienta con una canción vacía', () => {
    expect(resolveInitialVoice(null)).toEqual({ content: '', voiceKey: null });
  });
});

describe('extractLyricsSections', () => {
  const letraDe = (song = SONG) => {
    const { formatted } = renderSongContent(song, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    return extractLyricsSections(formatted);
  };

  it('elimina los acordes y conserva la letra', () => {
    const [bloque] = letraDe().sections;

    expect(bloque.content).toContain('Cristo vive hoy');
    expect(bloque.content).toContain('para siempre');
    expect(bloque.content).not.toMatch(/\bSOL\b/);
    expect(bloque.content).not.toMatch(/\bLAm\b/);
  });

  // El `##` está para la vista de acordes. En la de letra partía la canción en
  // tarjetas con tres rem entre una y otra, y a quien canta eso solo le
  // multiplica el scroll. Hacen falta DOS secciones con letra: con una sola,
  // un `extractLyricsSections` que no uniera nada pasaría igual.
  it('devuelve un único bloque aunque la canción tenga varias secciones', () => {
    const dosVersos = `## Verso 1\nDO   SOL\nCristo vive hoy\n\n## Verso 2\nLAm  FA\nGrande es tu amor\n`;
    const { formatted } = renderSongContent(dosVersos, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });

    expect(formatted.sections).toHaveLength(2);

    const { sections } = extractLyricsSections(formatted);
    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain('Cristo vive hoy');
    expect(sections[0].content).toContain('Grande es tu amor');
  });

  it('conserva el título de la sección como una línea más del bloque', () => {
    const [bloque] = letraDe().sections;

    expect(bloque.title).toBe('');
    expect(bloque.content).toContain('Verso\nCristo vive hoy');
  });

  // "Intro" son cuatro acordes y ni una palabra: en la vista de letra era una
  // tarjeta vacía con un título encima.
  it('descarta las secciones que se quedan sin letra al quitar los acordes', () => {
    const [bloque] = letraDe().sections;

    expect(bloque.content).not.toContain('Intro');
  });

  it('no devuelve ninguna sección si la canción es instrumental', () => {
    const instrumental = `## Intro\nDO SOL LAm FA\n\n## Puente\nFA SOL DO\n`;

    expect(letraDe(instrumental).sections).toEqual([]);
  });

  it('devuelve null sin canción formateada', () => {
    expect(extractLyricsSections(null)).toBeNull();
    expect(extractLyricsSections({})).toBeNull();
  });
});

describe('capo', () => {
  // Con la cejilla en el traste 3, el guitarrista toca las formas tres
  // semitonos por debajo y la cejilla las devuelve a su sitio. Si esto se
  // invierte, toca en la tonalidad equivocada y encima suena bien en su
  // cabeza: el error solo aparece cuando entra la banda.
  const guitarra = (capo) => renderSongContent(SONG, {
    baseKey: 'DO',
    targetKey: 'DO',
    instrument: 'c_guitar',
    notationSystem: 'latin',
    capo
  });

  it('baja los acordes que se leen', () => {
    // El DO del Intro llega a LA# en guitarra (-2), y con capo 2 baja a SOL#.
    const sinCapo = guitarra(0).formatted.sections[0].content;
    const conCapo = guitarra(2).formatted.sections[0].content;

    expect(sinCapo).toContain('LA#');
    expect(conCapo).toContain('SOL#');
    expect(conCapo).not.toBe(sinCapo);
  });

  // No basta con que `displayKey` y `soundingKey` sean distintas: con el signo
  // invertido también lo serían, y la hoja diría una tonalidad dos semitonos
  // por encima de la que el guitarrista está leyendo. Hay que atar la
  // tonalidad mostrada al primer acorde que se ve.
  it('baja la tonalidad que se lee pero no la que suena', () => {
    const sinCapo = guitarra(0);
    const conCapo = guitarra(2);

    expect(sinCapo.soundingKey).toBe('LA#');
    expect(conCapo.soundingKey).toBe('LA#'); // la banda sigue oyendo lo mismo
    expect(conCapo.displayKey).toBe('SOL#'); // pero él lee dos semitonos abajo

    // El primer acorde del Intro es la tónica: tiene que coincidir con la
    // tonalidad que se anuncia en pantalla.
    expect(conCapo.formatted.sections[0].content.startsWith(conCapo.displayKey))
      .toBe(true);
    expect(sinCapo.formatted.sections[0].content.startsWith(sinCapo.displayKey))
      .toBe(true);
  });

  // Doce trastes es una octava: se vuelve al mismo sitio.
  it('un capo de 12 deja la misma tonalidad', () => {
    expect(guitarra(12).displayKey).toBe(guitarra(0).displayKey);
  });

  it('sin capo no toca nada', () => {
    const base = guitarra(0);

    expect(base.displayKey).toBe(base.soundingKey);
    expect(guitarra(undefined).formatted.sections[0].content)
      .toBe(base.formatted.sections[0].content);
  });

  it('ignora valores que no son un traste', () => {
    const base = guitarra(0).formatted.sections[0].content;

    [-3, 1.5, 'III', null].forEach((malo) => {
      expect(guitarra(malo).formatted.sections[0].content).toBe(base);
    });
  });

  it('conserva los sufijos y los bajos del acorde', () => {
    const conSufijos = renderSongContent('## Verso\nDOsus4 LAm7 FA/DO\n', {
      baseKey: 'DO',
      targetKey: 'DO',
      instrument: 'c_guitar',
      notationSystem: 'latin',
      capo: 2
    });
    const contenido = conSufijos.formatted.sections[0].content;

    expect(contenido).toMatch(/sus4/);
    expect(contenido).toMatch(/m7/);
    expect(contenido).toMatch(/\//);
  });
});

describe('formatLyrics', () => {
  // La letra de una canción en PDF se escribe a mano y puede traer sus propios
  // `##`. Tampoco ahí deben partirla en tarjetas.
  it('funde las secciones de la letra en un solo bloque', () => {
    const letra = formatLyrics('## Coro\nSanto eres\n\n## Verso\nGrande es tu amor\n');

    expect(letra.sections).toHaveLength(1);
    expect(letra.sections[0].content).toBe('Coro\nSanto eres\n\nVerso\nGrande es tu amor');
  });

  // Aquí no hay acordes que quitar: una línea de letra que por mala suerte se
  // pareciera a una de acordes se perdería para siempre.
  it('no borra líneas que parecen acordes', () => {
    const letra = formatLyrics('DO SOL LAm FA\nCristo vive hoy\n');

    expect(letra.sections[0].content).toContain('DO SOL LAm FA');
  });

  it('devuelve null sin letra', () => {
    expect(formatLyrics('')).toBeNull();
    expect(formatLyrics('   \n  ')).toBeNull();
    expect(formatLyrics(null)).toBeNull();
  });
});

describe('renderSongContent', () => {
  it('no transpone cuando la tonalidad destino es la misma', () => {
    const { formatted } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    expect(formatted.rawContent).toContain('DO SOL LAm FA');
  });

  it('transpone de DO a RE', () => {
    const { formatted } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'RE',
      notationSystem: 'latin'
    });
    expect(formatted.rawContent).toContain('RE LA SIm SOL');
  });

  it('convierte los acordes mayores a notación anglosajona', () => {
    const { formatted } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'english'
    });
    expect(formatted.rawContent).toContain('C G');
    expect(formatted.rawContent).toContain('C        G');
  });

  // Esta era una limitación conocida: el lookahead `(?![#b\w])` del regex
  // impedía convertir cualquier acorde con sufijo. Se arregló detectando
  // primero si una línea es de acordes (packages/core/src/music/chords.js),
  // así que ahora sí se convierten en ambas direcciones.
  it('convierte también los acordes menores', () => {
    const aIngles = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'english'
    });
    expect(aIngles.formatted.rawContent).toContain('Am');
    expect(aIngles.formatted.rawContent).not.toContain('LAm');

    const aLatin = renderSongContent('## Intro\nC G Am F\n', {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    expect(aLatin.formatted.rawContent).toContain('LAm');
  });

  it('es idempotente respecto al sistema de notación', () => {
    const latin = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    const otraVez = renderSongContent(latin.formatted.rawContent, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    expect(otraVez.formatted.rawContent).toBe(latin.formatted.rawContent);
  });

  it('mantiene la notación latina tras transponer una canción en inglés', () => {
    // Regresión: antes la conversión solo se aplicaba si el destino era
    // 'english', así que una canción escrita en inglés volvía a mostrarse
    // en inglés al transponer aunque el usuario hubiera elegido latín.
    const english = '## Intro\nC G F\n';
    const { formatted } = renderSongContent(english, {
      baseKey: 'DO',
      targetKey: 'RE',
      notationSystem: 'latin'
    });
    expect(formatted.rawContent).toContain('RE LA SOL');
    expect(formatted.rawContent).not.toMatch(/\bC\b/);
  });

  it('no produce dobles alteraciones al transponer', () => {
    const { formatted } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'FA#',
      notationSystem: 'latin'
    });
    // Solo sobre notas, para no chocar con los encabezados markdown `## `
    expect(formatted.rawContent).not.toMatch(/(DO|RE|MI|FA|SOL|LA|SI)(##|bb)/);
  });

  it('no transpone por instrumento si es el de origen', () => {
    const base = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      instrument: SOURCE_INSTRUMENT,
      notationSystem: 'latin'
    });
    const sinInstrumento = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    expect(base.formatted.rawContent).toBe(sinInstrumento.formatted.rawContent);
  });

  it('transpone para otro instrumento', () => {
    const { formatted } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      instrument: 'f_horn',
      notationSystem: 'latin'
    });
    expect(formatted.rawContent).not.toContain('DO SOL LAm FA');
  });

  it('calcula la tonalidad visual del instrumento', () => {
    const trompeta = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      instrument: SOURCE_INSTRUMENT,
      notationSystem: 'latin'
    });
    const corno = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      instrument: 'f_horn',
      notationSystem: 'latin'
    });
    expect(trompeta.displayKey).toBeTruthy();
    expect(corno.displayKey).toBeTruthy();
    expect(corno.displayKey).not.toBe(trompeta.displayKey);
  });

  it('usa la tonalidad base si no hay destino', () => {
    const { displayKey } = renderSongContent(SONG, { baseKey: 'DO' });
    expect(displayKey).toBeTruthy();
  });

  it('devuelve también la versión sin acordes', () => {
    const { lyricsOnly } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    expect(lyricsOnly.sections[0].content).toContain('Cristo vive hoy');
  });

  it('no revienta con contenido vacío', () => {
    const { formatted, lyricsOnly } = renderSongContent('', {
      baseKey: 'DO',
      targetKey: 'DO'
    });
    expect(formatted.sections).toEqual([]);
    expect(lyricsOnly.sections).toEqual([]);
  });

  it('no revienta sin opciones', () => {
    expect(() => renderSongContent(SONG)).not.toThrow();
  });
});

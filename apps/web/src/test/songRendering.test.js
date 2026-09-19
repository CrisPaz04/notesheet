import { describe, it, expect } from 'vitest';
import {
  renderSongContent,
  extractLyricsSections,
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
  it('elimina los acordes y conserva la letra', () => {
    const { formatted } = renderSongContent(SONG, {
      baseKey: 'DO',
      targetKey: 'DO',
      notationSystem: 'latin'
    });
    const lyrics = extractLyricsSections(formatted);
    const verso = lyrics.sections.find((s) => s.title === 'Verso');

    expect(verso.content).toContain('Cristo vive hoy');
    expect(verso.content).toContain('para siempre');
    expect(verso.content).not.toMatch(/\bSOL\b/);
    expect(verso.content).not.toMatch(/\bLAm\b/);
  });

  it('devuelve null sin canción formateada', () => {
    expect(extractLyricsSections(null)).toBeNull();
    expect(extractLyricsSections({})).toBeNull();
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
    const verso = lyricsOnly.sections.find((s) => s.title === 'Verso');
    expect(verso.content).toContain('Cristo vive hoy');
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

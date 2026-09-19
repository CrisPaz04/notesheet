import { describe, it, expect } from 'vitest';
import {
  convertNotationSystem,
  extractLyricsOnly,
  transposeContent,
  transposeForInstrument,
  detectNotationSystem,
  isChord,
  isChordLine,
  splitChordSegment,
  mapChordLine,
} from '@notesheet/core';

/**
 * Renderizado de canciones completas: conversión de notación, extracción de
 * letra y transposición sobre contenido real (acordes con sufijo + letra).
 */

const LATIN_SONG = `# Título: Canción de prueba
# Tonalidad: DO

## Verso
DO       SOL      LAm      FA
Amor eterno, dame la mano

## Coro
DO7      SOLsus4  FA#m7    SIb   LAm/DO
Dame razones para seguir, Amor`;

const ENGLISH_SONG = `# Title: Test song
# Key: C

## Verse
C        G        Am       F
Amazing grace how sweet the sound

## Chorus
Cmaj7    G7sus4   Bb       Am/C   Dm7b5
I once was lost but now am found`;

describe('isChord', () => {
  it('acepta acordes mayores en ambos sistemas', () => {
    ['DO', 'SOL', 'SIb', 'FA#', 'C', 'G', 'Bb', 'F#'].forEach(chord => {
      expect(isChord(chord), chord).toBe(true);
    });
  });

  it('acepta acordes con sufijo', () => {
    ['LAm', 'Am', 'DO7', 'C7', 'Cmaj7', 'DOmaj7', 'G7sus4', 'SOL7sus4',
     'Am7b5', 'F#m7', 'Cadd9', 'Cdim', 'C+', 'C6/9'].forEach(chord => {
      expect(isChord(chord), chord).toBe(true);
    });
  });

  it('acepta acordes con bajo', () => {
    ['C/G', 'LAm/DO', 'Am/C', 'F#m7/A'].forEach(chord => {
      expect(isChord(chord), chord).toBe(true);
    });
  });

  it('rechaza palabras de la letra', () => {
    ['Amor', 'Dame', 'Amazing', 'grace', 'Solo', 'Fe', 'Contigo']
      .forEach(word => {
        expect(isChord(word), word).toBe(false);
      });
  });

  // Muchas partituras escriben las notas capitalizadas ("Re Mi Fa"), así que
  // se aceptan. El precio es que "Mi", "La", "Do" o "Si" —palabras corrientes
  // en español— pasan a ser acordes válidos por sí solas. Lo que evita el
  // desastre es isChordLine: exige que TODOS los tokens de la línea sean
  // acordes, así que una frase de verdad nunca se confunde.
  it('acepta notas capitalizadas', () => {
    ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Sib', 'Do#', 'Lam']
      .forEach(nota => {
        expect(isChord(nota), nota).toBe(true);
      });
  });

  it('no acepta notas en minúsculas', () => {
    // "la", "mi" y "si" son demasiado corrientes en español
    ['do', 'mi', 'la', 'si', 'sol'].forEach(palabra => {
      expect(isChord(palabra), palabra).toBe(false);
    });
  });
});

describe('isChordLine', () => {
  it('reconoce líneas de solo acordes', () => {
    expect(isChordLine('DO SOL LAm FA')).toBe(true);
    expect(isChordLine('C G Am F')).toBe(true);
    expect(isChordLine('DO7 SOLsus4 FA#m7 SIb LAm/DO')).toBe(true);
    expect(isChordLine('| DO | SOL |  (x2)')).toBe(true);
  });

  it('rechaza líneas de letra', () => {
    expect(isChordLine('Amor eterno, dame la mano')).toBe(false);
    expect(isChordLine('Amazing grace how sweet the sound')).toBe(false);
    expect(isChordLine('Dame razones para seguir')).toBe(false);
  });

  it('rechaza líneas vacías y de solo separadores', () => {
    expect(isChordLine('')).toBe(false);
    expect(isChordLine('   ')).toBe(false);
    expect(isChordLine('| | |')).toBe(false);
  });
});

describe('melodías nota a nota', () => {
  // El repertorio de la iglesia son partes de primera trompeta escritas como
  // una sucesión de notas, no como acordes sobre la letra. Transponerlas nota
  // a nota es exactamente la misma operación, así que funciona igual.
  it('reconoce una melodía capitalizada', () => {
    expect(isChordLine('Re Mi Fa Mi Re Fa Sol La Sol')).toBe(true);
    expect(isChordLine('La Sib La')).toBe(true);
  });

  it('tolera las marcas de repetición pegadas a la nota', () => {
    expect(isChordLine('//Re Re Re Do La')).toBe(true);
    expect(isChordLine('Do Do Do# Re//')).toBe(true);
  });

  it('transpone la melodía conservando las marcas', () => {
    const origen = '//Re Re Re Do La';
    const destino = mapChordLine(origen, (raiz) => ({ RE: 'MI', DO: 'RE', LA: 'SI' }[raiz] || raiz));
    expect(destino).toBe('//MI MI MI RE SI');
  });

  // Las partes escritas para la banda traen marcas propias: `_` alarga la
  // nota, `//` repite y `(4)` cuenta compases. Nada de eso es una nota, pero
  // acompaña a las notas y antes tumbaba la línea entera.
  it('acepta las marcas de duración y conteo', () => {
    expect(isChordLine('MI_ LA SOL# DO# MI_')).toBe(true);
    expect(isChordLine('// SOL# FA# MI_')).toBe(true);
    expect(isChordLine('FA# (4) MI (3) FA#')).toBe(true);
    expect(isChordLine('SI (4) SI(2)')).toBe(true);
    expect(isChordLine('LA SOL# MI LA SI_ SI //')).toBe(true);
  });

  it('conserva esas marcas al transponer', () => {
    expect(transposeContent('MI_ LA SOL# DO# MI_', 'MI', 'FA'))
      .toBe('FA_ SIb LA RE FA_');
    expect(transposeContent('FA# (4) MI (3) FA#', 'MI', 'FA'))
      .toBe('SOL (4) FA (3) SOL');
    expect(transposeContent('SI (4) SI(2)', 'MI', 'FA'))
      .toBe('DO (4) DO(2)');
  });

  it('una parte sin letra deja vacía la vista de solo letra', () => {
    expect(extractLyricsOnly('MI_ LA SOL# DO# MI_\n// SOL# FA# MI_')).toBe('');
  });

  // Protección: una frase de verdad no debe confundirse con notas aunque
  // empiece por una palabra que también es nota.
  it('no confunde una frase con una melodía', () => {
    expect(isChordLine('Mi Dios es fiel')).toBe(false);
    expect(isChordLine('La gloria de Dios')).toBe(false);
    expect(isChordLine('Solo tu amor')).toBe(false);
  });
});

describe('splitChordSegment', () => {
  it('separa la etiqueta de sección de los acordes', () => {
    expect(splitChordSegment('Intro: C - G - Am')).toEqual({
      prefix: 'Intro: ',
      body: 'C - G - Am',
    });
  });

  it('solo toca el metadato de tonalidad entre las líneas con #', () => {
    expect(splitChordSegment('# Tonalidad: DO')).toEqual({
      prefix: '# Tonalidad: ',
      body: 'DO',
    });
    expect(splitChordSegment('# Título: Amazing Grace')).toBeNull();
    expect(splitChordSegment('## Verso')).toBeNull();
  });
});

describe('convertNotationSystem con acordes con sufijo', () => {
  it('convierte acordes menores de latino a inglés', () => {
    expect(convertNotationSystem('DO SOL LAm FA', 'english')).toBe('C G Am F');
  });

  it('convierte acordes menores de inglés a latino', () => {
    expect(convertNotationSystem('C G Am F', 'latin')).toBe('DO SOL LAm FA');
  });

  it('convierte séptimas, sus, add y bajos', () => {
    expect(convertNotationSystem('DO7 SOLsus4 FA#m7 SIb LAm/DO', 'english'))
      .toBe('C7 Gsus4 F#m7 Bb Am/C');
    expect(convertNotationSystem('Cmaj7 G7sus4 Bb Am/C Dm7b5', 'latin'))
      .toBe('DOmaj7 SOL7sus4 SIb LAm/DO REm7b5');
  });

  it('conserva el espaciado de la línea de acordes', () => {
    expect(convertNotationSystem('DO       SOL      LAm      FA', 'english'))
      .toBe('C       G      Am      F');
  });

  it('no destroza la letra en español', () => {
    const lyrics = 'Amor eterno, dame la mano y no me sueltes';
    expect(convertNotationSystem(lyrics, 'latin')).toBe(lyrics);
    expect(convertNotationSystem(lyrics, 'english')).toBe(lyrics);
  });

  it('deja intacta la letra dentro de una canción completa', () => {
    const lines = convertNotationSystem(LATIN_SONG, 'english').split('\n');
    const result = lines.join('\n');
    expect(lines[4].trim().split(/\s+/)).toEqual(['C', 'G', 'Am', 'F']);
    expect(lines[8].trim().split(/\s+/))
      .toEqual(['C7', 'Gsus4', 'F#m7', 'Bb', 'Am/C']);
    expect(result).toContain('Amor eterno, dame la mano');
    expect(result).toContain('Dame razones para seguir, Amor');
    expect(result).toContain('# Tonalidad: C');
  });

  it('convierte la canción inglesa a latino sin tocar la letra', () => {
    const lines = convertNotationSystem(ENGLISH_SONG, 'latin').split('\n');
    const result = lines.join('\n');
    expect(lines[4].trim().split(/\s+/)).toEqual(['DO', 'SOL', 'LAm', 'FA']);
    expect(lines[8].trim().split(/\s+/))
      .toEqual(['DOmaj7', 'SOL7sus4', 'SIb', 'LAm/DO', 'REm7b5']);
    expect(result).toContain('Amazing grace how sweet the sound');
    expect(result).toContain('I once was lost but now am found');
  });

  it('es reversible ida y vuelta', () => {
    const roundTrip = convertNotationSystem(
      convertNotationSystem(LATIN_SONG, 'english'),
      'latin'
    );
    expect(roundTrip).toBe(LATIN_SONG);
  });
});

describe('extractLyricsOnly con acordes con sufijo', () => {
  it('elimina las líneas de acordes completas', () => {
    const lyrics = extractLyricsOnly(LATIN_SONG);
    expect(lyrics).not.toContain('LAm');
    expect(lyrics).not.toContain('DO7');
    expect(lyrics).not.toContain('SOLsus4');
    expect(lyrics).not.toContain('FA#m7');
    expect(lyrics).not.toContain('LAm/DO');
  });

  it('conserva la letra intacta, incluidas palabras con forma de acorde', () => {
    const lyrics = extractLyricsOnly(LATIN_SONG);
    expect(lyrics).toContain('Amor eterno, dame la mano');
    expect(lyrics).toContain('Dame razones para seguir, Amor');
  });

  it('conserva encabezados y metadatos', () => {
    const lyrics = extractLyricsOnly(LATIN_SONG);
    expect(lyrics).toContain('# Título: Canción de prueba');
    expect(lyrics).toContain('## Verso');
    expect(lyrics).toContain('## Coro');
  });

  it('elimina los acordes ingleses con sufijo', () => {
    const lyrics = extractLyricsOnly(ENGLISH_SONG);
    expect(lyrics).not.toContain('Cmaj7');
    expect(lyrics).not.toContain('Am/C');
    expect(lyrics).toContain('Amazing grace how sweet the sound');
  });
});

describe('transposeContent con acordes con sufijo', () => {
  it('transpone menores, séptimas, sus y bajos', () => {
    expect(transposeContent('C G Am F', 'C', 'D')).toBe('D A Bm G');
    expect(transposeContent('Cmaj7 G7sus4 Am/C', 'C', 'D')).toBe('Dmaj7 A7sus4 Bm/D');
    expect(transposeContent('DO7 SOLsus4 LAm/DO', 'DO', 'RE')).toBe('RE7 LAsus4 SIm/RE');
  });

  it('no toca la letra', () => {
    const result = transposeContent(LATIN_SONG, 'DO', 'RE');
    expect(result).toContain('Amor eterno, dame la mano');
    expect(result).toContain('Dame razones para seguir, Amor');
  });

  it('conserva el espaciado de las líneas de acordes', () => {
    const result = transposeContent('C        G        Am       F', 'C', 'D');
    expect(result).toBe('D        A        Bm       G');
  });
});

describe('transposeForInstrument con acordes con sufijo', () => {
  it('transpone la raíz y conserva el sufijo', () => {
    const result = transposeForInstrument('DO7 SOLsus4 LAm/DO', 'bb_trumpet', 'eb_alto_sax');
    expect(result).toBe('SOL7 REsus4 MIm/SOL');
  });

  it('no toca la letra', () => {
    const result = transposeForInstrument(LATIN_SONG, 'bb_trumpet', 'eb_alto_sax');
    expect(result).toContain('Amor eterno, dame la mano');
  });
});

describe('detectNotationSystem con acordes con sufijo', () => {
  it('detecta latino en una canción con menores', () => {
    expect(detectNotationSystem('DO SOL LAm FA\nAmor eterno')).toBe('latin');
    expect(detectNotationSystem(LATIN_SONG)).toBe('latin');
  });

  it('detecta inglés en una canción con menores', () => {
    expect(detectNotationSystem('C G Am F\nAmazing grace')).toBe('english');
    expect(detectNotationSystem(ENGLISH_SONG)).toBe('english');
  });
});

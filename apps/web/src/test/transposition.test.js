import { describe, it, expect } from 'vitest';
import {
  transposeNote,
  getKeyDistance,
  transposeLine,
  transposeContent,
  detectNotationSystem,
} from '@notesheet/core';

describe('transposeNote', () => {
  it('transposes up by semitones', () => {
    expect(transposeNote('C', 2)).toBe('D');    // C + 2 = D
    expect(transposeNote('DO', 2)).toBe('RE');  // DO + 2 = RE
  });

  it('transposes down by negative semitones', () => {
    expect(transposeNote('D', -2)).toBe('C');
    expect(transposeNote('RE', -2)).toBe('DO');
  });

  it('wraps around the octave', () => {
    expect(transposeNote('B', 1)).toBe('C');
    expect(transposeNote('C', -1)).toBe('B');
  });

  it('handles minor chords', () => {
    expect(transposeNote('Am', 2)).toBe('Bm');
    expect(transposeNote('LAm', 2, 'latin')).toBe('SIm');
  });

  it('handles sharps', () => {
    expect(transposeNote('C#', 2)).toBe('D#');
    expect(transposeNote('DO#', 2)).toBe('RE#');
  });

  it('returns original for invalid notes', () => {
    expect(transposeNote('X', 2)).toBe('X');
    expect(transposeNote('Hello', 2)).toBe('Hello');
  });

  it('respects target notation system', () => {
    expect(transposeNote('C', 2, 'latin')).toBe('RE');
    expect(transposeNote('DO', 2, 'english')).toBe('D');
  });
});

describe('getKeyDistance', () => {
  it('calculates semitones between keys', () => {
    expect(getKeyDistance('C', 'D')).toBe(2);   // C to D = 2 semitones
    expect(getKeyDistance('C', 'G')).toBe(7);   // C to G = 7 semitones (fifth)
    expect(getKeyDistance('DO', 'SOL')).toBe(7);
  });

  it('returns 0 for same key', () => {
    expect(getKeyDistance('C', 'C')).toBe(0);
    expect(getKeyDistance('DO', 'DO')).toBe(0);
  });

  it('handles minor keys', () => {
    expect(getKeyDistance('Am', 'Em')).toBe(7);
    expect(getKeyDistance('LAm', 'MIm')).toBe(7);
  });

  it('throws on invalid keys', () => {
    expect(() => getKeyDistance('X', 'C')).toThrow();
  });
});

describe('transposeLine', () => {
  it('transposes all chords in a line', () => {
    expect(transposeLine('C G Am F', 2)).toBe('D A Bm G');
  });

  it('preserves text between chords', () => {
    const result = transposeLine('Intro: C - G - Am', 2);
    expect(result).toBe('Intro: D - A - Bm');
  });

  it('handles Latin notation', () => {
    expect(transposeLine('DO SOL LAm FA', 2)).toBe('RE LA SIm SOL');
  });
});

describe('transposeContent', () => {
  it('transposes entire song content', () => {
    const content = `## Verso
C G Am F
Amazing grace`;
    const result = transposeContent(content, 'C', 'D');
    expect(result).toContain('D');
    expect(result).toContain('A');
    expect(result).toContain('Amazing grace');
  });

  it('maintains notation system', () => {
    const content = 'DO SOL LA';
    const result = transposeContent(content, 'DO', 'RE');
    expect(result).toContain('RE');
    expect(result).toContain('LA');
    expect(result).toContain('SI');
  });
});

describe('detectNotationSystem', () => {
  it('detects Latin notation', () => {
    expect(detectNotationSystem('DO RE MI FA SOL LA SI')).toBe('latin');
  });

  it('detects English notation', () => {
    expect(detectNotationSystem('C D E F G A B')).toBe('english');
  });

  it('handles mixed content by majority', () => {
    // More Latin notes than English
    expect(detectNotationSystem('DO SOL LA RE MI C')).toBe('latin');
  });
});

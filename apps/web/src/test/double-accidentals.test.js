import { describe, it, expect } from 'vitest';
import {
  transposeNote,
  transposeLine,
  transposeContent,
} from '@notesheet/core';

/**
 * Tests to identify and fix double sharp/flat issues
 */

describe('Double Accidentals Bug Investigation', () => {
  describe('transposeNote with accidentals', () => {
    it('should not produce double sharps when transposing F#', () => {
      // F# + 1 semitone should be G, not F##
      const result = transposeNote('F#', 1);
      expect(result).not.toContain('##');
      expect(result).toBe('G');
    });

    it('should not produce double sharps when transposing G#', () => {
      // G# + 1 semitone should be A, not G##
      const result = transposeNote('G#', 1);
      expect(result).not.toContain('##');
      expect(result).toBe('A');
    });

    it('should not produce double flats when transposing Bb', () => {
      // Bb - 1 semitone should be A, not Bbb
      const result = transposeNote('Bb', -1);
      expect(result).not.toContain('bb');
      expect(result).toBe('A');
    });

    it('should not produce double flats when transposing Eb', () => {
      // Eb - 1 semitone should be D, not Ebb
      const result = transposeNote('Eb', -1);
      expect(result).not.toContain('bb');
      expect(result).toBe('D');
    });

    // Latin notation
    it('should not produce double sharps in Latin (FA#)', () => {
      const result = transposeNote('FA#', 1);
      expect(result).not.toContain('##');
      expect(result).toBe('SOL');
    });

    it('should not produce double flats in Latin (SIb)', () => {
      // Note: SIb is detected as English due to getNoteSystem quirk
      // Use explicit targetSystem to get Latin output
      const result = transposeNote('SIb', -1, 'latin');
      expect(result).not.toContain('bb');
      expect(result).toBe('LA');
    });
  });

  describe('transposeLine should never have double accidentals', () => {
    it('should handle line with sharps', () => {
      const result = transposeLine('F# G# C#', 1);
      expect(result).not.toMatch(/##/);
      expect(result).not.toMatch(/bb/);
    });

    it('should handle line with flats', () => {
      const result = transposeLine('Bb Eb Ab', -1);
      expect(result).not.toMatch(/##/);
      expect(result).not.toMatch(/bb/);
    });

    it('should handle Latin line with sharps', () => {
      const result = transposeLine('FA# SOL# DO#', 1);
      expect(result).not.toMatch(/##/);
      expect(result).not.toMatch(/bb/);
    });

    it('should handle Latin line with flats', () => {
      const result = transposeLine('SIb MIb LAb', -1);
      expect(result).not.toMatch(/##/);
      expect(result).not.toMatch(/bb/);
    });
  });

  describe('transposeContent edge cases', () => {
    it('should not produce double accidentals when transposing to sharp keys', () => {
      const content = 'F# C# G#';
      const result = transposeContent(content, 'A', 'B');
      expect(result).not.toMatch(/##/);
      expect(result).not.toMatch(/bb/);
    });

    it('should not produce double accidentals when transposing to flat keys', () => {
      const content = 'Bb Eb Ab';
      const result = transposeContent(content, 'F', 'Eb');
      expect(result).not.toMatch(/##/);
      expect(result).not.toMatch(/bb/);
    });

    it('should handle complex song with mixed accidentals', () => {
      const content = `## Intro
F#m C# G#
Bb Eb Ab

## Verse
C#m F# B`;

      // Try transposing to various keys
      const keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Ab'];

      // Regex to match double accidentals on notes (not markdown headers like ## Intro)
      // Matches letter + ## or Latin note + ## or note + bb
      const doubleSharpRegex = /[A-G]##|DO##|RE##|MI##|FA##|SOL##|LA##|SI##/;
      const doubleFlatRegex = /[A-G]bb|DObb|REbb|MIbb|FAbb|SOLbb|LAbb|SIbb/;

      keys.forEach(targetKey => {
        const result = transposeContent(content, 'A', targetKey);
        expect(result).not.toMatch(doubleSharpRegex);
        expect(result).not.toMatch(doubleFlatRegex);
      });
    });
  });

  describe('Input with existing double accidentals', () => {
    it('should pass through invalid double accidentals unchanged', () => {
      // C## and Dbb are not recognized as valid notes
      // They pass through unchanged (not transposed)
      expect(transposeNote('C##', 0)).toBe('C##');
      expect(transposeNote('Dbb', 0)).toBe('Dbb');
    });
  });
});

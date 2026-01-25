import { describe, it, expect } from 'vitest';
import {
  transposeNote,
  transposeLine,
  transposeContent,
  transposeForInstrument,
} from '@notesheet/core';

/**
 * Tests using the "Prueba" song to reproduce real-world issues
 */

const PRUEBA_CONTENT = `DO RE MI FA SOL LA SI DO

DO# RE# MI# FA# SOL# LA# SI# DO#

DOb REb MIb FAb SOLb LAb SIb DOb`;

// Regex to detect problematic double accidentals
const DOUBLE_SHARP = /DO##|RE##|MI##|FA##|SOL##|LA##|SI##|[A-G]##/i;
const DOUBLE_FLAT = /DObb|REbb|MIbb|FAbb|SOLbb|LAbb|SIbb|[A-G]bb/i;

function hasInvalidAccidentals(text) {
  return DOUBLE_SHARP.test(text) || DOUBLE_FLAT.test(text);
}

describe('Prueba Song - Real World Issues', () => {

  describe('Individual notes with sharps', () => {
    const sharpNotes = ['DO#', 'RE#', 'MI#', 'FA#', 'SOL#', 'LA#', 'SI#'];

    sharpNotes.forEach(note => {
      it(`${note} should transpose without double accidentals`, () => {
        for (let i = -12; i <= 12; i++) {
          const result = transposeNote(note, i, 'latin');
          if (hasInvalidAccidentals(result)) {
            console.log(`ISSUE: ${note} + ${i} = ${result}`);
          }
          expect(hasInvalidAccidentals(result), `${note} + ${i} = ${result}`).toBe(false);
        }
      });
    });
  });

  describe('Individual notes with flats', () => {
    const flatNotes = ['DOb', 'REb', 'MIb', 'FAb', 'SOLb', 'LAb', 'SIb'];

    flatNotes.forEach(note => {
      it(`${note} should transpose without double accidentals`, () => {
        for (let i = -12; i <= 12; i++) {
          const result = transposeNote(note, i, 'latin');
          if (hasInvalidAccidentals(result)) {
            console.log(`ISSUE: ${note} + ${i} = ${result}`);
          }
          expect(hasInvalidAccidentals(result), `${note} + ${i} = ${result}`).toBe(false);
        }
      });
    });
  });

  describe('transposeLine with all note types', () => {
    it('should handle natural notes line', () => {
      const line = 'DO RE MI FA SOL LA SI DO';
      for (let i = -12; i <= 12; i++) {
        const result = transposeLine(line, i, 'latin');
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE naturals + ${i}: ${result}`);
        }
        expect(hasInvalidAccidentals(result), `naturals + ${i} = ${result}`).toBe(false);
      }
    });

    it('should handle sharp notes line', () => {
      const line = 'DO# RE# MI# FA# SOL# LA# SI# DO#';
      for (let i = -12; i <= 12; i++) {
        const result = transposeLine(line, i, 'latin');
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE sharps + ${i}: ${result}`);
        }
        expect(hasInvalidAccidentals(result), `sharps + ${i} = ${result}`).toBe(false);
      }
    });

    it('should handle flat notes line', () => {
      const line = 'DOb REb MIb FAb SOLb LAb SIb DOb';
      for (let i = -12; i <= 12; i++) {
        const result = transposeLine(line, i, 'latin');
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE flats + ${i}: ${result}`);
        }
        expect(hasInvalidAccidentals(result), `flats + ${i} = ${result}`).toBe(false);
      }
    });
  });

  describe('Instrument transpositions', () => {
    const instruments = [
      { name: 'Bb Trumpet', semitones: 0 },
      { name: 'Eb Alto Sax', semitones: 7 },
      { name: 'Eb Baritone Sax', semitones: -5 },
      { name: 'F Horn', semitones: -7 },
      { name: 'C Flute', semitones: -2 },
    ];

    const lines = [
      'DO RE MI FA SOL LA SI DO',
      'DO# RE# MI# FA# SOL# LA# SI# DO#',
      'DOb REb MIb FAb SOLb LAb SIb DOb',
    ];

    instruments.forEach(({ name, semitones }) => {
      lines.forEach(line => {
        it(`${name} (${semitones}): ${line.substring(0, 20)}...`, () => {
          const result = transposeLine(line, semitones, 'latin');
          if (hasInvalidAccidentals(result)) {
            console.log(`ISSUE ${name}: ${line} => ${result}`);
          }
          expect(hasInvalidAccidentals(result), `${name}: ${result}`).toBe(false);
        });
      });
    });
  });

  describe('Full Prueba song transposition to all keys', () => {
    const keys = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];

    keys.forEach(targetKey => {
      it(`should transpose to ${targetKey} without double accidentals`, () => {
        const result = transposeContent(PRUEBA_CONTENT, 'DO', targetKey, 'latin');
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE to ${targetKey}:\n${result}`);
        }
        expect(hasInvalidAccidentals(result), `to ${targetKey}:\n${result}`).toBe(false);
      });
    });
  });

  describe('transposeForInstrument (the function used in SongView)', () => {
    const instruments = [
      'bb_trumpet',
      'bb_trombone',
      'bb_clarinet',
      'bb_tenor_sax',
      'bb_soprano_sax',
      'eb_alto_sax',
      'eb_baritone_sax',
      'c_flute',
      'f_horn',
    ];

    instruments.forEach(toInstrument => {
      it(`should transpose Prueba to ${toInstrument} without double accidentals`, () => {
        const result = transposeForInstrument(PRUEBA_CONTENT, 'bb_trumpet', toInstrument);
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE transposeForInstrument to ${toInstrument}:\n${result}`);
        }
        expect(hasInvalidAccidentals(result), `to ${toInstrument}:\n${result}`).toBe(false);
      });
    });

    it('should handle sharps line with all instruments', () => {
      const line = 'DO# RE# MI# FA# SOL# LA# SI# DO#';
      instruments.forEach(toInstrument => {
        const result = transposeForInstrument(line, 'bb_trumpet', toInstrument);
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE sharps to ${toInstrument}: ${result}`);
        }
        expect(hasInvalidAccidentals(result), `sharps to ${toInstrument}: ${result}`).toBe(false);
      });
    });

    it('should handle flats line with all instruments', () => {
      const line = 'DOb REb MIb FAb SOLb LAb SIb DOb';
      instruments.forEach(toInstrument => {
        const result = transposeForInstrument(line, 'bb_trumpet', toInstrument);
        if (hasInvalidAccidentals(result)) {
          console.log(`ISSUE flats to ${toInstrument}: ${result}`);
        }
        expect(hasInvalidAccidentals(result), `flats to ${toInstrument}: ${result}`).toBe(false);
      });
    });
  });
});

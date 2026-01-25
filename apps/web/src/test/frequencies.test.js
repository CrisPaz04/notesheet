import { describe, it, expect } from 'vitest';
import {
  midiToFrequency,
  frequencyToMidi,
  midiToNoteName,
  frequencyToNoteName,
  getCentsDeviation,
  getNoteNameOnly,
  noteNameToMidi,
  noteNameToFrequency,
  A4_FREQUENCY,
} from '@notesheet/core';

describe('midiToFrequency', () => {
  it('converts A4 (MIDI 69) to 440 Hz', () => {
    expect(midiToFrequency(69)).toBe(440);
  });

  it('converts middle C (MIDI 60) to ~261.63 Hz', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it('converts A3 (MIDI 57) to 220 Hz (octave below A4)', () => {
    expect(midiToFrequency(57)).toBeCloseTo(220, 1);
  });

  it('converts A5 (MIDI 81) to 880 Hz (octave above A4)', () => {
    expect(midiToFrequency(81)).toBeCloseTo(880, 1);
  });

  it('supports custom reference frequency', () => {
    // With A4 = 442 Hz (common orchestral tuning)
    expect(midiToFrequency(69, 442)).toBe(442);
  });
});

describe('frequencyToMidi', () => {
  it('converts 440 Hz to MIDI 69 (A4)', () => {
    expect(frequencyToMidi(440)).toBe(69);
  });

  it('converts 261.63 Hz to MIDI 60 (middle C)', () => {
    expect(frequencyToMidi(261.63)).toBe(60);
  });

  it('rounds to nearest MIDI note', () => {
    // 445 Hz is slightly sharp of A4, should still round to 69
    expect(frequencyToMidi(445)).toBe(69);
  });
});

describe('midiToNoteName', () => {
  it('converts MIDI 60 to C4 (middle C)', () => {
    expect(midiToNoteName(60)).toBe('C4');
  });

  it('converts MIDI 69 to A4', () => {
    expect(midiToNoteName(69)).toBe('A4');
  });

  it('handles sharps correctly', () => {
    expect(midiToNoteName(61)).toBe('C#4');
    expect(midiToNoteName(70)).toBe('A#4');
  });

  it('supports Latin notation', () => {
    expect(midiToNoteName(60, true)).toBe('DO4');
    expect(midiToNoteName(69, true)).toBe('LA4');
    expect(midiToNoteName(61, true)).toBe('DO#4');
  });
});

describe('getCentsDeviation', () => {
  it('returns 0 cents for perfectly in-tune A4', () => {
    const result = getCentsDeviation(440);
    expect(result.cents).toBe(0);
    expect(result.note).toBe('A4');
  });

  it('detects sharp pitch (positive cents)', () => {
    // 453.08 Hz is ~50 cents sharp of A4
    const result = getCentsDeviation(452);
    expect(result.cents).toBeGreaterThan(0);
    expect(result.note).toBe('A4');
  });

  it('detects flat pitch (negative cents)', () => {
    // 427.47 Hz is ~50 cents flat of A4
    const result = getCentsDeviation(430);
    expect(result.cents).toBeLessThan(0);
    expect(result.note).toBe('A4');
  });

  it('includes Latin notation in result', () => {
    const result = getCentsDeviation(440);
    expect(result.noteLatin).toBe('LA4');
  });
});

describe('noteNameToMidi', () => {
  it('converts C4 to MIDI 60', () => {
    expect(noteNameToMidi('C4')).toBe(60);
  });

  it('converts A4 to MIDI 69', () => {
    expect(noteNameToMidi('A4')).toBe(69);
  });

  it('handles sharps', () => {
    expect(noteNameToMidi('C#4')).toBe(61);
    expect(noteNameToMidi('F#3')).toBe(54);
  });

  it('throws on invalid note format', () => {
    expect(() => noteNameToMidi('X4')).toThrow();
    expect(() => noteNameToMidi('C')).toThrow();
  });
});

describe('noteNameToFrequency', () => {
  it('converts A4 to 440 Hz', () => {
    expect(noteNameToFrequency('A4')).toBe(440);
  });

  it('converts C4 to ~261.63 Hz', () => {
    expect(noteNameToFrequency('C4')).toBeCloseTo(261.63, 1);
  });
});

describe('getNoteNameOnly', () => {
  it('returns note without octave', () => {
    expect(getNoteNameOnly(60)).toBe('C');
    expect(getNoteNameOnly(69)).toBe('A');
    expect(getNoteNameOnly(61)).toBe('C#');
  });

  it('supports Latin notation', () => {
    expect(getNoteNameOnly(60, true)).toBe('DO');
    expect(getNoteNameOnly(69, true)).toBe('LA');
  });
});

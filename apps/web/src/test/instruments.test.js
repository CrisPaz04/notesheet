import { describe, it, expect } from 'vitest';
import {
  TRANSPOSING_INSTRUMENTS,
  INSTRUMENT_GROUPS,
} from '@notesheet/core';

describe('TRANSPOSING_INSTRUMENTS', () => {
  it('contains expected instruments', () => {
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('bb_trumpet');
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('eb_alto_sax');
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('c_flute');
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('f_horn');
  });

  it('each instrument has required fields', () => {
    Object.entries(TRANSPOSING_INSTRUMENTS).forEach(([key, instrument]) => {
      expect(instrument).toHaveProperty('name');
      expect(instrument).toHaveProperty('transposition');
      expect(instrument).toHaveProperty('description');
      expect(typeof instrument.name).toBe('string');
      expect(typeof instrument.transposition).toBe('number');
    });
  });

  it('transposition values are within reasonable range', () => {
    Object.entries(TRANSPOSING_INSTRUMENTS).forEach(([key, instrument]) => {
      // Transpositions should be within -12 to +12 semitones (one octave)
      expect(instrument.transposition).toBeGreaterThanOrEqual(-12);
      expect(instrument.transposition).toBeLessThanOrEqual(12);
    });
  });

  it('Bb trumpet is the reference (0 transposition)', () => {
    expect(TRANSPOSING_INSTRUMENTS.bb_trumpet.transposition).toBe(0);
  });

  it('alto sax transposes up a fifth (7 semitones)', () => {
    expect(TRANSPOSING_INSTRUMENTS.eb_alto_sax.transposition).toBe(7);
  });

  it('French horn transposes down a fifth (-7 semitones)', () => {
    expect(TRANSPOSING_INSTRUMENTS.f_horn.transposition).toBe(-7);
  });
});

describe('INSTRUMENT_GROUPS', () => {
  it('contains instrument groupings', () => {
    expect(INSTRUMENT_GROUPS.length).toBeGreaterThan(0);
  });

  it('each group has name and instruments array', () => {
    INSTRUMENT_GROUPS.forEach(group => {
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('instruments');
      expect(Array.isArray(group.instruments)).toBe(true);
    });
  });

  it('all grouped instruments exist in TRANSPOSING_INSTRUMENTS', () => {
    INSTRUMENT_GROUPS.forEach(group => {
      group.instruments.forEach(instrumentKey => {
        expect(TRANSPOSING_INSTRUMENTS).toHaveProperty(instrumentKey);
      });
    });
  });

  it('has Bb instruments group', () => {
    const bbGroup = INSTRUMENT_GROUPS.find(g => g.name.includes('Sib'));
    expect(bbGroup).toBeTruthy();
    expect(bbGroup.instruments).toContain('bb_trumpet');
  });

  it('has Eb instruments group', () => {
    const ebGroup = INSTRUMENT_GROUPS.find(g => g.name.includes('Mib'));
    expect(ebGroup).toBeTruthy();
    expect(ebGroup.instruments).toContain('eb_alto_sax');
  });
});

import { describe, it, expect } from 'vitest';
import {
  TRANSPOSING_INSTRUMENTS,
  INSTRUMENT_GROUPS,
  readsChordChart,
  supportsCapo,
} from '@notesheet/core';

describe('TRANSPOSING_INSTRUMENTS', () => {
  it('contains expected instruments', () => {
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('bb_trumpet');
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('eb_alto_sax');
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('c_flute');
    expect(TRANSPOSING_INSTRUMENTS).toHaveProperty('f_horn');
  });

  it('each instrument has required fields', () => {
    Object.values(TRANSPOSING_INSTRUMENTS).forEach((instrument) => {
      expect(instrument).toHaveProperty('name');
      expect(instrument).toHaveProperty('transposition');
      expect(instrument).toHaveProperty('description');
      expect(typeof instrument.name).toBe('string');
      expect(typeof instrument.transposition).toBe('number');
    });
  });

  it('transposition values are within reasonable range', () => {
    Object.values(TRANSPOSING_INSTRUMENTS).forEach((instrument) => {
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

  it('agrupa guitarra, piano, bajo y voz donde se los busca', () => {
    const grupo = INSTRUMENT_GROUPS.find(g => g.name.includes('Guitarra'));
    expect(grupo).toBeTruthy();
    expect(grupo.instruments).toEqual(['c_guitar', 'c_piano', 'c_bass', 'c_voice']);
  });
});

describe('instrumentos que leen la hoja de acordes', () => {
  const ACORDES = ['c_guitar', 'c_piano', 'c_bass', 'c_voice'];

  it('están en el catálogo', () => {
    ACORDES.forEach((id) => {
      expect(TRANSPOSING_INSTRUMENTS).toHaveProperty(id);
    });
  });

  // Están en DO, igual que la flauta: -2 desde la trompeta en Sib. Si esto se
  // desvía, un guitarrista lee la canción en otra tonalidad que la banda.
  it('transponen como la flauta, que también está en DO', () => {
    const flauta = TRANSPOSING_INSTRUMENTS.c_flute.transposition;
    expect(flauta).toBe(-2);

    ACORDES.forEach((id) => {
      expect(TRANSPOSING_INSTRUMENTS[id].transposition).toBe(flauta);
    });
  });

  it('readsChordChart los distingue de los de viento', () => {
    ACORDES.forEach((id) => expect(readsChordChart(id)).toBe(true));

    ['bb_trumpet', 'eb_alto_sax', 'c_flute', 'f_horn'].forEach((id) => {
      expect(readsChordChart(id)).toBe(false);
    });
  });

  it('no revienta con un instrumento desconocido', () => {
    expect(readsChordChart('ocarina')).toBe(false);
    expect(readsChordChart(undefined)).toBe(false);
    expect(supportsCapo('ocarina')).toBe(false);
  });

  // La cejilla es cosa de la guitarra. Ofrecérsela al pianista es ruido.
  it('solo la guitarra admite capo', () => {
    expect(supportsCapo('c_guitar')).toBe(true);

    ['c_piano', 'c_bass', 'c_voice', 'bb_trumpet'].forEach((id) => {
      expect(supportsCapo(id)).toBe(false);
    });
  });
});

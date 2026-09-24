import { describe, it, expect } from 'vitest';
import {
  numeroDeVozAsignado,
  vozParaMusico,
  resolveVoiceForMusician,
  resolveScore,
  buildVoicesList
} from '@notesheet/core';

// Cada músico dice qué número es en la sección, y cada canción se ajusta a
// las voces que tiene: si tu número no está, la más alta por debajo.

describe('numeroDeVozAsignado', () => {
  it('tres trompetas y dos voces: 1 → 1; 2 y 3 → 2', () => {
    expect(numeroDeVozAsignado(['1', '2'], '1')).toBe('1');
    expect(numeroDeVozAsignado(['1', '2'], '2')).toBe('2');
    expect(numeroDeVozAsignado(['1', '2'], '3')).toBe('2');
  });

  it('cuatro y tres voces: 1, 2, 3, 3', () => {
    expect(['1', '2', '3', '4'].map((n) => numeroDeVozAsignado(['1', '2', '3'], n)))
      .toEqual(['1', '2', '3', '3']);
  });

  it('una sola voz: todos la misma', () => {
    expect(['1', '2', '3'].map((n) => numeroDeVozAsignado(['1'], n))).toEqual(['1', '1', '1']);
  });

  it('compara números, no texto: la 10 va después de la 2', () => {
    expect(numeroDeVozAsignado(['10', '2'], '3')).toBe('2');
  });

  // Las voces de Firestore no llegan en orden
  it('no depende del orden en que vengan', () => {
    expect(numeroDeVozAsignado(['3', '1', '2'], '4')).toBe('3');
    expect(numeroDeVozAsignado(['3', '2'], '1')).toBe('2');
  });

  it('si solo hay voces por encima de la mía, la más baja', () => {
    expect(numeroDeVozAsignado(['2', '3'], '1')).toBe('2');
  });

  it('sin número elegido o sin voces, nada (manda la regla de siempre)', () => {
    expect(numeroDeVozAsignado(['1', '2'], null)).toBeNull();
    expect(numeroDeVozAsignado(['1', '2'], '')).toBeNull();
    expect(numeroDeVozAsignado([], '2')).toBeNull();
  });
});

const CANCION = {
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1',
  voices: {
    bb_trumpet: { 1: 'trompeta 1', 2: 'trompeta 2' },
    eb_alto_sax: { 1: 'saxo 1' }
  }
};

describe('vozParaMusico', () => {
  const voces = buildVoicesList(CANCION.voices);

  it('entre las de su instrumento', () => {
    expect(vozParaMusico(voces, { instrument: 'bb_trumpet', voiceNumber: '3', primaryInstrument: 'bb_trumpet' }).id)
      .toBe('bb_trumpet-2');
    expect(vozParaMusico(voces, { instrument: 'eb_alto_sax', voiceNumber: '2', primaryInstrument: 'bb_trumpet' }).id)
      .toBe('eb_alto_sax-1');
  });

  it('si su instrumento no tiene voces, entre las del principal: el trombón 2 lee la segunda', () => {
    expect(vozParaMusico(voces, { instrument: 'bb_trombone', voiceNumber: '2', primaryInstrument: 'bb_trumpet' }).id)
      .toBe('bb_trumpet-2');
  });

  it('sin número, nada', () => {
    expect(vozParaMusico(voces, { instrument: 'bb_trumpet', voiceNumber: null })).toBeNull();
  });
});

describe('resolveVoiceForMusician (texto)', () => {
  it('la que eligió a mano manda sobre su número', () => {
    const r = resolveVoiceForMusician(CANCION, { voiceKey: 'bb_trumpet-1', instrument: 'bb_trumpet', voiceNumber: '2' });
    expect(r).toEqual({ content: 'trompeta 1', voiceKey: 'bb_trumpet-1' });
  });

  it('la de su número', () => {
    expect(resolveVoiceForMusician(CANCION, { instrument: 'bb_trumpet', voiceNumber: '3' }).content).toBe('trompeta 2');
  });

  it('sin número, la primera de su instrumento', () => {
    expect(resolveVoiceForMusician(CANCION, { instrument: 'eb_alto_sax' }).content).toBe('saxo 1');
  });

  it('sin voces para su instrumento ni número, la principal', () => {
    expect(resolveVoiceForMusician(CANCION, { instrument: 'f_horn' })).toEqual({ content: 'trompeta 1', voiceKey: 'bb_trumpet-1' });
  });

  it('una canción sin voces, su contenido plano', () => {
    expect(resolveVoiceForMusician({ content: 'DO SOL' }, { instrument: 'bb_trumpet', voiceNumber: '2' }))
      .toEqual({ content: 'DO SOL', voiceKey: null });
  });
});

describe('resolveScore con número de voz (PDF)', () => {
  const PDF = {
    format: 'pdf',
    primaryInstrument: 'bb_trumpet',
    primaryVoiceNumber: '1',
    pdfs: {
      bb_trumpet: {
        1: { partitura: 'p/t1.pdf' },
        2: { partitura: 'p/t2.pdf' }
      }
    }
  };

  it('la trompeta 3 abre la 2', () => {
    expect(resolveScore(PDF, { instrument: 'bb_trumpet', voiceNumber: '3' }).path).toBe('p/t2.pdf');
  });

  it('elegida a mano manda', () => {
    expect(resolveScore(PDF, { voiceKey: 'bb_trumpet-1', instrument: 'bb_trumpet', voiceNumber: '2' }).path)
      .toBe('p/t1.pdf');
  });

  it('sin número, como siempre: la principal de su instrumento', () => {
    expect(resolveScore(PDF, { instrument: 'bb_trumpet' }).path).toBe('p/t1.pdf');
  });
});

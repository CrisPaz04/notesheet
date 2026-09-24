import { describe, it, expect } from 'vitest';
import { renderChordChart, CHORDS_SOURCE_INSTRUMENT, vistaPreferida } from '@notesheet/core';

// Los acordes (`song.acordes`) se guardan en concierto, como los escribe el
// guitarrista, y se muestran con el mismo recorrido que las notas.

const texto = (formatted) => formatted.sections.map((s) => s.content).join('\n');

describe('renderChordChart', () => {
  it('se guardan en concierto: la guitarra los lee tal cual se escribieron', () => {
    expect(CHORDS_SOURCE_INSTRUMENT).toBe('c_guitar');
    const r = renderChordChart('DO SOL LAm FA', { baseKey: 'RE', targetKey: 'RE', instrument: 'c_guitar' });
    expect(texto(r)).toBe('DO SOL LAm FA');
  });

  it('la ortografía no cambia: SIb sigue siendo SIb', () => {
    const r = renderChordChart('SIb MIb FA7', { baseKey: 'DO', targetKey: 'DO', instrument: 'c_piano' });
    expect(texto(r)).toBe('SIb MIb FA7');
  });

  it('para la trompeta en Sib suben un tono, como sus notas', () => {
    const r = renderChordChart('DO SOL LAm FA', { baseKey: 'RE', targetKey: 'RE', instrument: 'bb_trumpet' });
    expect(texto(r)).toBe('RE LA SIm SOL');
  });

  // La tonalidad de la canción está en la referencia de Sib (RE = DO en
  // concierto): la distancia al transponer es la misma.
  it('transponen con la canción', () => {
    const r = renderChordChart('DO SOL LAm FA', { baseKey: 'RE', targetKey: 'MI', instrument: 'c_guitar' });
    expect(texto(r)).toBe('RE LA SIm SOL');
  });

  it('con cejilla se leen las formas más abajo', () => {
    const r = renderChordChart('RE LA SIm SOL', { baseKey: 'MI', targetKey: 'MI', instrument: 'c_guitar', capo: 2 });
    expect(texto(r)).toBe('DO SOL LAm FA');
  });

  it('en la notación del músico, con sus sufijos', () => {
    const r = renderChordChart('DO SOLm7 FAmaj7/LA', { baseKey: 'RE', targetKey: 'RE', instrument: 'c_guitar', notationSystem: 'english' });
    expect(texto(r)).toBe('C Gm7 Fmaj7/A');
  });

  it('respeta las secciones y no toca la letra', () => {
    const r = renderChordChart('## Coro\nDO SOL\nA Dios sea la gloria', {
      baseKey: 'RE', targetKey: 'RE', instrument: 'bb_trumpet'
    });
    expect(r.sections[0].title).toMatch(/coro/i);
    expect(r.sections[0].content).toContain('RE LA');
    expect(r.sections[0].content).toContain('A Dios sea la gloria');
  });

  it('sin acordes no hay nada que pintar', () => {
    expect(renderChordChart('', {})).toBeNull();
    expect(renderChordChart('   \n ', {})).toBeNull();
    expect(renderChordChart(undefined, {})).toBeNull();
  });
});

describe('vistaPreferida: con qué vista abre cada músico', () => {
  const todo = { hayLetra: true, hayAcordes: true };

  it('los vientos, en sus notas', () => {
    expect(vistaPreferida('bb_trumpet', todo)).toBe('principal');
    expect(vistaPreferida('eb_alto_sax', todo)).toBe('principal');
    expect(vistaPreferida('c_flute', todo)).toBe('principal');
  });

  it('la voz, en la letra; sin letra, en los acordes; sin nada, en la principal', () => {
    expect(vistaPreferida('c_voice', todo)).toBe('letra');
    expect(vistaPreferida('c_voice', { hayAcordes: true })).toBe('acordes');
    expect(vistaPreferida('c_voice', {})).toBe('principal');
  });

  it('guitarra, piano y bajo, en los acordes; sin acordes, en la principal', () => {
    expect(vistaPreferida('c_guitar', todo)).toBe('acordes');
    expect(vistaPreferida('c_piano', todo)).toBe('acordes');
    expect(vistaPreferida('c_bass', todo)).toBe('acordes');
    expect(vistaPreferida('c_guitar', { hayLetra: true })).toBe('principal');
  });
});

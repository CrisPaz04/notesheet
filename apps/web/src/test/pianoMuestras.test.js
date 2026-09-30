import { describe, it, expect } from 'vitest';
import { NOTAS_GRABADAS, INSTRUMENTOS, archivoDe, muestraPara, suena } from '../lib/pianoMuestras';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

describe('las grabaciones del piano', () => {
  it('una cada tres semitonos, de DO1 a DO8, y están todas en public', () => {
    expect(NOTAS_GRABADAS).toHaveLength(29);
    expect(archivoDe(24)).toBe('C1.mp3');
    expect(archivoDe(63)).toBe('Ds4.mp3');
    expect(archivoDe(108)).toBe('C8.mp3');
    for (const midi of NOTAS_GRABADAS) {
      expect(existsSync(join(cwd(), 'public/audio/piano', archivoDe(midi))), archivoDe(midi)).toBe(true);
    }
  });

  it('cada tecla usa la más cercana, afinada como mucho semitono y medio', () => {
    for (let midi = 24; midi <= 108; midi++) {
      const { muestra, velocidad } = muestraPara(midi);
      expect(Math.abs(midi - muestra)).toBeLessThanOrEqual(1.5);
      expect(velocidad).toBeCloseTo(2 ** ((midi - muestra) / 12), 10);
    }
  });

  it('una grabada suena tal cual', () => {
    expect(muestraPara(69)).toEqual({ muestra: 69, velocidad: 1 });
  });

  it('la trompeta: sus diez grabaciones están, y ninguna tecla se afina más de dos semitonos', () => {
    const { notas } = INSTRUMENTOS.trompeta;
    expect(notas).toHaveLength(10);
    for (const midi of notas) {
      expect(existsSync(join(cwd(), 'public/audio/trompeta', archivoDe(midi))), archivoDe(midi)).toBe(true);
    }
    for (let midi = 52; midi <= 86; midi++) {
      expect(Math.abs(midi - muestraPara(midi, 'trompeta').muestra)).toBeLessThanOrEqual(2);
    }
  });

  // Una trompeta en Sib suena de MI3 a DO6: fuera de ahí, esas teclas callan
  it('la trompeta solo suena en su registro', () => {
    expect(suena(52, 'trompeta')).toBe(true); // MI3
    expect(suena(51, 'trompeta')).toBe(false);
    expect(suena(86, 'trompeta')).toBe(true);
    expect(suena(87, 'trompeta')).toBe(false);
    expect(suena(24, 'piano')).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import MetronomeEngine, { SUBDIVISIONS, SOUND_PRESETS, nivelDelClick } from '@notesheet/core/src/audio/metronomeEngine';
import {
  TEMPOS_CLASICOS,
  tempoClasico,
  bpmAPosicion,
  posicionABpm,
  BPM_MIN,
  BPM_MAX
} from '@notesheet/core/src/audio/temposClasicos';

// El programador del motor, con un reloj falso: se apunta cada click (cuándo
// y cómo suena) en vez de sintetizarlo
function programar({ bpm = 60, compas = '4/4', subdivision = 'quarter', acento = 1 }, segundos) {
  const motor = new MetronomeEngine();
  const clicks = [];
  motor.audioContext = { currentTime: 0 };
  motor.scheduleNote = (t, nivel) => clicks.push({ t: Math.round(t * 1000) / 1000, nivel });
  motor.setTempo(bpm);
  motor.setTimeSignature(compas);
  motor.setSubdivision(subdivision);
  motor.setAcento(acento);
  motor.isPlaying = true;
  motor.scheduleAheadTime = segundos;
  motor.scheduler();
  return clicks;
}
const tiempos = (clicks) => clicks.map((c) => c.t);
const niveles = (clicks) => clicks.map((c) => c.nivel);

describe('el motor del metrónomo', () => {
  it('negras: un click por tiempo, acento en el 1', () => {
    const c = programar({ bpm: 120 }, 1.99);
    expect(tiempos(c)).toEqual([0, 0.5, 1, 1.5]);
    expect(niveles(c)).toEqual(['acento', 'pulso', 'pulso', 'pulso']);
  });

  it('sin acento, todos los tiempos iguales', () => {
    expect(niveles(programar({ acento: 0 }, 3.99))).toEqual(['pulso', 'pulso', 'pulso', 'pulso']);
  });

  it('el acento en otro tiempo', () => {
    expect(niveles(programar({ acento: 3 }, 3.99))).toEqual(['pulso', 'pulso', 'acento', 'pulso']);
  });

  it('el acento vuelve en cada compás', () => {
    expect(niveles(programar({ compas: '2/4' }, 3.99))).toEqual(['acento', 'pulso', 'acento', 'pulso']);
  });

  it('tresillo: tres partes iguales', () => {
    const c = programar({ subdivision: 'triplet' }, 0.99);
    expect(tiempos(c)).toEqual([0, 0.333, 0.667]);
    expect(niveles(c)).toEqual(['acento', 'subdivision', 'subdivision']);
  });

  // Corchea con puntillo y semicorchea: a los 3/4 del tiempo
  it('saltillo: en el tiempo y a los tres cuartos', () => {
    expect(tiempos(programar({ subdivision: 'saltillo' }, 1.99))).toEqual([0, 0.75, 1, 1.75]);
  });

  // Corchea y dos semicorcheas
  it('galopa: en el tiempo, a la mitad y a los tres cuartos', () => {
    const c = programar({ subdivision: 'galopa', acento: 0 }, 1.99);
    expect(tiempos(c)).toEqual([0, 0.5, 0.75, 1, 1.5, 1.75]);
    expect(niveles(c)).toEqual(['pulso', 'subdivision', 'subdivision', 'pulso', 'subdivision', 'subdivision']);
  });

  // Como Soundcorset: 6/8 son 2 tiempos de negra con puntillo, y el BPM los cuenta
  it('6/8: dos tiempos por compás, con las tres corcheas en el tresillo', () => {
    const c = programar({ bpm: 60, compas: '6/8', subdivision: 'triplet' }, 2.99);
    expect(tiempos(c)).toEqual([0, 0.333, 0.667, 1, 1.333, 1.667, 2, 2.333, 2.667]);
    // El acento vuelve cada dos tiempos: en el 0 y en el 2
    expect(niveles(c).filter((n) => n === 'acento')).toHaveLength(2);
    expect(c.find((x) => x.t === 2).nivel).toBe('acento');
  });

  it('9/8 y 12/8: tres y cuatro tiempos', () => {
    expect(niveles(programar({ compas: '9/8' }, 3.99))).toEqual(['acento', 'pulso', 'pulso', 'acento']);
    expect(niveles(programar({ compas: '12/8' }, 4.99))).toEqual(['acento', 'pulso', 'pulso', 'pulso', 'acento']);
  });

  // Antes cada tiempo de x/8 duraba una negra con puntillo
  it('7/8: siete tiempos, y el BPM cuenta corcheas', () => {
    const c = programar({ bpm: 120, compas: '7/8' }, 3.49);
    expect(tiempos(c)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3]);
    expect(niveles(c)).toEqual(['acento', 'pulso', 'pulso', 'pulso', 'pulso', 'pulso', 'pulso']);
  });

  it('el tempo va de 15 a 500', () => {
    const motor = new MetronomeEngine();
    motor.setTempo(10);
    expect(motor.getTempo()).toBe(15);
    motor.setTempo(900);
    expect(motor.getTempo()).toBe(500);
  });

  // Antes el compás solo se podía cambiar parado
  it('cambiar el compás sonando no vuelve al 1 si no hace falta', () => {
    const motor = new MetronomeEngine();
    motor.isPlaying = true;
    motor.currentBeat = 2;
    motor.setTimeSignature('3/4');
    expect(motor.currentBeat).toBe(2);
    // En 2/4 ya no hay tercer tiempo: el siguiente es el 1
    motor.setTimeSignature('2/4');
    expect(motor.currentBeat).toBe(0);
  });

  it('nivelDelClick: lo de entre tiempos siempre es subdivisión', () => {
    expect(nivelDelClick(0, 1, 1)).toBe('subdivision');
    expect(nivelDelClick(0, 0, 1)).toBe('acento');
    expect(nivelDelClick(0, 0, 0)).toBe('pulso');
  });

  it('cada sonido tiene lo que el motor necesita', () => {
    for (const [id, p] of Object.entries(SOUND_PRESETS)) {
      for (const campo of ['name', 'accentFrequency', 'regularFrequency', 'accentDuration', 'regularDuration', 'accentGain', 'regularGain']) {
        expect(p[campo], `${id}.${campo}`).toBeDefined();
      }
    }
    expect(Object.keys(SOUND_PRESETS).length).toBeGreaterThanOrEqual(10);
  });

  it('los patrones empiezan en el tiempo y van en orden dentro de él', () => {
    for (const [id, { pattern }] of Object.entries(SUBDIVISIONS)) {
      expect(pattern[0], id).toBe(0);
      pattern.slice(1).forEach((p, i) => {
        expect(p, id).toBeGreaterThan(pattern[i]);
        expect(p, id).toBeLessThan(1);
      });
    }
  });
});

describe('los tempos clásicos', () => {
  it('nombra cada tempo', () => {
    expect(tempoClasico(92).nombre).toBe('Andante');
    expect(tempoClasico(140).nombre).toBe('Allegro');
    expect(tempoClasico(208).nombre).toBe('Prestissimo');
    expect(tempoClasico(BPM_MIN).nombre).toBe('Larghissimo');
    expect(tempoClasico(BPM_MAX).nombre).toBe('Prestissimo');
  });

  it('cada botón cae en su propio tramo', () => {
    for (const t of TEMPOS_CLASICOS) expect(tempoClasico(t.bpm).nombre).toBe(t.nombre);
  });

  it('los tramos van en orden, sin huecos', () => {
    TEMPOS_CLASICOS.slice(1).forEach((t, i) => {
      expect(t.hasta).toBeGreaterThan(TEMPOS_CLASICOS[i].hasta);
    });
  });
});

describe('el deslizador de tempo (logarítmico)', () => {
  it('va de 15 a 500 de punta a punta', () => {
    expect(bpmAPosicion(BPM_MIN)).toBe(0);
    expect(bpmAPosicion(BPM_MAX)).toBe(1000);
    expect(posicionABpm(0)).toBe(BPM_MIN);
    expect(posicionABpm(1000)).toBe(BPM_MAX);
  });

  it('lo que se usa (60–180) ocupa más de un tercio del recorrido', () => {
    expect(bpmAPosicion(180) - bpmAPosicion(60)).toBeGreaterThan(300);
  });

  it('ida y vuelta sin perder el tempo', () => {
    for (const bpm of [15, 40, 72, 120, 208, 500]) {
      expect(Math.abs(posicionABpm(bpmAPosicion(bpm)) - bpm)).toBeLessThanOrEqual(1);
    }
  });
});

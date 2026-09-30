// packages/core/src/audio/temposClasicos.js

/**
 * El rango del metrónomo y los nombres clásicos del tempo.
 *
 * Va aparte del motor (metronomeEngine.js) porque los tests de las pantallas
 * sustituyen el motor entero (usa Web Audio); esto es puro y se usa tal cual.
 */

export const BPM_MIN = 15;
export const BPM_MAX = 500;

export const limitarBpm = (bpm) => Math.max(BPM_MIN, Math.min(BPM_MAX, bpm));

/**
 * Cada nombre con el tempo que pone su botón y hasta dónde llega. Los
 * tratados no coinciden en los límites (Largo y Lento se solapan, por
 * ejemplo); aquí van seguidos, sin huecos ni solapes, para que cada tempo
 * tenga un nombre y solo uno.
 */
export const TEMPOS_CLASICOS = [
  { nombre: 'Larghissimo', bpm: 20, hasta: 24 },
  { nombre: 'Grave', bpm: 40, hasta: 44 },
  { nombre: 'Largo', bpm: 50, hasta: 54 },
  { nombre: 'Lento', bpm: 58, hasta: 61 },
  { nombre: 'Larghetto', bpm: 64, hasta: 67 },
  { nombre: 'Adagio', bpm: 72, hasta: 75 },
  { nombre: 'Andante', bpm: 90, hasta: 95 },
  { nombre: 'Andantino', bpm: 100, hasta: 107 },
  { nombre: 'Moderato', bpm: 110, hasta: 113 },
  { nombre: 'Allegretto', bpm: 116, hasta: 119 },
  { nombre: 'Allegro', bpm: 140, hasta: 155 },
  { nombre: 'Vivace', bpm: 160, hasta: 167 },
  { nombre: 'Presto', bpm: 180, hasta: 199 },
  { nombre: 'Prestissimo', bpm: 210, hasta: Infinity }
];

/** El tempo clásico al que corresponde un BPM ("Allegro" para 140) */
export function tempoClasico(bpm) {
  return TEMPOS_CLASICOS.find((t) => bpm <= t.hasta) || TEMPOS_CLASICOS[TEMPOS_CLASICOS.length - 1];
}

// El deslizador va en escala logarítmica: de 15 a 500 en línea recta, lo que
// se usa de verdad (60–180) quedaría apretado en un tercio del recorrido.
// Posición de 0 a 1000.
const RAZON = Math.log(BPM_MAX / BPM_MIN);
export const bpmAPosicion = (bpm) => Math.round((1000 * Math.log(limitarBpm(bpm) / BPM_MIN)) / RAZON);
export const posicionABpm = (posicion) => limitarBpm(Math.round(BPM_MIN * Math.exp((posicion / 1000) * RAZON)));

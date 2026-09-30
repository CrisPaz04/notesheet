/**
 * Metronome Engine
 *
 * Provides precise metronome functionality using Web Audio API
 * with lookahead scheduling for sub-millisecond accuracy.
 */

import { getAudioContext, resumeAudioContext } from './audioContext';
import { limitarBpm } from './temposClasicos';

// Cuánto se sube cada click sobre la ganancia de su sonido. Con los valores
// de antes el metrónomo se quedaba corto al lado de una banda; el compresor
// de la salida evita que los más fuertes saturen.
const REFUERZO = 2.2;

// Time signature definitions
export const TIME_SIGNATURES = {
  '2/4': { beats: 2, noteValue: 4 },
  '3/4': { beats: 3, noteValue: 4 },
  '4/4': { beats: 4, noteValue: 4 },
  '5/4': { beats: 5, noteValue: 4 },
  // Los compuestos, como Soundcorset: el tiempo es la negra con puntillo (6/8
  // son 2 tiempos), el BPM cuenta esos tiempos y las corcheas se oyen con el
  // tresillo. Antes eran 6 "tiempos" de negra con puntillo cada uno: un 6/8
  // duraba como tres compases de 3/4.
  '6/8': { beats: 2, noteValue: 8, compuesto: true },
  // 7/8 no es compuesto: 7 corcheas, y el BPM cuenta corcheas
  '7/8': { beats: 7, noteValue: 8 },
  '9/8': { beats: 3, noteValue: 8, compuesto: true },
  '12/8': { beats: 4, noteValue: 8, compuesto: true }
};

// Subdivisiones. Cada una es un patrón: dónde suena cada click dentro del
// tiempo (0 = en el tiempo, 0.5 = a la mitad). Así caben las que no son
// partes iguales: el saltillo (corchea con puntillo y semicorchea) y la
// galopa (corchea y dos semicorcheas). `clicksPerBeat` se queda por
// compatibilidad: es el largo del patrón.
const subdivision = (name, pattern) => ({ name, pattern, clicksPerBeat: pattern.length });
export const SUBDIVISIONS = {
  quarter: subdivision('Negras', [0]),
  eighth: subdivision('Corcheas', [0, 1 / 2]),
  triplet: subdivision('Tresillos', [0, 1 / 3, 2 / 3]),
  sixteenth: subdivision('Semicorcheas', [0, 1 / 4, 1 / 2, 3 / 4]),
  saltillo: subdivision('Saltillo', [0, 3 / 4]),
  galopa: subdivision('Galopa', [0, 1 / 2, 3 / 4])
};

/**
 * Cómo suena un click: 'acento' (el tiempo acentuado), 'pulso' (los demás
 * tiempos) o 'subdivision' (lo que cae entre tiempos, más suave).
 *
 * @param {number} tiempo - Tiempo del compás, desde 0
 * @param {number} paso - Click dentro del tiempo, desde 0
 * @param {number} acento - Tiempo acentuado, desde 1; 0 es sin acento
 */
export function nivelDelClick(tiempo, paso, acento) {
  if (paso > 0) return 'subdivision';
  return acento > 0 && tiempo === acento - 1 ? 'acento' : 'pulso';
}

// Sound presets with different oscillator types and frequencies
export const SOUND_PRESETS = {
  classic: {
    name: 'Clásico',
    description: 'Sonido limpio y claro',
    accentFrequency: 1000,
    regularFrequency: 800,
    accentDuration: 0.05,
    regularDuration: 0.03,
    accentGain: 0.3,
    regularGain: 0.15,
    oscillatorType: 'sine'
  },
  woodBlock: {
    name: 'Bloque de Madera',
    description: 'Sonido percusivo y cálido',
    accentFrequency: 1200,
    regularFrequency: 900,
    accentDuration: 0.02,
    regularDuration: 0.015,
    accentGain: 0.35,
    regularGain: 0.18,
    oscillatorType: 'triangle'
  },
  // Ruido filtrado: un hi-hat de verdad no tiene nota (antes era una onda
  // cuadrada a 3000 Hz, que sonaba a pitido)
  hiHat: {
    name: 'Hi-Hat',
    description: 'Sonido brillante y agudo',
    tipo: 'ruido',
    filtro: 'highpass',
    accentFrequency: 8000,
    regularFrequency: 7000,
    accentDuration: 0.06,
    regularDuration: 0.04,
    accentGain: 0.5,
    regularGain: 0.3,
    oscillatorType: 'square'
  },
  rimshot: {
    name: 'Rimshot',
    description: 'Sonido cortante y definido',
    accentFrequency: 1500,
    regularFrequency: 1100,
    accentDuration: 0.025,
    regularDuration: 0.018,
    accentGain: 0.28,
    regularGain: 0.14,
    oscillatorType: 'sawtooth'
  },
  softClick: {
    name: 'Click Suave',
    description: 'Sonido suave para práctica tranquila',
    accentFrequency: 600,
    regularFrequency: 500,
    accentDuration: 0.04,
    regularDuration: 0.025,
    accentGain: 0.2,
    regularGain: 0.1,
    oscillatorType: 'sine'
  },
  claves: {
    name: 'Claves',
    description: 'Dos palos de madera: seco y agudo',
    accentFrequency: 2500,
    regularFrequency: 2100,
    accentDuration: 0.03,
    regularDuration: 0.022,
    accentGain: 0.32,
    regularGain: 0.18,
    oscillatorType: 'sine'
  },
  cencerro: {
    name: 'Cencerro',
    description: 'Metálico, se oye sobre la banda',
    tipo: 'cencerro',
    accentFrequency: 800,
    regularFrequency: 680,
    accentDuration: 0.25,
    regularDuration: 0.15,
    accentGain: 0.3,
    regularGain: 0.17,
    oscillatorType: 'square'
  },
  palmas: {
    name: 'Palmas',
    description: 'Una palmada',
    tipo: 'palmas',
    filtro: 'bandpass',
    accentFrequency: 1300,
    regularFrequency: 1100,
    accentDuration: 0.14,
    regularDuration: 0.1,
    accentGain: 0.7,
    regularGain: 0.4,
    oscillatorType: 'square'
  },
  bombo: {
    name: 'Bombo',
    description: 'Grave, se siente más que se oye',
    tipo: 'bombo',
    accentFrequency: 160,
    regularFrequency: 130,
    accentDuration: 0.3,
    regularDuration: 0.2,
    accentGain: 0.9,
    regularGain: 0.6,
    oscillatorType: 'sine'
  },
  electronico: {
    name: 'Electrónico',
    description: 'Pitido de metrónomo digital',
    accentFrequency: 1760,
    regularFrequency: 880,
    accentDuration: 0.06,
    regularDuration: 0.05,
    accentGain: 0.14,
    regularGain: 0.09,
    oscillatorType: 'square'
  }
};

class MetronomeEngine {
  constructor() {
    this.audioContext = null;
    this.masterGainNode = null;
    this.isPlaying = false;
    this.tempo = 120; // BPM
    this.timeSignature = TIME_SIGNATURES['4/4'];
    this.subdivision = 'quarter';
    // El tiempo acentuado, desde 1; 0 es sin acento
    this.acento = 1;
    // Tiempo del compás en curso, click dentro de ese tiempo y cuándo empezó
    this.currentBeat = 0;
    this.paso = 0;
    this.inicioDelTiempo = 0.0;
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.1; // Schedule 100ms ahead
    this.schedulerInterval = 25; // Check every 25ms
    this.schedulerTimer = null;
    this.onBeatCallback = null;
    this.onMeasureCompleteCallback = null;

    // Volume (0-1)
    this.volume = 0.7;

    // Sound preset
    this.soundPreset = 'classic';
    this.tipo = 'oscilador';
    this.filtro = null;
    this.bufferRuido = null;
    this.oscillatorType = SOUND_PRESETS.classic.oscillatorType;

    // Sound parameters (initialized from classic preset)
    this.accentFrequency = SOUND_PRESETS.classic.accentFrequency;
    this.regularFrequency = SOUND_PRESETS.classic.regularFrequency;
    this.accentDuration = SOUND_PRESETS.classic.accentDuration;
    this.regularDuration = SOUND_PRESETS.classic.regularDuration;
    this.accentGain = SOUND_PRESETS.classic.accentGain;
    this.regularGain = SOUND_PRESETS.classic.regularGain;

    // Measure tracking (for tempo trainer)
    this.measureCount = 0;
  }

  /**
   * Initialize or get audio context
   */
  init() {
    if (!this.audioContext) {
      this.audioContext = getAudioContext();
    }
    // Create master gain node if not exists
    if (!this.masterGainNode && this.audioContext) {
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.gain.value = this.volume;
      // Un limitador a la salida: deja subir el volumen sin que el bombo o
      // las palmas acentuadas distorsionen
      const limitador = this.audioContext.createDynamicsCompressor();
      limitador.threshold.value = -6;
      limitador.knee.value = 3;
      limitador.ratio.value = 12;
      limitador.attack.value = 0.001;
      limitador.release.value = 0.08;
      this.masterGainNode.connect(limitador);
      limitador.connect(this.audioContext.destination);
    }
    return this.audioContext;
  }

  /**
   * Set master volume (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGainNode) {
      this.masterGainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    }
  }

  /**
   * Get current volume
   */
  getVolume() {
    return this.volume;
  }

  /**
   * Set tempo in BPM
   */
  setTempo(bpm) {
    this.tempo = limitarBpm(bpm);
  }

  /**
   * Set time signature
   */
  setTimeSignature(timeSignature) {
    if (TIME_SIGNATURES[timeSignature]) {
      this.timeSignature = TIME_SIGNATURES[timeSignature];
      if (!this.isPlaying) {
        this.currentBeat = 0;
        this.paso = 0;
      } else if (this.currentBeat >= this.timeSignature.beats) {
        // Sonando, se sigue contando; si con el compás nuevo ya se pasó del
        // último tiempo, el siguiente es el 1
        this.currentBeat = 0;
      }
    }
  }

  /**
   * El tiempo que suena acentuado (desde 1), o 0 para que no se acentúe
   * ninguno. Se puede cambiar sonando: vale desde el siguiente click.
   */
  setAcento(acento) {
    const n = Number(acento);
    this.acento = Number.isInteger(n) && n >= 0 ? n : 1;
  }

  getAcento() {
    return this.acento;
  }

  /**
   * Set subdivision type
   */
  setSubdivision(subdivision) {
    if (SUBDIVISIONS[subdivision]) {
      this.subdivision = subdivision;
      // Si el patrón nuevo es más corto, se sigue desde el próximo tiempo
      if (this.paso >= SUBDIVISIONS[subdivision].pattern.length) this.paso = 0;
    }
  }

  /**
   * Set sound preset
   */
  setSoundPreset(presetId) {
    if (SOUND_PRESETS[presetId]) {
      const preset = SOUND_PRESETS[presetId];
      this.soundPreset = presetId;
      this.tipo = preset.tipo || 'oscilador';
      this.filtro = preset.filtro || null;
      this.oscillatorType = preset.oscillatorType;
      this.accentFrequency = preset.accentFrequency;
      this.regularFrequency = preset.regularFrequency;
      this.accentDuration = preset.accentDuration;
      this.regularDuration = preset.regularDuration;
      this.accentGain = preset.accentGain;
      this.regularGain = preset.regularGain;
    }
  }

  /**
   * Get current sound preset
   */
  getSoundPreset() {
    return this.soundPreset;
  }

  /**
   * Play a test sound with current preset
   */
  async playTestSound() {
    this.init();
    await resumeAudioContext();
    // El acento y un tiempo normal, para oír la diferencia
    const t = this.audioContext.currentTime + 0.05;
    this.scheduleNote(t, 'acento');
    this.scheduleNote(t + 0.4, 'pulso');
  }

  /**
   * Calculate the time between beats in seconds
   */
  getSecondPerBeat() {
    // El BPM cuenta los tiempos que se ven: negras en x/4, negras con puntillo
    // en 6/8, 9/8 y 12/8, corcheas en 7/8
    return 60.0 / this.tempo;
  }

  /**
   * Programa un click. `nivel` es 'acento', 'pulso' o 'subdivision'
   * (`nivelDelClick`); por compatibilidad, `true` cuenta como acento.
   */
  scheduleNote(time, nivel = 'pulso') {
    if (nivel === true) nivel = 'acento';
    if (nivel === false) nivel = 'pulso';
    const ctx = this.audioContext;
    const acento = nivel === 'acento';
    const frecuencia = acento ? this.accentFrequency : this.regularFrequency;
    const duracion = acento ? this.accentDuration : this.regularDuration;
    const ganancia = REFUERZO * (nivel === 'subdivision'
      ? this.regularGain * 0.5
      : (acento ? this.accentGain : this.regularGain));

    // La envolvente: sube de golpe y se apaga
    const envolvente = ctx.createGain();
    envolvente.gain.setValueAtTime(0, time);
    envolvente.gain.linearRampToValueAtTime(ganancia, time + 0.001);
    envolvente.gain.exponentialRampToValueAtTime(0.001, time + duracion);
    envolvente.connect(this.masterGainNode || ctx.destination);

    if (this.tipo === 'ruido' || this.tipo === 'palmas') {
      this.sonarRuido(time, frecuencia, duracion, envolvente, ganancia);
    } else if (this.tipo === 'cencerro') {
      // Dos cuadradas desafinadas entre sí, por un paso banda: el cencerro
      // de las cajas de ritmo
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'bandpass';
      filtro.frequency.value = frecuencia * 1.4;
      filtro.Q.value = 1.2;
      filtro.connect(envolvente);
      for (const f of [frecuencia, frecuencia * 1.48]) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        osc.connect(filtro);
        osc.start(time);
        osc.stop(time + duracion);
      }
    } else if (this.tipo === 'bombo') {
      // Una senoidal que cae de tono muy deprisa
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frecuencia, time);
      osc.frequency.exponentialRampToValueAtTime(45, time + duracion * 0.5);
      osc.connect(envolvente);
      osc.start(time);
      osc.stop(time + duracion);
    } else {
      const osc = ctx.createOscillator();
      osc.type = this.oscillatorType;
      osc.frequency.value = frecuencia;
      osc.connect(envolvente);
      osc.start(time);
      osc.stop(time + duracion);
    }
  }

  // Ruido blanco filtrado (hi-hat, palmas). Las palmas repiten el golpe tres
  // veces muy seguidas, que es lo que las distingue de un golpe de ruido
  sonarRuido(time, frecuencia, duracion, envolvente, ganancia) {
    const ctx = this.audioContext;
    if (!this.bufferRuido || this.bufferRuido.sampleRate !== ctx.sampleRate) {
      const largo = Math.floor(ctx.sampleRate * 0.5);
      this.bufferRuido = ctx.createBuffer(1, largo, ctx.sampleRate);
      const datos = this.bufferRuido.getChannelData(0);
      for (let i = 0; i < largo; i++) datos[i] = Math.random() * 2 - 1;
    }
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.bufferRuido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = this.filtro || 'highpass';
    filtro.frequency.value = frecuencia;
    if (this.tipo === 'palmas') {
      filtro.Q.value = 0.9;
      envolvente.gain.cancelScheduledValues(time);
      envolvente.gain.setValueAtTime(0, time);
      for (const d of [0, 0.011, 0.022]) {
        envolvente.gain.setValueAtTime(ganancia, time + d);
        envolvente.gain.exponentialRampToValueAtTime(ganancia * 0.3, time + d + 0.009);
      }
      envolvente.gain.exponentialRampToValueAtTime(0.001, time + duracion);
    }
    fuente.connect(filtro);
    filtro.connect(envolvente);
    fuente.start(time);
    fuente.stop(time + duracion);
  }

  /**
   * Avanza al siguiente click del patrón: dentro del tiempo o, al acabarlo,
   * al primero del tiempo siguiente
   */
  nextNote() {
    const patron = SUBDIVISIONS[this.subdivision].pattern;
    const segundosPorTiempo = this.getSecondPerBeat();

    this.paso++;
    if (this.paso >= patron.length) {
      this.paso = 0;
      this.inicioDelTiempo += segundosPorTiempo;
      this.currentBeat++;
    }
    this.nextNoteTime = this.inicioDelTiempo + patron[this.paso] * segundosPorTiempo;

    if (this.currentBeat >= this.timeSignature.beats) {
      this.currentBeat = 0;
      this.measureCount++;

      // Notify measure complete callback (for tempo trainer)
      if (this.onMeasureCompleteCallback) {
        const delay = (this.nextNoteTime - this.audioContext.currentTime) * 1000;
        setTimeout(() => {
          if (this.onMeasureCompleteCallback) {
            this.onMeasureCompleteCallback(this.measureCount);
          }
        }, Math.max(0, delay));
      }
    }
  }

  /**
   * Set callback for measure completion (used by tempo trainer)
   */
  setOnMeasureComplete(callback) {
    this.onMeasureCompleteCallback = callback;
  }

  /**
   * Get current measure count
   */
  getMeasureCount() {
    return this.measureCount;
  }

  /**
   * Reset measure count
   */
  resetMeasureCount() {
    this.measureCount = 0;
  }

  /**
   * Scheduler - called at regular intervals to schedule upcoming notes
   */
  scheduler() {
    // Schedule all notes that need to play before next scheduler call
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      const nivel = nivelDelClick(this.currentBeat, this.paso, this.acento);
      this.scheduleNote(this.nextNoteTime, nivel);

      // Las luces, solo en los tiempos (no en las subdivisiones)
      if (this.onBeatCallback && this.paso === 0) {
        const tiempo = this.currentBeat;
        const delay = (this.nextNoteTime - this.audioContext.currentTime) * 1000;
        setTimeout(() => {
          if (this.onBeatCallback) {
            this.onBeatCallback(tiempo, this.timeSignature.beats);
          }
        }, delay);
      }

      this.nextNote();
    }
  }

  /**
   * Start the metronome
   */
  async start(onBeatCallback = null) {
    if (this.isPlaying) return;

    // Initialize audio context
    this.init();

    // Resume audio context if suspended (browser autoplay policy)
    await resumeAudioContext();

    this.isPlaying = true;
    this.onBeatCallback = onBeatCallback;
    this.currentBeat = 0;
    this.paso = 0;
    this.inicioDelTiempo = this.audioContext.currentTime + 0.05; // Start slightly in the future
    this.nextNoteTime = this.inicioDelTiempo;

    // Start the scheduler
    this.schedulerTimer = setInterval(() => {
      this.scheduler();
    }, this.schedulerInterval);
  }

  /**
   * Stop the metronome
   */
  stop() {
    if (!this.isPlaying) return;

    this.isPlaying = false;

    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }

    this.currentBeat = 0;
    this.paso = 0;
    this.measureCount = 0;

    if (this.onBeatCallback) {
      this.onBeatCallback(0, this.timeSignature.beats);
    }
  }

  /**
   * Toggle play/pause
   */
  async toggle(onBeatCallback = null) {
    if (this.isPlaying) {
      this.stop();
    } else {
      await this.start(onBeatCallback);
    }
  }

  /**
   * Check if metronome is currently playing
   */
  getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * Get current tempo
   */
  getTempo() {
    return this.tempo;
  }

  /**
   * Get current time signature
   */
  getTimeSignature() {
    return this.timeSignature;
  }

  /**
   * Get current subdivision
   */
  getSubdivision() {
    return this.subdivision;
  }
}

export default MetronomeEngine;

// packages/core/src/audio/pitchDetection.js

/**
 * Detección de la altura de una nota: el método de McLeod (MPM), calculado
 * con FFT.
 *
 * Lo que había antes era una autocorrelación directa, con un doble bucle sobre
 * 8192 muestras: 20 ms por cuadro en un PC (en una tablet, bastante más), así
 * que la aguja no podía ir a 60 fps. Además se quedaba con el retardo de mayor
 * correlación, que muchas veces es el doble del periodo (una octava abajo), y
 * sin interpolar: a 440 Hz el paso entre dos retardos vecinos son ~16 cents.
 *
 * MPM usa la función de diferencia cuadrática normalizada (NSDF), que vale 1
 * en un periodo perfecto, se queda con el **primer** pico que llega al 93% del
 * más alto (el periodo, no sus múltiplos) y afina su posición con una
 * parábola, así que la lectura no va a escalones. La autocorrelación sale de
 * una FFT: O(n log n) en vez de O(n²).
 *
 * McLeod y Wyvill, "A smarter way to find pitch" (2005).
 */

// Por debajo de esta energía se considera silencio
const UMBRAL_RMS = 0.008;
// El primer pico que llegue a esta fracción del más alto es el periodo
const K_PICO = 0.93;
// Por debajo de esta claridad (el valor del pico, de 0 a 1) no hay una nota
// clara: ruido, una consonante, el golpe de lengua
const CLARIDAD_MINIMA = 0.8;
const FRECUENCIA_MINIMA = 27.5; // LA0
const FRECUENCIA_MAXIMA = 4200; // DO8

/**
 * FFT compleja en el sitio (radix 2), sobre arrays reutilizables.
 */
class FFT {
  constructor(n) {
    this.n = n;
    this.cos = new Float64Array(n / 2);
    this.sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n);
      this.sin[i] = Math.sin((2 * Math.PI * i) / n);
    }
    this.inverso = new Uint32Array(n);
    const bits = Math.log2(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      this.inverso[i] = r;
    }
  }

  /** Transforma `re`/`im`; con `inversa`, la inversa sin dividir por n */
  transformar(re, im, inversa = false) {
    const { n, inverso } = this;
    for (let i = 0; i < n; i++) {
      const j = inverso[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    const signo = inversa ? 1 : -1;
    for (let tam = 2; tam <= n; tam <<= 1) {
      const mitad = tam >> 1;
      const paso = n / tam;
      for (let inicio = 0; inicio < n; inicio += tam) {
        for (let k = 0; k < mitad; k++) {
          const wr = this.cos[k * paso];
          const wi = signo * this.sin[k * paso];
          const a = inicio + k;
          const b = a + mitad;
          const xr = re[b] * wr - im[b] * wi;
          const xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  }
}

/**
 * Detector reutilizable para un tamaño de ventana: guarda la FFT y los
 * arrays, para no crear memoria nueva 60 veces por segundo.
 */
export class DetectorDeTono {
  constructor(tamano) {
    this.tamano = tamano;
    this.fft = new FFT(tamano * 2);
    this.re = new Float64Array(tamano * 2);
    this.im = new Float64Array(tamano * 2);
    this.nsdf = new Float64Array(tamano / 2);
  }

  /**
   * @param {Float32Array} buffer - Muestras en el dominio del tiempo
   * @param {number} sampleRate
   * @returns {{ frecuencia: number, claridad: number, rms: number } | null}
   */
  detectar(buffer, sampleRate) {
    const n = Math.min(buffer.length, this.tamano);
    const desde = buffer.length - n; // las más recientes

    // Media (para quitar la componente continua) y energía
    let media = 0;
    for (let i = 0; i < n; i++) media += buffer[desde + i];
    media /= n;
    let energia = 0;
    for (let i = 0; i < n; i++) {
      const v = buffer[desde + i] - media;
      energia += v * v;
    }
    const rms = Math.sqrt(energia / n);
    if (rms < UMBRAL_RMS) return null;

    // Autocorrelación por FFT: |X|² y vuelta, con relleno de ceros al doble
    const { re, im, nsdf } = this;
    const m = this.fft.n;
    for (let i = 0; i < m; i++) {
      re[i] = i < n ? buffer[desde + i] - media : 0;
      im[i] = 0;
    }
    this.fft.transformar(re, im);
    for (let i = 0; i < m; i++) {
      re[i] = re[i] * re[i] + im[i] * im[i];
      im[i] = 0;
    }
    this.fft.transformar(re, im, true);
    // re[τ] / m es ahora la autocorrelación r(τ)

    // NSDF: n(τ) = 2 r(τ) / m(τ), con m(τ) = Σ x[j]² + x[j+τ]² incremental
    const maxRetardo = Math.min(nsdf.length, Math.floor(sampleRate / FRECUENCIA_MINIMA));
    let suma = 2 * energia;
    for (let tau = 0; tau < maxRetardo; tau++) {
      if (tau > 0) {
        const a = buffer[desde + tau - 1] - media;
        const b = buffer[desde + n - tau] - media;
        suma -= a * a + b * b;
      }
      nsdf[tau] = suma > 0 ? (2 * re[tau]) / m / suma : 0;
    }

    // Los picos entre cada cruce por cero hacia arriba y el siguiente hacia
    // abajo, empezando tras el primer tramo negativo (el lóbulo de τ = 0)
    const minRetardo = Math.max(2, Math.floor(sampleRate / FRECUENCIA_MAXIMA));
    let tau = 1;
    while (tau < maxRetardo && nsdf[tau] > 0) tau++;
    const picos = [];
    let mejor = 0;
    while (tau < maxRetardo - 1) {
      while (tau < maxRetardo - 1 && nsdf[tau] <= 0) tau++;
      let pico = -1;
      while (tau < maxRetardo - 1 && nsdf[tau] > 0) {
        if (tau >= minRetardo && (pico < 0 || nsdf[tau] > nsdf[pico])) pico = tau;
        tau++;
      }
      if (pico > 0 && nsdf[pico] >= nsdf[pico - 1] && nsdf[pico] >= nsdf[pico + 1]) {
        picos.push(pico);
        if (nsdf[pico] > mejor) mejor = nsdf[pico];
      }
    }
    if (!picos.length || mejor < CLARIDAD_MINIMA) return null;

    const elegido = picos.find((p) => nsdf[p] >= K_PICO * mejor);

    // Vértice de la parábola por el pico y sus vecinos
    const y0 = nsdf[elegido - 1];
    const y1 = nsdf[elegido];
    const y2 = nsdf[elegido + 1];
    const curvatura = y0 - 2 * y1 + y2;
    const desplazamiento = curvatura !== 0 ? (0.5 * (y0 - y2)) / curvatura : 0;
    const periodo = elegido + desplazamiento;
    const claridad = Math.min(1, y1 - 0.25 * (y0 - y2) * desplazamiento);

    const frecuencia = sampleRate / periodo;
    if (frecuencia < FRECUENCIA_MINIMA || frecuencia > FRECUENCIA_MAXIMA) return null;
    return { frecuencia, claridad, rms };
  }
}

const detectores = new Map();

/**
 * Detects pitch from audio buffer
 * @param {Float32Array} buffer - Audio buffer from AnalyserNode
 * @param {number} sampleRate - Sample rate of the audio context
 * @returns {number|null} - Detected frequency in Hz, or null if no clear pitch
 */
export function detectPitch(buffer, sampleRate) {
  // La FFT pide una potencia de 2
  const tamano = 2 ** Math.floor(Math.log2(buffer.length));
  if (!detectores.has(tamano)) detectores.set(tamano, new DetectorDeTono(tamano));
  return detectores.get(tamano).detectar(buffer, sampleRate)?.frecuencia ?? null;
}

/**
 * Convert frequency to nearest MIDI note number
 * @param {number} frequency - Frequency in Hz
 * @param {number} referenceFreq - El LA4 del diapasón (440 por defecto)
 * @returns {number} - MIDI note number (0-127)
 */
export function frequencyToMidi(frequency, referenceFreq = 440) {
  return Math.round(12 * Math.log2(frequency / referenceFreq) + 69);
}

/**
 * Convert MIDI note to frequency
 * @param {number} midiNote - MIDI note number
 * @param {number} referenceFreq - Reference frequency (default A4 = 440 Hz)
 * @returns {number} - Frequency in Hz
 */
export function midiToFrequency(midiNote, referenceFreq = 440) {
  return referenceFreq * Math.pow(2, (midiNote - 69) / 12);
}

/**
 * Get note name from MIDI number
 * @param {number} midiNote - MIDI note number
 * @returns {string} - Note name (e.g., "C4", "F#5")
 */
export function midiToNoteName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

/**
 * Get note name in Latin notation
 * @param {number} midiNote - MIDI note number
 * @returns {string} - Note name (e.g., "DO4", "FA#5")
 */
export function midiToNoteNameLatin(midiNote) {
  const noteNames = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

/**
 * Calculate cents deviation from target frequency
 * Cents are a logarithmic unit of measure used for musical intervals
 * 100 cents = 1 semitone
 *
 * Sin redondear: con `Math.floor` todo salía hasta un cent más bajo, y la
 * aguja se movía a saltos de un cent. Se redondea solo al escribirlo.
 *
 * @param {number} frequency - Detected frequency
 * @param {number} targetFrequency - Target frequency
 * @returns {number} - Cents deviation (-50 to +50 typically)
 */
export function getCentsDeviation(frequency, targetFrequency) {
  return 1200 * Math.log2(frequency / targetFrequency);
}

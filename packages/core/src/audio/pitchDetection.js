// packages/core/src/audio/pitchDetection.js

/**
 * Pitch Detection using Autocorrelation Algorithm
 * Based on the McLeod Pitch Method (MPM)
 *
 * This algorithm is more accurate for musical notes than FFT-based methods
 * as it handles harmonics and overtones better.
 */

/**
 * Detects pitch from audio buffer using autocorrelation
 * @param {Float32Array} buffer - Audio buffer from AnalyserNode
 * @param {number} sampleRate - Sample rate of the audio context
 * @returns {number|null} - Detected frequency in Hz, or null if no clear pitch
 */
export function detectPitch(buffer, sampleRate) {
  // Apply noise gate - ignore signals below threshold
  const rms = getRMS(buffer);
  const noiseThreshold = 0.01; // Adjust based on testing

  if (rms < noiseThreshold) {
    return null; // Signal too weak
  }

  // Apply autocorrelation
  const correlations = autoCorrelate(buffer, sampleRate);

  if (!correlations) {
    return null; // No clear pitch detected
  }

  return correlations.frequency;
}

/**
 * Calculate Root Mean Square (RMS) of buffer
 * Used for noise gate
 */
function getRMS(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Autocorrelation algorithm for pitch detection
 * @param {Float32Array} buffer - Audio buffer
 * @param {number} sampleRate - Sample rate
 * @returns {Object|null} - Object with frequency and clarity, or null
 */
function autoCorrelate(buffer, sampleRate) {
  const SIZE = buffer.length;
  const maxSamples = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let rms = 0;

  // Calculate RMS
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) {
    return null; // Signal too weak
  }

  // Find the last zero crossing before the peak
  let lastCorrelation = 1;
  for (let offset = 1; offset < maxSamples; offset++) {
    let correlation = 0;

    for (let i = 0; i < maxSamples; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }

    correlation = 1 - (correlation / maxSamples);

    // Store the best correlation
    if (correlation > 0.9 && correlation > lastCorrelation) {
      const foundGoodCorrelation = correlation > bestCorrelation;

      if (foundGoodCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }

    lastCorrelation = correlation;
  }

  if (bestCorrelation > 0.01 && bestOffset !== -1) {
    const frequency = sampleRate / bestOffset;

    // Filter out unrealistic frequencies for musical instruments
    // Human hearing: 20 Hz - 20,000 Hz
    // Musical instruments: typically 27.5 Hz (A0) - 4,186 Hz (C8)
    if (frequency >= 20 && frequency <= 5000) {
      return {
        frequency: frequency,
        clarity: bestCorrelation
      };
    }
  }

  return null;
}

/**
 * Convert frequency to nearest MIDI note number
 * @param {number} frequency - Frequency in Hz
 * @returns {number} - MIDI note number (0-127)
 */
export function frequencyToMidi(frequency) {
  return Math.round(12 * Math.log2(frequency / 440) + 69);
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
 * @param {number} frequency - Detected frequency
 * @param {number} targetFrequency - Target frequency
 * @returns {number} - Cents deviation (-50 to +50 typically)
 */
export function getCentsDeviation(frequency, targetFrequency) {
  return Math.floor(1200 * Math.log2(frequency / targetFrequency));
}

/**
 * Smooth pitch detection results to reduce jitter
 * Uses a running average of the last N detections
 */
export class PitchSmoother {
  constructor(bufferSize = 5) {
    this.bufferSize = bufferSize;
    this.buffer = [];
  }

  /**
   * Add a new frequency reading and get smoothed result
   * @param {number|null} frequency - Detected frequency
   * @returns {number|null} - Smoothed frequency
   */
  addReading(frequency) {
    if (frequency === null) {
      // If we get null, clear the buffer
      this.buffer = [];
      return null;
    }

    this.buffer.push(frequency);

    // Keep buffer at max size
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Need minimum readings for stability
    if (this.buffer.length < 3) {
      return null;
    }

    // Calculate median instead of mean to be more robust to outliers
    const sorted = [...this.buffer].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Reset the smoother
   */
  reset() {
    this.buffer = [];
  }
}

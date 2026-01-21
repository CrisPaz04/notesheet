/**
 * Note to Frequency Mappings
 *
 * Provides utilities for converting between musical notes and frequencies
 * using the 12-tone equal temperament system with A4 = 440 Hz as standard.
 */

// Standard reference frequency (A4)
export const A4_FREQUENCY = 440;

// MIDI note number for A4
const A4_MIDI = 69;

// Note names in chromatic scale
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const NOTE_NAMES_LATIN = ['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI'];

/**
 * Convert MIDI note number to frequency in Hz
 * @param {number} midiNote - MIDI note number (0-127, middle C = 60, A4 = 69)
 * @param {number} referenceFreq - Reference frequency for A4 (default 440 Hz)
 * @returns {number} Frequency in Hz
 */
export const midiToFrequency = (midiNote, referenceFreq = A4_FREQUENCY) => {
  return referenceFreq * Math.pow(2, (midiNote - A4_MIDI) / 12);
};

/**
 * Convert frequency in Hz to MIDI note number
 * @param {number} frequency - Frequency in Hz
 * @param {number} referenceFreq - Reference frequency for A4 (default 440 Hz)
 * @returns {number} MIDI note number
 */
export const frequencyToMidi = (frequency, referenceFreq = A4_FREQUENCY) => {
  return Math.round(12 * Math.log2(frequency / referenceFreq) + A4_MIDI);
};

/**
 * Get note name from MIDI number
 * @param {number} midiNote - MIDI note number
 * @param {boolean} useLatin - Use Latin notation (DO, RE, MI) instead of English (C, D, E)
 * @returns {string} Note name with octave (e.g., 'C4', 'A#5')
 */
export const midiToNoteName = (midiNote, useLatin = false) => {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  const noteNames = useLatin ? NOTE_NAMES_LATIN : NOTE_NAMES;
  return `${noteNames[noteIndex]}${octave}`;
};

/**
 * Get note name from frequency
 * @param {number} frequency - Frequency in Hz
 * @param {boolean} useLatin - Use Latin notation
 * @param {number} referenceFreq - Reference frequency for A4
 * @returns {string} Note name with octave
 */
export const frequencyToNoteName = (frequency, useLatin = false, referenceFreq = A4_FREQUENCY) => {
  const midi = frequencyToMidi(frequency, referenceFreq);
  return midiToNoteName(midi, useLatin);
};

/**
 * Calculate cents deviation from nearest note
 * Cents are 1/100th of a semitone
 * @param {number} frequency - Detected frequency in Hz
 * @param {number} referenceFreq - Reference frequency for A4
 * @returns {object} { note: string, cents: number, targetFrequency: number }
 */
export const getCentsDeviation = (frequency, referenceFreq = A4_FREQUENCY) => {
  const midi = frequencyToMidi(frequency, referenceFreq);
  const targetFrequency = midiToFrequency(midi, referenceFreq);
  const cents = Math.floor(1200 * Math.log2(frequency / targetFrequency));

  return {
    note: midiToNoteName(midi),
    noteLatin: midiToNoteName(midi, true),
    cents,
    targetFrequency,
    midiNote: midi
  };
};

/**
 * Get note name without octave
 * @param {number} midiNote - MIDI note number
 * @param {boolean} useLatin - Use Latin notation
 * @returns {string} Note name without octave (e.g., 'C', 'A#')
 */
export const getNoteNameOnly = (midiNote, useLatin = false) => {
  const noteIndex = midiNote % 12;
  const noteNames = useLatin ? NOTE_NAMES_LATIN : NOTE_NAMES;
  return noteNames[noteIndex];
};

/**
 * Convert note name to MIDI number
 * @param {string} noteName - Note name with octave (e.g., 'C4', 'A#5')
 * @returns {number} MIDI note number
 */
export const noteNameToMidi = (noteName) => {
  // Extract note and octave from string like "C4" or "A#5"
  const match = noteName.match(/^([A-G]#?)(\d+)$/i);

  if (!match) {
    throw new Error(`Formato de nota inválido: ${noteName}`);
  }

  const note = match[1].toUpperCase();
  const octave = parseInt(match[2]);

  const noteIndex = NOTE_NAMES.indexOf(note);

  if (noteIndex === -1) {
    throw new Error(`Nota no encontrada: ${note}`);
  }

  return (octave + 1) * 12 + noteIndex;
};

/**
 * Convert note name to frequency
 * @param {string} noteName - Note name with octave (e.g., 'C4', 'A#5')
 * @param {number} referenceFreq - Reference frequency for A4
 * @returns {number} Frequency in Hz
 */
export const noteNameToFrequency = (noteName, referenceFreq = A4_FREQUENCY) => {
  const midi = noteNameToMidi(noteName);
  return midiToFrequency(midi, referenceFreq);
};

/**
 * Generate array of all chromatic notes in a range
 * @param {number} startMidi - Starting MIDI note
 * @param {number} endMidi - Ending MIDI note
 * @param {boolean} useLatin - Use Latin notation
 * @returns {Array} Array of note names
 */
export const getChromaticScale = (startMidi = 21, endMidi = 108, useLatin = false) => {
  const notes = [];

  for (let midi = startMidi; midi <= endMidi; midi++) {
    notes.push(midiToNoteName(midi, useLatin));
  }

  return notes;
};

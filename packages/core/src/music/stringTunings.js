/**
 * String Tunings Definitions
 *
 * Tuning data for common stringed instruments
 * Each string includes note name, MIDI number, and frequency
 */

// Reference: A4 = 440 Hz
const A4_FREQ = 440;
const A4_MIDI = 69;

/**
 * Convert MIDI note to frequency
 */
function midiToFreq(midi, referenceFreq = A4_FREQ) {
  return referenceFreq * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * String tuning definitions
 * Each string object contains:
 * - note: Note name in English notation (e.g., "E4")
 * - noteLatin: Note name in Latin notation (e.g., "Mi4")
 * - midi: MIDI note number
 * - freq: Frequency at A4=440Hz (calculated at runtime if needed)
 */
export const STRING_TUNINGS = {
  guitar_standard: {
    id: 'guitar_standard',
    name: 'Guitarra Estándar',
    instrument: 'guitar',
    strings: [
      { note: 'E4', noteLatin: 'Mi4', midi: 64 },
      { note: 'B3', noteLatin: 'Si3', midi: 59 },
      { note: 'G3', noteLatin: 'Sol3', midi: 55 },
      { note: 'D3', noteLatin: 'Re3', midi: 50 },
      { note: 'A2', noteLatin: 'La2', midi: 45 },
      { note: 'E2', noteLatin: 'Mi2', midi: 40 }
    ]
  },

  guitar_drop_d: {
    id: 'guitar_drop_d',
    name: 'Guitarra Drop D',
    instrument: 'guitar',
    strings: [
      { note: 'E4', noteLatin: 'Mi4', midi: 64 },
      { note: 'B3', noteLatin: 'Si3', midi: 59 },
      { note: 'G3', noteLatin: 'Sol3', midi: 55 },
      { note: 'D3', noteLatin: 'Re3', midi: 50 },
      { note: 'A2', noteLatin: 'La2', midi: 45 },
      { note: 'D2', noteLatin: 'Re2', midi: 38 }
    ]
  },

  guitar_half_step_down: {
    id: 'guitar_half_step_down',
    name: 'Guitarra ½ Tono Abajo',
    instrument: 'guitar',
    strings: [
      { note: 'Eb4', noteLatin: 'Mib4', midi: 63 },
      { note: 'Bb3', noteLatin: 'Sib3', midi: 58 },
      { note: 'Gb3', noteLatin: 'Solb3', midi: 54 },
      { note: 'Db3', noteLatin: 'Reb3', midi: 49 },
      { note: 'Ab2', noteLatin: 'Lab2', midi: 44 },
      { note: 'Eb2', noteLatin: 'Mib2', midi: 39 }
    ]
  },

  bass_standard: {
    id: 'bass_standard',
    name: 'Bajo Estándar (4 cuerdas)',
    instrument: 'bass',
    strings: [
      { note: 'G2', noteLatin: 'Sol2', midi: 43 },
      { note: 'D2', noteLatin: 'Re2', midi: 38 },
      { note: 'A1', noteLatin: 'La1', midi: 33 },
      { note: 'E1', noteLatin: 'Mi1', midi: 28 }
    ]
  },

  bass_5_string: {
    id: 'bass_5_string',
    name: 'Bajo 5 Cuerdas',
    instrument: 'bass',
    strings: [
      { note: 'G2', noteLatin: 'Sol2', midi: 43 },
      { note: 'D2', noteLatin: 'Re2', midi: 38 },
      { note: 'A1', noteLatin: 'La1', midi: 33 },
      { note: 'E1', noteLatin: 'Mi1', midi: 28 },
      { note: 'B0', noteLatin: 'Si0', midi: 23 }
    ]
  },

  ukulele_standard: {
    id: 'ukulele_standard',
    name: 'Ukulele Estándar',
    instrument: 'ukulele',
    strings: [
      { note: 'A4', noteLatin: 'La4', midi: 69 },
      { note: 'E4', noteLatin: 'Mi4', midi: 64 },
      { note: 'C4', noteLatin: 'Do4', midi: 60 },
      { note: 'G4', noteLatin: 'Sol4', midi: 67 }
    ]
  },

  violin_standard: {
    id: 'violin_standard',
    name: 'Violín Estándar',
    instrument: 'violin',
    strings: [
      { note: 'E5', noteLatin: 'Mi5', midi: 76 },
      { note: 'A4', noteLatin: 'La4', midi: 69 },
      { note: 'D4', noteLatin: 'Re4', midi: 62 },
      { note: 'G3', noteLatin: 'Sol3', midi: 55 }
    ]
  },

  viola_standard: {
    id: 'viola_standard',
    name: 'Viola Estándar',
    instrument: 'viola',
    strings: [
      { note: 'A4', noteLatin: 'La4', midi: 69 },
      { note: 'D4', noteLatin: 'Re4', midi: 62 },
      { note: 'G3', noteLatin: 'Sol3', midi: 55 },
      { note: 'C3', noteLatin: 'Do3', midi: 48 }
    ]
  },

  cello_standard: {
    id: 'cello_standard',
    name: 'Violonchelo Estándar',
    instrument: 'cello',
    strings: [
      { note: 'A3', noteLatin: 'La3', midi: 57 },
      { note: 'D3', noteLatin: 'Re3', midi: 50 },
      { note: 'G2', noteLatin: 'Sol2', midi: 43 },
      { note: 'C2', noteLatin: 'Do2', midi: 36 }
    ]
  },

  mandolin_standard: {
    id: 'mandolin_standard',
    name: 'Mandolina Estándar',
    instrument: 'mandolin',
    strings: [
      { note: 'E5', noteLatin: 'Mi5', midi: 76 },
      { note: 'A4', noteLatin: 'La4', midi: 69 },
      { note: 'D4', noteLatin: 'Re4', midi: 62 },
      { note: 'G3', noteLatin: 'Sol3', midi: 55 }
    ]
  },

  banjo_standard: {
    id: 'banjo_standard',
    name: 'Banjo 5 Cuerdas',
    instrument: 'banjo',
    strings: [
      { note: 'D4', noteLatin: 'Re4', midi: 62 },
      { note: 'B3', noteLatin: 'Si3', midi: 59 },
      { note: 'G3', noteLatin: 'Sol3', midi: 55 },
      { note: 'D3', noteLatin: 'Re3', midi: 50 },
      { note: 'G4', noteLatin: 'Sol4', midi: 67 } // 5th string (short)
    ]
  }
};

/**
 * Get string tuning by ID
 */
export function getStringTuning(tuningId) {
  return STRING_TUNINGS[tuningId] || null;
}

/**
 * Get all tunings for a specific instrument type
 */
export function getTuningsForInstrument(instrument) {
  return Object.values(STRING_TUNINGS).filter(t => t.instrument === instrument);
}

/**
 * Get frequency for a string (considering reference frequency)
 */
export function getStringFrequency(midi, referenceFreq = A4_FREQ) {
  return midiToFreq(midi, referenceFreq);
}

/**
 * Check if detected pitch matches a target string (within tolerance)
 * @param {number} detectedMidi - Detected MIDI note
 * @param {number} targetMidi - Target string MIDI note
 * @param {number} centsDeviation - Deviation in cents
 * @param {number} tolerance - Tolerance in cents (default 50)
 * @returns {boolean}
 */
export function isStringMatch(detectedMidi, targetMidi, centsDeviation, tolerance = 50) {
  if (detectedMidi !== targetMidi) return false;
  return Math.abs(centsDeviation) <= tolerance;
}

/**
 * Get the closest string to a detected frequency
 * @param {number} detectedMidi - Detected MIDI note
 * @param {Array} strings - Array of string objects
 * @returns {Object|null} - Closest string or null
 */
export function findClosestString(detectedMidi, strings) {
  if (!strings || strings.length === 0) return null;

  let closest = null;
  let minDistance = Infinity;

  for (const string of strings) {
    const distance = Math.abs(string.midi - detectedMidi);
    if (distance < minDistance) {
      minDistance = distance;
      closest = string;
    }
  }

  // Only return if within reasonable range (1 octave)
  return minDistance <= 12 ? closest : null;
}

/**
 * Get instrument icon based on type
 */
export function getInstrumentIcon(instrument) {
  const icons = {
    guitar: 'bi-music-note',
    bass: 'bi-music-note-beamed',
    ukulele: 'bi-music-note',
    violin: 'bi-music-note-list',
    viola: 'bi-music-note-list',
    cello: 'bi-music-note-list',
    mandolin: 'bi-music-note',
    banjo: 'bi-music-note'
  };
  return icons[instrument] || 'bi-music-note';
}

export default STRING_TUNINGS;

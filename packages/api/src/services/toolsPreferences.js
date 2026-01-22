// packages/api/src/services/toolsPreferences.js
import { getUserPreferences, updateUserPreferences } from './user';

/**
 * Obtiene las preferencias del metrónomo del usuario
 * @param {string} userId - ID del usuario
 * @returns {Object} Objeto con las preferencias del metrónomo
 */
export const getMetronomePreferences = async (userId) => {
  try {
    const preferences = await getUserPreferences(userId);

    return {
      bpm: preferences.metronomeLastBPM || 120,
      timeSignature: preferences.metronomeLastTimeSignature || '4/4',
      subdivision: preferences.metronomeLastSubdivision || 'quarter',
      soundPreset: preferences.metronomeSoundPreset || 'classic'
    };
  } catch (error) {
    console.error("Error getting metronome preferences:", error);
    // Return defaults on error
    return {
      bpm: 120,
      timeSignature: '4/4',
      subdivision: 'quarter',
      soundPreset: 'classic'
    };
  }
};

/**
 * Guarda las preferencias del metrónomo del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} metronomePrefs - Objeto con las preferencias del metrónomo
 * @param {number} metronomePrefs.bpm - Tempo en BPM
 * @param {string} metronomePrefs.timeSignature - Compás (ej: '4/4')
 * @param {string} metronomePrefs.subdivision - Subdivisión (ej: 'quarter')
 * @returns {Object} Objeto con todas las preferencias actualizadas
 */
export const saveMetronomePreferences = async (userId, metronomePrefs) => {
  try {
    const preferencesToUpdate = {};

    if (metronomePrefs.bpm !== undefined) {
      preferencesToUpdate.metronomeLastBPM = metronomePrefs.bpm;
    }

    if (metronomePrefs.timeSignature !== undefined) {
      preferencesToUpdate.metronomeLastTimeSignature = metronomePrefs.timeSignature;
    }

    if (metronomePrefs.subdivision !== undefined) {
      preferencesToUpdate.metronomeLastSubdivision = metronomePrefs.subdivision;
    }

    if (metronomePrefs.soundPreset !== undefined) {
      preferencesToUpdate.metronomeSoundPreset = metronomePrefs.soundPreset;
    }

    return await updateUserPreferences(userId, preferencesToUpdate);
  } catch (error) {
    console.error("Error saving metronome preferences:", error);
    throw error;
  }
};

/**
 * Obtiene las preferencias del afinador del usuario
 * @param {string} userId - ID del usuario
 * @returns {Object} Objeto con las preferencias del afinador
 */
export const getTunerPreferences = async (userId) => {
  try {
    const preferences = await getUserPreferences(userId);

    return {
      referenceFrequency: preferences.tunerReferenceFrequency || 440,
      lastInstrument: preferences.tunerLastInstrument || 'bb_trumpet',
      showConcertPitch: preferences.tunerShowConcertPitch !== undefined
        ? preferences.tunerShowConcertPitch
        : true,
      stringModeEnabled: preferences.tunerStringModeEnabled || false,
      selectedTuning: preferences.tunerSelectedTuning || 'guitar_standard'
    };
  } catch (error) {
    console.error("Error getting tuner preferences:", error);
    // Return defaults on error
    return {
      referenceFrequency: 440,
      lastInstrument: 'bb_trumpet',
      showConcertPitch: true,
      stringModeEnabled: false,
      selectedTuning: 'guitar_standard'
    };
  }
};

/**
 * Guarda las preferencias del afinador del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} tunerPrefs - Objeto con las preferencias del afinador
 * @param {number} tunerPrefs.referenceFrequency - Frecuencia de referencia (A4)
 * @param {string} tunerPrefs.lastInstrument - Último instrumento seleccionado
 * @param {boolean} tunerPrefs.showConcertPitch - Mostrar tono de concierto
 * @returns {Object} Objeto con todas las preferencias actualizadas
 */
export const saveTunerPreferences = async (userId, tunerPrefs) => {
  try {
    const preferencesToUpdate = {};

    if (tunerPrefs.referenceFrequency !== undefined) {
      preferencesToUpdate.tunerReferenceFrequency = tunerPrefs.referenceFrequency;
    }

    if (tunerPrefs.lastInstrument !== undefined) {
      preferencesToUpdate.tunerLastInstrument = tunerPrefs.lastInstrument;
    }

    if (tunerPrefs.showConcertPitch !== undefined) {
      preferencesToUpdate.tunerShowConcertPitch = tunerPrefs.showConcertPitch;
    }

    if (tunerPrefs.stringModeEnabled !== undefined) {
      preferencesToUpdate.tunerStringModeEnabled = tunerPrefs.stringModeEnabled;
    }

    if (tunerPrefs.selectedTuning !== undefined) {
      preferencesToUpdate.tunerSelectedTuning = tunerPrefs.selectedTuning;
    }

    return await updateUserPreferences(userId, preferencesToUpdate);
  } catch (error) {
    console.error("Error saving tuner preferences:", error);
    throw error;
  }
};

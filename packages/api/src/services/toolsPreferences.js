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
      soundPreset: preferences.metronomeSoundPreset || 'classic',
      // El volumen se guardaba en el dispositivo pero no en el perfil
      volume: typeof preferences.metronomeVolume === 'number' ? preferences.metronomeVolume : 0.7,
      // 0 es "sin acento", así que no vale `||`
      acento: Number.isInteger(preferences.metronomeAcento) ? preferences.metronomeAcento : 1
    };
  } catch (error) {
    console.error("Error getting metronome preferences:", error);
    // Return defaults on error
    return {
      bpm: 120,
      timeSignature: '4/4',
      subdivision: 'quarter',
      soundPreset: 'classic',
      volume: 0.7,
      acento: 1
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

    if (metronomePrefs.volume !== undefined) {
      preferencesToUpdate.metronomeVolume = metronomePrefs.volume;
    }

    if (metronomePrefs.acento !== undefined) {
      preferencesToUpdate.metronomeAcento = metronomePrefs.acento;
    }

    return await updateUserPreferences(userId, preferencesToUpdate);
  } catch (error) {
    console.error("Error saving metronome preferences:", error);
    throw error;
  }
};

/**
 * Obtiene las preferencias del afinador del usuario
 *
 * `verNotasComo` es el instrumento cuyas notas enseña (o "concierto"). Si el
 * músico no lo ha elegido en el afinador, el de su perfil: una trompeta
 * piensa en sus notas, no en las de concierto.
 *
 * @param {string} userId - ID del usuario
 * @returns {Object} Objeto con las preferencias del afinador
 */
export const getTunerPreferences = async (userId) => {
  try {
    const preferences = await getUserPreferences(userId);

    return {
      referenceFrequency: preferences.tunerReferenceFrequency || 440,
      verNotasComo: preferences.tunerVerNotasComo || preferences.defaultInstrument || 'concierto'
    };
  } catch (error) {
    console.error("Error getting tuner preferences:", error);
    // Return defaults on error
    return {
      referenceFrequency: 440,
      verNotasComo: 'concierto'
    };
  }
};

/**
 * Guarda las preferencias del afinador del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} tunerPrefs - Objeto con las preferencias del afinador
 * @param {number} tunerPrefs.referenceFrequency - Frecuencia de referencia (A4)
 * @param {string} tunerPrefs.verNotasComo - Instrumento cuyas notas enseña, o "concierto"
 * @returns {Object} Objeto con todas las preferencias actualizadas
 */
export const saveTunerPreferences = async (userId, tunerPrefs) => {
  try {
    const preferencesToUpdate = {};

    if (tunerPrefs.referenceFrequency !== undefined) {
      preferencesToUpdate.tunerReferenceFrequency = tunerPrefs.referenceFrequency;
    }

    if (tunerPrefs.verNotasComo !== undefined) {
      preferencesToUpdate.tunerVerNotasComo = tunerPrefs.verNotasComo;
    }

    return await updateUserPreferences(userId, preferencesToUpdate);
  } catch (error) {
    console.error("Error saving tuner preferences:", error);
    throw error;
  }
};

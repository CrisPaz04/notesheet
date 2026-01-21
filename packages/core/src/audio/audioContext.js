/**
 * Shared Audio Context Singleton
 *
 * Provides a single AudioContext instance for the entire application.
 * Handles browser autoplay policies and context suspension/resumption.
 */

let audioContextInstance = null;

/**
 * Get or create the shared AudioContext
 * @returns {AudioContext} The shared audio context
 */
export const getAudioContext = () => {
  // Create new context if it doesn't exist
  if (!audioContextInstance) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error('Web Audio API no está soportada en este navegador');
    }

    audioContextInstance = new AudioContextClass();
  }

  // Handle suspended state (browser autoplay policy)
  if (audioContextInstance.state === 'suspended') {
    audioContextInstance.resume().catch(err => {
      console.warn('No se pudo reanudar el AudioContext:', err);
    });
  }

  return audioContextInstance;
};

/**
 * Resume the audio context (call on user interaction)
 * @returns {Promise<void>}
 */
export const resumeAudioContext = async () => {
  const context = getAudioContext();

  if (context.state === 'suspended') {
    await context.resume();
  }
};

/**
 * Close and cleanup the audio context
 * Call this when the app is unmounting or audio is no longer needed
 */
export const closeAudioContext = () => {
  if (audioContextInstance) {
    audioContextInstance.close();
    audioContextInstance = null;
  }
};

/**
 * Get the current state of the audio context
 * @returns {AudioContextState|null} 'suspended' | 'running' | 'closed' | null
 */
export const getAudioContextState = () => {
  return audioContextInstance ? audioContextInstance.state : null;
};

// packages/core/src/audio/tunerEngine.js

import { getAudioContext } from './audioContext';
import { detectPitch, PitchSmoother } from './pitchDetection';

/**
 * TunerEngine Class
 *
 * Handles microphone input, pitch detection, and reference tone generation
 * Uses Web Audio API for real-time audio analysis
 */
class TunerEngine {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.mediaStream = null;
    this.dataArray = null;
    this.rafId = null;
    this.isRunning = false;
    this.pitchCallback = null;
    this.smoother = new PitchSmoother(5);
    this.referenceFrequency = 440; // A4 = 440 Hz

    // Reference tone generation
    this.oscillator = null;
    this.gainNode = null;
    this.isPlayingTone = false;
  }

  /**
   * Initialize the tuner with microphone access
   * @returns {Promise<void>}
   * @throws {Error} If microphone access is denied or not available
   */
  async initialize() {
    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          autoGainControl: false,
          noiseSuppression: false,
          latency: 0
        }
      });

      // Get audio context
      this.audioContext = getAudioContext();

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 8192; // Higher = better low-frequency resolution
      this.analyser.smoothingTimeConstant = 0.3;

      const bufferLength = this.analyser.fftSize;
      this.dataArray = new Float32Array(bufferLength);

      // Create microphone source
      this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.microphone.connect(this.analyser);

      // Don't connect analyser to destination (we don't want to hear the mic)

      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Permiso de micrófono denegado. Por favor, permite el acceso al micrófono en la configuración de tu navegador.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No se encontró ningún micrófono. Por favor, conecta un micrófono e intenta de nuevo.');
      } else {
        throw new Error('Error al acceder al micrófono: ' + error.message);
      }
    }
  }

  /**
   * Start pitch detection loop
   * @param {Function} callback - Called with pitch detection results
   */
  start(callback) {
    if (this.isRunning) return;

    this.isRunning = true;
    this.pitchCallback = callback;
    this.smoother.reset();
    this.detectPitchLoop();
  }

  /**
   * Stop pitch detection loop
   */
  stop() {
    this.isRunning = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.smoother.reset();
  }

  /**
   * Pitch detection loop (runs at ~60 FPS)
   */
  detectPitchLoop() {
    if (!this.isRunning) return;

    // Get time domain data from analyser
    this.analyser.getFloatTimeDomainData(this.dataArray);

    // Detect pitch
    const rawFrequency = detectPitch(this.dataArray, this.audioContext.sampleRate);

    // Smooth the result to reduce jitter
    const smoothedFrequency = this.smoother.addReading(rawFrequency);

    // Call callback with result
    if (this.pitchCallback) {
      this.pitchCallback(smoothedFrequency);
    }

    // Schedule next detection
    this.rafId = requestAnimationFrame(() => this.detectPitchLoop());
  }

  /**
   * Set reference frequency (A4)
   * @param {number} frequency - Reference frequency in Hz (typically 440)
   */
  setReferenceFrequency(frequency) {
    this.referenceFrequency = frequency;
  }

  /**
   * Get reference frequency
   * @returns {number} - Reference frequency in Hz
   */
  getReferenceFrequency() {
    return this.referenceFrequency;
  }

  /**
   * Play a reference tone at the given frequency
   * @param {number} frequency - Frequency in Hz
   */
  playReferenceTone(frequency) {
    if (this.isPlayingTone) {
      this.stopReferenceTone();
    }

    // Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Create oscillator and gain node
    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();

    // Configure oscillator
    this.oscillator.type = 'sine'; // Pure tone
    this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    // Configure gain (volume)
    this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    this.gainNode.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.02); // Fade in

    // Connect nodes
    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Start oscillator
    this.oscillator.start(this.audioContext.currentTime);
    this.isPlayingTone = true;
  }

  /**
   * Stop the reference tone
   */
  stopReferenceTone() {
    if (!this.isPlayingTone || !this.oscillator) return;

    // Fade out
    this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.02);

    // Stop oscillator after fade out
    this.oscillator.stop(this.audioContext.currentTime + 0.02);

    this.isPlayingTone = false;
    this.oscillator = null;
    this.gainNode = null;
  }

  /**
   * Check if a reference tone is currently playing
   * @returns {boolean}
   */
  isReferenceTonePlaying() {
    return this.isPlayingTone;
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.stop();
    this.stopReferenceTone();

    // Stop microphone
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    // Disconnect nodes
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.audioContext = null;
    this.dataArray = null;
  }

  /**
   * Check if tuner is currently running
   * @returns {boolean}
   */
  getIsRunning() {
    return this.isRunning;
  }
}

export default TunerEngine;

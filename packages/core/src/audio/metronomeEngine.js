/**
 * Metronome Engine
 *
 * Provides precise metronome functionality using Web Audio API
 * with lookahead scheduling for sub-millisecond accuracy.
 */

import { getAudioContext, resumeAudioContext } from './audioContext';

// Time signature definitions
export const TIME_SIGNATURES = {
  '2/4': { beats: 2, noteValue: 4 },
  '3/4': { beats: 3, noteValue: 4 },
  '4/4': { beats: 4, noteValue: 4 },
  '5/4': { beats: 5, noteValue: 4 },
  '6/8': { beats: 6, noteValue: 8 },
  '7/8': { beats: 7, noteValue: 8 },
  '9/8': { beats: 9, noteValue: 8 },
  '12/8': { beats: 12, noteValue: 8 }
};

// Subdivision types
export const SUBDIVISIONS = {
  quarter: { name: 'Negras', icon: '♩', clicksPerBeat: 1 },
  eighth: { name: 'Corcheas', icon: '♪', clicksPerBeat: 2 },
  triplet: { name: 'Tresillos', icon: '♪³', clicksPerBeat: 3 },
  sixteenth: { name: 'Semicorcheas', icon: '♬', clicksPerBeat: 4 }
};

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
  hiHat: {
    name: 'Hi-Hat',
    description: 'Sonido brillante y agudo',
    accentFrequency: 3000,
    regularFrequency: 2500,
    accentDuration: 0.03,
    regularDuration: 0.02,
    accentGain: 0.25,
    regularGain: 0.12,
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
  }
};

class MetronomeEngine {
  constructor() {
    this.audioContext = null;
    this.isPlaying = false;
    this.tempo = 120; // BPM
    this.timeSignature = TIME_SIGNATURES['4/4'];
    this.subdivision = 'quarter';
    this.currentBeat = 0;
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.1; // Schedule 100ms ahead
    this.schedulerInterval = 25; // Check every 25ms
    this.schedulerTimer = null;
    this.onBeatCallback = null;
    this.onMeasureCompleteCallback = null;

    // Sound preset
    this.soundPreset = 'classic';
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
    return this.audioContext;
  }

  /**
   * Set tempo in BPM
   */
  setTempo(bpm) {
    this.tempo = Math.max(40, Math.min(240, bpm));
  }

  /**
   * Set time signature
   */
  setTimeSignature(timeSignature) {
    if (TIME_SIGNATURES[timeSignature]) {
      this.timeSignature = TIME_SIGNATURES[timeSignature];
      // Reset beat counter when changing time signature
      this.currentBeat = 0;
    }
  }

  /**
   * Set subdivision type
   */
  setSubdivision(subdivision) {
    if (SUBDIVISIONS[subdivision]) {
      this.subdivision = subdivision;
    }
  }

  /**
   * Set sound preset
   */
  setSoundPreset(presetId) {
    if (SOUND_PRESETS[presetId]) {
      const preset = SOUND_PRESETS[presetId];
      this.soundPreset = presetId;
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
    this.scheduleNote(this.audioContext.currentTime + 0.05, true, false);
  }

  /**
   * Calculate the time between beats in seconds
   */
  getSecondPerBeat() {
    // 60 seconds / BPM = seconds per beat
    // Adjust for note value (4/4 uses quarter notes, 6/8 uses eighth notes)
    const baseInterval = 60.0 / this.tempo;

    // For 6/8, 9/8, 12/8 time signatures, the beat is the dotted quarter
    if (this.timeSignature.noteValue === 8) {
      return baseInterval * 1.5; // Dotted quarter = 1.5 * quarter
    }

    return baseInterval;
  }

  /**
   * Calculate interval for subdivisions
   */
  getSubdivisionInterval() {
    const clicksPerBeat = SUBDIVISIONS[this.subdivision].clicksPerBeat;
    return this.getSecondPerBeat() / clicksPerBeat;
  }

  /**
   * Schedule a single click sound
   */
  scheduleNote(time, isAccent, subdivision = false) {
    const ctx = this.audioContext;

    // Create oscillator for the click
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Set oscillator type from preset
    osc.type = this.oscillatorType;

    // Set frequency and gain based on accent
    osc.frequency.value = isAccent ? this.accentFrequency : this.regularFrequency;
    const duration = isAccent ? this.accentDuration : this.regularDuration;
    const peakGain = subdivision ? this.regularGain * 0.5 : (isAccent ? this.accentGain : this.regularGain);

    // Create envelope (attack and decay)
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(peakGain, time + 0.001); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration); // Exponential decay

    // Connect nodes
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Start and stop
    osc.start(time);
    osc.stop(time + duration);
  }

  /**
   * Advance to next note
   */
  nextNote() {
    const subdivisionClicks = SUBDIVISIONS[this.subdivision].clicksPerBeat;
    const interval = this.getSubdivisionInterval();

    // Advance time
    this.nextNoteTime += interval;

    // Advance beat counter
    this.currentBeat++;

    // Wrap beat counter based on time signature and subdivision
    const totalClicks = this.timeSignature.beats * subdivisionClicks;
    if (this.currentBeat >= totalClicks) {
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
   * Check if current note is an accent (downbeat)
   */
  isAccent(beatNumber) {
    const subdivisionClicks = SUBDIVISIONS[this.subdivision].clicksPerBeat;

    // First beat of the measure is always accent
    if (beatNumber === 0) return true;

    // For subdivisions, only accent the main beats
    if (this.subdivision !== 'quarter') {
      return beatNumber % subdivisionClicks === 0;
    }

    return false;
  }

  /**
   * Check if current note is a subdivision (not a main beat)
   */
  isSubdivision(beatNumber) {
    if (this.subdivision === 'quarter') return false;

    const subdivisionClicks = SUBDIVISIONS[this.subdivision].clicksPerBeat;
    return beatNumber % subdivisionClicks !== 0;
  }

  /**
   * Get the main beat number (for visual display)
   */
  getMainBeatNumber(beatNumber) {
    const subdivisionClicks = SUBDIVISIONS[this.subdivision].clicksPerBeat;
    return Math.floor(beatNumber / subdivisionClicks);
  }

  /**
   * Scheduler - called at regular intervals to schedule upcoming notes
   */
  scheduler() {
    // Schedule all notes that need to play before next scheduler call
    while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
      const isAccentBeat = this.isAccent(this.currentBeat);
      const isSubBeat = this.isSubdivision(this.currentBeat);

      // Schedule the audio
      this.scheduleNote(this.nextNoteTime, isAccentBeat, isSubBeat);

      // Notify callback for visual sync (only for main beats)
      if (this.onBeatCallback && !isSubBeat) {
        const mainBeat = this.getMainBeatNumber(this.currentBeat);
        // Use setTimeout to sync visual with audio
        const delay = (this.nextNoteTime - this.audioContext.currentTime) * 1000;
        setTimeout(() => {
          if (this.onBeatCallback) {
            this.onBeatCallback(mainBeat, this.timeSignature.beats);
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
    this.nextNoteTime = this.audioContext.currentTime + 0.05; // Start slightly in the future

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

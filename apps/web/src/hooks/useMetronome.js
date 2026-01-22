/**
 * useMetronome Hook
 *
 * Manages metronome state and provides controls for the metronome engine
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import MetronomeEngine, { TIME_SIGNATURES, SUBDIVISIONS, SOUND_PRESETS } from '@notesheet/core/src/audio/metronomeEngine';
import { useAuth } from '../context/AuthContext';
import { saveMetronomePreferences } from '@notesheet/api';

const TAP_TEMPO_TIMEOUT = 2000; // Reset tap tempo after 2 seconds
const TAP_TEMPO_MIN_TAPS = 2; // Minimum taps needed to calculate tempo
const SAVE_DEBOUNCE_MS = 500; // Debounce Firebase saves

function useMetronome(initialPreferences = {}) {
  const { currentUser } = useAuth();
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(initialPreferences.bpm || 120);
  const [timeSignature, setTimeSignature] = useState(initialPreferences.timeSignature || '4/4');
  const [subdivision, setSubdivision] = useState(initialPreferences.subdivision || 'quarter');
  const [soundPreset, setSoundPreset] = useState(initialPreferences.soundPreset || 'classic');
  const [currentBeat, setCurrentBeat] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const engineRef = useRef(null);
  const tapTimesRef = useRef([]);
  const tapTimeoutRef = useRef(null);

  // Initialize engine
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new MetronomeEngine();
    }

    return () => {
      // Cleanup on unmount
      if (engineRef.current && engineRef.current.getIsPlaying()) {
        engineRef.current.stop();
      }
    };
  }, []);

  // Update engine when settings change
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTempo(bpm);
    }
  }, [bpm]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTimeSignature(timeSignature);
    }
  }, [timeSignature]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSubdivision(subdivision);
    }
  }, [subdivision]);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSoundPreset(soundPreset);
    }
  }, [soundPreset]);

  // Beat callback for visual sync
  const handleBeat = useCallback((beat, totalBeats) => {
    setCurrentBeat(beat);
  }, []);

  /**
   * Start the metronome
   */
  const start = useCallback(async () => {
    if (!engineRef.current || isPlaying) return;

    try {
      setLoading(true);
      setError(null);
      await engineRef.current.start(handleBeat);
      setIsPlaying(true);
    } catch (err) {
      console.error('Error starting metronome:', err);
      setError('No se pudo iniciar el metrónomo. ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [isPlaying, handleBeat]);

  /**
   * Stop the metronome
   */
  const stop = useCallback(() => {
    if (!engineRef.current || !isPlaying) return;

    try {
      engineRef.current.stop();
      setIsPlaying(false);
      setCurrentBeat(0);
    } catch (err) {
      console.error('Error stopping metronome:', err);
      setError('No se pudo detener el metrónomo. ' + err.message);
    }
  }, [isPlaying]);

  /**
   * Toggle play/pause
   */
  const toggle = useCallback(async () => {
    if (isPlaying) {
      stop();
    } else {
      await start();
    }
  }, [isPlaying, start, stop]);

  /**
   * Update BPM
   */
  const updateBpm = useCallback((newBpm) => {
    const clampedBpm = Math.max(40, Math.min(240, parseInt(newBpm) || 120));
    setBpm(clampedBpm);
  }, []);

  /**
   * Update time signature
   */
  const updateTimeSignature = useCallback((newSig) => {
    if (TIME_SIGNATURES[newSig]) {
      setTimeSignature(newSig);
      setCurrentBeat(0); // Reset visual beat
    }
  }, []);

  /**
   * Update subdivision
   */
  const updateSubdivision = useCallback((newSub) => {
    if (SUBDIVISIONS[newSub]) {
      setSubdivision(newSub);
    }
  }, []);

  /**
   * Tap tempo - calculate BPM from tap intervals
   */
  const tapTempo = useCallback(() => {
    const now = Date.now();

    // Clear old timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    // Add current tap
    tapTimesRef.current.push(now);

    // Keep only recent taps (last 8)
    if (tapTimesRef.current.length > 8) {
      tapTimesRef.current.shift();
    }

    // Calculate BPM if we have enough taps
    if (tapTimesRef.current.length >= TAP_TEMPO_MIN_TAPS) {
      const intervals = [];

      for (let i = 1; i < tapTimesRef.current.length; i++) {
        intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1]);
      }

      // Calculate average interval
      const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;

      // Convert to BPM (60000 ms per minute / average interval in ms)
      const calculatedBpm = Math.round(60000 / avgInterval);

      // Update BPM if within valid range
      if (calculatedBpm >= 40 && calculatedBpm <= 240) {
        updateBpm(calculatedBpm);
      }
    }

    // Reset tap times after timeout
    tapTimeoutRef.current = setTimeout(() => {
      tapTimesRef.current = [];
    }, TAP_TEMPO_TIMEOUT);
  }, [updateBpm]);

  /**
   * Increment BPM
   */
  const incrementBpm = useCallback((amount = 1) => {
    updateBpm(bpm + amount);
  }, [bpm, updateBpm]);

  /**
   * Decrement BPM
   */
  const decrementBpm = useCallback((amount = 1) => {
    updateBpm(bpm - amount);
  }, [bpm, updateBpm]);

  /**
   * Set preset tempo
   */
  const setPreset = useCallback((presetBpm) => {
    updateBpm(presetBpm);
  }, [updateBpm]);

  /**
   * Update sound preset
   */
  const updateSoundPreset = useCallback((newPreset) => {
    if (SOUND_PRESETS[newPreset]) {
      setSoundPreset(newPreset);
    }
  }, []);

  /**
   * Play a test sound with current preset
   */
  const testSound = useCallback(async () => {
    if (engineRef.current && !isPlaying) {
      try {
        await engineRef.current.playTestSound();
      } catch (err) {
        console.error('Error playing test sound:', err);
      }
    }
  }, [isPlaying]);

  // Save preferences to Firebase (with localStorage fallback) - debounced
  useEffect(() => {
    const preferences = {
      bpm,
      timeSignature,
      subdivision,
      soundPreset
    };

    // Save to localStorage immediately (optimistic update)
    localStorage.setItem('metronomePreferences', JSON.stringify(preferences));

    // Debounce Firebase save to avoid too many writes
    const timeoutId = setTimeout(async () => {
      if (currentUser) {
        try {
          await saveMetronomePreferences(currentUser.uid, preferences);
        } catch (error) {
          console.error('Error saving metronome preferences to Firebase:', error);
          // localStorage already saved, so user won't lose preferences
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [bpm, timeSignature, subdivision, soundPreset, currentUser]);

  return {
    // State
    isPlaying,
    bpm,
    timeSignature,
    subdivision,
    soundPreset,
    currentBeat,
    loading,
    error,

    // Controls
    start,
    stop,
    toggle,
    updateBpm,
    updateTimeSignature,
    updateSubdivision,
    updateSoundPreset,
    testSound,
    tapTempo,
    incrementBpm,
    decrementBpm,
    setPreset,

    // Helpers
    timeSignatureBeats: TIME_SIGNATURES[timeSignature]?.beats || 4,
    subdivisionName: SUBDIVISIONS[subdivision]?.name || 'Negras',
    soundPresetName: SOUND_PRESETS[soundPreset]?.name || 'Clásico',

    // Engine reference (for tempo trainer)
    engineRef
  };
}

export default useMetronome;

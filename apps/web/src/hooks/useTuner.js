/**
 * useTuner Hook
 *
 * Manages tuner state and provides controls for the tuner engine
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import TunerEngine from '@notesheet/core/src/audio/tunerEngine';
import {
  frequencyToMidi,
  midiToFrequency,
  midiToNoteName,
  midiToNoteNameLatin,
  getCentsDeviation
} from '@notesheet/core/src/audio/pitchDetection';
import { useAuth } from '../context/AuthContext';
import { saveTunerPreferences } from '@notesheet/api';
import { TRANSPOSING_INSTRUMENTS } from '@notesheet/core';

const SAVE_DEBOUNCE_MS = 500; // Debounce Firebase saves

function useTuner(initialPreferences = {}) {
  const { currentUser } = useAuth();

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detection state
  const [detectedFrequency, setDetectedFrequency] = useState(null);
  const [detectedNote, setDetectedNote] = useState(null);
  const [detectedNoteLatin, setDetectedNoteLatin] = useState(null);
  const [centsDeviation, setCentsDeviation] = useState(0);
  const [tuningStatus, setTuningStatus] = useState('detecting'); // 'flat', 'sharp', 'in-tune', 'detecting'

  // Settings
  const [referenceFrequency, setReferenceFrequency] = useState(
    initialPreferences.referenceFrequency || 440
  );
  const [currentInstrument, setCurrentInstrument] = useState(
    initialPreferences.lastInstrument || 'bb_trumpet'
  );
  const [showConcertPitch, setShowConcertPitch] = useState(
    initialPreferences.showConcertPitch !== undefined
      ? initialPreferences.showConcertPitch
      : true
  );
  const [notationSystem, setNotationSystem] = useState('latin');

  // Reference tone state
  const [isPlayingTone, setIsPlayingTone] = useState(false);

  const engineRef = useRef(null);

  // Initialize engine
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  /**
   * Initialize tuner and request microphone access
   */
  const initialize = useCallback(async () => {
    if (isInitialized || engineRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const engine = new TunerEngine();
      await engine.initialize();
      engine.setReferenceFrequency(referenceFrequency);

      engineRef.current = engine;
      setIsInitialized(true);
    } catch (err) {
      console.error('Error initializing tuner:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isInitialized, referenceFrequency]);

  /**
   * Pitch detection callback
   */
  const handlePitchDetection = useCallback(
    (frequency) => {
      if (frequency === null) {
        setDetectedFrequency(null);
        setDetectedNote(null);
        setDetectedNoteLatin(null);
        setCentsDeviation(0);
        setTuningStatus('detecting');
        return;
      }

      setDetectedFrequency(frequency);

      // Convert to MIDI note
      const midiNote = frequencyToMidi(frequency);
      const targetFrequency = midiToFrequency(midiNote, referenceFrequency);

      // Calculate cents deviation
      const cents = getCentsDeviation(frequency, targetFrequency);
      setCentsDeviation(cents);

      // Determine tuning status
      if (Math.abs(cents) <= 5) {
        setTuningStatus('in-tune');
      } else if (cents < -5) {
        setTuningStatus('flat');
      } else {
        setTuningStatus('sharp');
      }

      // Set note names
      setDetectedNote(midiToNoteName(midiNote));
      setDetectedNoteLatin(midiToNoteNameLatin(midiNote));
    },
    [referenceFrequency]
  );

  /**
   * Start the tuner
   */
  const start = useCallback(async () => {
    if (!isInitialized) {
      await initialize();
    }

    if (!engineRef.current || isRunning) return;

    try {
      setError(null);
      engineRef.current.start(handlePitchDetection);
      setIsRunning(true);
    } catch (err) {
      console.error('Error starting tuner:', err);
      setError('No se pudo iniciar el afinador. ' + err.message);
    }
  }, [isInitialized, isRunning, initialize, handlePitchDetection]);

  /**
   * Stop the tuner
   */
  const stop = useCallback(() => {
    if (!engineRef.current || !isRunning) return;

    try {
      engineRef.current.stop();
      setIsRunning(false);
      setDetectedFrequency(null);
      setDetectedNote(null);
      setDetectedNoteLatin(null);
      setCentsDeviation(0);
      setTuningStatus('detecting');
    } catch (err) {
      console.error('Error stopping tuner:', err);
      setError('No se pudo detener el afinador. ' + err.message);
    }
  }, [isRunning]);

  /**
   * Toggle tuner on/off
   */
  const toggle = useCallback(async () => {
    if (isRunning) {
      stop();
    } else {
      await start();
    }
  }, [isRunning, start, stop]);

  /**
   * Update reference frequency (A4)
   */
  const updateReferenceFrequency = useCallback((newFreq) => {
    const clampedFreq = Math.max(430, Math.min(450, parseInt(newFreq) || 440));
    setReferenceFrequency(clampedFreq);

    if (engineRef.current) {
      engineRef.current.setReferenceFrequency(clampedFreq);
    }
  }, []);

  /**
   * Update instrument selection
   */
  const updateInstrument = useCallback((instrumentId) => {
    if (TRANSPOSING_INSTRUMENTS[instrumentId]) {
      setCurrentInstrument(instrumentId);
    }
  }, []);

  /**
   * Toggle concert pitch display
   */
  const toggleConcertPitch = useCallback(() => {
    setShowConcertPitch((prev) => !prev);
  }, []);

  /**
   * Toggle notation system
   */
  const toggleNotationSystem = useCallback(() => {
    setNotationSystem((prev) => (prev === 'latin' ? 'english' : 'latin'));
  }, []);

  /**
   * Play reference tone for a specific note
   */
  const playReferenceTone = useCallback((frequency) => {
    if (!engineRef.current) return;

    engineRef.current.playReferenceTone(frequency);
    setIsPlayingTone(true);
  }, []);

  /**
   * Stop reference tone
   */
  const stopReferenceTone = useCallback(() => {
    if (!engineRef.current) return;

    engineRef.current.stopReferenceTone();
    setIsPlayingTone(false);
  }, []);

  /**
   * Toggle reference tone for detected note
   */
  const toggleReferenceTone = useCallback(() => {
    if (!engineRef.current) return;

    if (isPlayingTone) {
      stopReferenceTone();
    } else if (detectedNote) {
      const midiNote = frequencyToMidi(detectedFrequency);
      const targetFrequency = midiToFrequency(midiNote, referenceFrequency);
      playReferenceTone(targetFrequency);
    }
  }, [isPlayingTone, detectedNote, detectedFrequency, referenceFrequency, playReferenceTone, stopReferenceTone]);

  // Save preferences to Firebase (with localStorage fallback) - debounced
  useEffect(() => {
    const preferences = {
      referenceFrequency,
      lastInstrument: currentInstrument,
      showConcertPitch
    };

    // Save to localStorage immediately (optimistic update)
    localStorage.setItem('tunerPreferences', JSON.stringify(preferences));

    // Debounce Firebase save
    const timeoutId = setTimeout(async () => {
      if (currentUser) {
        try {
          await saveTunerPreferences(currentUser.uid, preferences);
        } catch (error) {
          console.error('Error saving tuner preferences to Firebase:', error);
        }
      }
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [referenceFrequency, currentInstrument, showConcertPitch, currentUser]);

  // Calculate displayed note (considering instrument transposition)
  const displayedNote = detectedNote
    ? notationSystem === 'latin'
      ? detectedNoteLatin
      : detectedNote
    : null;

  return {
    // State
    isRunning,
    isInitialized,
    loading,
    error,

    // Detection results
    detectedFrequency,
    detectedNote: displayedNote,
    centsDeviation,
    tuningStatus,

    // Settings
    referenceFrequency,
    currentInstrument,
    showConcertPitch,
    notationSystem,

    // Reference tone
    isPlayingTone,

    // Controls
    initialize,
    start,
    stop,
    toggle,
    updateReferenceFrequency,
    updateInstrument,
    toggleConcertPitch,
    toggleNotationSystem,
    playReferenceTone,
    stopReferenceTone,
    toggleReferenceTone,

    // Helpers
    instrumentName: TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || 'Trompeta en Sib'
  };
}

export default useTuner;

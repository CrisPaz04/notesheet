/**
 * useTuner Hook
 *
 * Manages tuner state and provides controls for the tuner engine
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import TunerEngine from '@notesheet/core/src/audio/tunerEngine';
import {
  midiToFrequency,
  midiToNoteName,
  midiToNoteNameLatin,
  getCentsDeviation
} from '@notesheet/core/src/audio/pitchDetection';
import { notaConHisteresis, estadoAfinacion } from '@notesheet/core/src/audio/seguimientoTono';
import { useAuth } from '../context/AuthContext';
import useNotacionPreferida from './useNotacionPreferida';
import { saveTunerPreferences } from '@notesheet/api';
import { TRANSPOSING_INSTRUMENTS, VER_EN_CONCIERTO, semitonosAEscrito } from '@notesheet/core';

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
  const [centsDeviation, setCentsDeviation] = useState(0);
  const [tuningStatus, setTuningStatus] = useState('detecting'); // 'flat', 'sharp', 'in-tune', 'detecting'

  // Settings
  const [referenceFrequency, setReferenceFrequency] = useState(
    initialPreferences.referenceFrequency || 440
  );
  // Cómo se nombran las notas: las que suenan ("concierto") o las que lee un
  // instrumento (el DO de la trompeta suena SIb). Antes había un interruptor
  // "tono de concierto" que se guardaba pero no se aplicaba en ningún sitio.
  const [verNotasComo, setVerNotasComo] = useState(
    initialPreferences.verNotasComo || VER_EN_CONCIERTO
  );
  // La del perfil, compartida con el resto de la app (useNotacionPreferida)
  const [notationSystem, setNotationSystem] = useNotacionPreferida(currentUser);

  // Reference tone state
  const [isPlayingTone, setIsPlayingTone] = useState(false);

  const [detectedMidi, setDetectedMidi] = useState(null);

  const engineRef = useRef(null);
  // Lo último que se guardó (o con lo que arrancó): sin esto guardaba ya al
  // montar, como le pasaba al metrónomo
  const ultimoGuardadoRef = useRef(null);
  // La nota y el estado de la lectura anterior: con ellos no parpadean en la
  // frontera entre dos notas ni en el borde de "Afinado"
  const notaAnteriorRef = useRef(null);
  const estadoAnteriorRef = useRef(null);

  // Initialize engine
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (engineRef.current) {
        engineRef.current.destroy();
      }
    };
  }, []);

  // El engine se crea al primer uso: los tonos de referencia lo necesitan sin
  // micrófono. Antes solo existía tras pedir el micrófono al pulsar Iniciar,
  // así que tocar un tono sin haber iniciado el afinador no hacía nada.
  const motor = useCallback(() => {
    if (!engineRef.current) engineRef.current = new TunerEngine();
    return engineRef.current;
  }, []);

  /**
   * Initialize tuner and request microphone access
   * @returns {Promise<boolean>} Si quedó listo para escuchar
   */
  const initialize = useCallback(async () => {
    if (isInitialized) return true;

    try {
      setLoading(true);
      setError(null);

      const engine = motor();
      await engine.initialize();
      engine.setReferenceFrequency(referenceFrequency);

      setIsInitialized(true);
      return true;
    } catch (err) {
      console.error('Error initializing tuner:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isInitialized, referenceFrequency, motor]);

  /**
   * Pitch detection callback
   */
  const handlePitchDetection = useCallback(
    (frequency) => {
      if (frequency === null) {
        notaAnteriorRef.current = null;
        estadoAnteriorRef.current = null;
        setDetectedFrequency(null);
        setDetectedNote(null);
        setCentsDeviation(0);
        setTuningStatus('detecting');
        setDetectedMidi(null);
        return;
      }

      setDetectedFrequency(frequency);

      // La nota más cercana según el diapasón elegido (con 442, las fronteras
      // entre notas también se mueven)
      const semitonos = 69 + 12 * Math.log2(frequency / referenceFrequency);
      const midiNote = notaConHisteresis(semitonos, notaAnteriorRef.current);
      notaAnteriorRef.current = midiNote;
      setDetectedMidi(midiNote);
      const targetFrequency = midiToFrequency(midiNote, referenceFrequency);

      const cents = getCentsDeviation(frequency, targetFrequency);
      setCentsDeviation(cents);

      const estado = estadoAfinacion(cents, estadoAnteriorRef.current);
      estadoAnteriorRef.current = estado;
      setTuningStatus(estado);

      // Set note names
      setDetectedNote(midiToNoteName(midiNote));
    },
    [referenceFrequency]
  );

  // El engine guarda el callback una sola vez, en start(). Sin esta ref se
  // quedaría con la primera versión de handlePitchDetection y seguiría
  // calculando los cents con el diapasón antiguo: cambiar el LA de 440 a 442
  // con el afinador en marcha no movía la aguja hasta parar y volver a
  // arrancar.
  const handlePitchDetectionRef = useRef(handlePitchDetection);
  useEffect(() => {
    handlePitchDetectionRef.current = handlePitchDetection;
  }, [handlePitchDetection]);

  /**
   * Start the tuner
   */
  const start = useCallback(async () => {
    const listo = isInitialized || await initialize();
    if (!listo || !engineRef.current || isRunning) return;

    try {
      setError(null);
      // Envoltorio estable: siempre delega en la versión vigente del callback
      engineRef.current.start((frequency) => handlePitchDetectionRef.current(frequency));
      setIsRunning(true);
    } catch (err) {
      console.error('Error starting tuner:', err);
      setError('No se pudo iniciar el afinador. ' + err.message);
    }
  }, [isInitialized, isRunning, initialize]);

  /**
   * Stop the tuner
   */
  const stop = useCallback(() => {
    if (!engineRef.current || !isRunning) return;

    try {
      engineRef.current.stop();
      setIsRunning(false);
      notaAnteriorRef.current = null;
      estadoAnteriorRef.current = null;
      setDetectedFrequency(null);
      setDetectedNote(null);
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
   * Las notas de qué instrumento se enseñan, o `VER_EN_CONCIERTO`
   */
  const updateVerNotasComo = useCallback((id) => {
    if (id === VER_EN_CONCIERTO || TRANSPOSING_INSTRUMENTS[id]) {
      setVerNotasComo(id);
    }
  }, []);

  /**
   * Toggle notation system
   */
  const toggleNotationSystem = () => {
    setNotationSystem(notationSystem === 'latin' ? 'english' : 'latin');
  };

  /**
   * Play reference tone for a specific note
   */
  const playReferenceTone = useCallback((frequency) => {
    motor().playReferenceTone(frequency);
    setIsPlayingTone(true);
  }, [motor]);

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
      playReferenceTone(midiToFrequency(detectedMidi, referenceFrequency));
    }
  }, [isPlayingTone, detectedNote, detectedMidi, referenceFrequency, playReferenceTone, stopReferenceTone]);

  // Save preferences to Firebase (with localStorage fallback) - debounced
  useEffect(() => {
    const preferences = { referenceFrequency, verNotasComo };

    const texto = JSON.stringify(preferences);
    if (ultimoGuardadoRef.current === null || ultimoGuardadoRef.current === texto) {
      ultimoGuardadoRef.current = texto;
      return undefined;
    }
    ultimoGuardadoRef.current = texto;

    // Save to localStorage immediately (optimistic update)
    try {
      localStorage.setItem('tunerPreferences', texto);
    } catch {
      // Sin almacenamiento (incógnito) queda Firebase
    }

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
  }, [referenceFrequency, verNotasComo, currentUser]);

  // La nota en la notación elegida y como la lee el instrumento elegido. La
  // de concierto se enseña aparte cuando no coinciden.
  const nombrar = (midi) => (notationSystem === 'latin' ? midiToNoteNameLatin(midi) : midiToNoteName(midi));
  const semitonosEscritos = semitonosAEscrito(verNotasComo);
  const displayedNote = detectedNote ? nombrar(detectedMidi + semitonosEscritos) : null;
  const notaConcierto = detectedNote && semitonosEscritos !== 0 ? nombrar(detectedMidi) : null;

  return {
    // State
    isRunning,
    isInitialized,
    loading,
    error,

    // Detection results
    detectedFrequency,
    detectedNote: displayedNote,
    notaConcierto,
    detectedMidi,
    centsDeviation,
    tuningStatus,

    // Settings
    referenceFrequency,
    verNotasComo,
    semitonosEscritos,
    notationSystem,

    // Reference tone
    isPlayingTone,

    // Controls
    initialize,
    start,
    stop,
    toggle,
    updateReferenceFrequency,
    updateVerNotasComo,
    toggleNotationSystem,
    playReferenceTone,
    stopReferenceTone,
    toggleReferenceTone
  };
}

export default useTuner;

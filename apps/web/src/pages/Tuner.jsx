/**
 * Tuner Page
 *
 * Full-screen tuner tool for instrument tuning
 * Features: Chromatic pitch detection, transposing instruments, reference tones
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTunerPreferences } from '@notesheet/api';
import useTuner from '../hooks/useTuner';
import TunerVisualizer from '../components/tuner/TunerVisualizer';
import TunerControls from '../components/tuner/TunerControls';
import ReferenceToneGenerator from '../components/tuner/ReferenceToneGenerator';

function Tuner({ compact = false }) {
  const { currentUser } = useAuth();
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [initialPreferences, setInitialPreferences] = useState({});

  // Load preferences from Firebase (with localStorage fallback)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (currentUser) {
          // Try loading from Firebase first
          const firebasePrefs = await getTunerPreferences(currentUser.uid);
          setInitialPreferences(firebasePrefs);
        } else {
          // Fall back to localStorage if not authenticated
          const savedPrefs = localStorage.getItem('tunerPreferences');
          if (savedPrefs) {
            const prefs = JSON.parse(savedPrefs);
            setInitialPreferences(prefs);
          }
        }
      } catch (err) {
        console.error('Error loading tuner preferences from Firebase:', err);
        // Fall back to localStorage on error
        try {
          const savedPrefs = localStorage.getItem('tunerPreferences');
          if (savedPrefs) {
            const prefs = JSON.parse(savedPrefs);
            setInitialPreferences(prefs);
          }
        } catch (localErr) {
          console.error('Error loading tuner preferences from localStorage:', localErr);
        }
      } finally {
        setPreferencesLoaded(true);
      }
    };

    loadPreferences();
  }, [currentUser]);

  const {
    isRunning,
    loading,
    error,
    detectedNote,
    detectedFrequency,
    centsDeviation,
    tuningStatus,
    referenceFrequency,
    currentInstrument,
    showConcertPitch,
    notationSystem,
    isPlayingTone,
    toggle,
    updateReferenceFrequency,
    updateInstrument,
    toggleConcertPitch,
    toggleNotationSystem,
    playReferenceTone,
    stopReferenceTone
  } = useTuner(initialPreferences);

  if (!preferencesLoaded) {
    return (
      <div className={compact ? '' : 'tuner-container container py-4'}>
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Cargando...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'tuner-container container py-4'}>
      {!compact && (
        <div className="tuner-header mb-4">
          <h1>
            <i className="bi bi-soundwave me-2"></i>
            Afinador
          </h1>
          <p className="text-secondary mb-0">
            Afina tu instrumento con detección cromática precisa
          </p>
        </div>
      )}

      <div className="row g-4">
        {/* Main Tuner Display */}
        <div className="col-lg-8">
          <div className="tuner-card card p-4">
            {/* Error Display */}
            {error && (
              <div className="alert alert-danger mb-4" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* Tuner Visualizer */}
            <TunerVisualizer
              detectedNote={detectedNote}
              detectedFrequency={detectedFrequency}
              centsDeviation={centsDeviation}
              tuningStatus={tuningStatus}
              isRunning={isRunning}
            />

            {/* Main Control Button */}
            <div className="d-flex gap-3 justify-content-center mt-4">
              <button
                className="btn btn-lg btn-primary px-5"
                onClick={toggle}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Iniciando...
                  </>
                ) : (
                  <>
                    <i
                      className={`bi bi-${
                        isRunning ? 'stop' : 'mic'
                      }-fill me-2`}
                    ></i>
                    {isRunning ? 'Detener' : 'Iniciar Afinación'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="col-lg-4">
          <div className="card p-4 mb-4">
            <TunerControls
              referenceFrequency={referenceFrequency}
              currentInstrument={currentInstrument}
              showConcertPitch={showConcertPitch}
              notationSystem={notationSystem}
              isRunning={isRunning}
              onReferenceFrequencyChange={updateReferenceFrequency}
              onInstrumentChange={updateInstrument}
              onToggleConcertPitch={toggleConcertPitch}
              onToggleNotationSystem={toggleNotationSystem}
            />
          </div>

          <div className="card p-4">
            <ReferenceToneGenerator
              referenceFrequency={referenceFrequency}
              notationSystem={notationSystem}
              onPlayTone={playReferenceTone}
              onStopTone={stopReferenceTone}
              isPlaying={isPlayingTone}
              isRunning={isRunning}
            />
          </div>
        </div>
      </div>

      {/* Help Text */}
      {!compact && (
        <div className="alert alert-info mt-4" role="alert">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Tip:</strong> Para mejores resultados, toca notas largas y
          sostenidas. El afinador funciona mejor en ambientes silenciosos.
          Los tonos de referencia te ayudan a comparar el tono de tu instrumento.
        </div>
      )}
    </div>
  );
}

export default Tuner;

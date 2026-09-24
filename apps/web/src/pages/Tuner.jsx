/**
 * Tuner Page
 *
 * Full-screen tuner tool for instrument tuning
 * Features: Chromatic pitch detection, transposing instruments, reference tones
 */

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getTunerPreferences } from '@notesheet/api';
import { STRING_TUNINGS } from '@notesheet/core';
import useTuner from '../hooks/useTuner';
import usePitchHistory from '../hooks/usePitchHistory';
import TunerVisualizer from '../components/tuner/TunerVisualizer';
import TunerControls from '../components/tuner/TunerControls';
import ReferenceToneGenerator from '../components/tuner/ReferenceToneGenerator';
import PitchHistoryGraph from '../components/tuner/PitchHistoryGraph';
import StringModeSelector from '../components/tuner/StringModeSelector';

/**
 * Carga las preferencias y, solo cuando las tiene, monta el afinador.
 *
 * `useTuner` toma los valores iniciales con `useState`, así que solo mira los
 * del primer render. Antes el hook se llamaba aquí mismo, con `{}`, mientras
 * Firebase aún no había respondido: el afinador arrancaba siempre en 440 y con
 * la trompeta, y además guardaba esos valores encima de los del usuario.
 */
function Tuner({ compact = false, mini = false }) {
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

  if (!preferencesLoaded) {
    return (
      <div className={compact ? 'tuner-compact' : 'tuner-container'}>
        <div className={compact ? '' : 'container'}>
          <div className="text-center py-5">
            <div className="spinner-border" role="status" style={{ color: 'var(--color-primary)' }}>
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <TunerCuerpo compact={compact} mini={mini} initialPreferences={initialPreferences} />;
}

function TunerCuerpo({ compact, mini, initialPreferences }) {
  const {
    isRunning,
    loading,
    error,
    detectedNote,
    detectedFrequency,
    detectedMidi,
    centsDeviation,
    tuningStatus,
    referenceFrequency,
    showConcertPitch,
    notationSystem,
    isPlayingTone,
    stringModeEnabled,
    selectedTuning,
    selectedString,
    toggle,
    updateReferenceFrequency,
    toggleConcertPitch,
    toggleNotationSystem,
    playReferenceTone,
    stopReferenceTone,
    toggleStringMode,
    updateSelectedTuning,
    updateSelectedString
  } = useTuner(initialPreferences);

  // Pitch history tracking
  const pitchHistory = usePitchHistory();
  const lastSampleTimeRef = useRef(0);

  // Feed cents data to pitch history (throttled to ~30fps)
  useEffect(() => {
    if (isRunning && detectedFrequency !== null) {
      const now = Date.now();
      if (now - lastSampleTimeRef.current >= 33) { // ~30fps
        pitchHistory.addSample(centsDeviation);
        lastSampleTimeRef.current = now;
      }
    }
  }, [isRunning, detectedFrequency, centsDeviation, pitchHistory]);

  // Clear history when tuner stops
  useEffect(() => {
    if (!isRunning) {
      pitchHistory.clearHistory();
    }
  }, [isRunning, pitchHistory.clearHistory]);

  // Versión simplificada para el panel flotante: la nota, una barra de
  // cents y el botón. La frecuencia de referencia, las cuerdas y los tonos siguen en la
  // página completa, con las mismas preferencias.
  if (mini) {
    const afinado = tuningStatus === 'in-tune';
    const color = !detectedNote
      ? 'var(--text-light-secondary)'
      : afinado ? '#4caf50' : Math.abs(centsDeviation) > 15 ? '#f44336' : '#ffc107';
    // -50..+50 cents -> 0..100 % del ancho de la barra
    const posicion = Math.max(0, Math.min(100, 50 + centsDeviation));

    return (
      <div className="tuner-mini">
        {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

        <div className="tuner-mini-lectura">
          <span className="tuner-mini-nota" style={{ color }}>
            {detectedNote || (isRunning ? '♪' : '--')}
          </span>
          <span className="tuner-mini-cents" style={{ color }}>
            {detectedNote ? `${centsDeviation > 0 ? '+' : ''}${Math.round(centsDeviation)}¢` : ''}
            <small>{detectedFrequency ? `${detectedFrequency.toFixed(1)} Hz` : ''}</small>
          </span>
        </div>

        <div className="tuner-mini-barra" aria-hidden="true">
          <span className="tuner-mini-centro" />
          {detectedNote && (
            <span className="tuner-mini-marca" style={{ left: `${posicion}%`, background: color }} />
          )}
        </div>
        <div className="tuner-mini-escala" aria-hidden="true">
          <span>♭ -50</span><span>0</span><span>+50 ♯</span>
        </div>

        <button type="button" className="btn btn-primary btn-sm" onClick={toggle} disabled={loading}>
          <i className={`bi bi-${isRunning ? 'stop' : 'mic'}-fill me-1`}></i>
          {loading ? 'Iniciando…' : isRunning ? 'Detener' : 'Iniciar'}
        </button>
      </div>
    );
  }

  return (
    <div className={compact ? 'tuner-compact' : 'tuner-container'}>
      <div className={compact ? '' : 'container'}>
      {!compact && (
        <div className="tuner-header fade-in">
          <div>
            <h1 className="tuner-title">
              <i className="bi bi-soundwave"></i>
              Afinador
            </h1>
            <p className="tuner-subtitle">
              Afina tu instrumento con detección cromática precisa
            </p>
          </div>
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
              stringModeEnabled={stringModeEnabled}
              targetString={stringModeEnabled && selectedString !== null ? STRING_TUNINGS[selectedTuning]?.strings[selectedString] : null}
              notationSystem={notationSystem}
              referenceFrequency={referenceFrequency}
            />

            {/* Pitch History Graph - in main display */}
            <div className="pitch-history-main mt-4">
              <PitchHistoryGraph
                history={pitchHistory.history}
                trend={pitchHistory.trend}
                stabilityRating={pitchHistory.stabilityRating}
                averageCents={pitchHistory.averageCents}
                isRunning={isRunning}
              />
            </div>

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
              showConcertPitch={showConcertPitch}
              notationSystem={notationSystem}
              isRunning={isRunning}
              onReferenceFrequencyChange={updateReferenceFrequency}
              onToggleConcertPitch={toggleConcertPitch}
              onToggleNotationSystem={toggleNotationSystem}
            />
          </div>

          <div className="card p-4 mb-4">
            <StringModeSelector
              stringModeEnabled={stringModeEnabled}
              selectedTuning={selectedTuning}
              selectedString={selectedString}
              notationSystem={notationSystem}
              referenceFrequency={referenceFrequency}
              detectedMidi={detectedMidi}
              centsDeviation={centsDeviation}
              isRunning={isRunning}
              onToggleStringMode={toggleStringMode}
              onTuningChange={updateSelectedTuning}
              onStringSelect={updateSelectedString}
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
        <div className="tuner-help-text mt-4">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Tip:</strong> Para mejores resultados, toca notas largas y
          sostenidas. El afinador funciona mejor en ambientes silenciosos.
          Los tonos de referencia te ayudan a comparar el tono de tu instrumento.
        </div>
      )}
      </div>
    </div>
  );
}

export default Tuner;

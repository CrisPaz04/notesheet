/**
 * Metronome Page
 *
 * Full-screen metronome tool for practice
 * Features: BPM control, time signatures, subdivisions, visual beat indicators
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMetronomePreferences } from '@notesheet/api';
import useMetronome from '../hooks/useMetronome';
import useTempoTrainer from '../hooks/useTempoTrainer';
import MetronomeControls from '../components/metronome/MetronomeControls';
import MetronomeVisualizer from '../components/metronome/MetronomeVisualizer';
import TempoPresets from '../components/metronome/TempoPresets';
import SoundPresetSelector from '../components/metronome/SoundPresetSelector';
import TempoTrainer from '../components/metronome/TempoTrainer';

function Metronome({ compact = false }) {
  const { currentUser } = useAuth();
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [initialPreferences, setInitialPreferences] = useState({});

  // Load preferences from Firebase (with localStorage fallback)
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (currentUser) {
          // Try loading from Firebase first
          const firebasePrefs = await getMetronomePreferences(currentUser.uid);
          setInitialPreferences(firebasePrefs);
        } else {
          // Fall back to localStorage if not authenticated
          const savedPrefs = localStorage.getItem('metronomePreferences');
          if (savedPrefs) {
            const prefs = JSON.parse(savedPrefs);
            setInitialPreferences(prefs);
          }
        }
      } catch (err) {
        console.error('Error loading metronome preferences from Firebase:', err);
        // Fall back to localStorage on error
        try {
          const savedPrefs = localStorage.getItem('metronomePreferences');
          if (savedPrefs) {
            const prefs = JSON.parse(savedPrefs);
            setInitialPreferences(prefs);
          }
        } catch (localErr) {
          console.error('Error loading metronome preferences from localStorage:', localErr);
        }
      } finally {
        setPreferencesLoaded(true);
      }
    };

    loadPreferences();
  }, [currentUser]);

  const {
    isPlaying,
    bpm,
    timeSignature,
    subdivision,
    soundPreset,
    currentBeat,
    loading,
    error,
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
    timeSignatureBeats,
    subdivisionName,
    engineRef
  } = useMetronome(initialPreferences);

  // Tempo Trainer
  const tempoTrainer = useTempoTrainer(
    engineRef.current,
    updateBpm,
    isPlaying
  );

  if (!preferencesLoaded) {
    return (
      <div className={compact ? 'metronome-compact' : 'metronome-container'}>
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

  return (
    <div className={compact ? 'metronome-compact' : 'metronome-container'}>
      <div className={compact ? '' : 'container'}>
      {!compact && (
        <div className="metronome-header fade-in">
          <div>
            <h1 className="metronome-title">
              <i className="bi bi-hourglass-split"></i>
              Metrónomo
            </h1>
            <p className="metronome-subtitle">
              Practica con tempo preciso y visualización de tiempo
            </p>
          </div>
        </div>
      )}

      <div className="row g-4">
        {/* Main Metronome Display */}
        <div className="col-lg-8">
          <div className="metronome-card card p-4">
            {/* Error Display */}
            {error && (
              <div className="alert alert-danger mb-4" role="alert">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
              </div>
            )}

            {/* BPM Display */}
            <div className="text-center mb-4">
              <div className="bpm-display">
                <div
                  className="bpm-value"
                  style={{
                    fontSize: '4rem',
                    fontWeight: '700',
                    color: 'var(--color-primary)'
                  }}
                >
                  {bpm}
                </div>
                <div className="bpm-label text-secondary">BPM</div>
                <div className="text-secondary small mt-2">
                  {timeSignature} • {subdivisionName}
                </div>
              </div>
            </div>

            {/* Beat Visualizer */}
            <MetronomeVisualizer
              currentBeat={currentBeat}
              totalBeats={timeSignatureBeats}
              isPlaying={isPlaying}
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
                    Cargando...
                  </>
                ) : (
                  <>
                    <i
                      className={`bi bi-${
                        isPlaying ? 'pause' : 'play'
                      }-fill me-2`}
                    ></i>
                    {isPlaying ? 'Pausar' : 'Iniciar'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Controls Sidebar */}
        <div className="col-lg-4">
          <div className="card p-4 mb-4">
            <MetronomeControls
              bpm={bpm}
              timeSignature={timeSignature}
              subdivision={subdivision}
              isPlaying={isPlaying}
              onBpmChange={updateBpm}
              onTimeSignatureChange={updateTimeSignature}
              onSubdivisionChange={updateSubdivision}
              onIncrement={incrementBpm}
              onDecrement={decrementBpm}
              onTapTempo={tapTempo}
            />
          </div>

          <div className="card p-4 mb-4">
            <TempoPresets
              currentBpm={bpm}
              onPresetSelect={setPreset}
              isPlaying={isPlaying}
            />
          </div>

          <div className="card p-4 mb-4">
            <SoundPresetSelector
              currentPreset={soundPreset}
              onPresetSelect={updateSoundPreset}
              onTestSound={testSound}
              isPlaying={isPlaying}
            />
          </div>

          <div className="card p-4">
            <TempoTrainer
              config={tempoTrainer.config}
              onConfigChange={tempoTrainer.updateConfig}
              isActive={tempoTrainer.isActive}
              isPaused={tempoTrainer.isPaused}
              currentBpm={tempoTrainer.currentTrainingBpm}
              progress={tempoTrainer.progress}
              hasReachedTarget={tempoTrainer.hasReachedTarget}
              onStart={tempoTrainer.startTraining}
              onTogglePause={tempoTrainer.togglePause}
              onStop={tempoTrainer.stopTraining}
              isMetronomePlaying={isPlaying}
            />
          </div>
        </div>
      </div>

      {/* Help Text */}
      {!compact && (
        <div className="metronome-help-text mt-4">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Tip:</strong> No puedes cambiar la configuración mientras el
          metrónomo está activo. Detén el metrónomo primero para ajustar el
          tempo, compás o subdivisión.
        </div>
      )}
      </div>
    </div>
  );
}

export default Metronome;

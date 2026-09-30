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
import { TIME_SIGNATURES } from '@notesheet/core/src/audio/metronomeEngine';
import MetronomeControls from '../components/metronome/MetronomeControls';
import MetronomeVisualizer from '../components/metronome/MetronomeVisualizer';
import TempoPresets from '../components/metronome/TempoPresets';
import SoundPresetSelector from '../components/metronome/SoundPresetSelector';
import TempoTrainer from '../components/metronome/TempoTrainer';
import Desplegable from '../components/Desplegable';
import Icono from "../components/Icono";
import FiguraRitmica from "../components/metronome/FiguraRitmica";
import { tempoClasico } from '@notesheet/core/src/audio/temposClasicos';

/**
 * Carga las preferencias y, solo cuando las tiene, monta el metrónomo.
 *
 * `useMetronome` toma los valores iniciales con `useState`, así que solo mira
 * los del primer render. Antes el hook se llamaba aquí mismo, con `{}`,
 * mientras Firebase aún no había respondido: el metrónomo arrancaba siempre
 * en 120 y además guardaba ese 120 encima del tempo del usuario.
 *
 * `tempoInicial` y `compasInicial` son los de la canción desde la que se abre
 * (SongView) y mandan sobre los guardados.
 */
function Metronome({ compact = false, mini = false, tempoInicial = null, compasInicial = null }) {
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

  const iniciales = { ...initialPreferences };
  if (Number.isFinite(tempoInicial) && tempoInicial > 0) iniciales.bpm = tempoInicial;
  if (compasInicial && TIME_SIGNATURES[compasInicial]) iniciales.timeSignature = compasInicial;

  return <MetronomeCuerpo compact={compact} mini={mini} initialPreferences={iniciales} />;
}

// La figura que cuenta el BPM: negra, negra con puntillo en los compuestos
// (6/8, 9/8, 12/8) o corchea en 7/8
const figuraDelTiempo = (compas) => {
  const c = TIME_SIGNATURES[compas];
  if (c?.compuesto) return 'negraConPuntillo';
  return c?.noteValue === 8 ? 'corchea' : 'quarter';
};

function MetronomeCuerpo({ compact, mini, initialPreferences }) {
  const {
    isPlaying,
    bpm,
    timeSignature,
    subdivision,
    soundPreset,
    volume,
    acento,
    currentBeat,
    loading,
    error,
    start,
    toggle,
    updateBpm,
    updateTimeSignature,
    updateSubdivision,
    updateSoundPreset,
    updateVolume,
    updateAcento,
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

  // El entrenamiento arranca el metrónomo si está parado: antes había que
  // iniciarlo primero, y con él sonando no se podían tocar los números
  const empezarEntrenamiento = async () => {
    if (tempoTrainer.startTraining() && !isPlaying) await start();
  };

  // Versión simplificada para el panel flotante: lo que se toca en vivo
  // (tempo, compás, empezar y parar). Lo demás está en la página completa.
  if (mini) {
    return (
      <div className="metronome-mini">
        {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

        <div className="metronome-mini-bpm">
          <button type="button" className="metronome-mini-paso" onClick={() => decrementBpm(5)} aria-label="Bajar 5 BPM">−5</button>
          <button type="button" className="metronome-mini-paso" onClick={() => decrementBpm(1)} aria-label="Bajar 1 BPM">−1</button>
          <div className="metronome-mini-valor">
            <strong>{bpm}</strong>
            <span>BPM</span>
          </div>
          <button type="button" className="metronome-mini-paso" onClick={() => incrementBpm(1)} aria-label="Subir 1 BPM">+1</button>
          <button type="button" className="metronome-mini-paso" onClick={() => incrementBpm(5)} aria-label="Subir 5 BPM">+5</button>
        </div>

        <MetronomeVisualizer
          currentBeat={currentBeat}
          totalBeats={timeSignatureBeats}
          isPlaying={isPlaying}
          acento={acento}
        />

        <div className="metronome-mini-fila">
          <Desplegable
            className="desplegable--compacto"
            value={timeSignature}
            onChange={updateTimeSignature}
            ariaLabel="Compás"
            opciones={Object.keys(TIME_SIGNATURES).map((c) => ({ value: c, label: c }))}
          />
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={tapTempo}>
            <Icono nombre="hand-pointing" className="me-1" />
            Tap
          </button>
          <button type="button" className="btn btn-sm btn-primary metronome-mini-play" onClick={toggle} disabled={loading}>
            <Icono nombre={isPlaying ? "pause" : "play"} peso="fill" className="me-1" />
            {isPlaying ? 'Pausar' : 'Iniciar'}
          </button>
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
              <Icono nombre="metronome" />
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
                <Icono nombre="warning" className="me-2" />
                {error}
              </div>
            )}

            {/* "♩ = 125" y debajo el tempo clásico que le corresponde */}
            <div className="text-center mb-4">
              <div className="bpm-display">
                <div className="bpm-fila">
                  <span className="bpm-figura" aria-hidden="true">
                    <FiguraRitmica tipo={figuraDelTiempo(timeSignature)} />
                    <span>=</span>
                  </span>
                  <div className="bpm-value" aria-label={`${bpm} BPM`}>{bpm}</div>
                </div>
                <div className="bpm-tempo-clasico">{tempoClasico(bpm).nombre}</div>
                <div className="text-secondary small mt-2">
                  {timeSignature} • {subdivisionName}{acento === 0 ? ' • Sin acento' : ''}
                </div>
              </div>
            </div>

            {/* Beat Visualizer */}
            <MetronomeVisualizer
              currentBeat={currentBeat}
              totalBeats={timeSignatureBeats}
              isPlaying={isPlaying}
              acento={acento}
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
                    <Icono nombre={isPlaying ? "pause" : "play"} peso="fill" className="me-2" />
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
              volume={volume}
              acento={acento}
              totalBeats={timeSignatureBeats}
              onBpmChange={updateBpm}
              onTimeSignatureChange={updateTimeSignature}
              onSubdivisionChange={updateSubdivision}
              onVolumeChange={updateVolume}
              onAcentoChange={updateAcento}
              onIncrement={incrementBpm}
              onDecrement={decrementBpm}
              onTapTempo={tapTempo}
            />
          </div>

          {/* El entrenador, justo después de los controles: es de lo que más
              se usa al estudiar */}
          <div className="card p-4 mb-4">
            <TempoTrainer
              config={tempoTrainer.config}
              onConfigChange={tempoTrainer.updateConfig}
              isActive={tempoTrainer.isActive}
              isPaused={tempoTrainer.isPaused}
              currentBpm={tempoTrainer.currentTrainingBpm}
              progress={tempoTrainer.progress}
              hasReachedTarget={tempoTrainer.hasReachedTarget}
              onStart={empezarEntrenamiento}
              onTogglePause={tempoTrainer.togglePause}
              onStop={tempoTrainer.stopTraining}
              isMetronomePlaying={isPlaying}
            />
          </div>

          <div className="card p-4 mb-4">
            <TempoPresets
              currentBpm={bpm}
              onPresetSelect={setPreset}
            />
          </div>

          <div className="card p-4">
            <SoundPresetSelector
              currentPreset={soundPreset}
              onPresetSelect={updateSoundPreset}
            />
          </div>
        </div>
      </div>

      {/* Help Text */}
      {!compact && (
        <div className="metronome-help-text mt-4">
          <Icono nombre="info" className="me-2" />
          <strong>Tip:</strong> Todo se puede cambiar mientras suena: tempo, compás, acento,
          subdivisión y sonido. El cambio se oye desde el siguiente click.
        </div>
      )}
      </div>
    </div>
  );
}

export default Metronome;

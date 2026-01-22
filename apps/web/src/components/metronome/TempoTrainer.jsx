/**
 * Tempo Trainer Component
 *
 * UI for configuring and running tempo training sessions
 * Gradually increases BPM over time to help build speed
 */

function TempoTrainer({
  config,
  onConfigChange,
  isActive,
  isPaused,
  currentBpm,
  progress,
  hasReachedTarget,
  onStart,
  onTogglePause,
  onStop,
  isMetronomePlaying
}) {
  const handleInputChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    onConfigChange({ [field]: numValue });
  };

  // Training is available when metronome is playing and training is active
  const canControl = isMetronomePlaying && isActive;

  return (
    <div className="tempo-trainer">
      <label className="form-label-modern mb-3">
        <i className="bi bi-graph-up me-2"></i>
        Entrenador de Tempo
      </label>

      {!isActive ? (
        // Configuration Mode
        <div className="trainer-config">
          <div className="trainer-input-row mb-3">
            <div className="trainer-input-group">
              <label className="trainer-input-label">Inicio</label>
              <div className="d-flex align-items-center gap-1">
                <input
                  type="number"
                  className="form-control-modern trainer-input"
                  value={config.startBpm}
                  onChange={(e) => handleInputChange('startBpm', e.target.value)}
                  min="40"
                  max="200"
                  disabled={isMetronomePlaying}
                />
                <span className="trainer-input-unit">BPM</span>
              </div>
            </div>
            <div className="trainer-arrow">
              <i className="bi bi-arrow-right"></i>
            </div>
            <div className="trainer-input-group">
              <label className="trainer-input-label">Objetivo</label>
              <div className="d-flex align-items-center gap-1">
                <input
                  type="number"
                  className="form-control-modern trainer-input"
                  value={config.targetBpm}
                  onChange={(e) => handleInputChange('targetBpm', e.target.value)}
                  min="50"
                  max="240"
                  disabled={isMetronomePlaying}
                />
                <span className="trainer-input-unit">BPM</span>
              </div>
            </div>
          </div>

          <div className="trainer-input-row mb-3">
            <div className="trainer-input-group flex-grow-1">
              <label className="trainer-input-label">Incremento</label>
              <div className="d-flex align-items-center gap-2">
                <span className="trainer-input-prefix">+</span>
                <input
                  type="number"
                  className="form-control-modern trainer-input-small"
                  value={config.incrementBpm}
                  onChange={(e) => handleInputChange('incrementBpm', e.target.value)}
                  min="1"
                  max="20"
                  disabled={isMetronomePlaying}
                />
                <span className="trainer-input-unit">BPM cada</span>
                <input
                  type="number"
                  className="form-control-modern trainer-input-small"
                  value={config.barsPerIncrement}
                  onChange={(e) => handleInputChange('barsPerIncrement', e.target.value)}
                  min="1"
                  max="16"
                  disabled={isMetronomePlaying}
                />
                <span className="trainer-input-unit">compases</span>
              </div>
            </div>
          </div>

          {config.startBpm >= config.targetBpm && (
            <div className="trainer-warning mb-3">
              <i className="bi bi-exclamation-triangle me-1"></i>
              El tempo inicial debe ser menor que el objetivo
            </div>
          )}

          <button
            className="btn-trainer-start"
            onClick={onStart}
            disabled={!isMetronomePlaying || config.startBpm >= config.targetBpm}
          >
            <i className="bi bi-play-fill me-2"></i>
            {isMetronomePlaying ? 'Iniciar Entrenamiento' : 'Inicia el metrónomo primero'}
          </button>
        </div>
      ) : (
        // Active Training Mode
        <div className="trainer-active">
          {/* Progress Display */}
          <div className="trainer-progress-container mb-3">
            <div className="trainer-progress-header">
              <span className="trainer-current-bpm">{currentBpm} BPM</span>
              <span className="trainer-target-bpm">/ {config.targetBpm} BPM</span>
            </div>
            <div className="trainer-progress-bar">
              <div
                className={`trainer-progress-fill ${hasReachedTarget ? 'completed' : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="trainer-progress-label">
              {hasReachedTarget ? (
                <span className="trainer-success">
                  <i className="bi bi-check-circle me-1"></i>
                  ¡Objetivo alcanzado!
                </span>
              ) : isPaused ? (
                <span className="trainer-paused">
                  <i className="bi bi-pause-circle me-1"></i>
                  Pausado
                </span>
              ) : (
                <span>
                  +{config.incrementBpm} BPM cada {config.barsPerIncrement} compases
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="trainer-controls">
            <button
              className={`btn-trainer-control ${isPaused ? 'resume' : 'pause'}`}
              onClick={onTogglePause}
              disabled={!canControl || hasReachedTarget}
            >
              <i className={`bi bi-${isPaused ? 'play' : 'pause'}-fill me-1`}></i>
              {isPaused ? 'Reanudar' : 'Pausar'}
            </button>
            <button
              className="btn-trainer-control stop"
              onClick={onStop}
            >
              <i className="bi bi-stop-fill me-1"></i>
              Detener
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TempoTrainer;

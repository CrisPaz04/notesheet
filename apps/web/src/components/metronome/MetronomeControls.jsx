/**
 * Metronome Controls Component
 *
 * Provides UI controls for BPM, time signature, subdivisions, and volume
 */

import { TIME_SIGNATURES, SUBDIVISIONS } from '@notesheet/core/src/audio/metronomeEngine';

function MetronomeControls({
  bpm,
  timeSignature,
  subdivision,
  volume,
  isPlaying,
  onBpmChange,
  onTimeSignatureChange,
  onSubdivisionChange,
  onVolumeChange,
  onIncrement,
  onDecrement,
  onTapTempo
}) {
  return (
    <div className="metronome-controls">
      {/* BPM Control */}
      <div className="bpm-control-section mb-4">
        <label className="form-label-modern">Tempo (BPM)</label>

        <div className="d-flex align-items-center gap-2 mb-3">
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onDecrement(5)}
            title="Disminuir 5 BPM"
          >
            <i className="bi bi-dash-lg"></i>
          </button>

          <input
            type="number"
            className="form-control text-center"
            value={bpm}
            onChange={(e) => onBpmChange(e.target.value)}
            min="40"
            max="240"
            style={{ maxWidth: '80px' }}
          />

          <button
            className="btn btn-sm btn-secondary"
            onClick={() => onIncrement(5)}
            title="Aumentar 5 BPM"
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>

        <input
          type="range"
          className="form-range"
          value={bpm}
          onChange={(e) => onBpmChange(e.target.value)}
          min="40"
          max="240"
        />

        <div className="d-flex justify-content-between metronome-controls-range-labels">
          <span>40</span>
          <span>120</span>
          <span>240</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="mb-4">
        <label className="form-label-modern">
          <i className="bi bi-volume-up me-2"></i>
          Volumen
        </label>

        <div className="d-flex align-items-center gap-3">
          <i className="bi bi-volume-mute text-secondary"></i>
          <input
            type="range"
            className="form-range flex-grow-1"
            value={volume}
            onChange={(e) => onVolumeChange(e.target.value)}
            min="0"
            max="1"
            step="0.05"
          />
          <i className="bi bi-volume-up text-secondary"></i>
        </div>
        <div className="text-center metronome-controls-hint">
          {Math.round(volume * 100)}%
        </div>
      </div>

      {/* Time Signature */}
      <div className="mb-4">
        <label className="form-label-modern">Compás</label>
        <select
          className="form-control-modern"
          value={timeSignature}
          onChange={(e) => onTimeSignatureChange(e.target.value)}
          disabled={isPlaying}
        >
          {Object.keys(TIME_SIGNATURES).map((sig) => (
            <option key={sig} value={sig}>
              {sig}
            </option>
          ))}
        </select>
        {isPlaying && (
          <div className="metronome-controls-hint mt-1">
            <i className="bi bi-info-circle me-1"></i>
            Pausa para cambiar el compás
          </div>
        )}
      </div>

      {/* Subdivision */}
      <div className="mb-4">
        <label className="form-label-modern">Subdivisión</label>
        <div className="btn-group w-100" role="group">
          {Object.entries(SUBDIVISIONS).map(([key, { name, icon }]) => (
            <button
              key={key}
              type="button"
              className={`btn ${
                subdivision === key ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => onSubdivisionChange(key)}
              title={name}
            >
              <span style={{ fontSize: '1.5rem', lineHeight: '1' }}>
                {icon}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tap Tempo */}
      <div className="mb-3">
        <button
          className="btn-tap-tempo w-100"
          onClick={onTapTempo}
        >
          <i className="bi bi-hand-index-thumb me-2"></i>
          Tap Tempo
        </button>
        <div className="metronome-controls-hint text-center mt-2">
          Toca el botón al ritmo deseado (mínimo 2 veces)
        </div>
      </div>
    </div>
  );
}

export default MetronomeControls;

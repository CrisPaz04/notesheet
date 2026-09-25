/**
 * Metronome Controls Component
 *
 * Provides UI controls for BPM, time signature, subdivisions, and volume
 */

import { TIME_SIGNATURES, SUBDIVISIONS } from '@notesheet/core/src/audio/metronomeEngine';
import { rellenoDeslizador } from "../../utils/rellenoDeslizador";
import Desplegable from "../Desplegable";
import Icono from "../Icono";

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
            <Icono nombre="minus" />
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
            <Icono nombre="plus" />
          </button>
        </div>

        <input
          type="range"
          className="form-range"
          value={bpm}
          onChange={(e) => onBpmChange(e.target.value)}
          min="40"
          max="240"
          style={rellenoDeslizador(bpm, 40, 240)}
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
          <Icono nombre="speaker-high" className="me-2" />
          Volumen
        </label>

        <div className="d-flex align-items-center gap-3">
          <Icono nombre="speaker-slash" className="text-secondary" />
          <input
            type="range"
            className="form-range flex-grow-1"
            value={volume}
            onChange={(e) => onVolumeChange(e.target.value)}
            min="0"
            max="1"
            step="0.05"
            style={rellenoDeslizador(volume, 0, 1)}
          />
          <Icono nombre="speaker-high" className="text-secondary" />
        </div>
        <div className="text-center metronome-controls-hint">
          {Math.round(volume * 100)}%
        </div>
      </div>

      {/* Time Signature */}
      <div className="mb-4">
        <label className="form-label-modern">Compás</label>
        <Desplegable
          value={timeSignature}
          onChange={onTimeSignatureChange}
          disabled={isPlaying}
          ariaLabel="Compás"
          opciones={Object.keys(TIME_SIGNATURES).map((sig) => ({ value: sig, label: sig }))}
        />
        {isPlaying && (
          <div className="metronome-controls-hint mt-1">
            <Icono nombre="info" className="me-1" />
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
          <Icono nombre="hand-tap" className="me-2" />
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

/**
 * Metronome Controls Component
 *
 * Provides UI controls for BPM, time signature, subdivisions, and volume
 */

import { TIME_SIGNATURES, SUBDIVISIONS } from '@notesheet/core/src/audio/metronomeEngine';
import { BPM_MIN, BPM_MAX, bpmAPosicion, posicionABpm } from '@notesheet/core/src/audio/temposClasicos';
import { rellenoDeslizador } from "../../utils/rellenoDeslizador";
import Desplegable from "../Desplegable";
import Icono from "../Icono";
import FiguraRitmica from "./FiguraRitmica";

// Todo se puede cambiar sonando: el motor lo aplica desde el siguiente click
function MetronomeControls({
  bpm,
  timeSignature,
  subdivision,
  volume,
  acento,
  totalBeats,
  onBpmChange,
  onTimeSignatureChange,
  onSubdivisionChange,
  onVolumeChange,
  onAcentoChange,
  onIncrement,
  onDecrement,
  onTapTempo
}) {
  const posicion = bpmAPosicion(bpm);
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
            min={BPM_MIN}
            max={BPM_MAX}
            aria-label="Tempo en BPM"
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

        {/* En escala logarítmica: de 15 a 500 en línea recta, lo que se usa de
            verdad (60–180) quedaría en un tercio del recorrido */}
        <input
          type="range"
          className="form-range"
          value={posicion}
          onChange={(e) => onBpmChange(posicionABpm(Number(e.target.value)))}
          min="0"
          max="1000"
          aria-label="Tempo"
          aria-valuetext={`${bpm} BPM`}
          style={rellenoDeslizador(posicion, 0, 1000)}
        />

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
            aria-label="Volumen"
            aria-valuetext={`${Math.round(volume * 100)}%`}
          />
          <Icono nombre="speaker-high" className="text-secondary" />
        </div>
      </div>

      {/* Compás y acento: el compás es cuántos tiempos tiene; el acento, cuál
          suena más fuerte (o ninguno) */}
      <div className="metronome-compas-acento mb-4">
        <div>
          <label className="form-label-modern">Compás</label>
          <Desplegable
            value={timeSignature}
            onChange={onTimeSignatureChange}
            ariaLabel="Compás"
            opciones={Object.keys(TIME_SIGNATURES).map((sig) => ({ value: sig, label: sig }))}
          />
        </div>
        <div>
          <label className="form-label-modern">Acento</label>
          <Desplegable
            value={String(acento)}
            onChange={(v) => onAcentoChange(Number(v))}
            ariaLabel="Acento"
            opciones={[
              { value: "0", label: "Sin acento" },
              ...Array.from({ length: totalBeats }, (_, i) => ({ value: String(i + 1), label: `En el ${i + 1}` }))
            ]}
          />
        </div>
      </div>

      {/* Subdivision */}
      <div className="mb-4">
        <label className="form-label-modern">Subdivisión</label>
        <div className="metronome-subdivisiones" role="group" aria-label="Subdivisión">
          {Object.entries(SUBDIVISIONS).map(([key, { name }]) => (
            <button
              key={key}
              type="button"
              className={`metronome-subdivision${subdivision === key ? ' activa' : ''}`}
              onClick={() => onSubdivisionChange(key)}
              aria-pressed={subdivision === key}
              title={name}
            >
              <FiguraRitmica tipo={key} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tap tempo */}
      <div className="mb-3">
        <button
          className="btn-tap-tempo w-100"
          onClick={onTapTempo}
        >
          <Icono nombre="hand-tap" className="me-2" />
          Tap tempo
        </button>
        <div className="metronome-controls-hint text-center mt-2">
          Toca el botón al ritmo deseado (mínimo 2 veces)
        </div>
      </div>
    </div>
  );
}

export default MetronomeControls;

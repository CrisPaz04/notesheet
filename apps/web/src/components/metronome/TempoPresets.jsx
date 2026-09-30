/**
 * Tempo Presets Component
 *
 * Los nombres clásicos del tempo. Se marca el que corresponde al tempo que
 * suena (su tramo, no solo el número exacto del botón), y se pueden tocar
 * sonando.
 */

import { TEMPOS_CLASICOS, tempoClasico } from '@notesheet/core/src/audio/temposClasicos';

function TempoPresets({ currentBpm, onPresetSelect }) {
  const actual = tempoClasico(currentBpm).nombre;

  return (
    <div className="tempo-presets">
      <label className="form-label-modern mb-3">Tempos clásicos</label>
      <div className="presets-grid">
        {TEMPOS_CLASICOS.map((preset) => (
          <button
            key={preset.nombre}
            type="button"
            className={`tempo-preset-btn ${preset.nombre === actual ? 'active' : ''}`}
            onClick={() => onPresetSelect(preset.bpm)}
            aria-pressed={preset.nombre === actual}
          >
            <div className="preset-name">{preset.nombre}</div>
            <div className="preset-bpm">{preset.bpm} BPM</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TempoPresets;

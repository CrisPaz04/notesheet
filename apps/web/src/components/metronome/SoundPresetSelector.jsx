/**
 * Sound Preset Selector Component
 *
 * Allows users to select different metronome click sounds
 */

import { SOUND_PRESETS } from '@notesheet/core/src/audio/metronomeEngine';
import Icono from "../Icono";

// Icons for each preset type
const PRESET_ICONS = {
  classic: 'music-note',
  woodBlock: 'cube',
  hiHat: 'disc',
  rimshot: 'lightning',
  softClick: 'speaker-low'
};

function SoundPresetSelector({
  currentPreset,
  onPresetSelect,
  onTestSound,
  isPlaying
}) {
  return (
    <div className="sound-presets">
      <label className="form-label-modern mb-3">Sonido del Click</label>
      <div className="sound-presets-grid">
        {Object.entries(SOUND_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            className={`sound-preset-btn ${currentPreset === key ? 'active' : ''}`}
            onClick={() => onPresetSelect(key)}
            disabled={isPlaying}
            title={preset.description}
          >
            <Icono nombre={PRESET_ICONS[key] || "music-note"} className="preset-icon" />
            <span className="preset-name">{preset.name}</span>
          </button>
        ))}
      </div>
      <button
        className="btn-test-sound mt-3"
        onClick={onTestSound}
        disabled={isPlaying}
      >
        <Icono nombre="speaker-high" className="me-2" />
        Probar Sonido
      </button>
    </div>
  );
}

export default SoundPresetSelector;

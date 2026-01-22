/**
 * Sound Preset Selector Component
 *
 * Allows users to select different metronome click sounds
 */

import { SOUND_PRESETS } from '@notesheet/core/src/audio/metronomeEngine';

// Icons for each preset type
const PRESET_ICONS = {
  classic: 'bi-music-note',
  woodBlock: 'bi-box',
  hiHat: 'bi-disc',
  rimshot: 'bi-lightning',
  softClick: 'bi-volume-down'
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
            <i className={`bi ${PRESET_ICONS[key] || 'bi-music-note'} preset-icon`}></i>
            <span className="preset-name">{preset.name}</span>
          </button>
        ))}
      </div>
      <button
        className="btn-test-sound mt-3"
        onClick={onTestSound}
        disabled={isPlaying}
      >
        <i className="bi bi-volume-up me-2"></i>
        Probar Sonido
      </button>
    </div>
  );
}

export default SoundPresetSelector;

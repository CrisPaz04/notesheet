/**
 * Sound Preset Selector Component
 *
 * Allows users to select different metronome click sounds. Al elegir uno
 * suena (con el metrónomo parado): no hay botón de probar
 */

import { SOUND_PRESETS } from '@notesheet/core/src/audio/metronomeEngine';
import Icono from "../Icono";

// Icons for each preset type
const PRESET_ICONS = {
  classic: 'music-note',
  woodBlock: 'cube',
  hiHat: 'disc',
  rimshot: 'lightning',
  softClick: 'speaker-low',
  claves: 'claves',
  cencerro: 'cencerro',
  palmas: 'hands-clapping',
  bombo: 'bombo',
  electronico: 'wave-square'
};

function SoundPresetSelector({
  currentPreset,
  onPresetSelect
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
            aria-pressed={currentPreset === key}
            title={preset.description}
          >
            <Icono nombre={PRESET_ICONS[key] || "music-note"} className="preset-icon" />
            <span className="preset-name">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default SoundPresetSelector;

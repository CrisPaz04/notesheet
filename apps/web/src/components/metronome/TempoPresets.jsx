/**
 * Tempo Presets Component
 *
 * Provides quick access to common tempo markings
 */

const TEMPO_PRESETS = [
  { name: 'Grave', bpm: 40 },
  { name: 'Largo', bpm: 50 },
  { name: 'Adagio', bpm: 70 },
  { name: 'Andante', bpm: 90 },
  { name: 'Moderato', bpm: 110 },
  { name: 'Allegro', bpm: 140 },
  { name: 'Presto', bpm: 180 },
  { name: 'Prestissimo', bpm: 210 }
];

function TempoPresets({ currentBpm, onPresetSelect, isPlaying }) {
  // Check if current BPM matches a preset (within ±2 BPM tolerance)
  const isPresetActive = (presetBpm) => {
    return Math.abs(currentBpm - presetBpm) <= 2;
  };

  return (
    <div className="tempo-presets">
      <label className="form-label fw-bold mb-3">Tempo Clásicos</label>
      <div className="presets-grid">
        {TEMPO_PRESETS.map((preset) => (
          <button
            key={preset.name}
            className={`tempo-preset-btn ${
              isPresetActive(preset.bpm) ? 'active' : ''
            }`}
            onClick={() => onPresetSelect(preset.bpm)}
            disabled={isPlaying}
          >
            <div className="preset-name">{preset.name}</div>
            <div className="preset-bpm">{preset.bpm} BPM</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default TempoPresets;

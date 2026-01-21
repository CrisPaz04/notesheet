/**
 * Metronome Page
 *
 * Full-screen metronome tool for practice
 * Features: BPM control, time signatures, subdivisions, visual beat indicators
 */

import { useState } from 'react';

function Metronome({ compact = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
    // TODO: Implement metronome engine integration
  };

  return (
    <div className={compact ? '' : 'metronome-container container py-4'}>
      {!compact && (
        <div className="metronome-header mb-4">
          <h1>
            <i className="bi bi-hourglass-split me-2"></i>
            Metrónomo
          </h1>
          <p className="text-secondary mb-0">
            Practica con tempo preciso y visualización de tiempo
          </p>
        </div>
      )}

      <div className="metronome-card card p-4">
        {/* BPM Display */}
        <div className="text-center mb-4">
          <div className="bpm-display">
            <div className="bpm-value" style={{ fontSize: '4rem', fontWeight: '700', color: 'var(--color-primary)' }}>
              {bpm}
            </div>
            <div className="bpm-label text-secondary">BPM</div>
          </div>
        </div>

        {/* BPM Slider */}
        <div className="mb-4">
          <input
            type="range"
            className="form-range"
            min="40"
            max="240"
            value={bpm}
            onChange={(e) => setBpm(parseInt(e.target.value))}
          />
          <div className="d-flex justify-content-between text-secondary small">
            <span>40</span>
            <span>240</span>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="d-flex gap-3 justify-content-center">
          <button
            className="btn btn-lg btn-primary"
            onClick={togglePlay}
          >
            <i className={`bi bi-${isPlaying ? 'pause' : 'play'}-fill me-2`}></i>
            {isPlaying ? 'Pausar' : 'Iniciar'}
          </button>
        </div>

        {/* Coming Soon Message */}
        <div className="alert alert-info mt-4" role="alert">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Fase 1 Completada:</strong> Interfaz básica creada.
          Las funciones completas del metrónomo (motor de audio, subdivisiones,
          compases) se implementarán en la Fase 2.
        </div>
      </div>
    </div>
  );
}

export default Metronome;

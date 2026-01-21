/**
 * TunerControls Component
 *
 * Provides UI controls for tuner settings
 */

import { TRANSPOSING_INSTRUMENTS } from '@notesheet/core';

function TunerControls({
  referenceFrequency,
  currentInstrument,
  showConcertPitch,
  notationSystem,
  isRunning,
  onReferenceFrequencyChange,
  onInstrumentChange,
  onToggleConcertPitch,
  onToggleNotationSystem
}) {
  return (
    <div className="tuner-controls">
      {/* Reference Frequency (A4) */}
      <div className="mb-4">
        <label className="form-label fw-bold">
          Frecuencia de Referencia (A4)
        </label>

        <div className="d-flex align-items-center gap-2 mb-2">
          <input
            type="number"
            className="form-control text-center"
            value={referenceFrequency}
            onChange={(e) => onReferenceFrequencyChange(e.target.value)}
            min="430"
            max="450"
            disabled={isRunning}
            style={{ maxWidth: '80px' }}
          />
          <span className="text-secondary">Hz</span>
        </div>

        <input
          type="range"
          className="form-range"
          value={referenceFrequency}
          onChange={(e) => onReferenceFrequencyChange(e.target.value)}
          min="430"
          max="450"
          step="1"
          disabled={isRunning}
        />

        <div className="d-flex justify-content-between text-secondary small">
          <span>430</span>
          <span>440</span>
          <span>450</span>
        </div>

        <div className="text-secondary small mt-2">
          <i className="bi bi-info-circle me-1"></i>
          Estándar: 440 Hz
        </div>
      </div>

      {/* Instrument Selector */}
      <div className="mb-4">
        <label className="form-label fw-bold">Instrumento</label>
        <select
          className="form-select"
          value={currentInstrument}
          onChange={(e) => onInstrumentChange(e.target.value)}
          disabled={isRunning}
        >
          {Object.entries(TRANSPOSING_INSTRUMENTS).map(([id, instrument]) => (
            <option key={id} value={id}>
              {instrument.name}
            </option>
          ))}
        </select>
        <div className="text-secondary small mt-2">
          {TRANSPOSING_INSTRUMENTS[currentInstrument]?.description || ''}
        </div>
      </div>

      {/* Notation System Toggle */}
      <div className="mb-4">
        <label className="form-label fw-bold">Sistema de Notación</label>
        <div className="btn-group w-100" role="group">
          <button
            type="button"
            className={`btn ${
              notationSystem === 'latin' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={onToggleNotationSystem}
            disabled={isRunning}
          >
            DO-RE-MI
          </button>
          <button
            type="button"
            className={`btn ${
              notationSystem === 'english' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={onToggleNotationSystem}
            disabled={isRunning}
          >
            C-D-E
          </button>
        </div>
      </div>

      {/* Concert Pitch Toggle */}
      <div className="mb-3">
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="concertPitchToggle"
            checked={showConcertPitch}
            onChange={onToggleConcertPitch}
            disabled={isRunning}
          />
          <label className="form-check-label" htmlFor="concertPitchToggle">
            Mostrar tono de concierto
          </label>
        </div>
        <div className="text-secondary small mt-1">
          {showConcertPitch
            ? 'Muestra la nota real (concierto)'
            : `Muestra la nota para ${TRANSPOSING_INSTRUMENTS[currentInstrument]?.name}`}
        </div>
      </div>
    </div>
  );
}

export default TunerControls;

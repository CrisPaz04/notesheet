/**
 * StringModeSelector Component
 *
 * UI for selecting string tuner mode and instrument tunings
 */

import {
  STRING_TUNINGS,
  getStringFrequency,
  getInstrumentIcon
} from '@notesheet/core';
import Desplegable from '../Desplegable';
import Icono from "../Icono";

function StringModeSelector({
  stringModeEnabled,
  selectedTuning,
  selectedString,
  notationSystem,
  referenceFrequency,
  detectedMidi,
  centsDeviation,
  isRunning,
  onToggleStringMode,
  onTuningChange,
  onStringSelect
}) {
  const currentTuning = STRING_TUNINGS[selectedTuning];

  // Check if a string is "in tune" (within 5 cents and matching MIDI)
  const isStringInTune = (string) => {
    if (!isRunning || detectedMidi === null) return false;
    return detectedMidi === string.midi && Math.abs(centsDeviation) <= 5;
  };

  // Check if a string is being detected (close match)
  const isStringDetected = (string) => {
    if (!isRunning || detectedMidi === null) return false;
    return detectedMidi === string.midi;
  };

  // Get display note name based on notation system
  const getNoteName = (string) => {
    return notationSystem === 'latin' ? string.noteLatin : string.note;
  };

  // Group tunings by instrument for better organization
  const tuningGroups = Object.values(STRING_TUNINGS).reduce((acc, tuning) => {
    const group = tuning.instrument;
    if (!acc[group]) acc[group] = [];
    acc[group].push(tuning);
    return acc;
  }, {});

  return (
    <div className="string-mode-selector">
      {/* Toggle Switch */}
      <div className="string-mode-toggle mb-3">
        <div className="form-check form-switch">
          <input
            className="form-check-input"
            type="checkbox"
            id="stringModeSwitch"
            checked={stringModeEnabled}
            onChange={(e) => onToggleStringMode(e.target.checked)}
          />
          <label className="form-check-label string-mode-label" htmlFor="stringModeSwitch">
            <Icono nombre="music-notes" className="me-2" />
            Modo Cuerdas
          </label>
        </div>
        <p className="string-mode-hint">
          Afina cuerdas individuales de tu instrumento
        </p>
      </div>

      {stringModeEnabled && (
        <>
          {/* Tuning Selector */}
          <div className="mb-3">
            <label className="form-label-modern mb-2">
              <Icono nombre={currentTuning ? getInstrumentIcon(currentTuning.instrument) : "music-note"} className="me-2" />
              Afinación
            </label>
            <Desplegable
              value={selectedTuning}
              onChange={onTuningChange}
              ariaLabel="Afinación"
              grupos={Object.entries(tuningGroups).map(([group, tunings]) => ({
                label: group.charAt(0).toUpperCase() + group.slice(1),
                opciones: tunings.map((tuning) => ({ value: tuning.id, label: tuning.name }))
              }))}
            />
          </div>

          {/* String Grid */}
          {currentTuning && (
            <div className="string-grid">
              <label className="form-label-modern mb-2">
                Selecciona una cuerda
              </label>
              <div className="strings-container">
                {currentTuning.strings.map((string, index) => {
                  const stringNum = index + 1;
                  const isSelected = selectedString === index;
                  const inTune = isStringInTune(string);
                  const detected = isStringDetected(string);

                  return (
                    <button
                      key={index}
                      className={`string-btn ${isSelected ? 'selected' : ''} ${inTune ? 'in-tune' : ''} ${detected && !inTune ? 'detected' : ''}`}
                      onClick={() => onStringSelect(isSelected ? null : index)}
                    >
                      <span className="string-number">{stringNum}</span>
                      <span className="string-note">{getNoteName(string)}</span>
                      <span className="string-freq">
                        {Math.round(getStringFrequency(string.midi, referenceFrequency))} Hz
                      </span>
                      {inTune && (
                        <span className="string-check">
                          <Icono nombre="check-circle" peso="fill" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Target Display */}
          {selectedString !== null && currentTuning && (
            <div className="target-string-display mt-3">
              <div className="target-label">Afinando:</div>
              <div className="target-note">
                {getNoteName(currentTuning.strings[selectedString])}
              </div>
              <div className="target-freq">
                {Math.round(getStringFrequency(currentTuning.strings[selectedString].midi, referenceFrequency))} Hz
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default StringModeSelector;

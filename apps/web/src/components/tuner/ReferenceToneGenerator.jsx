/**
 * ReferenceToneGenerator Component
 *
 * Allows users to play reference tones for common notes
 */

import { useState } from 'react';
import { midiToFrequency } from '@notesheet/core/src/audio/pitchDetection';

// Common reference notes for brass and woodwind instruments
const REFERENCE_NOTES = [
  { name: 'DO3', nameLatin: 'DO3', midi: 48 },   // C3
  { name: 'RE3', nameLatin: 'RE3', midi: 50 },   // D3
  { name: 'MI3', nameLatin: 'MI3', midi: 52 },   // E3
  { name: 'FA3', nameLatin: 'FA3', midi: 53 },   // F3
  { name: 'SOL3', nameLatin: 'SOL3', midi: 55 }, // G3
  { name: 'LA3', nameLatin: 'LA3', midi: 57 },   // A3
  { name: 'SI3', nameLatin: 'SI3', midi: 59 },   // B3
  { name: 'DO4', nameLatin: 'DO4', midi: 60 },   // C4 (Middle C)
  { name: 'RE4', nameLatin: 'RE4', midi: 62 },   // D4
  { name: 'MI4', nameLatin: 'MI4', midi: 64 },   // E4
  { name: 'FA4', nameLatin: 'FA4', midi: 65 },   // F4
  { name: 'SOL4', nameLatin: 'SOL4', midi: 67 }, // G4
  { name: 'LA4', nameLatin: 'LA4', midi: 69 },   // A4 (440 Hz)
  { name: 'SI4', nameLatin: 'SI4', midi: 71 },   // B4
  { name: 'DO5', nameLatin: 'DO5', midi: 72 }    // C5
];

function ReferenceToneGenerator({
  referenceFrequency,
  notationSystem,
  onPlayTone,
  onStopTone,
  isPlaying,
  isRunning
}) {
  const [playingNote, setPlayingNote] = useState(null);

  const handleToneClick = (midiNote) => {
    if (isPlaying && playingNote === midiNote) {
      // Stop if clicking the same note that's playing
      onStopTone();
      setPlayingNote(null);
    } else {
      // Stop any current tone and play the new one
      if (isPlaying) {
        onStopTone();
      }
      const frequency = midiToFrequency(midiNote, referenceFrequency);
      onPlayTone(frequency);
      setPlayingNote(midiNote);
    }
  };

  const handleStop = () => {
    onStopTone();
    setPlayingNote(null);
  };

  return (
    <div className="reference-tone-generator">
      <label className="form-label-modern mb-3">
        <i className="bi bi-soundwave me-2"></i>
        Tonos de Referencia
      </label>

      <div className="reference-notes-grid">
        {REFERENCE_NOTES.map((note) => {
          const displayName = notationSystem === 'latin' ? note.nameLatin : note.name;
          const isA4 = note.midi === 69; // Highlight A4
          const isCurrentlyPlaying = isPlaying && playingNote === note.midi;

          return (
            <button
              key={note.midi}
              className={`reference-note-btn ${isA4 ? 'reference-note-btn-primary' : ''} ${isCurrentlyPlaying ? 'reference-note-btn-playing' : ''}`}
              onClick={() => handleToneClick(note.midi)}
              disabled={isRunning}
              title={`${displayName} - ${midiToFrequency(note.midi, referenceFrequency).toFixed(1)} Hz`}
            >
              {displayName}
              {isA4 && <div className="reference-note-label">A4</div>}
              {isCurrentlyPlaying && <i className="bi bi-volume-up-fill reference-note-playing-icon"></i>}
            </button>
          );
        })}
      </div>

      {isPlaying && (
        <div className="text-center mt-3">
          <button
            className="btn btn-sm btn-danger"
            onClick={handleStop}
          >
            <i className="bi bi-stop-fill me-1"></i>
            Detener Tono
          </button>
        </div>
      )}

      <div className="tuner-controls-hint mt-3">
        <i className="bi bi-info-circle me-2"></i>
        Toca una nota para escuchar su tono de referencia.
        LA4 (A4) es la nota estándar a {referenceFrequency} Hz.
      </div>
    </div>
  );
}

export default ReferenceToneGenerator;

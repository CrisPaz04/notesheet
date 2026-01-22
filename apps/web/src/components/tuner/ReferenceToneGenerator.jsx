/**
 * ReferenceToneGenerator Component
 *
 * Allows users to play reference tones for common notes
 */

import { useState } from 'react';
import { midiToFrequency } from '@notesheet/core/src/audio/pitchDetection';

// Common reference notes for instruments
const REFERENCE_NOTES = [
  { nameEnglish: 'C3', nameLatin: 'DO3', midi: 48 },
  { nameEnglish: 'D3', nameLatin: 'RE3', midi: 50 },
  { nameEnglish: 'E3', nameLatin: 'MI3', midi: 52 },
  { nameEnglish: 'F3', nameLatin: 'FA3', midi: 53 },
  { nameEnglish: 'G3', nameLatin: 'SOL3', midi: 55 },
  { nameEnglish: 'A3', nameLatin: 'LA3', midi: 57 },
  { nameEnglish: 'B3', nameLatin: 'SI3', midi: 59 },
  { nameEnglish: 'C4', nameLatin: 'DO4', midi: 60 },
  { nameEnglish: 'D4', nameLatin: 'RE4', midi: 62 },
  { nameEnglish: 'E4', nameLatin: 'MI4', midi: 64 },
  { nameEnglish: 'F4', nameLatin: 'FA4', midi: 65 },
  { nameEnglish: 'G4', nameLatin: 'SOL4', midi: 67 },
  { nameEnglish: 'A4', nameLatin: 'LA4', midi: 69 },
  { nameEnglish: 'B4', nameLatin: 'SI4', midi: 71 },
  { nameEnglish: 'C5', nameLatin: 'DO5', midi: 72 }
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

  return (
    <div className="reference-tone-generator">
      <label className="form-label-modern mb-3">
        <i className="bi bi-soundwave me-2"></i>
        Tonos de Referencia
      </label>

      <div className="reference-notes-grid">
        {REFERENCE_NOTES.map((note) => {
          const displayName = notationSystem === 'latin' ? note.nameLatin : note.nameEnglish;
          const isA4 = note.midi === 69;
          const isCurrentlyPlaying = isPlaying && playingNote === note.midi;
          // Only highlight A4 when no tone is playing
          const showA4Highlight = isA4 && !isPlaying;

          return (
            <button
              key={note.midi}
              className={`reference-note-btn ${showA4Highlight ? 'reference-note-btn-primary' : ''} ${isCurrentlyPlaying ? 'reference-note-btn-playing' : ''}`}
              onClick={() => handleToneClick(note.midi)}
              disabled={isRunning}
              title={`${displayName} - ${midiToFrequency(note.midi, referenceFrequency).toFixed(1)} Hz`}
            >
              {displayName}
              {isCurrentlyPlaying && <i className="bi bi-volume-up-fill reference-note-playing-icon"></i>}
            </button>
          );
        })}
      </div>

      <div className="tuner-controls-hint mt-3">
        <i className="bi bi-info-circle me-2"></i>
        Toca una nota para escuchar su tono.
        {isPlaying ? ' Toca de nuevo para detener.' : ''}
      </div>
    </div>
  );
}

export default ReferenceToneGenerator;

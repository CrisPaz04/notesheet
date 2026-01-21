/**
 * Tuner Page
 *
 * Full-screen tuner tool for instrument tuning
 * Features: Chromatic pitch detection, transposing instruments, reference tones
 */

import { useState } from 'react';

function Tuner({ compact = false }) {
  const [isListening, setIsListening] = useState(false);
  const [detectedNote, setDetectedNote] = useState('--');
  const [centsOff, setCentsOff] = useState(0);

  const toggleListening = () => {
    setIsListening(!isListening);
    // TODO: Implement tuner engine integration
  };

  return (
    <div className={compact ? '' : 'tuner-container container py-4'}>
      {!compact && (
        <div className="tuner-header mb-4">
          <h1>
            <i className="bi bi-soundwave me-2"></i>
            Afinador
          </h1>
          <p className="text-secondary mb-0">
            Afina tu instrumento con detección cromática precisa
          </p>
        </div>
      )}

      <div className="tuner-card card p-4">
        {/* Detected Note Display */}
        <div className="text-center mb-4">
          <div className="note-name" style={{ fontSize: '4rem', fontWeight: '700', color: 'var(--text-light-primary)' }}>
            {detectedNote}
          </div>
          <div className="cents-indicator text-secondary" style={{ fontSize: '2rem' }}>
            {centsOff > 0 ? '+' : ''}{centsOff} cents
          </div>
        </div>

        {/* Visual Gauge Placeholder */}
        <div className="tuner-gauge bg-secondary bg-opacity-10 rounded p-4 mb-4 text-center" style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="text-secondary">
            <i className="bi bi-music-note-beamed" style={{ fontSize: '3rem' }}></i>
            <p className="mt-2">Indicador visual se implementará en Fase 3</p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="d-flex gap-3 justify-content-center">
          <button
            className="btn btn-lg btn-primary"
            onClick={toggleListening}
          >
            <i className={`bi bi-mic${isListening ? '-fill' : ''} me-2`}></i>
            {isListening ? 'Detener' : 'Iniciar Afinación'}
          </button>
        </div>

        {/* Coming Soon Message */}
        <div className="alert alert-info mt-4" role="alert">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Fase 1 Completada:</strong> Interfaz básica creada.
          Las funciones completas del afinador (detección de tono, micrófono,
          tonos de referencia) se implementarán en la Fase 3.
        </div>
      </div>
    </div>
  );
}

export default Tuner;

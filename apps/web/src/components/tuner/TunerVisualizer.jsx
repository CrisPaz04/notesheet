/**
 * TunerVisualizer Component
 *
 * Displays tuning gauge, detected note, and frequency
 */

import { getStringFrequency } from '@notesheet/core';

function TunerVisualizer({
  detectedNote,
  detectedFrequency,
  centsDeviation,
  tuningStatus,
  isRunning,
  // String mode props
  stringModeEnabled,
  targetString,
  notationSystem,
  referenceFrequency
}) {
  // Calculate needle position (-50 to +50 cents maps to -45deg to +45deg)
  const needleRotation = Math.max(-45, Math.min(45, (centsDeviation / 50) * 45));

  // Get status color
  const getStatusColor = () => {
    switch (tuningStatus) {
      case 'in-tune':
        return '#4caf50'; // Green
      case 'flat':
      case 'sharp':
        return Math.abs(centsDeviation) > 15 ? '#f44336' : '#ffc107'; // Red or Yellow
      default:
        return 'rgba(255, 255, 255, 0.3)'; // Gray
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (tuningStatus) {
      case 'in-tune':
        return 'Afinado';
      case 'flat':
        return 'Bemol';
      case 'sharp':
        return 'Sostenido';
      default:
        return 'Detectando...';
    }
  };

  // Get target note display name
  const getTargetNoteName = () => {
    if (!targetString) return null;
    return notationSystem === 'latin' ? targetString.noteLatin : targetString.note;
  };

  const targetNoteName = getTargetNoteName();
  const targetFreq = targetString ? getStringFrequency(targetString.midi, referenceFrequency) : null;

  return (
    <div className="tuner-visualizer">
      {/* Target Note Display (String Mode) */}
      {stringModeEnabled && targetString && (
        <div className="tuner-target-display">
          <span className="tuner-target-label">Afinando cuerda:</span>
          <span className="tuner-target-note">{targetNoteName}</span>
          <span className="tuner-target-freq">{targetFreq?.toFixed(1)} Hz</span>
        </div>
      )}

      {/* Note Display */}
      <div className="tuner-note-display">
        <div
          className={`tuner-note-name ${!detectedNote ? 'tuner-note-waiting' : ''}`}
          style={{ color: detectedNote ? getStatusColor() : 'var(--text-light-secondary)' }}
        >
          {detectedNote || (stringModeEnabled && targetString ? targetNoteName : (isRunning ? '♪' : '--'))}
        </div>
        <div className="tuner-frequency">
          {detectedFrequency ? `${detectedFrequency.toFixed(1)} Hz` : (targetFreq ? `Objetivo: ${targetFreq.toFixed(1)} Hz` : '--- Hz')}
        </div>
      </div>

      {/* Tuning Gauge */}
      <div className="tuner-gauge-container">
        {/* Gauge Background */}
        <svg
          className="tuner-gauge"
          viewBox="0 0 200 120"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Arc segments */}
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f44336" />
              <stop offset="30%" stopColor="#ffc107" />
              <stop offset="50%" stopColor="#4caf50" />
              <stop offset="70%" stopColor="#ffc107" />
              <stop offset="100%" stopColor="#f44336" />
            </linearGradient>
          </defs>

          {/* Background arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Colored arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Center mark */}
          <line
            x1="100"
            y1="25"
            x2="100"
            y2="35"
            stroke="#4caf50"
            strokeWidth="3"
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {[-40, -30, -20, -10, 10, 20, 30, 40].map((cents) => {
            const angle = (cents / 50) * 90; // -90 to +90 degrees
            const radians = ((angle - 90) * Math.PI) / 180;
            const x1 = 100 + 75 * Math.cos(radians);
            const y1 = 100 + 75 * Math.sin(radians);
            const x2 = 100 + 82 * Math.cos(radians);
            const y2 = 100 + 82 * Math.sin(radians);

            return (
              <line
                key={cents}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 255, 255, 0.3)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}

          {/* Needle */}
          {detectedNote && (
            <g transform={`rotate(${needleRotation} 100 100)`}>
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="30"
                stroke={getStatusColor()}
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle
                cx="100"
                cy="100"
                r="5"
                fill={getStatusColor()}
              />
            </g>
          )}
        </svg>

        {/* Cents labels */}
        <div className="tuner-gauge-labels">
          <span className="tuner-gauge-label tuner-gauge-label-left">-50¢</span>
          <span className="tuner-gauge-label tuner-gauge-label-center">0</span>
          <span className="tuner-gauge-label tuner-gauge-label-right">+50¢</span>
        </div>
      </div>

      {/* Cents Display */}
      <div className="tuner-cents-display">
        <div
          className="tuner-cents-value"
          style={{ color: detectedNote ? getStatusColor() : 'var(--text-light-secondary)' }}
        >
          {detectedNote
            ? `${centsDeviation > 0 ? '+' : ''}${Math.round(centsDeviation)}¢`
            : '0¢'
          }
        </div>
        <div
          className="tuner-status-text"
          style={{ color: detectedNote ? getStatusColor() : 'var(--text-light-secondary)' }}
        >
          {detectedNote
            ? getStatusText()
            : (isRunning ? 'Toca una nota...' : 'Presiona Iniciar')
          }
        </div>
      </div>
    </div>
  );
}

export default TunerVisualizer;

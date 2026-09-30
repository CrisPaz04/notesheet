/**
 * Metronome Visualizer Component
 *
 * Displays beat indicators with visual feedback
 */

// `acento`: el tiempo acentuado, desde 1; 0 es ninguno
function MetronomeVisualizer({ currentBeat, totalBeats, isPlaying, acento = 1 }) {
  // Generate beat indicators based on time signature
  const beatIndicators = Array.from({ length: totalBeats }, (_, index) => {
    const isActive = isPlaying && index === currentBeat;
    const isAccent = acento > 0 && index === acento - 1;

    return (
      <div
        key={index}
        className={`beat-indicator ${isActive ? 'active' : ''} ${
          isAccent ? 'accent' : ''
        }`}
      >
        {/* El signo de acento (>) sobre el tiempo acentuado */}
        {isAccent && <span className="beat-acento" aria-label="acentuado">&gt;</span>}
        <div className="beat-number">{index + 1}</div>
      </div>
    );
  });

  return (
    <div className="metronome-visualizer">
      <div className="beat-indicators">{beatIndicators}</div>
    </div>
  );
}

export default MetronomeVisualizer;

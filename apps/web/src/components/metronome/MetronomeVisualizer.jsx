/**
 * Metronome Visualizer Component
 *
 * Displays beat indicators with visual feedback
 */

function MetronomeVisualizer({ currentBeat, totalBeats, isPlaying }) {
  // Generate beat indicators based on time signature
  const beatIndicators = Array.from({ length: totalBeats }, (_, index) => {
    const isActive = isPlaying && index === currentBeat;
    const isAccent = index === 0; // First beat is always accent

    return (
      <div
        key={index}
        className={`beat-indicator ${isActive ? 'active' : ''} ${
          isAccent ? 'accent' : ''
        }`}
      >
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

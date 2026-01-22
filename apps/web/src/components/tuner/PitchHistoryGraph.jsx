/**
 * PitchHistoryGraph Component
 *
 * SVG-based rolling graph showing pitch deviation history
 * Color zones indicate tuning accuracy
 */

function PitchHistoryGraph({
  history,
  trend,
  stabilityRating,
  averageCents,
  isRunning
}) {
  // Graph dimensions
  const width = 300;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 20, left: 35 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Y-axis range: -50 to +50 cents
  const yMin = -50;
  const yMax = 50;

  // Convert cents to Y coordinate
  const centsToY = (cents) => {
    const clampedCents = Math.max(yMin, Math.min(yMax, cents));
    const normalized = (clampedCents - yMin) / (yMax - yMin);
    return padding.top + graphHeight - (normalized * graphHeight);
  };

  // Build smooth path data from history using cubic bezier curves
  const buildPath = () => {
    if (history.length < 2) return '';

    const points = history.map((sample, index) => {
      const x = padding.left + (index / (history.length - 1 || 1)) * graphWidth;
      const y = centsToY(sample.cents);
      return { x, y };
    });

    // Start with move to first point
    let path = `M ${points[0].x},${points[0].y}`;

    // Use smooth curve through points
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      // Control point for smooth curve (midpoint with slight smoothing)
      const cpX = (prev.x + curr.x) / 2;

      path += ` Q ${cpX},${prev.y} ${cpX},${(prev.y + curr.y) / 2}`;
      if (i === points.length - 1) {
        path += ` Q ${cpX},${curr.y} ${curr.x},${curr.y}`;
      }
    }

    return path;
  };

  // Build simple line path for fill (smooth curves can cause fill issues)
  const buildLinePath = () => {
    if (history.length < 2) return '';

    const points = history.map((sample, index) => {
      const x = padding.left + (index / (history.length - 1 || 1)) * graphWidth;
      const y = centsToY(sample.cents);
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Build gradient fill area
  const buildFillPath = () => {
    if (history.length < 2) return '';

    const linePath = buildLinePath();
    const firstX = padding.left;
    const lastX = padding.left + graphWidth;
    const baseY = centsToY(0);

    return `${linePath} L ${lastX},${baseY} L ${firstX},${baseY} Z`;
  };

  // Y-axis labels
  const yLabels = [50, 25, 0, -25, -50];

  // Trend icon and text
  const getTrendInfo = () => {
    if (!trend) return { icon: '', text: '' };

    switch (trend) {
      case 'rising':
        return { icon: 'bi-arrow-up-right', text: 'Subiendo', color: '#f59e0b' };
      case 'falling':
        return { icon: 'bi-arrow-down-right', text: 'Bajando', color: '#f59e0b' };
      case 'stable':
        return { icon: 'bi-arrow-right', text: 'Estable', color: '#10b981' };
      default:
        return { icon: '', text: '' };
    }
  };

  // Stability color
  const getStabilityColor = () => {
    switch (stabilityRating) {
      case 'excellent': return '#10b981';
      case 'good': return '#34d399';
      case 'fair': return '#fbbf24';
      case 'poor': return '#f87171';
      default: return 'var(--text-light-muted)';
    }
  };

  const trendInfo = getTrendInfo();

  return (
    <div className="pitch-history-graph">
      <div className="graph-header">
        <span className="graph-title">
          <i className="bi bi-graph-up me-2"></i>
          Historial
        </span>
        {averageCents !== null && (
          <span className="graph-avg" style={{ color: Math.abs(averageCents) <= 5 ? '#10b981' : '#f59e0b' }}>
            {averageCents > 0 ? '+' : ''}{averageCents}¢
          </span>
        )}
      </div>

      <svg width={width} height={height} className="history-svg">
        {/* Background zones */}
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#f87171" stopOpacity="0.3" />
            <stop offset="30%" stopColor="#fbbf24" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.3" />
            <stop offset="70%" stopColor="#fbbf24" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Zone backgrounds */}
        {/* Red zone (sharp) */}
        <rect
          x={padding.left}
          y={padding.top}
          width={graphWidth}
          height={graphHeight * 0.3}
          fill="rgba(248, 113, 113, 0.1)"
        />
        {/* Yellow zone (slightly sharp) */}
        <rect
          x={padding.left}
          y={padding.top + graphHeight * 0.3}
          width={graphWidth}
          height={graphHeight * 0.1}
          fill="rgba(251, 191, 36, 0.1)"
        />
        {/* Green zone (in tune) */}
        <rect
          x={padding.left}
          y={padding.top + graphHeight * 0.4}
          width={graphWidth}
          height={graphHeight * 0.2}
          fill="rgba(16, 185, 129, 0.15)"
        />
        {/* Yellow zone (slightly flat) */}
        <rect
          x={padding.left}
          y={padding.top + graphHeight * 0.6}
          width={graphWidth}
          height={graphHeight * 0.1}
          fill="rgba(251, 191, 36, 0.1)"
        />
        {/* Red zone (flat) */}
        <rect
          x={padding.left}
          y={padding.top + graphHeight * 0.7}
          width={graphWidth}
          height={graphHeight * 0.3}
          fill="rgba(248, 113, 113, 0.1)"
        />

        {/* Center line (0 cents) */}
        <line
          x1={padding.left}
          y1={centsToY(0)}
          x2={padding.left + graphWidth}
          y2={centsToY(0)}
          stroke="var(--color-primary)"
          strokeWidth="1"
          strokeDasharray="4,4"
          opacity="0.5"
        />

        {/* Grid lines */}
        {yLabels.filter(v => v !== 0).map((value) => (
          <line
            key={value}
            x1={padding.left}
            y1={centsToY(value)}
            x2={padding.left + graphWidth}
            y2={centsToY(value)}
            stroke="var(--border-light)"
            strokeWidth="0.5"
            opacity="0.3"
          />
        ))}

        {/* Y-axis labels */}
        {yLabels.map((value) => (
          <text
            key={value}
            x={padding.left - 5}
            y={centsToY(value)}
            textAnchor="end"
            dominantBaseline="middle"
            className="graph-label"
            fontSize="10"
            fill="var(--text-light-muted)"
          >
            {value > 0 ? '+' : ''}{value}
          </text>
        ))}

        {/* X-axis label */}
        <text
          x={padding.left + graphWidth / 2}
          y={height - 4}
          textAnchor="middle"
          className="graph-label"
          fontSize="9"
          fill="var(--text-light-muted)"
        >
          Tiempo →
        </text>

        {/* Pitch history line */}
        {history.length >= 2 && (
          <>
            {/* Fill area */}
            <path
              d={buildFillPath()}
              fill="var(--color-primary)"
              opacity="0.15"
            />
            {/* Line */}
            <path
              d={buildPath()}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* Current value dot */}
        {history.length > 0 && (
          <circle
            cx={padding.left + graphWidth}
            cy={centsToY(history[history.length - 1].cents)}
            r="4"
            fill="var(--color-primary)"
            className="current-dot"
          />
        )}
      </svg>

      {/* Status indicators */}
      <div className="graph-status">
        {trendInfo.text && (
          <span className="status-item" style={{ color: trendInfo.color }}>
            <i className={`bi ${trendInfo.icon} me-1`}></i>
            {trendInfo.text}
          </span>
        )}
        {stabilityRating && (
          <span className="status-item" style={{ color: getStabilityColor() }}>
            <i className="bi bi-activity me-1"></i>
            {stabilityRating === 'excellent' && 'Excelente'}
            {stabilityRating === 'good' && 'Bueno'}
            {stabilityRating === 'fair' && 'Regular'}
            {stabilityRating === 'poor' && 'Inestable'}
          </span>
        )}
      </div>

      {/* No data message */}
      {!isRunning && history.length === 0 && (
        <div className="graph-no-data">
          <i className="bi bi-mic me-2"></i>
          Inicia el afinador para ver el historial
        </div>
      )}
    </div>
  );
}

export default PitchHistoryGraph;

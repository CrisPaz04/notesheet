import { useEffect, useRef } from "react";
import Icono from "../Icono";

/**
 * El historial de la afinación: una línea que corre de derecha a izquierda
 * con los cents de los últimos segundos, sobre las franjas de afinado (±5),
 * casi (±15) y fuera.
 *
 * Se pinta en un canvas en cada fotograma, con el eje X en **tiempo**: la
 * línea se desplaza a velocidad constante aunque las muestras lleguen a
 * trompicones. Antes era un SVG rehecho con cada muestra y con el eje X en
 * número de muestras, así que al empezar la línea se estiraba y encogía, y
 * avanzaba a saltos. Los cortes de sonido se ven como huecos.
 */

// Lo que cabe en el ancho del gráfico
const VENTANA_MS = 5000;
// Dos muestras más separadas que esto no se unen: ahí no sonaba nada
const HUECO_MS = 250;
const ESCALA = [50, 25, 0, -25, -50];

// -50..+50 cents -> alto..0
const centsAY = (cents, alto) => {
  const c = Math.max(-50, Math.min(50, cents));
  return alto * (0.5 - c / 100);
};

function dibujar(canvas, muestras, ahora, colores) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.dataset.dibujado = "si";
  const dpr = window.devicePixelRatio || 1;
  const ancho = canvas.clientWidth;
  const alto = canvas.clientHeight;
  if (canvas.width !== Math.round(ancho * dpr) || canvas.height !== Math.round(alto * dpr)) {
    canvas.width = Math.round(ancho * dpr);
    canvas.height = Math.round(alto * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, ancho, alto);

  // Línea del cero
  ctx.save();
  ctx.strokeStyle = colores.primario;
  ctx.globalAlpha = 0.5;
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, alto / 2);
  ctx.lineTo(ancho, alto / 2);
  ctx.stroke();
  ctx.restore();

  // Los tramos con sonido, de izquierda (antiguo) a derecha (ahora)
  const tramos = [];
  let tramo = [];
  let anterior = null;
  for (const m of muestras) {
    const edad = ahora - m.timestamp;
    if (edad > VENTANA_MS + HUECO_MS) continue;
    if (anterior && m.timestamp - anterior > HUECO_MS && tramo.length) {
      tramos.push(tramo);
      tramo = [];
    }
    tramo.push({ x: ancho - (edad / VENTANA_MS) * ancho, y: centsAY(m.cents, alto) });
    anterior = m.timestamp;
  }
  if (tramo.length) tramos.push(tramo);

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const puntos of tramos) {
    if (puntos.length < 2) continue;
    // Relleno hasta el cero
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = colores.primario;
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, alto / 2);
    for (const p of puntos) ctx.lineTo(p.x, p.y);
    ctx.lineTo(puntos[puntos.length - 1].x, alto / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = colores.primario;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);
    for (const p of puntos) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  // El punto de ahora, si aún suena
  const ultima = muestras[muestras.length - 1];
  if (ultima && ahora - ultima.timestamp < HUECO_MS) {
    const y = centsAY(ultima.cents, alto);
    const x = ancho - ((ahora - ultima.timestamp) / VENTANA_MS) * ancho;
    ctx.save();
    ctx.fillStyle = colores.primario;
    ctx.shadowColor = colores.primario;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function PitchHistoryGraph({
  history,
  trend,
  stabilityRating,
  isRunning
}) {
  const canvasRef = useRef(null);
  const historyRef = useRef(history);

  useEffect(() => {
    historyRef.current = history;
    // Al parar se vacía el historial: se borra lo pintado
    const canvas = canvasRef.current;
    if (!history.length && canvas?.dataset.dibujado) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [history]);

  // Un fotograma tras otro mientras suena el afinador; al pararlo, una
  // última vez para dejarlo limpio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!isRunning && !historyRef.current.length)) return;

    // Los colores del tema, releídos cada segundo por si se cambia
    let colores = null;
    let leidos = 0;
    const leerColores = (ahora) => {
      if (!colores || ahora - leidos > 1000) {
        const estilo = getComputedStyle(canvas);
        colores = { primario: estilo.getPropertyValue("--color-primary").trim() || "#2dd4bf" };
        leidos = ahora;
      }
      return colores;
    };

    let raf = null;
    const fotograma = () => {
      const ahora = Date.now();
      dibujar(canvas, historyRef.current, ahora, leerColores(ahora));
      raf = isRunning ? requestAnimationFrame(fotograma) : null;
    };
    fotograma();
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [isRunning]);

  // Trend icon and text
  const getTrendInfo = () => {
    if (!trend) return { icon: '', text: '' };

    switch (trend) {
      case 'rising':
        return { icon: 'arrow-up-right', text: 'Subiendo', color: '#f59e0b' };
      case 'falling':
        return { icon: 'arrow-down-right', text: 'Bajando', color: '#f59e0b' };
      case 'stable':
        return { icon: 'arrow-right', text: 'Estable', color: '#10b981' };
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
      <div className="historial-grafico">
        <div className="historial-escala" aria-hidden="true">
          {ESCALA.map((valor) => (
            <span key={valor} style={{ top: `${50 - valor}%` }}>
              {valor > 0 ? '+' : ''}{valor}
            </span>
          ))}
        </div>
        <canvas ref={canvasRef} className="historial-canvas" aria-label="Historial de la afinación" />
      </div>

      {/* Status indicators */}
      <div className="graph-status">
        {trendInfo.text && (
          <span className="status-item" style={{ color: trendInfo.color }}>
            <Icono nombre={trendInfo.icon} className="me-1" />
            {trendInfo.text}
          </span>
        )}
        {stabilityRating && (
          <span className="status-item" style={{ color: getStabilityColor() }}>
            <Icono nombre="pulse" className="me-1" />
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
          <Icono nombre="microphone" className="me-2" />
          Inicia el afinador para ver el historial
        </div>
      )}
    </div>
  );
}

export default PitchHistoryGraph;

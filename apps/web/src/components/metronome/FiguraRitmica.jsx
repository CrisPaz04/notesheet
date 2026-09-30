/**
 * Las figuras de cada subdivisión del metrónomo, dibujadas como en la
 * partitura: cabezas, plicas y barras. Los caracteres de música (♩ ♪ ♬) salen
 * distintos en cada sistema y no hay uno para el tresillo, el saltillo o la
 * galopa.
 *
 * Todo en un lienzo de 40 de alto; el ancho sale de cuántas notas hay.
 * Pinta con el color del texto.
 */

const CY = 34; // centro de las cabezas
const ARRIBA = 11; // donde acaban las plicas
const GRUESO = 3.6; // de las barras
const SEPARACION = 13;

// La plica sale del borde derecho de la cabeza
const plicaX = (cx) => cx + 3.6;

// Cada figura: dónde van las cabezas, qué barras las unen y los adornos
const FIGURAS = {
  // Una negra
  quarter: { notas: [0] },
  // El tiempo de 6/8, 9/8 y 12/8, y el de 7/8 (para "♩. =" y "♪ =")
  negraConPuntillo: { notas: [0], puntillo: 0 },
  corchea: { notas: [0], bandera: 0 },
  // Dos corcheas
  eighth: { notas: [0, 1], barras: [[0, 1]] },
  // Tres corcheas con el 3 encima
  triplet: { notas: [0, 1, 2], barras: [[0, 2]], tres: true },
  // Cuatro semicorcheas: dos barras enteras
  sixteenth: { notas: [0, 1, 2, 3], barras: [[0, 3]], barras2: [[0, 3]] },
  // Corchea con puntillo y semicorchea: la segunda barra, solo un trozo
  // en la semicorchea, apuntando a la anterior
  // (más separadas, para que quepa el puntillo)
  saltillo: { notas: [0, 1.6], barras: [[0, 1.6]], puntillo: 0, gancho: 1.6 },
  // Corchea y dos semicorcheas
  galopa: { notas: [0, 1, 2], barras: [[0, 2]], barras2: [[1, 2]] }
};

function FiguraRitmica({ tipo, className = "" }) {
  const figura = FIGURAS[tipo] || FIGURAS.quarter;
  const x = (i) => 7 + i * SEPARACION;
  const ultima = x(figura.notas[figura.notas.length - 1]);
  // El puntillo o la bandera de la última nota salen por la derecha
  const ancho = ultima + 7 + (figura.puntillo !== undefined || figura.bandera !== undefined ? 7 : 0);
  const barra = ([a, b], y) => (
    <rect
      key={`${a}-${b}-${y}`}
      x={plicaX(x(a))}
      y={y}
      width={plicaX(x(b)) + 1.5 - plicaX(x(a))}
      height={GRUESO}
    />
  );

  return (
    <svg
      className={`figura-ritmica ${className}`}
      viewBox={`0 0 ${ancho} 40`}
      height="1em"
      width={`${ancho / 40}em`}
      aria-hidden="true"
      fill="currentColor"
    >
      {figura.notas.map((n) => (
        <g key={n}>
          <ellipse cx={x(n)} cy={CY} rx="5" ry="3.6" transform={`rotate(-20 ${x(n)} ${CY})`} />
          <rect x={plicaX(x(n))} y={ARRIBA} width="1.5" height={CY - ARRIBA - 1} />
        </g>
      ))}
      {figura.barras?.map((b) => barra(b, ARRIBA))}
      {figura.barras2?.map((b) => barra(b, ARRIBA + GRUESO + 2.4))}
      {figura.gancho !== undefined && (
        <rect
          x={plicaX(x(figura.gancho)) - 6}
          y={ARRIBA + GRUESO + 2.4}
          width="7.5"
          height={GRUESO}
        />
      )}
      {figura.bandera !== undefined && (
        <path
          d={`M${plicaX(x(figura.bandera)) + 1.5} ${ARRIBA} c1 6 8 7 5.5 15 c0.5 -6 -3 -8.5 -5.5 -9.5 z`}
        />
      )}
      {figura.puntillo !== undefined && (
        <circle cx={x(figura.puntillo) + 8.5} cy={CY + 0.5} r="1.7" />
      )}
      {figura.tres && (
        <text
          x={(x(0) + ultima) / 2 + 2}
          y="9"
          fontSize="11"
          fontWeight="700"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
        >
          3
        </text>
      )}
    </svg>
  );
}

export default FiguraRitmica;

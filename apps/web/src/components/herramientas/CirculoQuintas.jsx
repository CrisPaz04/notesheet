import { nombrarTonalidad } from "@notesheet/core";

// Las doce posiciones, en el sentido de las agujas del reloj con DO arriba.
// Mayor en el anillo exterior, su relativa menor en el interior, y la
// armadura por fuera. Las tres de abajo llevan sus dos nombres enarmónicos.
const POSICIONES = [
  { mayor: ["DO"], menor: ["LAm"], armadura: "—" },
  { mayor: ["SOL"], menor: ["MIm"], armadura: "1♯" },
  { mayor: ["RE"], menor: ["SIm"], armadura: "2♯" },
  { mayor: ["LA"], menor: ["FA#m"], armadura: "3♯" },
  { mayor: ["MI"], menor: ["DO#m"], armadura: "4♯" },
  { mayor: ["SI", "DOb"], menor: ["SOL#m", "LAbm"], armadura: "5♯ / 7♭" },
  { mayor: ["FA#", "SOLb"], menor: ["RE#m", "MIbm"], armadura: "6♯ / 6♭" },
  { mayor: ["REb", "DO#"], menor: ["SIbm", "LA#m"], armadura: "5♭ / 7♯" },
  { mayor: ["LAb"], menor: ["FAm"], armadura: "4♭" },
  { mayor: ["MIb"], menor: ["DOm"], armadura: "3♭" },
  { mayor: ["SIb"], menor: ["SOLm"], armadura: "2♭" },
  { mayor: ["FA"], menor: ["REm"], armadura: "1♭" }
];

const C = 160;             // centro
const R_ARMADURA = 150;    // donde va el texto de la armadura
const R_EXTERIOR = 132;
const R_MEDIO = 90;
const R_INTERIOR = 50;

const punto = (r, grados) => {
  const rad = (grados * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
};

// Sector de corona entre dos radios, de a0 a a1 grados (0 = arriba)
const sector = (rExt, rInt, a0, a1) => {
  const [x0, y0] = punto(rExt, a0);
  const [x1, y1] = punto(rExt, a1);
  const [x2, y2] = punto(rInt, a1);
  const [x3, y3] = punto(rInt, a0);
  return `M${x0},${y0} A${rExt},${rExt} 0 0 1 ${x1},${y1} L${x2},${y2} A${rInt},${rInt} 0 0 0 ${x3},${y3} Z`;
};

/** Uno o dos nombres, apilados en el centro del sector. */
function Etiqueta({ nombres, r, angulo, tam, notacion }) {
  const [x, y] = punto(r, angulo);
  const lineas = nombres.map((n) => nombrarTonalidad(n, notacion));
  const alto = tam * 1.1;
  const inicio = y - ((lineas.length - 1) * alto) / 2;

  return (
    <text
      x={x}
      textAnchor="middle"
      dominantBaseline="central"
      style={{ fill: "var(--text-light-primary)", fontSize: lineas.length > 1 ? tam * 0.82 : tam, fontWeight: 600 }}
    >
      {lineas.map((l, i) => (
        <tspan key={l} x={x} y={inicio + i * alto}>{l}</tspan>
      ))}
    </text>
  );
}

/**
 * El círculo de quintas como imagen de referencia para mirar en vivo:
 * mayores fuera, relativas menores dentro y la armadura de cada una.
 *
 * No tiene interacción a propósito: es una chuleta. Se dibuja en vez de ser
 * una imagen para que siga el tema y la notación (DO-RE-MI o C-D-E) del
 * músico.
 */
function CirculoQuintas({ notacion = "latin" }) {
  return (
    <svg
      viewBox="0 0 320 320"
      className="circulo-quintas"
      role="img"
      aria-label="Círculo de quintas"
    >
      {POSICIONES.map((p, i) => {
        const a0 = i * 30 - 15;
        const a1 = i * 30 + 15;
        // Las posiciones pares un poco más marcadas, para distinguir sectores
        const tinte = i % 2 === 0 ? 0.22 : 0.12;
        const [xArmadura, yArmadura] = punto(R_ARMADURA, i * 30);
        return (
          <g key={p.mayor[0]}>
            <path
              d={sector(R_EXTERIOR, R_MEDIO, a0, a1)}
              style={{ fill: `rgba(var(--color-primary-rgb), ${tinte})`, stroke: "var(--border-strong)", strokeWidth: 1 }}
            />
            <path
              d={sector(R_MEDIO, R_INTERIOR, a0, a1)}
              style={{ fill: `rgba(var(--overlay-rgb), ${tinte / 2})`, stroke: "var(--border-strong)", strokeWidth: 1 }}
            />
            <Etiqueta nombres={p.mayor} r={(R_EXTERIOR + R_MEDIO) / 2} angulo={i * 30} tam={14} notacion={notacion} />
            <Etiqueta nombres={p.menor} r={(R_MEDIO + R_INTERIOR) / 2} angulo={i * 30} tam={11} notacion={notacion} />
            <text
              x={xArmadura}
              y={yArmadura}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fill: "var(--text-light-secondary)", fontSize: 9 }}
            >
              {p.armadura}
            </text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_INTERIOR} style={{ fill: "rgba(var(--overlay-rgb), 0.04)", stroke: "var(--border-strong)" }} />
      <text x={C} y={C - 7} textAnchor="middle" style={{ fill: "var(--text-light-secondary)", fontSize: 9 }}>Mayor fuera</text>
      <text x={C} y={C + 8} textAnchor="middle" style={{ fill: "var(--text-light-secondary)", fontSize: 9 }}>menor dentro</text>
    </svg>
  );
}

export default CirculoQuintas;

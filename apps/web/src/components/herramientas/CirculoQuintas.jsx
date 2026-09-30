import { nombrarTonalidad } from "@notesheet/core";

// Las doce posiciones, en el sentido de las agujas del reloj con DO arriba.
// Mayor en el anillo exterior, su relativa menor en el interior, y la
// armadura por fuera, en un pentagrama. Las tres de abajo llevan sus dos
// nombres enarmónicos y sus dos armaduras (`otra`): un pentagrama con los
// sostenidos y otro con los bemoles, el segundo más lejos del círculo.
// `armadura`: cuántas alteraciones, positivo sostenidos y negativo bemoles.
const POSICIONES = [
  { mayor: ["DO"], menor: ["LAm"], armadura: 0 },
  { mayor: ["SOL"], menor: ["MIm"], armadura: 1 },
  { mayor: ["RE"], menor: ["SIm"], armadura: 2 },
  { mayor: ["LA"], menor: ["FA#m"], armadura: 3 },
  { mayor: ["MI"], menor: ["DO#m"], armadura: 4 },
  { mayor: ["SI", "DOb"], menor: ["SOL#m", "LAbm"], armadura: 5, otra: -7 },
  { mayor: ["FA#", "SOLb"], menor: ["RE#m", "MIbm"], armadura: 6, otra: -6 },
  { mayor: ["REb", "DO#"], menor: ["SIbm", "LA#m"], armadura: -5, otra: 7 },
  { mayor: ["LAb"], menor: ["FAm"], armadura: -4 },
  { mayor: ["MIb"], menor: ["DOm"], armadura: -3 },
  { mayor: ["SIb"], menor: ["SOLm"], armadura: -2 },
  { mayor: ["FA"], menor: ["REm"], armadura: -1 }
];

const C = 210;             // centro
const R_ARMADURA = 176;    // donde va el centro de cada pentagrama
// Los pentagramas, más grandes que su dibujo base: en el panel (unos 300 px)
// a tamaño 1 las alteraciones apenas se distinguían
const ESCALA_ARMADURA = 1.4;
// Las tres de abajo llevan dos: la segunda, esto más abajo (fuera del círculo)
const SEGUNDA_ARMADURA = 46;
const R_EXTERIOR = 142;
const R_MEDIO = 98;
const R_INTERIOR = 56;

// --- La armadura en un pentagrama (clave de sol) ---
// Todo en unidades del SVG: 4 entre líneas, así que un paso (de línea a
// espacio) son 2. Los pasos se cuentan hacia abajo desde la quinta línea (FA5).
const ENTRE_LINEAS = 4;
const PASO = ENTRE_LINEAS / 2;
// Dónde va cada alteración, en el orden de siempre:
// sostenidos FA DO SOL RE LA MI SI; bemoles SI MI LA RE SOL DO FA
const PASOS_SOSTENIDOS = [0, 3, -1, 2, 5, 1, 4];
const PASOS_BEMOLES = [4, 1, 5, 2, 6, 3, 7];
const ANCHO_CLAVE = 14; // la clave y un respiro antes de la primera alteración
const SEPARACION = 5;

const nombreArmadura = (n) => {
  if (n === 0) return "sin alteraciones";
  const cuantas = Math.abs(n);
  if (n > 0) return `${cuantas} ${cuantas === 1 ? "sostenido" : "sostenidos"}`;
  return `${cuantas} ${cuantas === 1 ? "bemol" : "bemoles"}`;
};

// Clave de sol, dibujada (el carácter de la clave no viene en todas las
// tablets). La espiral abraza la segunda línea (SOL4, en y = 12).
const CLAVE_SOL =
  "M6.2 12.2 C4.4 12.2 4.2 9.6 6.4 9.4 C9.4 9.2 10.2 14.6 6.2 15.2 C2.2 15.8 0.8 11 3.8 7.6 " +
  "L7.2 3.6 C9.4 0.8 8.6 -4.6 7 -4.6 C5.4 -4.6 4.8 -0.6 5.4 3 L7.4 20.2 C7.8 23.4 4 24 3.6 21.4";

function Sostenido({ x, y }) {
  return (
    <g className="circulo-sostenido">
      <line x1={x - 1} y1={y - 4.6} x2={x - 1} y2={y + 4.8} strokeWidth={0.6} />
      <line x1={x + 1} y1={y - 4.8} x2={x + 1} y2={y + 4.6} strokeWidth={0.6} />
      <line x1={x - 2.4} y1={y - 0.8} x2={x + 2.4} y2={y - 2.2} strokeWidth={1.3} />
      <line x1={x - 2.4} y1={y + 2.2} x2={x + 2.4} y2={y + 0.8} strokeWidth={1.3} />
    </g>
  );
}

function Bemol({ x, y }) {
  // El vientre del bemol se apoya en la nota; el palo sube por encima
  return (
    <g className="circulo-bemol">
      <line x1={x - 1.6} y1={y - 8.5} x2={x - 1.6} y2={y + 2} strokeWidth={0.7} />
      <path
        d={`M${x - 1.6} ${y + 2} C${x + 3.2} ${y - 0.2} ${x + 2.2} ${y - 3.4} ${x - 1.6} ${y - 0.8}`}
        strokeWidth={1}
        fill="none"
      />
    </g>
  );
}

/**
 * La armadura como en una partitura: pentagrama, clave de sol y las
 * alteraciones en su sitio. `(x, y)` es el centro del dibujo.
 */
function Armadura({ n, x, y }) {
  const cuantas = Math.abs(n);
  const ancho = ANCHO_CLAVE + Math.max(cuantas, 1) * SEPARACION + 3;
  const izquierda = x - ancho / 2;
  const arriba = y - 2 * ENTRE_LINEAS;
  const pasos = n > 0 ? PASOS_SOSTENIDOS : PASOS_BEMOLES;
  const Glifo = n > 0 ? Sostenido : Bemol;
  const titulo = nombreArmadura(n);

  return (
    <g
      className="circulo-armadura"
      style={{ stroke: "var(--text-light-secondary)", fill: "none" }}
      transform={`translate(${x} ${y}) scale(${ESCALA_ARMADURA}) translate(${-x} ${-y})`}
      aria-label={titulo}
    >
      <title>{titulo}</title>
      {[0, 1, 2, 3, 4].map((l) => (
        <line
          key={l}
          x1={izquierda}
          x2={izquierda + ancho}
          y1={arriba + l * ENTRE_LINEAS}
          y2={arriba + l * ENTRE_LINEAS}
          strokeWidth={0.5}
          style={{ opacity: 0.7 }}
        />
      ))}
      <path d={CLAVE_SOL} transform={`translate(${izquierda + 1} ${arriba})`} strokeWidth={1.1} strokeLinecap="round" />
      {pasos.slice(0, cuantas).map((paso, i) => (
        <Glifo key={i} x={izquierda + ANCHO_CLAVE + 2 + i * SEPARACION} y={arriba + paso * PASO} />
      ))}
    </g>
  );
}

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
 * mayores fuera, relativas menores dentro y la armadura de cada una en un
 * pentagrama (antes era un texto, "2♯", que se leía peor).
 *
 * No tiene interacción a propósito: es una chuleta. Se dibuja en vez de ser
 * una imagen para que siga el tema y la notación (DO-RE-MI o C-D-E) del
 * músico.
 */
function CirculoQuintas({ notacion = "latin" }) {
  return (
    <svg
      viewBox="0 0 420 464"
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
            <Etiqueta nombres={p.mayor} r={(R_EXTERIOR + R_MEDIO) / 2} angulo={i * 30} tam={16} notacion={notacion} />
            <Etiqueta nombres={p.menor} r={(R_MEDIO + R_INTERIOR) / 2} angulo={i * 30} tam={12} notacion={notacion} />
            <Armadura n={p.armadura} x={xArmadura} y={yArmadura} />
            {p.otra !== undefined && (
              <Armadura n={p.otra} x={xArmadura} y={yArmadura + SEGUNDA_ARMADURA} />
            )}
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_INTERIOR} style={{ fill: "rgba(var(--overlay-rgb), 0.04)", stroke: "var(--border-strong)" }} />
      <text x={C} y={C - 7} textAnchor="middle" style={{ fill: "var(--text-light-secondary)", fontSize: 10 }}>Mayor fuera</text>
      <text x={C} y={C + 9} textAnchor="middle" style={{ fill: "var(--text-light-secondary)", fontSize: 10 }}>menor dentro</text>
    </svg>
  );
}

export default CirculoQuintas;

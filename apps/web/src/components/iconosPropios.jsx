// Íconos que Phosphor no tiene, dibujados a su manera: rejilla de 256, trazo
// redondo y el grosor de cada peso (el de Phosphor: 8, 12, 16, 24). Aceptan
// `weight` como los suyos; `fill` y `duotone` usan el trazo de `bold`.

const GROSOR = { thin: 8, light: 12, regular: 16, bold: 24, fill: 24, duotone: 24 };

function propio(nombre, trazos) {
  const Componente = ({ weight = "regular" }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 256 256"
      fill="none"
      stroke="currentColor"
      strokeWidth={GROSOR[weight] || GROSOR.regular}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {trazos}
    </svg>
  );
  Componente.displayName = nombre;
  return Componente;
}

// La flecha hacia abajo, a la izquierda: se lee "de lo de arriba a lo de abajo"
const flecha = (
  <>
    <line x1="72" y1="40" x2="72" y2="216" />
    <polyline points="32 176 72 216 112 176" />
  </>
);
// Una A y una Z en una caja de 80 × 80, con la esquina de arriba en `y`
const letraA = (y) => (
  <>
    <polyline points={`144 ${y + 80} 184 ${y} 224 ${y + 80}`} />
    <line x1="156" y1={y + 56} x2="212" y2={y + 56} />
  </>
);
const letraZ = (y) => <polyline points={`148 ${y} 220 ${y} 148 ${y + 80} 220 ${y + 80}`} />;

export const OrdenAZ = propio("OrdenAZ", <>{flecha}{letraA(32)}{letraZ(144)}</>);
export const OrdenZA = propio("OrdenZA", <>{flecha}{letraZ(32)}{letraA(144)}</>);

// Nuevas primero: un destello (lo nuevo) arriba y renglones (lo de antes)
// abajo. No un reloj: se confundía con el filtro "Editadas esta semana".
export const OrdenNuevas = propio("OrdenNuevas", (
  <>
    {flecha}
    <path d="M184 32 Q192 64 224 72 Q192 80 184 112 Q176 80 144 72 Q176 64 184 32 Z" />
    <line x1="144" y1="160" x2="224" y2="160" />
    <line x1="144" y1="208" x2="224" y2="208" />
  </>
));

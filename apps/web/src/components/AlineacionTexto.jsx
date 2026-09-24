const OPCIONES = [
  { valor: "left", icono: "bi-text-left", texto: "Alinear a la izquierda" },
  { valor: "center", icono: "bi-text-center", texto: "Centrar" },
  { valor: "right", icono: "bi-text-right", texto: "Alinear a la derecha" }
];

/**
 * Los tres botones de alineación del texto, como los de un procesador de
 * textos. Justificar no está a propósito: cada línea de la canción es una
 * línea (no se parte), así que no haría nada.
 *
 * @param {Object} props
 * @param {string} props.alineacion - "left" | "center" | "right"
 * @param {(valor: string) => void} props.onCambiar
 * @param {string} [props.className] - Clase del grupo
 * @param {string} [props.botonClassName] - Clase de cada botón
 */
function AlineacionTexto({
  alineacion,
  onCambiar,
  className = "font-controls",
  botonClassName = "font-control-btn"
}) {
  return (
    <div className={className} role="group" aria-label="Alineación del texto">
      {OPCIONES.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={`${botonClassName}${alineacion === o.valor ? " active" : ""}`}
          onClick={() => onCambiar(o.valor)}
          title={o.texto}
          aria-label={o.texto}
          aria-pressed={alineacion === o.valor}
        >
          <i className={`bi ${o.icono}`}></i>
        </button>
      ))}
    </div>
  );
}

export default AlineacionTexto;

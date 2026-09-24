// Qué se ve de cada canción en la lista y en la sesión en vivo: las notas, la
// letra o los acordes. Las mismas tres pestañas que en la vista de la canción,
// pero aquí valen para todas las canciones a la vez.

const VISTAS = [
  { id: "principal", etiqueta: "Notas", icono: "bi bi-music-note-list" },
  { id: "letra", etiqueta: "Letra", icono: "bi bi-card-text" },
  { id: "acordes", etiqueta: "Acordes", icono: "bi bi-music-note" }
];

/**
 * @param {Object} props
 * @param {'principal'|'letra'|'acordes'} props.vista
 * @param {(vista: string) => void} props.onCambiar
 * @param {string} [props.className] - Para encajarlo en cada barra
 */
function SelectorVista({ vista, onCambiar, className = "" }) {
  return (
    <div
      className={`view-toggle-controls ${className}`.trim()}
      role="group"
      aria-label="Qué ver de cada canción"
    >
      {VISTAS.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`view-toggle-btn-song ${vista === v.id ? "active" : ""}`}
          aria-pressed={vista === v.id}
          onClick={() => onCambiar(v.id)}
        >
          <i className={v.icono}></i>
          {v.etiqueta}
        </button>
      ))}
    </div>
  );
}

export default SelectorVista;

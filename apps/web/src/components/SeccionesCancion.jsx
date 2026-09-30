import Icono from "./Icono";
// Las secciones de una canción ya formateada (notas, letra o acordes), como
// se pintan en la lista y en la sesión en vivo.

/**
 * @param {Object} props
 * @param {Object|null} props.formatted - Lo que devuelve `formatSong`
 * @param {string} props.alineacion - 'left' | 'center' | 'right'
 * @param {number} props.fontSize
 */
export function SeccionesCancion({ formatted, alineacion, fontSize }) {
  if (!formatted?.sections?.length) return null;
  return formatted.sections.map((section, i) => (
    <section key={i} className="song-section-modern">
      {section.title && <h4 className="song-section-title">{section.title}</h4>}
      <div className={`song-section-content alinear-${alineacion}`} style={{ fontSize: `${fontSize}px` }}>
        {section.content}
      </div>
    </section>
  ));
}

/**
 * La línea que avisa de que esta canción no tiene lo que se pidió ver, y que
 * por eso se enseña la principal (ver `elegirVista`).
 *
 * @param {Object} props
 * @param {'letra'|'acordes'|'notas'|null} props.faltaba
 * @param {'principal'|'letra'|'acordes'} [props.vista] - La que se enseña en su lugar
 * @param {boolean} [props.esPdf]
 */
export function AvisoVista({ faltaba, vista = "principal", esPdf = false }) {
  if (!faltaba) return null;
  // Sin notas ni lo pedido: se enseña la letra, para cantarla
  if (vista === "letra") {
    return (
      <p className="vista-aviso">
        <Icono nombre="microphone-stage" className="me-1" />
        {faltaba === "acordes"
          ? "Esta canción no tiene acordes ni notas: se muestra la letra."
          : "Esta canción no tiene notas: se muestra la letra."}
      </p>
    );
  }
  return (
    <p className="vista-aviso">
      <Icono nombre="info" className="me-1" />
      Esta canción aún no tiene {faltaba === "letra" ? "letra" : "acordes"}: se{" "}
      {esPdf ? "muestra la partitura" : "muestran las notas"}.
    </p>
  );
}

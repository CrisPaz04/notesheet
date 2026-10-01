import { nombrarTonalidad } from "@notesheet/core";
import Icono from "./Icono";
// Las secciones de una canción ya formateada (notas, letra o acordes), como
// se pintan en la lista y en la sesión en vivo.

/**
 * El título de una sección y, si en ella modula la canción, la tonalidad en
 * que se lee desde ahí ("Modulación · DO#m"), en la notación del músico.
 *
 * @param {Object} props
 * @param {{title?: string, tonalidad?: string}} props.section
 * @param {'latin'|'english'} [props.notacion]
 * @param {'h3'|'h4'} [props.nivel]
 */
export function TituloSeccion({ section, notacion = "latin", nivel = "h4" }) {
  const { title, tonalidad } = section || {};
  if (!title && !tonalidad) return null;
  const Etiqueta = nivel;
  return (
    <Etiqueta className="song-section-title">
      {title}
      {tonalidad && (
        <span className="song-section-tonalidad">
          {title && <span aria-hidden="true"> · </span>}
          <span className="visually-hidden">{title ? ", modula a" : "Modula a"}</span>{" "}
          {nombrarTonalidad(tonalidad, notacion)}
        </span>
      )}
    </Etiqueta>
  );
}

/**
 * @param {Object} props
 * @param {Object|null} props.formatted - Lo que devuelve `formatSong`
 * @param {string} props.alineacion - 'left' | 'center' | 'right'
 * @param {number} props.fontSize
 * @param {'latin'|'english'} [props.notacion] - Para nombrar la tonalidad de las modulaciones
 */
export function SeccionesCancion({ formatted, alineacion, fontSize, notacion = "latin" }) {
  if (!formatted?.sections?.length) return null;
  return formatted.sections.map((section, i) => (
    <section key={i} className="song-section-modern">
      <TituloSeccion section={section} notacion={notacion} />
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

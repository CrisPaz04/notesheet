import { ICONOS } from "./iconos";

/**
 * Un ícono de Phosphor dentro de un `<i>`, como iban los de Bootstrap Icons:
 * así las reglas de CSS que ya les daban tamaño, color o margen (`.x i`,
 * `me-2`, `font-size`) siguen valiendo. El SVG mide 1em y pinta con el color
 * del texto.
 *
 * El peso por defecto es `bold`: el `regular` queda demasiado fino al lado de
 * las etiquetas en negrita de los botones, a 13 px. `fill` sirve para marcar lo
 * activo o para los botones de reproducir y parar.
 *
 * @param {Object} props
 * @param {string} props.nombre - El de Phosphor ("metronome"), ver `iconos.js`
 * @param {"thin"|"light"|"regular"|"bold"|"fill"|"duotone"} [props.peso]
 * @param {string} [props.className]
 */
function Icono({ nombre, peso = "bold", className = "", ...resto }) {
  const Svg = ICONOS[nombre];
  if (!Svg) {
    if (import.meta.env.DEV) console.warn(`Icono: "${nombre}" no está en iconos.js`);
    return null;
  }
  return (
    <i className={className ? `icono ${className}` : "icono"} aria-hidden="true" {...resto}>
      <Svg weight={peso} />
    </i>
  );
}

export default Icono;

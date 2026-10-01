import { nombrarTonalidad, mismaTonalidad, transposeKeyBySemitones } from "@notesheet/core";
import Desplegable from "./Desplegable";

/**
 * A qué tonalidad va una modulación en una lista o en la sesión en vivo.
 *
 * Se elige una tonalidad, pero lo que se guarda es el ajuste en semitonos
 * desde donde iría moviéndose con la canción (ver `modulaciones.js` en core):
 * así, si luego se cambia la tonalidad de la canción, la modulación la sigue.
 * Las doce de su mismo modo, de la más baja a la más alta, marcando la de
 * siempre y la que es quedarse sin modular.
 *
 * @param {Object} props
 * @param {{numero: number, titulo: string, porDefecto: string, ajuste: number}} props.modulacion
 *   - Una de `modulacionesDeLaEntrada`
 * @param {string} props.tonalidadInicio - La de la canción en esa entrada
 * @param {(ajuste: number) => void} props.onChange
 * @param {'latin'|'english'} [props.notacion]
 * @param {string} [props.className] - Variante de tamaño del desplegable
 */
function SelectorModulacion({ modulacion, tonalidadInicio, onChange, notacion = "latin", className = "desplegable--compacto" }) {
  const { numero, titulo, porDefecto, ajuste } = modulacion;
  const nombre = titulo || `Modulación ${numero}`;

  const opciones = [];
  for (let semitonos = -6; semitonos <= 5; semitonos += 1) {
    const tonalidad = transposeKeyBySemitones(porDefecto, semitonos);
    let label = nombrarTonalidad(tonalidad, notacion);
    if (semitonos === 0) label += " · con la canción";
    else if (mismaTonalidad(tonalidad, tonalidadInicio)) label += " · sin modulación";
    opciones.push({ value: String(semitonos), label });
  }

  return (
    <div className="selector-modulacion">
      <span className="selector-modulacion-nombre">{nombre}:</span>
      <Desplegable
        value={String(ajuste || 0)}
        onChange={(valor) => onChange(Number(valor))}
        opciones={opciones}
        ariaLabel={`Tonalidad de ${nombre}`}
        className={className}
      />
    </div>
  );
}

export default SelectorModulacion;

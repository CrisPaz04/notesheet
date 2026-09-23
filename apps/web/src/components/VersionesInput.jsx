import { useState } from "react";
import { limpiarVersiones } from "@notesheet/core";

/**
 * "Versión de" con varios nombres: una persona y un grupo, o dos personas.
 * Cada nombre es una etiqueta con su botón para quitarlo; se añade otro
 * escribiéndolo y pulsando Enter o coma.
 *
 * Lo que quede escrito sin confirmar se añade al salir del campo. Si no, quien
 * escribe un nombre y pulsa Guardar directamente lo perdería sin enterarse.
 *
 * @param {Object} props
 * @param {string[]} props.value - Los nombres
 * @param {(nombres: string[]) => void} props.onChange
 * @param {string} [props.id] - Id del campo de texto, para el <label>
 */
function VersionesInput({ value, onChange, id }) {
  const [texto, setTexto] = useState("");
  const nombres = value || [];

  const anadir = (entrada) => {
    // Pegar "A, B" añade los dos de una vez
    const nuevos = String(entrada).split(",");
    if (!nuevos.some((n) => n.trim())) return;
    onChange(limpiarVersiones([...nombres, ...nuevos]));
    setTexto("");
  };

  const quitar = (indice) => {
    onChange(nombres.filter((_, i) => i !== indice));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      anadir(texto);
    } else if (e.key === "Backspace" && !texto && nombres.length > 0) {
      quitar(nombres.length - 1);
    }
  };

  const handleChange = (e) => {
    const valor = e.target.value;
    // Al pegar o escribir una coma a mitad del texto
    if (valor.includes(",")) anadir(valor);
    else setTexto(valor);
  };

  return (
    <div className="form-control-modern versiones-input">
      {nombres.map((nombre, i) => (
        <span key={nombre} className="version-chip">
          {nombre}
          <button
            type="button"
            className="version-chip-quitar"
            onClick={() => quitar(i)}
            aria-label={`Quitar ${nombre}`}
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        className="versiones-input-texto"
        value={texto}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={() => anadir(texto)}
        placeholder={nombres.length ? "Añadir otro…" : "Autor original o versión"}
      />
    </div>
  );
}

export default VersionesInput;

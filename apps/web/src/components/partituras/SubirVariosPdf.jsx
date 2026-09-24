import { useRef, useState } from "react";
import { repartirPdfs } from "@notesheet/core";
import { subirVariasPartituras } from "@notesheet/api";
import RepartoPdfs from "./RepartoPdfs";

/**
 * "Subir varios PDF" en el editor de una canción: se eligen todos los de su
 * carpeta y cada uno va a su voz por el nombre del archivo
 * ("…--Bb_Trumpet_2--NN.pdf" es la trompeta 2 con nombres de notas).
 *
 * Primero se enseña el reparto y solo se sube al confirmarlo.
 *
 * @param {Object} props
 * @param {Object} props.song - `{ id, pdfs, voices, primaryInstrument, primaryVoiceNumber }`
 * @param {(resultado: {pdfs: Object, voices: Object}) => void} props.onSubidos
 *   Para que el editor ponga al día su estado: si no, al guardar pisaría lo subido
 */
function SubirVariosPdf({ song, onSubidos }) {
  const inputRef = useRef(null);
  const [reparto, setReparto] = useState(null);
  const [progreso, setProgreso] = useState(null);
  const [resultado, setResultado] = useState(null);

  const alElegir = (e) => {
    const archivos = [...(e.target.files || [])];
    e.target.value = "";
    if (archivos.length === 0) return;
    setResultado(null);
    setReparto(repartirPdfs(archivos));
  };

  const subir = async () => {
    const r = await subirVariasPartituras({
      song,
      asignados: reparto.asignados,
      onProgreso: setProgreso
    });
    setProgreso(null);
    setReparto(null);
    setResultado(r);
    onSubidos({ pdfs: r.pdfs, voices: r.voices });
  };

  const subiendo = progreso !== null;

  return (
    <div className="subir-varios-pdf">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={alElegir}
        data-testid="subir-varios-input"
      />

      {!reparto && (
        <button
          type="button"
          className="btn-editor-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={!song?.id}
        >
          <i className="bi bi-files me-1"></i>
          Subir varios PDF
        </button>
      )}

      {reparto && (
        <div className="subir-varios-panel">
          <p className="subir-varios-titulo">
            {reparto.asignados.length === 1 ? "1 PDF" : `${reparto.asignados.length} PDF`} en su voz
            {reparto.apartados.length > 0 && `, ${reparto.apartados.length} sin subir`}
          </p>
          <RepartoPdfs asignados={reparto.asignados} apartados={reparto.apartados} />

          {subiendo ? (
            <p className="subir-varios-progreso" role="status">
              Subiendo {progreso.hechos + 1} de {progreso.total}: {progreso.actual}
            </p>
          ) : (
            <div className="subir-varios-acciones">
              <button
                type="button"
                className="btn-editor-primary"
                onClick={subir}
                disabled={reparto.asignados.length === 0}
              >
                <i className="bi bi-cloud-upload me-1"></i>
                Subir {reparto.asignados.length}
              </button>
              <button type="button" className="btn-editor-secondary" onClick={() => setReparto(null)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className={`subir-varios-resultado${resultado.errores.length ? " con-errores" : ""}`} role="status">
          <i className="bi bi-check-circle me-1"></i>
          Subidos {resultado.subidos}.
          {resultado.errores.length > 0 && (
            <ul>
              {resultado.errores.map((e) => (
                <li key={e.archivo.name}>{e.archivo.name}: {e.mensaje}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default SubirVariosPdf;

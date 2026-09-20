// apps/web/src/components/ScoreUploader.jsx
import { useRef, useState } from "react";
import { SCORE_VARIANTS, SCORE_VARIANT_LABELS } from "@notesheet/core";

/**
 * Las dos casillas de PDF de una voz: la partitura normal y la que lleva los
 * nombres de las notas encima.
 *
 * Una casilla por variante y no un solo botón: son dos archivos distintos de
 * la misma voz, y verlos separados es lo que deja claro de un vistazo cuál
 * falta. La variante con los nombres existe para quien todavía no lee
 * partitura, así que no tenerla no es un detalle menor.
 *
 * Cada casilla acepta el archivo de dos maneras, porque la gente prueba las
 * dos: soltándolo encima o eligiéndolo con el botón.
 *
 * @param {Object} props
 * @param {Object} props.casilla - `{ partitura?: ruta, conNotas?: ruta }`
 * @param {boolean} props.disabled - Aún no se puede subir (canción sin guardar)
 * @param {string} props.disabledReason
 * @param {Function} [props.onGuardar] - Guardar la canción para desbloquear
 * @param {Function} props.onUpload - (variant, File)
 * @param {Function} props.onRemove - (variant)
 * @param {string} props.subiendo - Variante que se está subiendo ahora
 */
function ScoreUploader({
  casilla = {},
  disabled = false,
  disabledReason = "",
  onGuardar,
  onUpload,
  onRemove,
  subiendo = ""
}) {
  // Un PDF soltado fuera de una casilla haría que el navegador lo abriera y
  // se llevara por delante la página con el trabajo sin guardar.
  const tragarSuelta = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      className="score-uploader"
      onDragOver={tragarSuelta}
      onDrop={tragarSuelta}
    >
      {disabled && disabledReason && (
        <div className="alert alert-info score-uploader-aviso" role="status">
          <i className="bi bi-info-circle"></i>
          <span>{disabledReason}</span>
          {onGuardar && (
            <button
              type="button"
              className="btn-editor-primary"
              onClick={onGuardar}
            >
              <i className="bi bi-check-circle me-1"></i>
              Guardar ahora
            </button>
          )}
        </div>
      )}

      <div className="score-slots">
        {SCORE_VARIANTS.map((variant) => (
          <ScoreSlot
            key={variant}
            variant={variant}
            path={casilla[variant]}
            disabled={disabled}
            subiendo={subiendo === variant}
            onUpload={(file) => onUpload(variant, file)}
            onRemove={() => onRemove(variant)}
          />
        ))}
      </div>
    </div>
  );
}

function ScoreSlot({ variant, path, disabled, subiendo, onUpload, onRemove }) {
  const inputRef = useRef(null);
  const [nombreElegido, setNombreElegido] = useState("");
  const [encima, setEncima] = useState(false);

  const aceptar = (file) => {
    if (!file) return;
    setNombreElegido(file.name);
    onUpload(file);
  };

  const elegir = (event) => {
    aceptar(event.target.files?.[0]);

    // Sin esto, volver a elegir el mismo archivo (tras corregirlo fuera) no
    // dispara el evento y parece que la app se ha quedado colgada.
    event.target.value = "";
  };

  // `dragOver` tiene que cancelarse en cada evento, no solo al entrar: si no,
  // el navegador se queda con la suelta y abre el PDF en la pestaña.
  const alArrastrar = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && !subiendo) setEncima(true);
  };

  const alSalir = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setEncima(false);
  };

  const alSoltar = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setEncima(false);
    if (disabled || subiendo) return;
    aceptar(event.dataTransfer?.files?.[0]);
  };

  const abrirBuscador = () => {
    if (disabled || subiendo) return;
    inputRef.current?.click();
  };

  return (
    <div
      className={[
        "score-slot",
        path ? "score-slot--lleno" : "",
        encima ? "score-slot--encima" : "",
        disabled ? "score-slot--bloqueado" : ""
      ].filter(Boolean).join(" ")}
      onDragEnter={alArrastrar}
      onDragOver={alArrastrar}
      onDragLeave={alSalir}
      onDrop={alSoltar}
    >
      <div className="score-slot-header">
        <i className={variant === "conNotas" ? "bi bi-eyeglasses" : "bi bi-file-earmark-music"}></i>
        <span className="score-slot-title">{SCORE_VARIANT_LABELS[variant]}</span>
      </div>

      <div className="score-slot-state">
        {subiendo && (
          <>
            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
            Subiendo {nombreElegido}...
          </>
        )}
        {!subiendo && path && (
          <>
            <i className="bi bi-check-circle-fill me-2"></i>
            Subida
          </>
        )}
        {!subiendo && !path && (
          <span className="score-slot-empty">
            {disabled ? "Sin archivo" : "Suelta el PDF aquí, o:"}
          </span>
        )}
      </div>

      <div className="score-slot-actions">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={elegir}
          hidden
          aria-label={`Subir ${SCORE_VARIANT_LABELS[variant]}`}
        />
        <button
          type="button"
          className="btn-editor-secondary"
          onClick={abrirBuscador}
          disabled={disabled || subiendo}
        >
          <i className="bi bi-upload me-1"></i>
          {path ? "Reemplazar" : "Buscar archivo"}
        </button>

        {path && (
          <button
            type="button"
            className="btn-editor-secondary"
            onClick={onRemove}
            disabled={disabled || subiendo}
          >
            <i className="bi bi-trash me-1"></i>
            Quitar
          </button>
        )}
      </div>
    </div>
  );
}

export default ScoreUploader;

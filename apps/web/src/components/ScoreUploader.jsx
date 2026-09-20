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
 * @param {Object} props
 * @param {Object} props.casilla - `{ partitura?: ruta, conNotas?: ruta }`
 * @param {boolean} props.disabled - Aún no se puede subir (canción sin guardar)
 * @param {string} props.disabledReason
 * @param {Function} props.onUpload - (variant, File)
 * @param {Function} props.onRemove - (variant)
 * @param {string} props.subiendo - Variante que se está subiendo ahora
 */
function ScoreUploader({
  casilla = {},
  disabled = false,
  disabledReason = "",
  onUpload,
  onRemove,
  subiendo = ""
}) {
  return (
    <div className="score-uploader">
      {disabled && disabledReason && (
        <div className="alert alert-info" role="status">
          <i className="bi bi-info-circle me-2"></i>
          {disabledReason}
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

  const elegir = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setNombreElegido(file.name);
    onUpload(file);

    // Sin esto, volver a elegir el mismo archivo (tras corregirlo fuera) no
    // dispara el evento y parece que la app se ha quedado colgada.
    event.target.value = "";
  };

  return (
    <div className={`score-slot ${path ? "score-slot--lleno" : ""}`}>
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
          <span className="score-slot-empty">Sin archivo</span>
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
          onClick={() => inputRef.current?.click()}
          disabled={disabled || subiendo}
        >
          <i className="bi bi-upload me-1"></i>
          {path ? "Reemplazar" : "Subir PDF"}
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

import { TRANSPOSING_INSTRUMENTS, SCORE_VARIANT_LABELS } from "@notesheet/core";

/**
 * Qué archivo va a qué voz, antes de subir nada: lo que devuelve
 * `repartirPdfs`. Lo que no se entiende se enseña aparte con su motivo, para
 * que nadie descubra después que faltaba una voz.
 *
 * @param {Object} props
 * @param {Array} props.asignados
 * @param {Array} props.apartados
 */
function RepartoPdfs({ asignados, apartados }) {
  return (
    <div className="reparto-pdfs">
      {asignados.length > 0 && (
        <ul className="reparto-pdfs-lista">
          {asignados.map((a) => (
            <li key={`${a.instrumentId}-${a.voiceNumber}-${a.variant}`}>
              <span className="reparto-pdfs-voz">
                {TRANSPOSING_INSTRUMENTS[a.instrumentId]?.name || a.instrumentId} {a.voiceNumber}
                <span className="reparto-pdfs-variante">{SCORE_VARIANT_LABELS[a.variant] || a.variant}</span>
              </span>
              <span className="reparto-pdfs-archivo">{a.archivo.name}</span>
            </li>
          ))}
        </ul>
      )}

      {apartados.length > 0 && (
        <ul className="reparto-pdfs-lista reparto-pdfs-apartados">
          {apartados.map((a) => (
            <li key={a.archivo.name}>
              <span className="reparto-pdfs-voz">
                <i className="bi bi-dash-circle me-1" aria-hidden="true"></i>
                {a.motivo}
              </span>
              <span className="reparto-pdfs-archivo">{a.archivo.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default RepartoPdfs;

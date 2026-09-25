import { useState } from "react";
import { TRANSPOSING_INSTRUMENTS } from "@notesheet/core";
import Icono from "../Icono";

/**
 * Barra de estado de la sesión: el código para que entren los demás, quién
 * está conectado y si seguimos teniendo red.
 *
 * El aviso de "sin conexión" no es decorativo. Firestore sigue sirviendo desde
 * la caché cuando se cae el wifi, así que la pantalla se ve perfecta mientras
 * los cambios del director ya no llegan. Sin este aviso, el músico no tiene
 * forma de saberlo hasta que toca en la tonalidad equivocada.
 */
export default function LiveBar({
  code,
  name,
  sinRed,
  participants = [],
  updatedBy,
  isHost,
  onSalir,
  onCerrar
}) {
  const [copiado, setCopiado] = useState(false);
  const [verGente, setVerGente] = useState(false);

  const enLinea = participants.filter((p) => p.isOnline);

  const copiarLink = async () => {
    const url = `${window.location.origin}/live/${code}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles (o sin HTTPS): al menos que pueda
      // seleccionarlo a mano en vez de quedarse sin nada.
      window.prompt("Copia el enlace de la sesión:", url);
    }
  };

  return (
    <div className="live-bar no-print">
      <div className="live-bar-main">
        <div className="live-bar-identity">
          <span className={`live-dot ${sinRed ? "offline" : "online"}`} aria-hidden="true" />
          <div>
            <div className="live-bar-name">{name || "Sesión en vivo"}</div>
            <div className="live-bar-code">
              <span className="visually-hidden">Código de la sesión:</span>
              {code}
            </div>
          </div>
        </div>

        <div className="live-bar-actions">
          <button
            type="button"
            className="btn-live"
            onClick={copiarLink}
            title="Copiar el enlace para que entren los demás"
          >
            <Icono nombre={copiado ? "check" : "link"} />
            {copiado ? "Copiado" : "Compartir"}
          </button>

          <button
            type="button"
            className="btn-live"
            onClick={() => setVerGente((v) => !v)}
            aria-expanded={verGente}
          >
            <Icono nombre="users" />
            {enLinea.length}
          </button>

          {isHost ? (
            <button type="button" className="btn-live btn-live-danger" onClick={onCerrar}>
              <Icono nombre="stop-circle" />
              Terminar
            </button>
          ) : (
            <button type="button" className="btn-live" onClick={onSalir}>
              <Icono nombre="sign-out" />
              Salir
            </button>
          )}
        </div>
      </div>

      {sinRed && (
        <div className="live-warning" role="status">
          <Icono nombre="wifi-slash" className="me-2" />
          Sin conexión: estás viendo la última versión que llegó. Los cambios de
          los demás no se están recibiendo.
        </div>
      )}

      {updatedBy?.name && !sinRed && (
        <div className="live-last-change">
          Último cambio: {updatedBy.name}
        </div>
      )}

      {verGente && (
        <ul className="live-people">
          {participants.length === 0 && (
            <li className="live-person text-muted">Todavía no ha entrado nadie</li>
          )}
          {participants.map((p) => (
            <li key={p.uid} className="live-person">
              <span className={`live-dot ${p.isOnline ? "online" : "offline"}`} aria-hidden="true" />
              <span className="live-person-name">{p.name || "Músico"}</span>
              {p.instrumentId && (
                <span className="live-person-instrument">
                  {TRANSPOSING_INSTRUMENTS[p.instrumentId]?.name || p.instrumentId}
                  {p.voiceNumber ? ` ${p.voiceNumber}` : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

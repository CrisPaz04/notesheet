import { useState } from "react";
import { Link } from "react-router-dom";
import { signInAsGuest } from "@notesheet/api";
import Icono from "../Icono";

/**
 * Puerta de entrada para quien abre el link sin tener cuenta.
 *
 * El caso real: el director manda el enlace por WhatsApp diez minutos antes
 * del servicio y la mitad de la sección de vientos no tiene cuenta. Pedirles
 * que se registren ahí mismo es perderlos. Entran como invitados, ponen su
 * nombre para que el resto sepa quién es, y listo.
 *
 * Requiere el proveedor anónimo habilitado en la consola de Firebase; si no
 * lo está, Firebase responde `auth/operation-not-allowed` y se avisa en vez de
 * dejar un botón que no hace nada.
 */
export default function GuestGate({ code }) {
  const [nombre, setNombre] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState("");

  const entrar = async (e) => {
    e.preventDefault();
    setEntrando(true);
    setError("");

    try {
      await signInAsGuest(nombre);
      // No hay que navegar: AuthContext propaga el usuario nuevo y la pantalla
      // de la sesión se monta sola.
    } catch (err) {
      console.error("Error entrando como invitado:", err);
      setError(
        err?.code === "auth/operation-not-allowed"
          ? "Las entradas de invitado no están habilitadas en este servidor."
          : "No se pudo entrar: " + err.message
      );
      setEntrando(false);
    }
  };

  return (
    <div className="live-container">
      <form className="live-message" onSubmit={entrar}>
        <Icono nombre="music-notes" className="live-message-icon" />
        <h2>Te invitaron a una sesión</h2>
        <p>
          Código <strong>{code}</strong>. Pon tu nombre para que el resto sepa
          quién eres.
        </p>

        <input
          type="text"
          className="live-input"
          placeholder="Tu nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          maxLength={40}
          autoComplete="name"
        />

        {error && (
          <div className="live-warning live-warning-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="btn-live btn-live-primary" disabled={entrando}>
          {entrando ? "Entrando..." : "Entrar a la sesión"}
        </button>

        <p className="live-message-footnote">
          ¿Tienes cuenta? <Link to="/login">Inicia sesión</Link> y entra con
          tus preferencias de instrumento.
        </p>
      </form>
    </div>
  );
}

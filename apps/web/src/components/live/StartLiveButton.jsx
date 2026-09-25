import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSession } from "@notesheet/api";
import Icono from "../Icono";

/**
 * Abre una sesión en vivo a partir de una lista.
 *
 * La sesión **copia** la lista y a partir de ahí vive sola: lo que se decida
 * sobre la marcha ("hoy en RE que el cantante está ronco") no reescribe el
 * repertorio guardado, y al terminar el servicio la lista sigue como estaba.
 */
export default function StartLiveButton({ playlist, user, className = "" }) {
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const abrir = async () => {
    setAbriendo(true);
    setError("");

    try {
      const sesion = await createSession({ playlist, host: user });
      navigate(`/live/${sesion.code}`);
    } catch (e) {
      console.error("Error abriendo la sesión:", e);
      setError("No se pudo abrir la sesión: " + e.message);
      setAbriendo(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        type="button"
        className={className || "btn-song-action btn-song-primary"}
        onClick={abrir}
        disabled={abriendo || !playlist?.songs?.length}
        title={
          playlist?.songs?.length
            ? "Abrir una sesión para que todos vean la misma lista"
            : "Añade canciones a la lista antes de abrir una sesión"
        }
      >
        <Icono nombre="broadcast" />
        {abriendo ? "Abriendo..." : "Sesión en vivo"}
      </button>

      {error && (
        <div className="alert alert-danger mt-2" role="alert">{error}</div>
      )}
    </>
  );
}

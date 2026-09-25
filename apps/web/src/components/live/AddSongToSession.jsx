import { useState, useEffect, useMemo } from "react";
import { nombrarTonalidad } from "@notesheet/core";
import { getAllSongs } from "@notesheet/api";
import Icono from "../Icono";

/**
 * Añadir una canción al final de la sesión, sobre la marcha.
 *
 * El repertorio se pide la primera vez que se abre y no al montar la
 * pantalla: la mayoría de los servicios pasan sin añadir nada, y traerse 118
 * canciones por si acaso es gastar lecturas y datos del móvil de doce
 * personas.
 *
 * Añadir una canción se lo cambia a todos, así que esto no es un panel
 * privado: lo que se elija aquí le aparece a la banda entera.
 */
export default function AddSongToSession({ user, yaEnLaSesion = [], onAgregar, notacion = "latin" }) {
  const [abierto, setAbierto] = useState(false);
  const [repertorio, setRepertorio] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto || repertorio.length > 0 || !user?.uid) return;

    setCargando(true);
    setError("");

    getAllSongs(user.uid)
      .then(setRepertorio)
      .catch((e) => {
        console.error("Error cargando el repertorio:", e);
        setError("No se pudo cargar el repertorio: " + e.message);
      })
      .finally(() => setCargando(false));
  }, [abierto, repertorio.length, user]);

  const encontradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    const fuera = new Set(yaEnLaSesion);

    return repertorio
      .filter((s) => !fuera.has(s.id))
      .filter((s) => !texto || (s.title || "").toLowerCase().includes(texto))
      .slice(0, 50);
  }, [repertorio, busqueda, yaEnLaSesion]);

  if (!abierto) {
    return (
      <button
        type="button"
        className="btn-live btn-live-wide no-print"
        onClick={() => setAbierto(true)}
      >
        <Icono nombre="plus-circle" className="me-2" />
        Añadir una canción a la sesión
      </button>
    );
  }

  return (
    <div className="live-add no-print">
      <div className="live-add-header">
        <strong>Añadir a la sesión</strong>
        <button
          type="button"
          className="live-icon-btn"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
        >
          <Icono nombre="x" />
        </button>
      </div>

      <input
        type="search"
        className="live-input"
        placeholder="Buscar por título"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        aria-label="Buscar una canción"
      />

      {cargando && <p className="live-card-loading">Cargando el repertorio…</p>}

      {error && (
        <div className="live-warning live-warning-error" role="alert">{error}</div>
      )}

      {!cargando && !error && encontradas.length === 0 && (
        <p className="live-card-loading">
          {busqueda ? "Ninguna canción coincide." : "No queda ninguna por añadir."}
        </p>
      )}

      <ul className="live-add-results" aria-label="Canciones que puedes añadir">
        {encontradas.map((song) => (
          <li key={song.id}>
            <button
              type="button"
              className="live-add-item"
              onClick={() => {
                onAgregar(song);
                setAbierto(false);
                setBusqueda("");
              }}
            >
              <span className="live-add-title">{song.title || "Sin título"}</span>
              <span className="live-add-meta">{nombrarTonalidad(song.key, notacion) || "Sin tonalidad"}</span>
              <Icono nombre="plus-circle" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

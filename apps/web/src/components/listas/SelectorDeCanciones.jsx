import { useMemo, useRef, useState } from "react";
import { buscarCanciones, nombrarTonalidad } from "@notesheet/core";
import Icono from "../Icono";

// En este orden salen las pestañas de tipo, si hay canciones de ese tipo
const ORDEN_TIPOS = ["Adoración", "Júbilo", "Moderada"];

/**
 * Para añadir canciones a una lista: un buscador (título, artista, álbum o un
 * verso de la letra, sin tildes) y los tipos. Antes era la lista entera del
 * repertorio y había que bajar hasta encontrar cada canción.
 *
 * Con teclado: se escribe y **Enter** añade la primera que encaje, y el
 * buscador se vacía para la siguiente. Así una lista se arma sin soltar el
 * teclado.
 *
 * @param {Object} props
 * @param {Object[]} props.canciones - El repertorio
 * @param {Set<string>} props.enLista - Ids de las que ya están en la lista
 * @param {(cancion: Object) => void} props.onAnadir
 * @param {string} props.notacion
 */
function SelectorDeCanciones({ canciones, enLista, onAnadir, notacion }) {
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [ultimaAnadida, setUltimaAnadida] = useState(null);
  const buscadorRef = useRef(null);

  const tipos = useMemo(() => {
    const presentes = new Set(canciones.map((c) => c.type).filter(Boolean));
    return [
      ...ORDEN_TIPOS.filter((t) => presentes.has(t)),
      ...[...presentes].filter((t) => !ORDEN_TIPOS.includes(t)).sort()
    ];
  }, [canciones]);

  const resultados = useMemo(() => {
    const delTipo = tipo ? canciones.filter((c) => c.type === tipo) : canciones;
    return buscarCanciones(delTipo, texto, { notacion });
  }, [canciones, tipo, texto, notacion]);

  const primeraLibre = texto.trim() ? resultados.find((c) => !enLista.has(c.id)) : null;

  const anadir = (cancion) => {
    onAnadir(cancion);
    setUltimaAnadida(cancion.title || "Sin título");
  };

  const alTeclear = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (primeraLibre) {
        anadir(primeraLibre);
        setTexto("");
      }
    } else if (e.key === "Escape" && texto) {
      e.preventDefault();
      setTexto("");
    }
  };

  // La línea de debajo del buscador: qué hace Enter, o qué se acaba de añadir
  const pista = primeraLibre
    ? <>Enter añade <strong>{primeraLibre.title}</strong></>
    : ultimaAnadida
      ? <><Icono nombre="check-circle" className="me-1" />Añadida <strong>{ultimaAnadida}</strong></>
      : null;

  return (
    <div className="selector-canciones">
      <div className="selector-canciones-cabeza">
        <div className="selector-canciones-buscador">
          <Icono nombre="magnifying-glass" />
          <input
            ref={buscadorRef}
            type="search"
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setUltimaAnadida(null); }}
            onKeyDown={alTeclear}
            placeholder="Buscar por título, artista o letra"
            aria-label="Buscar canción"
            autoComplete="off"
          />
          {texto && (
            <button
              type="button"
              className="selector-canciones-borrar"
              onClick={() => { setTexto(""); buscadorRef.current?.focus(); }}
              aria-label="Borrar búsqueda"
            >
              <Icono nombre="x" />
            </button>
          )}
        </div>

        {tipos.length > 1 && (
          <div className="selector-canciones-tipos" role="group" aria-label="Tipo">
            {["", ...tipos].map((t) => (
              <button
                key={t || "todas"}
                type="button"
                className={`selector-canciones-tipo${tipo === t ? " activo" : ""}`}
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
              >
                {t || "Todas"}
              </button>
            ))}
          </div>
        )}

        <p className="selector-canciones-pista" aria-live="polite">{pista}</p>
      </div>

      <div className="available-songs-list">
        {canciones.length === 0 ? (
          <div className="empty-state-small">
            <Icono nombre="music-notes" />
            <p>No hay canciones disponibles</p>
          </div>
        ) : resultados.length === 0 ? (
          <div className="empty-state-small">
            <Icono nombre="magnifying-glass" />
            <p>Ninguna canción coincide{texto.trim() ? <> con «{texto.trim()}»</> : null}.</p>
          </div>
        ) : (
          resultados.map((song) => {
            const yaEsta = enLista.has(song.id);
            return (
              <button
                key={song.id}
                type="button"
                className={`available-song-item${yaEsta ? " disabled" : ""}${song === primeraLibre ? " primera" : ""}`}
                onClick={() => anadir(song)}
                disabled={yaEsta}
              >
                <div className="available-song-content">
                  <div className="available-song-title">{song.title || "Sin título"}</div>
                  <div className="available-song-meta">
                    {[nombrarTonalidad(song.key, notacion) || "Sin tonalidad", song.type, song.version]
                      .filter(Boolean).join(" • ")}
                  </div>
                </div>
                {yaEsta ? (
                  <span className="available-song-esta">
                    <Icono nombre="check" className="me-1" />
                    En la lista
                  </span>
                ) : (
                  <Icono nombre="plus-circle" className="available-song-add" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SelectorDeCanciones;

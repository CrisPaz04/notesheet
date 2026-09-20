import PlaylistKeySelector from "../PlaylistKeySelector";

/**
 * La lista de la sesión, compartida por todos.
 *
 * Cualquiera puede tocar aquí: en el servicio el director suele estar tocando
 * y no puede ser el único capaz de mover la lista. Lo que se cambia aquí le
 * cambia a los doce, así que la tonalidad que se muestra es la **de
 * concierto**, no la que lee cada instrumento: si a cada uno le apareciera la
 * suya, dos músicos hablando de "la de RE" estarían hablando de cosas
 * distintas.
 */
export default function LiveSetlist({
  songs = [],
  activeSongId,
  onIr,
  onCambiarTonalidad,
  onQuitar,
  onMover
}) {
  if (songs.length === 0) {
    return (
      <p className="live-setlist-empty">
        La sesión está vacía. Añade canciones desde la lista.
      </p>
    );
  }

  return (
    <ol className="live-setlist">
      {songs.map((song, index) => {
        const activa = song.id === activeSongId;

        return (
          <li key={song.id} className={`live-setlist-item ${activa ? "active" : ""}`}>
            <button
              type="button"
              className="live-setlist-go"
              onClick={() => onIr(song.id)}
              aria-current={activa ? "true" : undefined}
              // Sin esto el nombre accesible sale pegado ("2Sublime Gracia"):
              // el número y el título son dos elementos contiguos.
              aria-label={`Ir a ${song.title || "canción sin título"}`}
            >
              <span className="live-setlist-number">{index + 1}</span>
              <span className="live-setlist-title">{song.title || "Sin título"}</span>
            </button>

            <div className="live-setlist-controls">
              <PlaylistKeySelector
                value={song.key || song.originalKey || "?"}
                originalKey={song.originalKey || song.key || "DO"}
                onChange={(key) => onCambiarTonalidad(song.id, key)}
              />

              <button
                type="button"
                className="live-icon-btn"
                onClick={() => onMover(index, index - 1)}
                disabled={index === 0}
                title="Subir"
                aria-label={`Subir ${song.title || "canción"}`}
              >
                <i className="bi bi-chevron-up" />
              </button>

              <button
                type="button"
                className="live-icon-btn"
                onClick={() => onMover(index, index + 1)}
                disabled={index === songs.length - 1}
                title="Bajar"
                aria-label={`Bajar ${song.title || "canción"}`}
              >
                <i className="bi bi-chevron-down" />
              </button>

              <button
                type="button"
                className="live-icon-btn live-icon-danger"
                onClick={() => onQuitar(song.id)}
                title="Quitar de la sesión"
                aria-label={`Quitar ${song.title || "canción"}`}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

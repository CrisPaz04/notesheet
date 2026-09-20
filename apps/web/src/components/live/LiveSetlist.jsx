/**
 * Índice para saltar de una canción a otra sin bajar scrolleando.
 *
 * Solo navega: los controles de tonalidad, orden y borrado viven en cada
 * canción, que es donde se miran. Tenerlos también aquí era duplicar el mismo
 * botón en dos sitios y hacer que ninguno de los dos se encontrara.
 *
 * Saltar aquí mueve el puntero compartido, así que la banda entera va contigo.
 */
export default function LiveSetlist({ songs = [], activeSongId, onIr }) {
  if (songs.length === 0) {
    return <p className="live-setlist-empty">La sesión está vacía.</p>;
  }

  return (
    <ol className="live-setlist">
      {songs.map((song, index) => (
        <li
          key={song.id}
          className={`live-setlist-item ${song.id === activeSongId ? "active" : ""}`}
        >
          <button
            type="button"
            className="live-setlist-go"
            onClick={() => onIr(song.id)}
            aria-current={song.id === activeSongId ? "true" : undefined}
            // Sin esto el nombre accesible sale pegado ("2Sublime Gracia"):
            // el número y el título son dos elementos contiguos.
            aria-label={`Ir a ${song.title || "canción sin título"}`}
          >
            <span className="live-setlist-number">{index + 1}</span>
            <span className="live-setlist-title">{song.title || "Sin título"}</span>
            <span className="live-setlist-key">{song.key || song.originalKey || "?"}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

import { forwardRef } from "react";
import PlaylistKeySelector from "../PlaylistKeySelector";
import { nombrarTonalidad } from "@notesheet/core";

/**
 * Una canción dentro de la sesión, con sus controles a la vista.
 *
 * Los controles están aquí y no escondidos en un menú porque es donde se
 * necesitan: quien va a bajar la tonalidad está mirando esta canción, no
 * buscando una lista aparte. La primera versión los metió detrás de un botón
 * que no parecía un botón, y no los encontró nadie.
 *
 * La tonalidad que se muestra en el selector es la **de concierto**, la que
 * comparte la banda. La insignia de al lado es la que lee este músico con su
 * instrumento, y solo aparece cuando son distintas: si a cada uno le saliera
 * la suya sin distinguirlas, dos personas hablando de "la de RE" estarían
 * hablando de cosas diferentes.
 */
const LiveSongCard = forwardRef(function LiveSongCard({
  song,
  index,
  total,
  activa,
  fontSize,
  onCambiarTonalidad,
  onQuitar,
  onMover,
  onElegirVoz,
  notacion = "latin"
}, ref) {
  const tonalidadCompartida = song.key || song.originalKey || "?";
  const tonalidadPropia = song.rendered?.displayKey;
  const difieren = tonalidadPropia && tonalidadPropia !== tonalidadCompartida;

  return (
    <article
      ref={ref}
      className={`live-card ${activa ? "active" : ""}`}
      aria-current={activa ? "true" : undefined}
    >
      <header className="live-card-header">
        <div className="live-card-identity">
          <span className="live-card-number">{index + 1}</span>
          <h2 className="live-card-title">{song.title || "Sin título"}</h2>
          {activa && (
            <span className="live-card-badge-now">
              <i className="bi bi-broadcast me-1" />
              Ahora
            </span>
          )}
        </div>

        <div className="live-card-controls no-print">
          <div className="live-card-keys">
            <span className="live-control-label">Banda</span>
            <PlaylistKeySelector
              value={tonalidadCompartida}
              originalKey={song.originalKey || song.key || "DO"}
              onChange={(key) => onCambiarTonalidad(song.id, key)}
              notacion={notacion}
            />
          </div>

          {difieren && (
            <div className="live-card-keys">
              <span className="live-control-label">Tú</span>
              <span className="live-key-badge live-key-mine">{nombrarTonalidad(tonalidadPropia, notacion)}</span>
            </div>
          )}

          {song.voices.length > 1 && (
            <div className="live-card-keys">
              <span className="live-control-label">Voz</span>
              <select
                className="live-select live-select-compact"
                value={song.voiceKey || ""}
                onChange={(e) => onElegirVoz(song.id, e.target.value)}
                aria-label={`Voz para ${song.title || "esta canción"}`}
              >
                {song.voices.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="live-card-order">
            <button
              type="button"
              className="live-icon-btn"
              onClick={() => onMover(index, index - 1)}
              disabled={index === 0}
              aria-label={`Subir ${song.title || "canción"}`}
              title="Subir"
            >
              <i className="bi bi-chevron-up" />
            </button>
            <button
              type="button"
              className="live-icon-btn"
              onClick={() => onMover(index, index + 1)}
              disabled={index === total - 1}
              aria-label={`Bajar ${song.title || "canción"}`}
              title="Bajar"
            >
              <i className="bi bi-chevron-down" />
            </button>
            <button
              type="button"
              className="live-icon-btn live-icon-danger"
              onClick={() => onQuitar(song.id)}
              aria-label={`Quitar ${song.title || "canción"} de la sesión`}
              title="Quitar de la sesión"
            >
              <i className="bi bi-x-lg" />
            </button>
          </div>
        </div>
      </header>

      {song.error && (
        <div className="live-warning live-warning-error" role="alert">
          <i className="bi bi-exclamation-circle me-2" />
          {song.error} Quien abrió la sesión puede quitarla con la X.
        </div>
      )}

      {!song.error && !song.rendered && (
        <p className="live-card-loading">Cargando…</p>
      )}

      {song.rendered?.formatted?.sections?.map((section, i) => (
        <section key={i} className="song-section-modern">
          <h4 className="song-section-title">{section.title}</h4>
          <div className="song-section-content" style={{ fontSize: `${fontSize}px` }}>
            {section.content}
          </div>
        </section>
      ))}
    </article>
  );
});

export default LiveSongCard;

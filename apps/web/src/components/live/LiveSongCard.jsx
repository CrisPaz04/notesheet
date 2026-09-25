import { forwardRef } from "react";
import PlaylistKeySelector from "../PlaylistKeySelector";
import { nombrarTonalidad, elegirVista } from "@notesheet/core";
import PdfEnLista from "../PdfEnLista";
import Desplegable from "../Desplegable";
import { SeccionesCancion, AvisoVista } from "../SeccionesCancion";
import Icono from "../Icono";

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
  alineacion = "left",
  vista = "principal",
  onCambiarTonalidad,
  onQuitar,
  onMover,
  onElegirVoz,
  notacion = "latin"
}, ref) {
  const tonalidadCompartida = song.key || song.originalKey || "?";
  const tonalidadPropia = song.rendered?.displayKey || song.pdf?.displayKey;
  const difieren = tonalidadPropia && tonalidadPropia !== tonalidadCompartida;

  // Notas (o partitura), letra o acordes, según lo que eligió este músico.
  // Si la canción no tiene lo pedido, la principal y un aviso.
  const cargada = Boolean(song.rendered || song.pdf);
  const eleccion = elegirVista(vista, song.vistas);

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
              <Icono nombre="broadcast" className="me-1" />
              Ahora
            </span>
          )}
        </div>

        <div className="live-card-controls no-print">
          <div className="live-card-keys">
            <span className="live-control-label">Banda</span>
            {/* Un PDF no se transpone: la tonalidad es un dato, no un control */}
            {song.pdf ? (
              <span className="live-key-badge">{nombrarTonalidad(tonalidadCompartida, notacion)}</span>
            ) : (
              <PlaylistKeySelector
                value={tonalidadCompartida}
                originalKey={song.originalKey || song.key || "DO"}
                onChange={(key) => onCambiarTonalidad(song.id, key)}
                notacion={notacion}
              />
            )}
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
              <Desplegable
                className="desplegable--compacto desplegable--live"
                value={song.voiceKey || ""}
                onChange={(voz) => onElegirVoz(song.id, voz)}
                ariaLabel={`Voz para ${song.title || "esta canción"}`}
                opciones={song.voices.map((v) => ({ value: v.id, label: v.label }))}
              />
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
              <Icono nombre="caret-up" />
            </button>
            <button
              type="button"
              className="live-icon-btn"
              onClick={() => onMover(index, index + 1)}
              disabled={index === total - 1}
              aria-label={`Bajar ${song.title || "canción"}`}
              title="Bajar"
            >
              <Icono nombre="caret-down" />
            </button>
            <button
              type="button"
              className="live-icon-btn live-icon-danger"
              onClick={() => onQuitar(song.id)}
              aria-label={`Quitar ${song.title || "canción"} de la sesión`}
              title="Quitar de la sesión"
            >
              <Icono nombre="x" />
            </button>
          </div>
        </div>
      </header>

      {song.error && (
        <div className="live-warning live-warning-error" role="alert">
          <Icono nombre="warning-circle" className="me-2" />
          {song.error} Quien abrió la sesión puede quitarla con la X.
        </div>
      )}

      {!song.error && !song.rendered && !song.pdf && (
        <p className="live-card-loading">Cargando…</p>
      )}

      {cargada && <AvisoVista faltaba={eleccion.faltaba} esPdf={Boolean(song.pdf)} />}

      {eleccion.vista === "principal" ? (
        <>
          {/* Solo se abre cuando la canción está cerca de la pantalla: una
              sesión puede llevar varios PDF. */}
          {song.pdf && <PdfEnLista path={song.pdf.path} title={song.title} />}
          <SeccionesCancion formatted={song.rendered?.formatted} alineacion={alineacion} fontSize={fontSize} />
        </>
      ) : (
        <SeccionesCancion formatted={song.vistas[eleccion.vista]} alineacion={alineacion} fontSize={fontSize} />
      )}
    </article>
  );
});

export default LiveSongCard;

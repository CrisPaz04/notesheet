import {
  nombrarTonalidad,
  tonalidadParaInstrumento,
  esTranspositor,
  formatearDuracion,
  TRANSPOSING_INSTRUMENTS
} from "@notesheet/core";
import EnlacesVerEn from "./EnlacesVerEn";

const NOMBRE_FUENTE = { musicbrainz: "MusicBrainz", itunes: "Apple Music", getsongbpm: "GetSongBPM" };

/**
 * Recuadro con los datos de la grabación original de una canción, traídos
 * con "Buscar datos" en el editor. Está cerrado de entrada para no quitar
 * sitio a la partitura.
 *
 * Todo está en **tonalidad de concierto**, que es como lo dan las fuentes.
 * Por eso, a quien toca un instrumento transpositor se le avisa y se le dice
 * la tonalidad escrita para el suyo.
 */
function DatosGrabacion({ grabacion, titulo, artista, instrumento, notacion = "latin" }) {
  const g = grabacion || null;
  const nombreInstrumento = TRANSPOSING_INSTRUMENTS[instrumento]?.name;
  const tonoMio = g?.tonoConcierto ? tonalidadParaInstrumento(g.tonoConcierto, instrumento) : null;
  const fuenteGrabacion = g?.fuentes?.grabacion;
  const fuenteTempo = g?.fuentes?.tempo;

  return (
    <details className="datos-grabacion no-print">
      <summary>
        <i className="bi bi-vinyl me-2" aria-hidden="true"></i>
        Datos de la grabación original
      </summary>

      <div className="datos-grabacion-cuerpo">
        {g ? (
          <>
            <dl className="datos-grabacion-lista">
              {g.artista && (<><dt>Artista</dt><dd>{g.artista}</dd></>)}
              {g.titulo && (<><dt>Título</dt><dd>{g.titulo}</dd></>)}
              {g.album && (<><dt>Álbum</dt><dd>{g.album}{g.anio ? ` (${g.anio})` : ""}</dd></>)}
              {g.duracion && (<><dt>Duración</dt><dd>{formatearDuracion(g.duracion)}</dd></>)}
              {g.tonoConcierto && (
                <>
                  <dt>Tonalidad</dt>
                  <dd>
                    {nombrarTonalidad(g.tonoConcierto, notacion)}
                    {esTranspositor(instrumento) && tonoMio && (
                      <span className="datos-grabacion-mio">
                        {" "}· en tu instrumento{nombreInstrumento ? ` (${nombreInstrumento})` : ""}:{" "}
                        <strong>{nombrarTonalidad(tonoMio, notacion)}</strong>
                      </span>
                    )}
                  </dd>
                </>
              )}
              {g.bpm && (<><dt>Tempo</dt><dd>{g.bpm} BPM</dd></>)}
              {g.compas && (<><dt>Compás</dt><dd>{g.compas}</dd></>)}
            </dl>

            <p className="datos-grabacion-nota">
              <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
              Son los datos de la grabación original, en tonalidad de concierto. Si tu
              instrumento transpone (trompeta, saxo, clarinete…), puede que tengas que
              transportarlos.
            </p>

            <p className="datos-grabacion-fuentes">
              Fuentes:{" "}
              {fuenteGrabacion?.enlace && (
                <a href={fuenteGrabacion.enlace} target="_blank" rel="noopener noreferrer">
                  {NOMBRE_FUENTE[fuenteGrabacion.fuente] || fuenteGrabacion.fuente}
                </a>
              )}
              {fuenteGrabacion?.enlace && fuenteTempo && " · "}
              {/* Obligatorio mientras se muestren datos de GetSongBPM */}
              {fuenteTempo && (
                <>
                  tempo y tonalidad de{" "}
                  <a href={fuenteTempo.enlace || "https://getsongbpm.com"} target="_blank" rel="noopener">
                    GetSongBPM
                  </a>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="datos-grabacion-vacio">
            Aún no hay datos de la grabación original. Quien edita la canción puede
            traerlos con "Buscar datos".
          </p>
        )}

        <EnlacesVerEn titulo={g?.titulo || titulo} artista={g?.artista || artista} />
      </div>
    </details>
  );
}

export default DatosGrabacion;

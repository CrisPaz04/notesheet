import { useRef, useState } from "react";
import { tempoDesdeToques, TEMPO_MIN, TEMPO_MAX, formatearDuracion } from "@notesheet/core";
import KeySelector from "../KeySelector";
import TypeSelector from "../TypeSelector";
import VersionesInput from "../VersionesInput";
import Desplegable from "../Desplegable";
import BuscarDatosModal from "../datos/BuscarDatosModal";
import Icono from "../Icono";

const COMPASES = ["2/4", "3/4", "4/4", "6/8", "12/8"];

/**
 * Los datos de una canción: título, "Versión de", álbum, tipo, tonalidad,
 * tempo, compás, visibilidad y grabación original.
 *
 * Es el mismo formulario en el editor y en "Importar partituras" (uno por
 * canción), para que un cambio llegue a los dos. Lo que es solo del editor
 * —la sugerencia de tonalidad, el instrumento principal, el formato— entra
 * por las ranuras.
 *
 * @param {Object} props
 * @param {Object} props.valores - `{ title, versiones, album, type, key, tempo, compas, isPublic, grabacion }`
 * @param {(campo: string, valor: any) => void} props.onCambiar
 * @param {string} props.notacion - Para mostrar las tonalidades
 * @param {string} [props.idBase] - Prefijo de los ids: en la importación hay
 *   un formulario por canción y los ids no pueden repetirse
 * @param {React.ReactNode} [props.bajoTonalidad] - Debajo del selector de tonalidad
 * @param {React.ReactNode} [props.trasTonalidad] - Otra casilla tras la tonalidad
 * @param {React.ReactNode} [props.antesDeVisibilidad] - Otra casilla antes de la visibilidad
 */
function CamposCancion({
  valores,
  onCambiar,
  notacion,
  idBase = "song",
  bajoTonalidad = null,
  trasTonalidad = null,
  antesDeVisibilidad = null
}) {
  const { title, versiones, album, type, key, tempo, compas, isPublic, grabacion } = valores;
  const [buscandoDatos, setBuscandoDatos] = useState(false);
  const toquesRef = useRef([]);

  // Tap tempo: cada toque apunta el instante; con tres ya hay tempo. Si pasan
  // más de 2 s entre toques, se empieza de nuevo.
  const tapTempo = () => {
    const ahora = performance.now();
    const toques = toquesRef.current;
    if (toques.length && ahora - toques[toques.length - 1] > 2000) toques.length = 0;
    toques.push(ahora);
    if (toques.length > 8) toques.shift();
    const calculado = tempoDesdeToques(toques);
    if (calculado) onCambiar("tempo", String(calculado));
  };

  // Lo que el músico aceptó en "Buscar datos": solo rellena el formulario
  const aplicarDatos = (propuesta) => {
    if (propuesta.grabacion) onCambiar("grabacion", propuesta.grabacion);
    if (propuesta.tempo) onCambiar("tempo", String(propuesta.tempo));
    if (propuesta.compas) onCambiar("compas", propuesta.compas);
    if (propuesta.versiones) onCambiar("versiones", propuesta.versiones);
  };

  return (
    <>
      <div className="metadata-grid">
        <div className="form-group-modern">
          <label className="form-label-modern" htmlFor={`${idBase}-titulo`}>
            <Icono nombre="text-t" />
            Título
          </label>
          <input
            id={`${idBase}-titulo`}
            type="text"
            className="form-control-modern"
            value={title}
            onChange={(e) => onCambiar("title", e.target.value)}
            placeholder="Nombre de la canción"
          />
        </div>

        <div className="form-group-modern">
          <label className="form-label-modern" htmlFor={`${idBase}-versiones`}>
            <Icono nombre="user" />
            Versión de
          </label>
          <VersionesInput
            id={`${idBase}-versiones`}
            value={versiones}
            onChange={(lista) => onCambiar("versiones", lista)}
          />
          <div className="form-help-text">
            Pulsa Enter para añadir otro nombre.
          </div>
        </div>

        <div className="form-group-modern">
          <label className="form-label-modern" htmlFor={`${idBase}-album`}>
            <Icono nombre="disc" className="me-2" />
            Álbum
          </label>
          <input
            id={`${idBase}-album`}
            type="text"
            className="form-control-modern"
            value={album}
            onChange={(e) => onCambiar("album", e.target.value)}
            placeholder="Álbum al que pertenece"
          />
          <div className="form-help-text">
            Las canciones del mismo álbum se enlazan entre sí.
          </div>
        </div>

        <TypeSelector value={type} onChange={(t) => onCambiar("type", t)} />

        <div>
          <KeySelector value={key} onChange={(k) => onCambiar("key", k)} notacion={notacion} />
          {bajoTonalidad}
        </div>

        {trasTonalidad}

        <div className="form-group-modern">
          <label className="form-label-modern" htmlFor={`${idBase}-tempo`}>
            <Icono nombre="metronome" />
            Tempo (BPM)
          </label>
          <div className="tempo-campo">
            <input
              id={`${idBase}-tempo`}
              type="number"
              inputMode="numeric"
              min={TEMPO_MIN}
              max={TEMPO_MAX}
              className="form-control-modern"
              value={tempo}
              onChange={(e) => onCambiar("tempo", e.target.value)}
              placeholder="Ej.: 72"
            />
            <button
              type="button"
              className="btn-editor-secondary tempo-tap"
              onClick={tapTempo}
              title="Toca al ritmo de la canción"
            >
              Tap
            </button>
          </div>
          <div className="form-help-text">
            El metrónomo arranca con él al abrirlo desde la canción.
          </div>
        </div>

        <div className="form-group-modern">
          <label className="form-label-modern" htmlFor={`${idBase}-compas`}>
            <Icono nombre="grid-four" />
            Compás
          </label>
          <Desplegable
            id={`${idBase}-compas`}
            value={compas}
            onChange={(c) => onCambiar("compas", c)}
            opciones={[
              { value: "", label: "Sin indicar" },
              ...COMPASES.map((c) => ({ value: c, label: c }))
            ]}
          />
        </div>

        {antesDeVisibilidad}

        <div className="form-group-modern">
          <label className="form-label-modern">
            <Icono nombre="eye" className="me-2" />
            Visibilidad
          </label>
          <div className="visibility-toggle">
            <button
              type="button"
              className={`visibility-option ${isPublic ? 'active' : ''}`}
              onClick={() => onCambiar("isPublic", true)}
            >
              <Icono nombre="users" className="me-2" />
              Repertorio
            </button>
            <button
              type="button"
              className={`visibility-option ${!isPublic ? 'active' : ''}`}
              onClick={() => onCambiar("isPublic", false)}
            >
              <Icono nombre="lock" className="me-2" />
              Privada
            </button>
          </div>
          <div className="form-help-text">
            Las canciones del repertorio las ven todos los músicos. Solo tú
            puedes editarlas o borrarlas.
          </div>
        </div>

        <div className="form-group-modern grabacion-original">
          <label className="form-label-modern">
            <Icono nombre="vinyl-record" />
            Grabación original
          </label>
          <div className="grabacion-caja">
            {grabacion ? (
              <p className="grabacion-resumen">
                {[grabacion.artista, grabacion.album, grabacion.anio, formatearDuracion(grabacion.duracion)]
                  .filter(Boolean).join(" · ") || grabacion.titulo}
              </p>
            ) : (
              <p className="grabacion-resumen grabacion-resumen-vacia">Sin datos todavía.</p>
            )}
            <div className="grabacion-acciones">
              <button type="button" className="btn-editor-secondary" onClick={() => setBuscandoDatos(true)}>
                <Icono nombre="magnifying-glass" className="me-1" />
                Buscar datos
              </button>
              {grabacion && (
                <button type="button" className="btn-editor-secondary" onClick={() => onCambiar("grabacion", null)}>
                  Quitar
                </button>
              )}
            </div>
          </div>
          <div className="form-help-text">
            Tonalidad, tempo y duración del disco, de MusicBrainz, iTunes y GetSongBPM.
          </div>
        </div>
      </div>

      <BuscarDatosModal
        isOpen={buscandoDatos}
        onClose={() => setBuscandoDatos(false)}
        titulo={title}
        artista={versiones[0] || ""}
        versiones={versiones}
        notacion={notacion}
        onAplicar={aplicarDatos}
      />
    </>
  );
}

export default CamposCancion;

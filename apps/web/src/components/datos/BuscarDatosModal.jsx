import { useEffect, useState } from "react";
import { buscarDatosDeCancion } from "@notesheet/api";
import { nombrarTonalidad, formatearDuracion, limpiarVersiones } from "@notesheet/core";
import Modal from "../Modal";
import EnlacesVerEn from "./EnlacesVerEn";
import Icono from "../Icono";

const NOMBRE_FUENTE = { musicbrainz: "MusicBrainz", itunes: "iTunes", getsongbpm: "GetSongBPM" };

/**
 * Busca los datos de la grabación original y los propone **uno a uno**.
 *
 * Nada se aplica solo: el músico elige la grabación (estudio, en vivo,
 * medley… cada una con su duración) y el resultado de tempo, y marca qué
 * datos quiere. "Aplicar" solo rellena el formulario del editor; se guarda
 * con el botón Guardar de siempre, como la sugerencia de tonalidad.
 *
 * @param {Object} props
 * @param {(propuesta: {grabacion?: Object, tempo?: number, compas?: string, versiones?: string[]}) => void} props.onAplicar
 */
function BuscarDatosModal({ isOpen, onClose, titulo, artista, versiones = [], notacion = "latin", onAplicar }) {
  const [consulta, setConsulta] = useState({ titulo: "", artista: "" });
  const [estado, setEstado] = useState("inicio"); // inicio | buscando | listo
  const [resultado, setResultado] = useState({ grabaciones: [], tempos: [], errores: {} });
  const [grabacionElegida, setGrabacionElegida] = useState(null);
  const [tempoElegido, setTempoElegido] = useState(null);
  const [marcas, setMarcas] = useState({});

  const buscar = async (t, a) => {
    if (!t.trim()) return;
    setEstado("buscando");
    setGrabacionElegida(null);
    setTempoElegido(null);
    try {
      setResultado(await buscarDatosDeCancion({ titulo: t, artista: a }));
    } catch (error) {
      setResultado({ grabaciones: [], tempos: [], errores: { general: error.message } });
    }
    setEstado("listo");
  };

  // Al abrir, se busca con el título y el primer "versión de" de la canción
  useEffect(() => {
    if (!isOpen) return;
    const inicial = { titulo: titulo || "", artista: artista || "" };
    setConsulta(inicial);
    setEstado("inicio");
    setResultado({ grabaciones: [], tempos: [], errores: {} });
    if (inicial.titulo.trim()) buscar(inicial.titulo, inicial.artista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const g = grabacionElegida != null ? resultado.grabaciones[grabacionElegida] : null;
  const t = tempoElegido != null ? resultado.tempos[tempoElegido] : null;
  const artistaNuevo = g?.artista || t?.artista || "";
  const yaEsVersion = artistaNuevo &&
    limpiarVersiones([...versiones, artistaNuevo]).length === limpiarVersiones(versiones).length;

  // Qué casillas tiene sentido ofrecer con lo elegido. Todas marcadas de
  // entrada salvo "versión de" si ya está.
  const opciones = [
    g && { clave: "grabacion", texto: `Datos de la grabación: ${[g.artista, g.album, g.anio, formatearDuracion(g.duracion)].filter(Boolean).join(" · ")}` },
    t?.tonoConcierto && { clave: "tono", texto: `Tonalidad original: ${nombrarTonalidad(t.tonoConcierto, notacion)} (en concierto)` },
    t?.tempo && { clave: "tempo", texto: `Usar ${t.tempo} BPM como tempo de la canción` },
    t?.compas && { clave: "compas", texto: `Compás ${t.compas}` },
    artistaNuevo && !yaEsVersion && { clave: "version", texto: `Añadir «${artistaNuevo}» a "Versión de"` }
  ].filter(Boolean);

  const marcada = (clave) => marcas[clave] !== false;
  const alternar = (clave) => setMarcas((m) => ({ ...m, [clave]: !marcada(clave) }));

  const aplicar = () => {
    const quiere = (clave) => opciones.some((o) => o.clave === clave) && marcada(clave);
    const propuesta = {};

    if (quiere("grabacion") || quiere("tono")) {
      propuesta.grabacion = {
        titulo: (quiere("grabacion") && g?.titulo) || t?.titulo || "",
        artista: (quiere("grabacion") && g?.artista) || t?.artista || "",
        album: quiere("grabacion") ? g?.album || "" : "",
        anio: quiere("grabacion") ? g?.anio ?? null : null,
        duracion: quiere("grabacion") ? g?.duracion ?? null : null,
        tonoConcierto: quiere("tono") ? t.tonoConcierto : null,
        bpm: t?.tempo ?? null,
        compas: t?.compas ?? null,
        fuentes: {
          grabacion: quiere("grabacion") && g ? { fuente: g.fuente, id: g.id, enlace: g.enlace } : null,
          tempo: t ? { fuente: "getsongbpm", id: t.id, enlace: t.enlace } : null
        },
        actualizado: new Date().toISOString().slice(0, 10)
      };
    }
    if (quiere("tempo")) propuesta.tempo = t.tempo;
    if (quiere("compas")) propuesta.compas = t.compas;
    if (quiere("version")) propuesta.versiones = limpiarVersiones([...versiones, artistaNuevo]);

    onAplicar(propuesta);
    onClose();
  };

  const nada = estado === "listo" && !resultado.grabaciones.length && !resultado.tempos.length;
  const erroresFuente = Object.entries(resultado.errores || {});

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Buscar datos de la grabación original" size="large">
      <div className="buscar-datos">
        <form
          className="buscar-datos-consulta"
          onSubmit={(e) => { e.preventDefault(); buscar(consulta.titulo, consulta.artista); }}
        >
          <input
            className="form-control-modern"
            aria-label="Título a buscar"
            placeholder="Título"
            value={consulta.titulo}
            onChange={(e) => setConsulta({ ...consulta, titulo: e.target.value })}
          />
          <input
            className="form-control-modern"
            aria-label="Artista a buscar"
            placeholder="Artista"
            value={consulta.artista}
            onChange={(e) => setConsulta({ ...consulta, artista: e.target.value })}
          />
          <button type="submit" className="btn-editor-secondary" disabled={estado === "buscando" || !consulta.titulo.trim()}>
            <Icono nombre="magnifying-glass" className="me-1" />
            Buscar
          </button>
        </form>

        {estado === "buscando" && <p className="buscar-datos-estado" role="status">Buscando en MusicBrainz, iTunes y GetSongBPM…</p>}

        {nada && (
          <p className="buscar-datos-estado" role="status">
            No se encontró esta canción en MusicBrainz, iTunes ni GetSongBPM. Prueba con otro
            título o artista, rellena el tempo a mano, o búscala en otra web:
          </p>
        )}

        {erroresFuente.length > 0 && (
          <p className="buscar-datos-aviso">
            <Icono nombre="warning" className="me-1" />
            No se pudo consultar {erroresFuente.map(([f]) => NOMBRE_FUENTE[f] || f).join(", ")}. El resto de
            resultados sí son válidos.
          </p>
        )}

        {resultado.grabaciones.length > 0 && (
          <fieldset className="buscar-datos-grupo">
            <legend>1. ¿Cuál es vuestra grabación?</legend>
            {resultado.grabaciones.map((r, i) => (
              <label key={`${r.fuente}-${r.id}-${i}`} className="buscar-datos-opcion">
                <input
                  type="radio"
                  name="grabacion"
                  checked={grabacionElegida === i}
                  onChange={() => setGrabacionElegida(i)}
                />
                <span>
                  <strong>{r.titulo}</strong> — {r.artista}
                  <span className="buscar-datos-detalle">
                    {[r.album, r.anio, formatearDuracion(r.duracion)].filter(Boolean).join(" · ")}
                    {" "}({NOMBRE_FUENTE[r.fuente]})
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {resultado.tempos.length > 0 && (
          <fieldset className="buscar-datos-grupo">
            <legend>2. Tempo y tonalidad</legend>
            {resultado.tempos.map((r, i) => (
              <label key={`${r.id}-${i}`} className="buscar-datos-opcion">
                <input
                  type="radio"
                  name="tempo"
                  checked={tempoElegido === i}
                  onChange={() => setTempoElegido(i)}
                />
                <span>
                  <strong>{r.titulo}</strong> — {r.artista}
                  <span className="buscar-datos-detalle">
                    {[
                      r.tempo && `${r.tempo} BPM`,
                      r.tonoConcierto && nombrarTonalidad(r.tonoConcierto, notacion),
                      r.compas
                    ].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {opciones.length > 0 && (
          <fieldset className="buscar-datos-grupo buscar-datos-grupo-opciones">
            <legend>3. Qué datos usar</legend>
            {opciones.map((o) => (
              <label key={o.clave} className="buscar-datos-opcion">
                <input type="checkbox" checked={marcada(o.clave)} onChange={() => alternar(o.clave)} />
                <span>{o.texto}</span>
              </label>
            ))}
            <p className="buscar-datos-nota">
              La tonalidad es la de la grabación, en concierto: no cambia la tonalidad de la
              canción en NoteSheet, que sigue siendo la que ya tiene.
            </p>
          </fieldset>
        )}

        <EnlacesVerEn titulo={consulta.titulo} artista={consulta.artista} />

        <p className="buscar-datos-credito">
          Datos de MusicBrainz, iTunes y{" "}
          <a href="https://getsongbpm.com" target="_blank" rel="noopener">GetSongBPM</a>.
        </p>

        <div className="buscar-datos-acciones">
          <button type="button" className="btn-editor-secondary" onClick={onClose}>Cancelar</button>
          <button
            type="button"
            className="btn-editor-primary"
            onClick={aplicar}
            disabled={!opciones.some((o) => marcada(o.clave))}
          >
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default BuscarDatosModal;

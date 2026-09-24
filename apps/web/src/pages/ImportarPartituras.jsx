// apps/web/src/pages/ImportarPartituras.jsx
//
// Importar la carpeta "Partituras" entera: una canción por autor y título, y
// cada PDF a su voz, todo por los nombres de los archivos.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  agruparPorCancion,
  repartirPdfs,
  buscarCancionParaPdfs,
  isPdfSong
} from "@notesheet/core";
import { getAllSongs, subirVariasPartituras, crearCancionPdf } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import RepartoPdfs from "../components/partituras/RepartoPdfs";
import CamposCancion from "../components/cancion/CamposCancion";
import useNotacionPreferida from "../hooks/useNotacionPreferida";

// El selector de carpetas no es un atributo estándar de React: va tal cual
const ELEGIR_CARPETA = { webkitdirectory: "", directory: "" };

// Los datos con que nace una canción nueva: lo que dice el nombre de sus
// archivos, y el resto como en una canción nueva del editor
const datosIniciales = ({ titulo, autor }) => ({
  title: titulo,
  versiones: autor ? [autor] : [],
  album: "",
  type: "Adoración",
  key: "DO",
  tempo: "",
  compas: "",
  isPublic: true,
  grabacion: null
});

function ImportarPartituras() {
  const { currentUser } = useAuth();
  const [notacion] = useNotacionPreferida(currentUser);
  // Los datos que el músico va rellenando de cada canción nueva, por su clave
  const [detalles, setDetalles] = useState({});
  const [canciones, setCanciones] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [excluidas, setExcluidas] = useState(new Set());
  const [abierta, setAbierta] = useState(null);
  const [progreso, setProgreso] = useState(null); // { cancion, hechos, total, actual }
  const [resultados, setResultados] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    getAllSongs(currentUser.uid)
      .then(setCanciones)
      .catch((e) => setError("No se pudo cargar el repertorio: " + e.message));
  }, [currentUser]);

  // Solo se pueden añadir PDF a las canciones propias: las reglas no dejan
  // escribir las de otros músicos
  const propias = useMemo(() => canciones.filter((c) => c.isOwn), [canciones]);

  const plan = useMemo(() => agruparPorCancion(archivos).map((grupo) => {
    const reparto = repartirPdfs(grupo.archivos);
    const destino = buscarCancionParaPdfs(propias, grupo);
    const ajena = destino ? null : buscarCancionParaPdfs(canciones.filter((c) => !c.isOwn), grupo);
    return { ...grupo, clave: `${grupo.autor}|${grupo.titulo}`, reparto, destino, ajena };
  }), [archivos, propias, canciones]);

  const incluidas = plan.filter((p) => p.reparto.asignados.length > 0 && !excluidas.has(p.clave));
  const totalPdf = incluidas.reduce((n, p) => n + p.reparto.asignados.length, 0);

  const datosDe = (p) => detalles[p.clave] || datosIniciales(p);
  const cambiarDato = (p) => (campo, valor) => setDetalles((prev) => ({
    ...prev,
    [p.clave]: { ...(prev[p.clave] || datosIniciales(p)), [campo]: valor }
  }));

  const alElegir = (e) => {
    setArchivos([...(e.target.files || [])]);
    setExcluidas(new Set());
    setDetalles({});
    setResultados(null);
    e.target.value = "";
  };

  const alternar = (clave) => setExcluidas((prev) => {
    const siguiente = new Set(prev);
    if (siguiente.has(clave)) siguiente.delete(clave); else siguiente.add(clave);
    return siguiente;
  });

  const importar = async () => {
    const hechos = [];
    for (const p of incluidas) {
      try {
        const datos = datosDe(p);
        const song = p.destino || await crearCancionPdf({
          // Sin título no se reconocería en el repertorio: el del archivo
          datos: { ...datos, title: datos.title.trim() || p.titulo },
          userId: currentUser.uid
        });
        const r = await subirVariasPartituras({
          song,
          asignados: p.reparto.asignados,
          onProgreso: (avance) => setProgreso({ cancion: p.titulo, ...avance })
        });
        hechos.push({ titulo: p.titulo, songId: song.id, creada: !p.destino, subidos: r.subidos, errores: r.errores });
      } catch (e) {
        hechos.push({ titulo: p.titulo, songId: null, creada: false, subidos: 0, errores: [{ archivo: { name: "—" }, mensaje: e.message }] });
      }
    }
    setProgreso(null);
    setResultados(hechos);
    setArchivos([]);
    // Las recién creadas cuentan ya como existentes para la siguiente tanda
    getAllSongs(currentUser.uid).then(setCanciones).catch(() => {});
  };

  return (
    <div className="importar-pdfs-container">
      <div className="container">
        <header className="importar-pdfs-cabecera">
          <h1>Importar partituras</h1>
          <p>
            Elige la carpeta <strong>Partituras</strong> entera (o la de una canción). Cada PDF va a
            su canción y a su voz por el nombre del archivo:
          </p>
          <code className="importar-pdfs-ejemplo">Coalo Zamorano--Alégrense--Bb_Trumpet_2--NN.pdf</code>
          <p className="importar-pdfs-nota">
            Autor, título, instrumento con su número de voz (sin número es la 1) y <code>NN</code> para
            la versión con los nombres de las notas. La partitura completa (<code>Score</code>) no se
            sube. Si la canción ya está en tu repertorio, se le añaden los PDF; si no, se crea.
          </p>
        </header>

        {error && <div className="alert alert-danger">{error}</div>}

        {!progreso && (
          <div className="importar-pdfs-elegir">
            <label className="btn-editor-primary">
              <i className="bi bi-folder2-open me-1"></i>
              Elegir carpeta
              <input type="file" multiple hidden onChange={alElegir} data-testid="importar-carpeta" {...ELEGIR_CARPETA} />
            </label>
            <label className="btn-editor-secondary">
              <i className="bi bi-files me-1"></i>
              Elegir archivos
              <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={alElegir} data-testid="importar-archivos" />
            </label>
          </div>
        )}

        {archivos.length > 0 && plan.length === 0 && (
          <p className="importar-pdfs-vacio">No hay ningún PDF con nombre de canción en lo que elegiste.</p>
        )}

        {plan.length > 0 && !progreso && (
          <>
            <ul className="importar-pdfs-canciones">
              {plan.map((p) => {
                const sinNada = p.reparto.asignados.length === 0;
                const incluida = !sinNada && !excluidas.has(p.clave);
                return (
                  <li key={p.clave} className={`importar-pdfs-cancion${incluida ? "" : " excluida"}`}>
                    <div className="importar-pdfs-fila">
                      <label className="importar-pdfs-check">
                        <input
                          type="checkbox"
                          checked={incluida}
                          disabled={sinNada}
                          onChange={() => alternar(p.clave)}
                        />
                        <span>
                          <strong>{p.titulo}</strong>
                          {p.autor && <span className="importar-pdfs-autor"> · {p.autor}</span>}
                        </span>
                      </label>
                      <span className="importar-pdfs-destino">
                        {p.destino
                          ? <>Se añaden a tu canción <strong>{p.destino.title}</strong></>
                          : <>Se crea nueva{p.ajena ? " (hay una con ese título de otro músico)" : ""}</>}
                      </span>
                      <button
                        type="button"
                        className="importar-pdfs-detalle"
                        onClick={() => setAbierta(abierta === p.clave ? null : p.clave)}
                        aria-expanded={abierta === p.clave}
                      >
                        {p.reparto.asignados.length} PDF
                        {p.reparto.apartados.length > 0 && ` · ${p.reparto.apartados.length} sin subir`}
                        <i className={`bi bi-chevron-${abierta === p.clave ? "up" : "down"} ms-1`}></i>
                      </button>
                    </div>

                    {/* Los datos de la canción nueva, abiertos: es cuando se
                        tienen a mano. Los de una que ya existe no se tocan. */}
                    {!p.destino && incluida && (
                      <div className="importar-pdfs-detalles">
                        <CamposCancion
                          valores={datosDe(p)}
                          onCambiar={cambiarDato(p)}
                          notacion={notacion}
                          idBase={`importar-${plan.indexOf(p)}`}
                        />
                      </div>
                    )}

                    {p.destino && (
                      <p className="importar-pdfs-aviso">
                        <i className="bi bi-info-circle me-1"></i>
                        Se conservan los datos de tu canción: solo se le añaden los PDF.
                      </p>
                    )}

                    {p.destino && !isPdfSong(p.destino) && (
                      <p className="importar-pdfs-aviso">
                        <i className="bi bi-info-circle me-1"></i>
                        Tiene notas en texto: se abrirá en la partitura, y sus notas seguirán en la pestaña Notas.
                      </p>
                    )}

                    {abierta === p.clave && (
                      <RepartoPdfs asignados={p.reparto.asignados} apartados={p.reparto.apartados} />
                    )}
                  </li>
                );
              })}
            </ul>

            <div className="importar-pdfs-acciones">
              <button
                type="button"
                className="btn-editor-primary"
                onClick={importar}
                disabled={incluidas.length === 0}
              >
                <i className="bi bi-cloud-upload me-1"></i>
                Importar {incluidas.length} {incluidas.length === 1 ? "canción" : "canciones"} ({totalPdf} PDF)
              </button>
            </div>
          </>
        )}

        {progreso && (
          <p className="importar-pdfs-progreso" role="status">
            <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            {progreso.cancion}: {Math.min(progreso.hechos + 1, progreso.total)} de {progreso.total}
            {progreso.actual ? ` — ${progreso.actual}` : ""}
          </p>
        )}

        {resultados && (
          <ul className="importar-pdfs-resultados" aria-label="Resultado">
            {resultados.map((r) => (
              <li key={r.titulo} className={r.errores.length ? "con-errores" : ""}>
                <i className={`bi ${r.errores.length ? "bi-exclamation-triangle" : "bi-check-circle"} me-2`}></i>
                {r.songId ? <Link to={`/songs/${r.songId}`}>{r.titulo}</Link> : r.titulo}
                {" — "}{r.creada ? "creada, " : ""}{r.subidos} PDF
                {r.errores.length > 0 && (
                  <ul>
                    {r.errores.map((e) => <li key={e.archivo.name}>{e.archivo.name}: {e.mensaje}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ImportarPartituras;

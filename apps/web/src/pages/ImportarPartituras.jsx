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
import Icono from "../components/Icono";
import { archivosSoltados } from "../utils/archivosSoltados";

// El selector de carpetas no es un atributo estándar de React: va tal cual
const ELEGIR_CARPETA = { webkitdirectory: "", directory: "" };

// Un nombre de archivo desarmado, para enseñar cómo se leen
const PARTES_DEL_NOMBRE = [
  { texto: "Coalo Zamorano", que: "Autor" },
  { texto: "Alégrense", que: "Título" },
  { texto: "Bb_Trumpet_2", que: "Instrumento y voz" },
  { texto: "NN", que: "Con nombres de notas", opcional: true }
];

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
  // Algo arrastrado encima de la zona
  const [encima, setEncima] = useState(false);

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

  const usarArchivos = (lista) => {
    setArchivos(lista);
    setExcluidas(new Set());
    setDetalles({});
    setResultados(null);
  };

  const alElegir = (e) => {
    usarArchivos([...(e.target.files || [])]);
    e.target.value = "";
  };

  const alSoltar = (e) => {
    e.preventDefault();
    setEncima(false);
    // Las entradas se sacan aquí mismo, dentro del evento (ver archivosSoltados)
    archivosSoltados(e.dataTransfer)
      .then(usarArchivos)
      .catch((err) => setError("No se pudo leer lo que soltaste: " + err.message));
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
        <header className="importar-cabecera fade-in">
          <h1 className="importar-titulo">
            <Icono nombre="folder-open" />
            Importar partituras
          </h1>
          <p className="importar-subtitulo">
            Sube tu carpeta de partituras: cada PDF va a su canción y a su voz por el nombre del archivo.
          </p>
        </header>

        {error && (
          <div className="alert alert-danger" role="alert">
            <Icono nombre="warning" peso="fill" className="me-2" />
            {error}
          </div>
        )}

        {!progreso && (
          <section
            className={`importar-zona${encima ? " importar-zona--encima" : ""}${archivos.length ? " importar-zona--compacta" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setEncima(false); }}
            onDrop={alSoltar}
          >
            <Icono nombre="cloud-arrow-up" className="importar-zona-icono" />
            <p className="importar-zona-titulo">
              {encima ? "Suéltala aquí" : "Arrastra aquí la carpeta de partituras"}
            </p>
            <p className="importar-zona-texto">
              {archivos.length > 0
                ? `${archivos.length} ${archivos.length === 1 ? "archivo elegido" : "archivos elegidos"}. Puedes elegir otros.`
                : "o elígela: la carpeta entera, la de una canción o unos PDF sueltos."}
            </p>
            <div className="importar-pdfs-elegir">
              <label className="btn-editor-primary">
                <Icono nombre="folder-open" className="me-1" />
                Elegir carpeta
                <input type="file" multiple hidden onChange={alElegir} data-testid="importar-carpeta" {...ELEGIR_CARPETA} />
              </label>
              <label className="btn-editor-secondary">
                <Icono nombre="files" className="me-1" />
                Elegir archivos
                <input type="file" accept="application/pdf,.pdf" multiple hidden onChange={alElegir} data-testid="importar-archivos" />
              </label>
            </div>
          </section>
        )}

        {/* Abierta hasta que se eligen archivos: luego estorba, pero sigue a mano */}
        <details className="importar-tarjeta importar-nombres" open={!archivos.length}>
          <summary className="importar-tarjeta-cabecera">
            <Icono nombre="info" className="me-2" />
            Cómo se leen los nombres
            <Icono nombre="caret-down" className="importar-nombres-flecha" />
          </summary>
          <div className="importar-tarjeta-cuerpo">
            <div className="importar-anatomia" aria-label="Coalo Zamorano--Alégrense--Bb_Trumpet_2--NN.pdf">
              {PARTES_DEL_NOMBRE.map((parte, i) => (
                <div key={parte.que} className="importar-anatomia-grupo">
                  {i > 0 && <span className="importar-anatomia-separador">--</span>}
                  <div className={`importar-anatomia-parte${parte.opcional ? " importar-anatomia-parte--opcional" : ""}`}>
                    <div className="importar-anatomia-fila">
                      <code>{parte.texto}</code>
                      {/* La extensión va pegada a la última parte, no tras su etiqueta */}
                      {i === PARTES_DEL_NOMBRE.length - 1 && <span className="importar-anatomia-separador">.pdf</span>}
                    </div>
                    <span>{parte.que}{parte.opcional ? " (opcional)" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
            <ul className="importar-reglas">
              <li>Sin número de voz, es la 1: <code>Bb_Trumpet</code> es la trompeta 1.</li>
              <li><code>NN</code> es la versión con los nombres de las notas encima.</li>
              <li>La partitura completa (<code>Score</code>) no se sube.</li>
              <li>Si la canción ya está en tu repertorio, se le añaden los PDF; si no, se crea.</li>
            </ul>
          </div>
        </details>

        {archivos.length > 0 && plan.length === 0 && (
          <p className="importar-pdfs-vacio">
            <Icono nombre="warning-circle" className="me-2" />
            No hay ningún PDF con nombre de canción en lo que elegiste.
          </p>
        )}

        {plan.length > 0 && !progreso && (
          <section className="importar-tarjeta">
            <div className="importar-tarjeta-cabecera">
              <Icono nombre="music-notes" className="me-2" />
              Lo que se va a subir
              <span className="importar-tarjeta-cuenta">
                {plan.length} {plan.length === 1 ? "canción" : "canciones"}
              </span>
            </div>
            <div className="importar-tarjeta-cuerpo">
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
                        <span className={`importar-pdfs-destino${p.destino ? " importar-pdfs-destino--existe" : ""}`}>
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
                          <Icono nombre={abierta === p.clave ? "caret-up" : "caret-down"} className="ms-1" />
                        </button>
                      </div>

                      {abierta === p.clave && (
                        <RepartoPdfs asignados={p.reparto.asignados} apartados={p.reparto.apartados} />
                      )}

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
                          <Icono nombre="info" className="me-1" />
                          Se conservan los datos de tu canción: solo se le añaden los PDF.
                        </p>
                      )}

                      {p.destino && !isPdfSong(p.destino) && (
                        <p className="importar-pdfs-aviso">
                          <Icono nombre="info" className="me-1" />
                          Tiene notas en texto: se abrirá en la partitura, y sus notas seguirán en la pestaña Notas.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="importar-pdfs-acciones">
              <button
                type="button"
                className="btn-editor-primary"
                onClick={importar}
                disabled={incluidas.length === 0}
              >
                <Icono nombre="cloud-arrow-up" className="me-1" />
                Importar {incluidas.length} {incluidas.length === 1 ? "canción" : "canciones"} ({totalPdf} PDF)
              </button>
            </div>
          </section>
        )}

        {progreso && (
          <section className="importar-tarjeta importar-progreso" role="status">
            <div className="importar-tarjeta-cuerpo">
              <p className="importar-progreso-texto">
                <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                Subiendo <strong>{progreso.cancion}</strong>: {Math.min(progreso.hechos + 1, progreso.total)} de {progreso.total}
              </p>
              <div className="importar-progreso-barra" aria-hidden="true">
                <span style={{ width: `${(100 * progreso.hechos) / Math.max(progreso.total, 1)}%` }} />
              </div>
              {progreso.actual && <p className="importar-progreso-archivo">{progreso.actual}</p>}
            </div>
          </section>
        )}

        {resultados && (
          <section className="importar-tarjeta">
            <div className="importar-tarjeta-cabecera">
              <Icono nombre="check-circle" className="me-2" />
              Resultado
            </div>
            <div className="importar-tarjeta-cuerpo">
              <ul className="importar-pdfs-resultados" aria-label="Resultado">
                {resultados.map((r) => (
                  <li key={r.titulo} className={r.errores.length ? "con-errores" : ""}>
                    <Icono nombre={r.errores.length ? "warning" : "check-circle"} className="me-2" />
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
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default ImportarPartituras;

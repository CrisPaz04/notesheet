// apps/web/src/pages/LiveSession.jsx
//
// La pantalla del servicio: todos viendo la misma lista, cada quien con su
// instrumento.
//
// Las canciones se muestran TODAS seguidas, no una cada vez. En los enlaces
// rápidos hace falta ver el final de una y el principio de la siguiente, que
// es justo el momento en que no se puede apartar la vista del papel. La
// canción activa es un puntero compartido —marca dónde va la banda y lleva el
// scroll— no un filtro que esconde lo demás.
//
// La otra división, la de siempre: lo que sale de `useLiveSession` es
// compartido y lo que cambie aquí le cambia a los doce; lo que sale de
// `usePreferenciaLocal` es de este dispositivo y no viaja a ningún sitio.
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  TRANSPOSING_INSTRUMENTS,
  INSTRUMENT_GROUPS,
  SOURCE_INSTRUMENT,
  NUMEROS_DE_VOZ,
  vistaPreferida
} from "@notesheet/core";
import { getUserPreferences } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import useLiveSession from "../hooks/useLiveSession";
import useAlineacionTexto from "../hooks/useAlineacionTexto";
import AlineacionTexto from "../components/AlineacionTexto";
import Desplegable from "../components/Desplegable";
import SelectorVista from "../components/SelectorVista";
import HerramientasFlotantes from "../components/herramientas/HerramientasFlotantes";
import useLiveSetlistContent from "../hooks/useLiveSetlistContent";
import usePreferenciaLocal from "../hooks/usePreferenciaLocal";
import useNotacionPreferida from "../hooks/useNotacionPreferida";
import useFontSizePreference from "../hooks/useFontSizePreference";
import useNumeroDeVoz from "../hooks/useNumeroDeVoz";
import LoadingSpinner from "../components/LoadingSpinner";
import LiveBar from "../components/live/LiveBar";
import LiveSetlist from "../components/live/LiveSetlist";
import LiveSongCard from "../components/live/LiveSongCard";
import AddSongToSession from "../components/live/AddSongToSession";
import GuestGate from "../components/live/GuestGate";
import Icono from "../components/Icono";

const INSTRUMENTOS = Object.keys(TRANSPOSING_INSTRUMENTS);
const SEGUIR = ["si", "no"];
const SIN_CANCIONES = [];

// La vista con que arranca cada instrumento en una lista de canciones: se
// supone que las hay de todo, y cada canción que no lo tenga avisa.
const vistaDelInstrumento = (id) => vistaPreferida(id, { hayLetra: true, hayAcordes: true });

function LiveSession() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { currentUser, loading: cargandoAuth } = useAuth();

  // --- Lo mío, en este dispositivo ---
  const [instrumento, setInstrumento] = usePreferenciaLocal(
    "live:instrumento",
    SOURCE_INSTRUMENT,
    INSTRUMENTOS
  );
  // La del perfil si hay cuenta; los invitados, que entran por el enlace sin
  // cuenta, la guardan solo en el dispositivo (con la clave de siempre, para
  // no perder la que ya tenían elegida).
  const [notacion, setNotacion] = useNotacionPreferida(currentUser, "live:notacion");

  /**
   * Si el scroll sigue al director.
   *
   * Se recuerda en el dispositivo porque es una postura, no una decisión de
   * un momento: el que toca teclado y va mirando dos canciones por delante lo
   * apaga una vez y quiere que siga apagado la próxima vez.
   */
  const [seguir, setSeguir] = usePreferenciaLocal("live:seguir", "si", SEGUIR);

  /**
   * Si los controles propios están desplegados.
   *
   * Todo lo de arriba se queda fijo para poder pasar de canción sin volver al
   * principio, pero eso tiene un precio: en un móvil, instrumento + notación +
   * tamaño + seguir se comen media pantalla, que es justo la que hace falta
   * para leer. Se configuran una vez al entrar y después estorban, así que se
   * pliegan y el dispositivo lo recuerda.
   */
  const [verAjustes, setVerAjustes] = usePreferenciaLocal("live:ajustes", "si", SEGUIR);

  const [voiceKeys, setVoiceKeys] = useState({});

  // Qué número es en su sección hoy ("soy la trompeta 2"). Lo elige cada uno;
  // cada canción le da la voz que le toca según las que tenga.
  const [numeroVoz, setNumeroVoz] = useNumeroDeVoz();
  const [verIndice, setVerIndice] = useState(false);

  const { fontSize, setFontSize, increaseFontSize, decreaseFontSize } =
    useFontSizePreference(currentUser);
  const [alineacion, setAlineacion] = useAlineacionTexto();

  // Notas, letra o acordes de todas las canciones. Arranca en la del
  // instrumento (la voz en la letra, la guitarra en los acordes...) y vuelve
  // a ella si cambia de instrumento; una canción que no tenga la elegida
  // enseña sus notas con un aviso (`elegirVista`).
  const [vista, setVista] = useState(() => vistaDelInstrumento(instrumento));
  useEffect(() => {
    setVista(vistaDelInstrumento(instrumento));
  }, [instrumento]);

  // --- Lo compartido ---
  const {
    session, songs, activeSongId, activeIndex,
    estado, error, sinRed, participants, isHost,
    irACancion, cambiarTonalidad,
    moverCancion, agregarCancion, quitarCancion, cerrarSesion, salir,
    anunciarInstrumento, entrado
  } = useLiveSession(code, { user: currentUser });

  // Un invitado (sin cuenta) solo puede leer las canciones de la sesión en la
  // que entró, y eso lo apunta `joinSession`. Hasta entonces las reglas se
  // las negarían, y el aviso de "no disponible" se quedaría puesto.
  const esInvitado = Boolean(currentUser?.isAnonymous);
  const puedeLeer = !esInvitado || entrado;

  const { canciones } = useLiveSetlistContent({
    songs: puedeLeer ? songs : SIN_CANCIONES,
    instrument: instrumento,
    notationSystem: notacion,
    voiceKeys,
    voiceNumber: numeroVoz
  });

  const propiaPorId = useMemo(
    () => new Map(canciones.map((c) => [c.id, c.rendered?.displayKey || c.pdf?.displayKey]).filter(([, k]) => k)),
    [canciones]
  );

  // --- Scroll hacia la canción activa ---
  const refsCanciones = useRef({});
  const ultimaActiva = useRef(null);
  const headerRef = useRef(null);

  /**
   * Publica la altura de la cabecera fija en una variable CSS.
   *
   * `scroll-margin-top` la usa para que, al saltar a una canción, su título no
   * quede escondido debajo de la cabecera. Un valor fijo no sirve porque la
   * cabecera cambia de alto al plegar los ajustes o al aparecer el aviso de
   * "sin conexión".
   */
  useEffect(() => {
    const nodo = headerRef.current;
    if (!nodo) return undefined;

    const aplicar = () => {
      nodo.parentElement?.style.setProperty("--live-header-h", `${nodo.offsetHeight}px`);
    };

    aplicar();

    // jsdom no implementa ResizeObserver; sin red de seguridad, los tests de
    // esta pantalla reventarían al montar.
    if (typeof ResizeObserver === "undefined") return undefined;

    const observador = new ResizeObserver(aplicar);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [verAjustes, sinRed, estado]);

  /**
   * Marca que el salto lo he pedido yo.
   *
   * "Seguir al director" solo debe gobernar los cambios de **otros**. Si lo
   * apago porque voy mirando dos canciones por delante, pero luego pulso
   * Siguiente yo mismo, tengo que ir a donde he pulsado: un botón que no te
   * lleva a donde dice es peor que no tenerlo.
   */
  const saltoPropio = useRef(false);

  const registrarRef = useCallback((songId) => (nodo) => {
    if (nodo) refsCanciones.current[songId] = nodo;
    else delete refsCanciones.current[songId];
  }, []);

  /** Envuelve una acción compartida para que además me lleve el scroll. */
  const conScroll = useCallback((accion) => (...args) => {
    saltoPropio.current = true;
    return accion(...args);
  }, []);

  useEffect(() => {
    if (!activeSongId) return;

    // Solo cuando cambia de verdad: sin esto, cualquier re-render (un latido
    // de presencia de otro) devolvería el scroll a la canción activa mientras
    // el músico está mirando otra a propósito.
    if (ultimaActiva.current === activeSongId) return;
    ultimaActiva.current = activeSongId;

    const meToca = seguir === "si" || saltoPropio.current;
    saltoPropio.current = false;
    if (!meToca) return;

    refsCanciones.current[activeSongId]?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, [activeSongId, seguir]);

  /**
   * La canción que este músico tiene delante.
   *
   * No es la de la banda: quien baja a mirar la siguiente con el dedo sigue
   * teniendo la banda en otra. Antes el contador y Anterior/Siguiente iban
   * siempre con la de la banda, así que tras bajar a mano hasta la última,
   * "Siguiente" te subía a la segunda.
   *
   * Cuenta la última tarjeta cuyo principio ya ha pasado por debajo de la
   * cabecera fija. Al final de la página una canción corta no llega a subir
   * tanto; si ya no se puede bajar más, cuenta la última que asoma.
   */
  const [enVistaId, setEnVistaId] = useState(null);

  // Mientras dura un salto pedido con Anterior/Siguiente, el desplazamiento
  // animado pasa por las canciones de en medio. Se ignoran esas lecturas un
  // momento; si no, una segunda pulsación rápida contaría desde la de antes.
  const saltoEnCurso = useRef(null); // { id, hasta }

  useEffect(() => {
    // Se mide como mucho cada 60 ms mientras se desplaza: sobra para un
    // contador y no carga la tablet.
    let pendiente = null;

    const medir = () => {
      pendiente = null;
      const cajas = songs
        .map((s) => ({ id: s.id, nodo: refsCanciones.current[s.id] }))
        .filter((c) => c.nodo)
        .map((c) => ({ id: c.id, caja: c.nodo.getBoundingClientRect() }));

      // Sin maquetar todavía (o en jsdom) todo mide 0: no se sabe cuál se ve
      if (cajas.length === 0 || cajas.every((c) => c.caja.height === 0)) {
        setEnVistaId(null);
        return;
      }

      const linea = (headerRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
      let elegida = cajas[0].id;
      cajas.forEach((c) => { if (c.caja.top <= linea) elegida = c.id; });

      const alFinal = window.innerHeight + window.scrollY
        >= document.documentElement.scrollHeight - 2;
      if (alFinal) {
        const asoman = cajas.filter((c) => c.caja.top < window.innerHeight);
        if (asoman.length > 0) elegida = asoman[asoman.length - 1].id;
      }

      const salto = saltoEnCurso.current;
      if (salto) {
        if (elegida !== salto.id && Date.now() < salto.hasta) return;
        saltoEnCurso.current = null;
      }

      setEnVistaId(elegida);
    };

    const alMoverse = () => {
      if (pendiente === null) pendiente = setTimeout(medir, 60);
    };

    medir();
    window.addEventListener("scroll", alMoverse, { passive: true });
    window.addEventListener("resize", alMoverse);
    return () => {
      window.removeEventListener("scroll", alMoverse);
      window.removeEventListener("resize", alMoverse);
      if (pendiente !== null) clearTimeout(pendiente);
    };
  }, [songs]);

  // Anterior y Siguiente cuentan desde la que se ve; si no se sabe, desde la
  // de la banda.
  const indiceEnVista = enVistaId ? songs.findIndex((s) => s.id === enVistaId) : -1;
  const indiceBase = indiceEnVista >= 0 ? indiceEnVista : activeIndex;
  //
  // El botón lleva SIEMPRE a la canción, y además mueve a la banda si iba en
  // otra. Antes solo movía a la banda y el scroll iba detrás del cambio: si
  // la de destino ya era la de la banda (mirando la 1 con la banda en la 2,
  // pulsar Siguiente), no cambiaba nada y el botón parecía no funcionar.
  const irARelativa = (salto) => {
    const destino = songs[indiceBase + salto];
    if (!destino) return;

    refsCanciones.current[destino.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Ya se va para allá: que el efecto de la canción activa no repita el salto
    ultimaActiva.current = destino.id;
    saltoEnCurso.current = { id: destino.id, hasta: Date.now() + 1200 };
    // El contador cambia ya, sin esperar a que termine el desplazamiento: dos
    // pulsaciones seguidas cuentan desde la nueva, no desde la de antes.
    setEnVistaId(destino.id);

    if (destino.id !== activeSongId) irACancion(destino.id);
  };

  // Las preferencias del usuario mandan sobre el valor por defecto, pero no
  // sobre lo que ya eligió en este dispositivo.
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) return;

    let cancelado = false;
    getUserPreferences(currentUser.uid)
      .then((prefs) => {
        if (cancelado) return;
        if (prefs.defaultFontSize) setFontSize(prefs.defaultFontSize);
      })
      .catch((e) => console.error("Error cargando preferencias:", e));

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Que el resto vea qué toco.
  useEffect(() => {
    if (estado !== "live") return;
    anunciarInstrumento(instrumento, numeroVoz);
  }, [estado, instrumento, numeroVoz, anunciarInstrumento]);

  const cambiarInstrumento = (id) => {
    setInstrumento(id);
    // Las voces elegidas a mano eran para el instrumento anterior; soltarlas
    // deja que cada canción elija la del instrumento nuevo si la tiene.
    setVoiceKeys({});
  };

  const cambiarNumeroVoz = (numero) => {
    setNumeroVoz(numero);
    // Igual que al cambiar de instrumento: las elegidas a mano eran para el
    // número anterior
    setVoiceKeys({});
  };

  // Otro de mi instrumento con mi mismo número: uno de los dos se equivocó
  const mismaVoz = participants.filter((p) =>
    p.uid !== currentUser?.uid
    && p.isOnline
    && p.instrumentId === instrumento
    && String(p.voiceNumber) === numeroVoz
  );

  const elegirVoz = (songId, voiceKey) =>
    setVoiceKeys((prev) => ({ ...prev, [songId]: voiceKey }));

  const terminar = async () => {
    if (!window.confirm("¿Terminar la sesión para todos?")) return;
    await cerrarSesion();
  };

  const abandonar = async () => {
    await salir();
    navigate("/playlists");
  };

  // --- Estados de la pantalla ---

  if (cargandoAuth) return <LoadingSpinner text="Cargando..." />;

  // Sin cuenta: el enlace llega por WhatsApp a gente que no la tiene.
  if (!currentUser) return <GuestGate code={code} />;

  if (estado === "loading") {
    return <LoadingSpinner text="Entrando en la sesión..." subtext={`Código ${code}`} />;
  }

  if (estado === "missing") {
    return (
      <div className="live-container">
        <div className="live-message">
          <Icono nombre="question" className="live-message-icon" />
          <h2>No encontramos esa sesión</h2>
          <p>
            El código <strong>{code}</strong> no existe o la sesión ya caducó.
            Pide el enlace otra vez a quien la abrió.
          </p>
          <Link to="/live" className="btn-live">Probar con otro código</Link>
        </div>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="live-container">
        <div className="live-message">
          <Icono nombre="warning" className="live-message-icon" />
          <h2>Algo va mal con la sesión</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (estado === "ended") {
    return (
      <div className="live-container">
        <div className="live-message">
          <Icono nombre="check-circle" className="live-message-icon" />
          <h2>La sesión terminó</h2>
          <p>{session?.name}</p>
          {session?.playlistId && (
            <Link to={`/playlists/${session.playlistId}`} className="btn-live">
              Ver la lista
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="live-container">
      {/* Todo esto se queda fijo: pasar de canción no puede obligar a volver
          arriba scrolleando con el instrumento en la mano. */}
      <div className="live-header" ref={headerRef}>
      <LiveBar
        code={code}
        name={session?.name}
        sinRed={sinRed}
        participants={participants}
        updatedBy={session?.updatedBy}
        isHost={isHost}
        onSalir={abandonar}
        onCerrar={terminar}
      />

      {error && (
        <div className="live-warning live-warning-error no-print" role="alert">
          <Icono nombre="warning-circle" className="me-2" />
          {error}
        </div>
      )}

      {mismaVoz.length > 0 && (
        <div className="live-warning no-print" role="status">
          <Icono nombre="users" className="me-2" />
          {mismaVoz.map((p) => p.name).join(", ")} también {mismaVoz.length === 1 ? "es" : "son"}{" "}
          {TRANSPOSING_INSTRUMENTS[instrumento]?.name} {numeroVoz}. Revisen quién toca cada voz.
        </div>
      )}

      {/* Controles propios: nada de esto viaja a los demás */}
      <button
        type="button"
        className="live-ajustes-toggle no-print"
        onClick={() => setVerAjustes(verAjustes === "si" ? "no" : "si")}
        aria-expanded={verAjustes === "si"}
      >
        <Icono nombre={verAjustes === "si" ? "caret-up" : "caret-down"} className="me-2" />
        Mis ajustes
        <span className="live-ajustes-resumen">
          {TRANSPOSING_INSTRUMENTS[instrumento]?.name} {numeroVoz}
          {notacion === "latin" ? " · DO-RE-MI" : " · C-D-E"}
        </span>
      </button>

      <div className={`live-controls no-print ${verAjustes === "si" ? "" : "plegado"}`}>
        <div className="live-control-group">
          <label className="live-control-label" htmlFor="live-instrumento">
            Mi instrumento
          </label>
          <Desplegable
            id="live-instrumento"
            className="desplegable--live"
            value={instrumento}
            onChange={cambiarInstrumento}
            grupos={INSTRUMENT_GROUPS.map((grupo) => ({
              label: grupo.name,
              opciones: grupo.instruments.map((id) => ({ value: id, label: TRANSPOSING_INSTRUMENTS[id].name }))
            }))}
          />
        </div>

        <div className="live-control-group">
          <label className="live-control-label" htmlFor="live-voz">Mi voz</label>
          <Desplegable
            id="live-voz"
            className="desplegable--live"
            value={numeroVoz}
            onChange={cambiarNumeroVoz}
            opciones={NUMEROS_DE_VOZ.map((n) => ({ value: n, label: `${n}ª` }))}
          />
        </div>

        <div className="live-control-group">
          <label className="live-control-label" htmlFor="live-notacion">Notación</label>
          <Desplegable
            id="live-notacion"
            className="desplegable--live"
            value={notacion}
            onChange={setNotacion}
            opciones={[
              { value: "latin", label: "DO-RE-MI" },
              { value: "english", label: "C-D-E" }
            ]}
          />
        </div>

        <div className="live-control-group live-font-controls">
          <button type="button" className="live-icon-btn" onClick={decreaseFontSize}>A-</button>
          <button type="button" className="live-icon-btn" onClick={increaseFontSize}>A+</button>
        </div>

        <AlineacionTexto
          alineacion={alineacion}
          onCambiar={setAlineacion}
          className="live-control-group live-font-controls"
          botonClassName="live-icon-btn"
        />

        <SelectorVista vista={vista} onCambiar={setVista} className="live-control-group live-vista" />

        <div className="live-control-group live-follow">
          <label className="live-switch">
            <input
              type="checkbox"
              checked={seguir === "si"}
              onChange={(e) => setSeguir(e.target.checked ? "si" : "no")}
            />
            <span>Seguir al director</span>
          </label>
        </div>
      </div>

      {/* Navegación: esto sí es compartido */}
      <div className="live-nav no-print">
        <button
          type="button"
          className="btn-live"
          onClick={() => irARelativa(-1)}
          disabled={indiceBase <= 0}
        >
          <Icono nombre="caret-left" />
          Anterior
        </button>

        <button
          type="button"
          className="btn-live btn-live-wide"
          onClick={() => setVerIndice((v) => !v)}
          aria-expanded={verIndice}
        >
          <Icono nombre="list-numbers" className="me-2" />
          {indiceBase >= 0 ? `${indiceBase + 1} de ${songs.length}` : `${songs.length} canciones`}
        </button>

        <button
          type="button"
          className="btn-live"
          onClick={() => irARelativa(1)}
          disabled={indiceBase < 0 || indiceBase >= songs.length - 1}
        >
          Siguiente
          <Icono nombre="caret-right" />
        </button>
      </div>
      </div>

      {verIndice && (
        <LiveSetlist
          songs={songs}
          activeSongId={activeSongId}
          onIr={(id) => { conScroll(irACancion)(id); setVerIndice(false); }}
          notacion={notacion}
        />
      )}

      {/* Todas las canciones, seguidas */}
      <div className="live-songs" id="playlist-content">
        {canciones.length === 0 && (
          <p className="live-setlist-empty">
            La sesión está vacía. Añade una canción abajo.
          </p>
        )}

        {canciones.map((song, index) => (
          <LiveSongCard
            key={song.id}
            ref={registrarRef(song.id)}
            song={song}
            index={index}
            total={canciones.length}
            activa={song.id === activeSongId}
            fontSize={fontSize}
            alineacion={alineacion}
            vista={vista}
            onCambiarTonalidad={cambiarTonalidad}
            onQuitar={quitarCancion}
            onMover={moverCancion}
            onElegirVoz={elegirVoz}
            notacion={notacion}
          />
        ))}
      </div>

      {/* Añadir busca en el repertorio, y un invitado no puede leerlo: solo
          las canciones de su sesión. */}
      {!esInvitado && (
        <AddSongToSession
          user={currentUser}
          yaEnLaSesion={songs.map((s) => s.id)}
          onAgregar={agregarCancion}
          notacion={notacion}
        />
      )}

      {/* El panel "Lista" solo mueve la pantalla de este músico. Para llevar
          a la banda entera a otra canción está el índice de arriba. */}
      <HerramientasFlotantes
        notacion={notacion}
        lista={{
          mensaje: session?.mensajeDirector || null,
          // La tonalidad en la que lee este músico (la "Tú" de la tarjeta),
          // no la de la banda: al saxo le sirve la suya. Un PDF no se
          // transpone, y mientras carga el contenido, la de la banda.
          canciones: songs.map((s) => ({
            id: s.id,
            title: s.title,
            key: propiaPorId.get(s.id) || s.key || s.originalKey
          })),
          activaId: activeSongId,
          onIr: (songId) => refsCanciones.current[songId]?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}
      />
    </div>
  );
}

export default LiveSession;

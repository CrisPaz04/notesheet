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
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { TRANSPOSING_INSTRUMENTS, INSTRUMENT_GROUPS, SOURCE_INSTRUMENT } from "@notesheet/core";
import { getUserPreferences } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import useLiveSession from "../hooks/useLiveSession";
import useLiveSetlistContent from "../hooks/useLiveSetlistContent";
import usePreferenciaLocal from "../hooks/usePreferenciaLocal";
import useNotacionPreferida from "../hooks/useNotacionPreferida";
import useFontSizePreference from "../hooks/useFontSizePreference";
import LoadingSpinner from "../components/LoadingSpinner";
import LiveBar from "../components/live/LiveBar";
import LiveSetlist from "../components/live/LiveSetlist";
import LiveSongCard from "../components/live/LiveSongCard";
import AddSongToSession from "../components/live/AddSongToSession";
import GuestGate from "../components/live/GuestGate";

const INSTRUMENTOS = Object.keys(TRANSPOSING_INSTRUMENTS);
const SEGUIR = ["si", "no"];

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
  const [verIndice, setVerIndice] = useState(false);

  const { fontSize, setFontSize, increaseFontSize, decreaseFontSize } =
    useFontSizePreference(currentUser);

  // --- Lo compartido ---
  const {
    session, songs, activeSongId, activeIndex,
    estado, error, sinRed, participants, isHost,
    irACancion, siguiente, anterior, cambiarTonalidad,
    moverCancion, agregarCancion, quitarCancion, cerrarSesion, salir,
    anunciarInstrumento
  } = useLiveSession(code, { user: currentUser });

  const { canciones } = useLiveSetlistContent({
    songs,
    instrument: instrumento,
    notationSystem: notacion,
    voiceKeys
  });

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
    anunciarInstrumento(instrumento, null);
  }, [estado, instrumento, anunciarInstrumento]);

  const cambiarInstrumento = (id) => {
    setInstrumento(id);
    // Las voces elegidas a mano eran para el instrumento anterior; soltarlas
    // deja que cada canción elija la del instrumento nuevo si la tiene.
    setVoiceKeys({});
  };

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
          <i className="bi bi-question-circle live-message-icon" />
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
          <i className="bi bi-exclamation-triangle live-message-icon" />
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
          <i className="bi bi-check-circle live-message-icon" />
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
          <i className="bi bi-exclamation-circle me-2" />
          {error}
        </div>
      )}

      {/* Controles propios: nada de esto viaja a los demás */}
      <button
        type="button"
        className="live-ajustes-toggle no-print"
        onClick={() => setVerAjustes(verAjustes === "si" ? "no" : "si")}
        aria-expanded={verAjustes === "si"}
      >
        <i className={`bi bi-chevron-${verAjustes === "si" ? "up" : "down"} me-2`} />
        Mis ajustes
        <span className="live-ajustes-resumen">
          {TRANSPOSING_INSTRUMENTS[instrumento]?.name}
          {notacion === "latin" ? " · DO-RE-MI" : " · C-D-E"}
        </span>
      </button>

      <div className={`live-controls no-print ${verAjustes === "si" ? "" : "plegado"}`}>
        <div className="live-control-group">
          <label className="live-control-label" htmlFor="live-instrumento">
            Mi instrumento
          </label>
          <select
            id="live-instrumento"
            className="live-select"
            value={instrumento}
            onChange={(e) => cambiarInstrumento(e.target.value)}
          >
            {INSTRUMENT_GROUPS.map((grupo) => (
              <optgroup key={grupo.name} label={grupo.name}>
                {grupo.instruments.map((id) => (
                  <option key={id} value={id}>{TRANSPOSING_INSTRUMENTS[id].name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="live-control-group">
          <label className="live-control-label" htmlFor="live-notacion">Notación</label>
          <select
            id="live-notacion"
            className="live-select"
            value={notacion}
            onChange={(e) => setNotacion(e.target.value)}
          >
            <option value="latin">DO-RE-MI</option>
            <option value="english">C-D-E</option>
          </select>
        </div>

        <div className="live-control-group live-font-controls">
          <button type="button" className="live-icon-btn" onClick={decreaseFontSize}>A-</button>
          <button type="button" className="live-icon-btn" onClick={increaseFontSize}>A+</button>
        </div>

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
          onClick={conScroll(anterior)}
          disabled={activeIndex <= 0}
        >
          <i className="bi bi-chevron-left" />
          Anterior
        </button>

        <button
          type="button"
          className="btn-live btn-live-wide"
          onClick={() => setVerIndice((v) => !v)}
          aria-expanded={verIndice}
        >
          <i className="bi bi-list-ol me-2" />
          {activeIndex >= 0 ? `${activeIndex + 1} de ${songs.length}` : `${songs.length} canciones`}
        </button>

        <button
          type="button"
          className="btn-live"
          onClick={conScroll(siguiente)}
          disabled={activeIndex < 0 || activeIndex >= songs.length - 1}
        >
          Siguiente
          <i className="bi bi-chevron-right" />
        </button>
      </div>
      </div>

      {verIndice && (
        <LiveSetlist
          songs={songs}
          activeSongId={activeSongId}
          onIr={(id) => { conScroll(irACancion)(id); setVerIndice(false); }}
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
            onCambiarTonalidad={cambiarTonalidad}
            onQuitar={quitarCancion}
            onMover={moverCancion}
            onElegirVoz={elegirVoz}
          />
        ))}
      </div>

      <AddSongToSession
        user={currentUser}
        yaEnLaSesion={songs.map((s) => s.id)}
        onAgregar={agregarCancion}
      />
    </div>
  );
}

export default LiveSession;

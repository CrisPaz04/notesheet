// apps/web/src/pages/LiveSession.jsx
//
// La pantalla del servicio: todos viendo la misma lista, cada quien con su
// instrumento.
//
// La división es la de siempre y conviene tenerla presente al tocar esto:
// lo que sale de `useLiveSession` es compartido y lo que cambie aquí le cambia
// a los doce; lo que sale de `usePreferenciaLocal` es de este dispositivo y no
// viaja a ningún sitio.
import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { TRANSPOSING_INSTRUMENTS, INSTRUMENT_GROUPS, SOURCE_INSTRUMENT } from "@notesheet/core";
import { getUserPreferences } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import useLiveSession from "../hooks/useLiveSession";
import useLiveSongContent from "../hooks/useLiveSongContent";
import usePreferenciaLocal from "../hooks/usePreferenciaLocal";
import useFontSizePreference from "../hooks/useFontSizePreference";
import LoadingSpinner from "../components/LoadingSpinner";
import LiveBar from "../components/live/LiveBar";
import LiveSetlist from "../components/live/LiveSetlist";
import GuestGate from "../components/live/GuestGate";

const INSTRUMENTOS = Object.keys(TRANSPOSING_INSTRUMENTS);
const NOTACIONES = ["latin", "english"];

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
  const [notacion, setNotacion] = usePreferenciaLocal("live:notacion", "latin", NOTACIONES);
  const [voiceKey, setVoiceKey] = useState(null);
  const [verLista, setVerLista] = useState(false);

  const { fontSize, setFontSize, increaseFontSize, decreaseFontSize } =
    useFontSizePreference(currentUser);

  // --- Lo compartido ---
  const sesion = useLiveSession(code, { user: currentUser });
  const {
    session, songs, activeSongId, activeIndex, activeSong,
    estado, error, sinRed, participants, isHost,
    irACancion, siguiente, anterior, cambiarTonalidad,
    moverCancion, quitarCancion, cerrarSesion, salir,
    anunciarInstrumento
  } = sesion;

  const { rendered, voices, voiceKey: voiceKeyEfectiva, loading: cargandoCancion, error: errorCancion } =
    useLiveSongContent({ song: activeSong, instrument: instrumento, notationSystem: notacion, voiceKey });

  // Las preferencias del usuario mandan sobre el valor por defecto, pero no
  // sobre lo que ya eligió en este dispositivo: quien tocó el selector aquí
  // arriba lo hizo por algo.
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

  // Que el resto vea qué toco. Se reintenta cuando cambia el instrumento o la
  // voz resuelta, no en cada render.
  useEffect(() => {
    if (estado !== "live" || !voiceKeyEfectiva) return;
    const numero = voiceKeyEfectiva.split("-").pop();
    anunciarInstrumento(instrumento, numero);
  }, [estado, instrumento, voiceKeyEfectiva, anunciarInstrumento]);

  const cambiarInstrumento = (id) => {
    setInstrumento(id);
    // La voz elegida a mano era para el instrumento anterior; soltarla deja
    // que `useLiveSongContent` elija la del instrumento nuevo si existe.
    setVoiceKey(null);
  };

  const terminar = async () => {
    if (!window.confirm("¿Terminar la sesión para todos?")) return;
    await cerrarSesion();
  };

  const abandonar = async () => {
    await salir();
    navigate("/playlists");
  };

  // --- Estados de la pantalla ---

  if (cargandoAuth) {
    return <LoadingSpinner text="Cargando..." />;
  }

  // Sin cuenta: el link llega por WhatsApp a gente que no la tiene.
  if (!currentUser) {
    return <GuestGate code={code} />;
  }

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
      <div className="live-controls no-print">
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

        {voices.length > 1 && (
          <div className="live-control-group">
            <label className="live-control-label" htmlFor="live-voz">Mi voz</label>
            <select
              id="live-voz"
              className="live-select"
              value={voiceKeyEfectiva || ""}
              onChange={(e) => setVoiceKey(e.target.value)}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
        )}

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
      </div>

      {/* Navegación por la lista: esto sí es compartido */}
      <div className="live-nav no-print">
        <button
          type="button"
          className="btn-live"
          onClick={anterior}
          disabled={activeIndex <= 0}
        >
          <i className="bi bi-chevron-left" />
          Anterior
        </button>

        <button
          type="button"
          className="btn-live btn-live-wide"
          onClick={() => setVerLista((v) => !v)}
          aria-expanded={verLista}
        >
          <i className="bi bi-list-ol me-2" />
          {activeIndex >= 0 ? `${activeIndex + 1} de ${songs.length}` : `${songs.length} canciones`}
        </button>

        <button
          type="button"
          className="btn-live"
          onClick={siguiente}
          disabled={activeIndex < 0 || activeIndex >= songs.length - 1}
        >
          Siguiente
          <i className="bi bi-chevron-right" />
        </button>
      </div>

      {verLista && (
        <LiveSetlist
          songs={songs}
          activeSongId={activeSongId}
          onIr={(id) => { irACancion(id); setVerLista(false); }}
          onCambiarTonalidad={cambiarTonalidad}
          onQuitar={quitarCancion}
          onMover={moverCancion}
        />
      )}

      {/* La canción */}
      <div className="live-song" id="playlist-content">
        {!activeSong && (
          <p className="live-setlist-empty">
            No hay ninguna canción activa. Abre la lista y elige una.
          </p>
        )}

        {activeSong && (
          <>
            <div className="live-song-header">
              <h1 className="live-song-title">{activeSong.title || "Sin título"}</h1>
              <div className="live-song-keys">
                <span className="live-key-badge" title="Tonalidad de la sesión, igual para todos">
                  <i className="bi bi-people-fill me-1" />
                  {activeSong.key || "?"}
                </span>
                {rendered?.displayKey && rendered.displayKey !== activeSong.key && (
                  <span className="live-key-badge live-key-mine" title="Lo que lees tú con tu instrumento">
                    <i className="bi bi-person-fill me-1" />
                    {rendered.displayKey}
                  </span>
                )}
              </div>
            </div>

            {cargandoCancion && <LoadingSpinner text="Cargando la canción..." />}

            {errorCancion && (
              <div className="live-warning live-warning-error" role="alert">
                <i className="bi bi-exclamation-circle me-2" />
                {errorCancion}
              </div>
            )}

            {rendered?.formatted?.sections?.map((section, i) => (
              <div key={i} className="song-section-modern">
                <h4 className="song-section-title">{section.title}</h4>
                <div className="song-section-content" style={{ fontSize: `${fontSize}px` }}>
                  {section.content}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default LiveSession;

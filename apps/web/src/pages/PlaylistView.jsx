// apps/web/src/pages/PlaylistView.jsx
import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { getPlaylistById, getSongById, getUserPreferences } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import useNotacionPreferida from "../hooks/useNotacionPreferida";
import {
  renderSongContent,
  renderChordChart,
  formatLyrics,
  elegirVista,
  vistaPreferida,
  resolveVoiceForMusician,
  tonalidadDeLaParte,
  NUMEROS_DE_VOZ,
  isPdfSong,
  nombrarTonalidad,
  resolveScore,
  DEFAULT_SCORE_VARIANT
} from "@notesheet/core";
import LoadingSpinner from "../components/LoadingSpinner";
import StartLiveButton from "../components/live/StartLiveButton";
import PdfEnLista from "../components/PdfEnLista";
import AlineacionTexto from "../components/AlineacionTexto";
import SelectorVista from "../components/SelectorVista";
import Desplegable from "../components/Desplegable";
import useNumeroDeVoz from "../hooks/useNumeroDeVoz";
import { SeccionesCancion, AvisoVista } from "../components/SeccionesCancion";
import useAlineacionTexto from "../hooks/useAlineacionTexto";
import HerramientasFlotantes from "../components/herramientas/HerramientasFlotantes";
import Icono from "../components/Icono";

function PlaylistView() {
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(18);
  
  const { id } = useParams();
  const { currentUser } = useAuth();
  const [notacion] = useNotacionPreferida(currentUser);
  const [alineacion, setAlineacion] = useAlineacionTexto();

  // Notas, letra o acordes de todas las canciones de la lista. Arranca en la
  // del instrumento de las preferencias, cuando llegan (la voz en la letra, la
  // guitarra en los acordes...); una canción que no tenga la elegida enseña
  // sus notas con un aviso (`elegirVista`).
  const [vista, setVista] = useState("principal");

  // Qué número es en su sección ("soy la trompeta 2"): cada canción se abre
  // en la voz que le toca según las que tenga (`vozParaMusico`, en core).
  const [numeroVoz, setNumeroVoz] = useNumeroDeVoz();

  // Con qué voz se abre cada partitura: la del instrumento del músico, como
  // en la vista de la canción. Sin preferencias, la voz principal.
  const [preferenciasPdf, setPreferenciasPdf] = useState({
    instrument: null,
    variant: DEFAULT_SCORE_VARIANT
  });
  // Los PDF esperan a saber la voz: si no, se bajaba la principal y, al
  // llegar las preferencias, otra vez la del instrumento.
  const [preferenciasListas, setPreferenciasListas] = useState(false);

  useEffect(() => {
    if (!currentUser) return undefined;
    let vigente = true;
    getUserPreferences(currentUser.uid)
      .then((prefs) => {
        if (!vigente) return;
        setVista(vistaPreferida(prefs?.defaultInstrument, { hayLetra: true, hayAcordes: true }));
        setPreferenciasPdf({
          instrument: prefs?.defaultInstrument || null,
          variant: prefs?.defaultScoreVariant || DEFAULT_SCORE_VARIANT
        });
      })
      .catch((prefsError) => console.error("Error loading user preferences:", prefsError))
      .finally(() => { if (vigente) setPreferenciasListas(true); });
    return () => { vigente = false; };
  }, [currentUser]);

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        setLoading(true);
        
        // Cargar la playlist
        const loadedPlaylist = await getPlaylistById(id);
        setPlaylist(loadedPlaylist);
        
        // Cargar las canciones de la playlist
        if (loadedPlaylist.songs && loadedPlaylist.songs.length > 0) {
          const loadedSongs = await Promise.all(
            loadedPlaylist.songs.map(async (song) => {
              try {
                const fullSong = await getSongById(song.id);

                // Una partitura en PDF no tiene `content` que formatear ni
                // tonalidad a la que transponer. Se despliega más abajo con
                // `PdfEnLista`, que solo la abre cuando está cerca de la
                // pantalla.
                if (isPdfSong(fullSong)) {
                  return {
                    ...fullSong,
                    selectedKey: song.key,
                    formattedContent: null
                  };
                }

                // Se formatea más abajo (`cancionesVista`), para poder
                // repintar si cambia la notación sin volver a descargar nada.
                return {
                  ...fullSong,
                  selectedKey: song.key // Tonalidad seleccionada en la playlist
                };
              } catch (error) {
                console.error(`Error loading song ${song.id}:`, error);
                // Devolver datos básicos si no se puede cargar la canción completa
                return {
                  id: song.id,
                  title: song.title || "Canción no disponible",
                  selectedKey: song.key,
                  error: true
                };
              }
            })
          );
          setSongs(loadedSongs);
        }
      } catch (error) {
        setError("Error al cargar la lista: " + error.message);
        console.error("Error loading playlist:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
  }, [id]);

  // La lista puede transponer una canción solo para esta ocasión: hay que
  // mostrarla en la tonalidad elegida, no en la original. Antes se formateaba
  // sin transponer y la etiqueta decía una tonalidad mientras los acordes
  // mostraban otra. La notación es la del perfil, como en el resto de la app.
  //
  // Y en el instrumento del músico, como en la vista de la canción y en la
  // sesión en vivo: los acordes de la guitarra van en concierto, y con las
  // notas en la referencia de Sib la etiqueta de tonalidad no casaría.
  const instrumento = preferenciasPdf.instrument || undefined;
  const cancionesVista = useMemo(() => songs.map((song) => {
    if (song.error) return { ...song, formattedContent: null, vistas: {} };

    const opciones = {
      baseKey: song.key,
      targetKey: song.selectedKey || song.key,
      instrument: instrumento,
      notationSystem: notacion
    };

    // Un PDF puede traer además letra y acordes, en texto
    if (isPdfSong(song)) {
      // La tonalidad de la parte que abre, no la de la trompeta: el saxo lee la suya
      const parte = resolveScore(song, { ...preferenciasPdf, voiceNumber: numeroVoz });
      return {
        ...song,
        formattedContent: null,
        displayKey: tonalidadDeLaParte(song.selectedKey || song.key, parte.voiceKey, instrumento),
        vistas: {
          letra: formatLyrics(song.lyricsOnly),
          acordes: renderChordChart(song.acordes, opciones)
        }
      };
    }

    const { content } = resolveVoiceForMusician(song, { instrument: instrumento, voiceNumber: numeroVoz });
    const { formatted, lyricsOnly, displayKey } = renderSongContent(content, opciones);
    return {
      ...song,
      formattedContent: formatted,
      displayKey,
      vistas: { letra: lyricsOnly, acordes: renderChordChart(song.acordes, opciones) }
    };
  }), [songs, notacion, instrumento, numeroVoz, preferenciasPdf]);

  // Qué se enseña de cada una: lo elegido o, si no lo tiene, la principal
  const cancionesConVista = useMemo(() => cancionesVista.map((song) => ({
    ...song,
    eleccion: song.error ? null : elegirVista(vista, song.vistas)
  })), [cancionesVista, vista]);

  // Estilos de impresión
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #playlist-content, #playlist-content * {
          visibility: visible;
        }
        #playlist-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const printStyle = document.getElementById('print-style');
      if (printStyle) {
        document.head.removeChild(printStyle);
      }
    };
  }, []);

  // Funciones para ajustar tamaño de texto
  const increaseFontSize = () => {
    if (fontSize < 24) {
      setFontSize(fontSize + 2);
    }
  };

  const decreaseFontSize = () => {
    if (fontSize > 14) {
      setFontSize(fontSize - 2);
    }
  };

  const resetFontSize = () => {
    setFontSize(18);
  };

  const handlePrint = () => {
    window.print();
  };

  // Desde el panel "Lista": lleva a la canción sin salir de la página
  const irACancion = (songId) => {
    document.getElementById(`cancion-${songId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Formatear fecha
  const formatDate = (date) => {
    if (!date) return "Sin fecha";
    return new Date(date.toDate()).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="playlists-container">
        <div className="container">
          <LoadingSpinner 
            text="Cargando lista..." 
            subtext="Preparando las canciones"
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="playlists-container">
        <div className="container">
          <div className="alert alert-danger fade-in" role="alert">
            <Icono nombre="warning" peso="fill" className="me-2" />
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="playlists-container">
        <div className="container">
          <div className="text-center fade-in">
            <h2 className="text-white mb-4">Lista no encontrada</h2>
            <Link to="/playlists" className="btn-playlist-primary btn-playlist-action">
              <Icono nombre="arrow-left" className="me-2" />
              Volver a Mis Listas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playlists-container">
      <div className="container">
        {/* Header de la playlist */}
        <div className="playlist-view-header fade-in">
          <h1 className="playlist-view-title">{playlist.name || "Lista sin nombre"}</h1>
          
          <div className="playlist-view-meta">
            <span>
              <Icono nombre="calendar-blank" className="me-1" />
              {formatDate(playlist.date)}
            </span>
            <span className={`playlist-visibility-badge ${playlist.public ? 'public' : 'private'}`}>
              <Icono nombre={playlist.public ? "globe" : "lock"} className="me-1" />
              {playlist.public ? 'Lista Pública' : 'Lista Privada'}
            </span>
            <span>
              <Icono nombre="music-notes" className="me-1" />
              {songs.length} canciones
            </span>
          </div>
        </div>

        {/* Controles */}
        <div className="controls-toolbar fade-in-delay no-print">
          <div className="controls-row">
            <div className="controls-group">
              <h2 className="section-title mb-0">
                <Icono nombre="list-numbers" />
                Lista de Canciones
              </h2>
            </div>
            
            <div className="controls-group">
              {/* Controles de fuente */}
              <div className="font-controls">
                <button
                  className="font-control-btn"
                  onClick={decreaseFontSize}
                  title="Disminuir tamaño"
                >
                  A-
                </button>
                <button
                  className="font-control-btn"
                  onClick={resetFontSize}
                  title="Tamaño normal"
                >
                  A
                </button>
                <button
                  className="font-control-btn"
                  onClick={increaseFontSize}
                  title="Aumentar tamaño"
                >
                  A+
                </button>
              </div>

              <AlineacionTexto alineacion={alineacion} onCambiar={setAlineacion} />

              <SelectorVista vista={vista} onCambiar={setVista} />

              <div className="mi-voz">
                <label htmlFor="lista-mi-voz">Mi voz</label>
                <Desplegable
                  id="lista-mi-voz"
                  className="desplegable--compacto"
                  value={numeroVoz}
                  onChange={setNumeroVoz}
                  opciones={NUMEROS_DE_VOZ.map((n) => ({ value: n, label: `${n}ª` }))}
                />
              </div>
              
              {/* Botones de acción */}
              <div className="action-buttons-song">
                {/* La sesión copia la lista: lo que se cambie durante el
                    servicio no toca la lista guardada. */}
                <StartLiveButton
                  playlist={{
                    id,
                    name: playlist.name,
                    songs: playlist.songs,
                    mensajeDirector: playlist.mensajeDirector || null
                  }}
                  user={currentUser}
                />

                <button
                  className="btn-song-action"
                  onClick={handlePrint}
                  title="Imprimir"
                >
                  <Icono nombre="printer" />
                  Imprimir
                </button>
                
                {currentUser && currentUser.uid === playlist.creatorId && (
                  <Link 
                    to={`/playlists/${id}/edit`} 
                    className="btn-song-action btn-song-primary"
                  >
                    <Icono nombre="pencil-simple" />
                    Editar
                  </Link>
                )}
                
                <Link 
                  to="/playlists" 
                  className="btn-song-action"
                >
                  <Icono nombre="arrow-left" />
                  Volver
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido de las canciones */}
        <div id="playlist-content" className="slide-up">
          {songs.length === 0 ? (
            <div className="empty-playlists-state">
              <div className="empty-playlists-icon">
                <Icono nombre="music-notes" />
              </div>
              <h3 className="empty-playlists-title">Esta lista está vacía</h3>
              <p className="empty-playlists-description">
                No hay canciones en esta lista. Edita la lista para agregar canciones.
              </p>
              {currentUser && currentUser.uid === playlist.creatorId && (
                <Link to={`/playlists/${id}/edit`} className="btn-playlist-primary btn-playlist-action">
                  <Icono nombre="plus-circle" className="me-2" />
                  Agregar Canciones
                </Link>
              )}
            </div>
          ) : (
            <div className="playlist-songs-section">
              <div className="playlist-songs-header">
                <h3 className="section-title">
                  <Icono nombre="music-notes" className="me-2" />
                  Canciones de la Lista
                </h3>
              </div>
              
              {cancionesConVista.map((song, index) => (
                <div key={song.id} id={`cancion-${song.id}`} className="playlist-song-ancla">
                  {/* Item de la canción */}
                  <div className="playlist-song-item">
                    <div className="playlist-song-number">
                      {index + 1}
                    </div>
                    
                    <div className="playlist-song-content">
                      <h4 className="playlist-song-title">
                        {song.error ? (
                          <span className="text-muted">{song.title}</span>
                        ) : (
                          <Link to={`/songs/${song.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {song.title || "Sin título"}
                          </Link>
                        )}
                      </h4>
                      <div className="playlist-song-meta">
                        {song.error ? (
                          <span className="text-danger">Esta canción no está disponible</span>
                        ) : (
                          <>
                            <span>{song.type || "No especificado"}</span>
                            {song.version && <span> • Versión de: {song.version}</span>}
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="playlist-song-key">
                      {nombrarTonalidad(song.displayKey || song.selectedKey || song.key, notacion) || "?"}
                    </div>
                  </div>
                  
                  {song.eleccion && (
                    <>
                      <AvisoVista faltaba={song.eleccion.faltaba} esPdf={isPdfSong(song)} />
                      {song.eleccion.vista !== "principal" && (
                        <div className="song-content-section">
                          <SeccionesCancion
                            formatted={song.vistas[song.eleccion.vista]}
                            alineacion={alineacion}
                            fontSize={fontSize}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Una partitura en PDF se despliega aquí mismo, en la voz
                      del músico, para leer la lista de corrido. Para elegir
                      otra voz está la pantalla de la canción. */}
                  {!song.error && isPdfSong(song) && song.eleccion.vista === "principal" && (
                    <div className="song-content-section">
                      {preferenciasListas && (
                        <PdfEnLista
                          path={resolveScore(song, { ...preferenciasPdf, voiceNumber: numeroVoz }).path}
                          title={song.title}
                        />
                      )}
                      <Link to={`/songs/${song.id}`} className="playlist-song-pdf-otra-voz no-print">
                        <Icono nombre="file-pdf" className="me-1" />
                        Ver en otra voz
                      </Link>
                    </div>
                  )}

                  {/* Contenido de la canción */}
                  {!song.error && song.formattedContent && song.eleccion.vista === "principal" && (
                    <div className="song-content-section">
                      {song.formattedContent.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="song-section-modern">
                          <h4 className="song-section-title">{section.title}</h4>
                          <div className={`song-section-content alinear-${alineacion}`} style={{ fontSize: `${fontSize}px` }}>
                            {section.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {index < songs.length - 1 && (
                    <hr style={{ 
                      border: 'none', 
                      height: '2px', 
                      background: 'rgba(var(--overlay-rgb), 0.1)', 
                      margin: '2rem 0' 
                    }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <HerramientasFlotantes
        notacion={notacion}
        lista={{
          mensaje: playlist.mensajeDirector || null,
          canciones: cancionesVista
            .filter((c) => !c.error)
            .map((c) => ({ id: c.id, title: c.title, key: c.selectedKey || c.key })),
          activaId: null,
          onIr: irACancion
        }}
      />
    </div>
  );
}

export default PlaylistView;
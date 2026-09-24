// apps/web/src/pages/PlaylistView.jsx
import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { getPlaylistById, getSongById, getUserPreferences } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import useNotacionPreferida from "../hooks/useNotacionPreferida";
import { renderSongContent, isPdfSong, nombrarTonalidad, resolveScore, DEFAULT_SCORE_VARIANT } from "@notesheet/core";
import LoadingSpinner from "../components/LoadingSpinner";
import StartLiveButton from "../components/live/StartLiveButton";
import PdfEnLista from "../components/PdfEnLista";
import AlineacionTexto from "../components/AlineacionTexto";
import useAlineacionTexto from "../hooks/useAlineacionTexto";
import HerramientasFlotantes from "../components/herramientas/HerramientasFlotantes";

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

  // Con qué voz se abre cada partitura: la del instrumento del músico, como
  // en la vista de la canción. Sin preferencias, la voz principal.
  const [preferenciasPdf, setPreferenciasPdf] = useState({
    instrument: null,
    variant: DEFAULT_SCORE_VARIANT
  });

  useEffect(() => {
    if (!currentUser) return undefined;
    let vigente = true;
    getUserPreferences(currentUser.uid)
      .then((prefs) => {
        if (!vigente) return;
        setPreferenciasPdf({
          instrument: prefs?.defaultInstrument || null,
          variant: prefs?.defaultScoreVariant || DEFAULT_SCORE_VARIANT
        });
      })
      .catch((prefsError) => console.error("Error loading user preferences:", prefsError));
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
  const cancionesVista = useMemo(() => songs.map((song) => {
    if (song.error || isPdfSong(song)) return { ...song, formattedContent: null };
    const { formatted } = renderSongContent(song.content, {
      baseKey: song.key,
      targetKey: song.selectedKey || song.key,
      notationSystem: notacion
    });
    return { ...song, formattedContent: formatted };
  }), [songs, notacion]);

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
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
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
              <i className="bi bi-arrow-left me-2"></i>
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
              <i className="bi bi-calendar3 me-1"></i>
              {formatDate(playlist.date)}
            </span>
            <span className={`playlist-visibility-badge ${playlist.public ? 'public' : 'private'}`}>
              <i className={`bi ${playlist.public ? 'bi-globe' : 'bi-lock'} me-1`}></i>
              {playlist.public ? 'Lista Pública' : 'Lista Privada'}
            </span>
            <span>
              <i className="bi bi-music-note-beamed me-1"></i>
              {songs.length} canciones
            </span>
          </div>
        </div>

        {/* Controles */}
        <div className="controls-toolbar fade-in-delay no-print">
          <div className="controls-row">
            <div className="controls-group">
              <h2 className="section-title mb-0">
                <i className="bi bi-list-ol"></i>
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
                  <i className="bi bi-printer"></i>
                  Imprimir
                </button>
                
                {currentUser && currentUser.uid === playlist.creatorId && (
                  <Link 
                    to={`/playlists/${id}/edit`} 
                    className="btn-song-action btn-song-primary"
                  >
                    <i className="bi bi-pencil"></i>
                    Editar
                  </Link>
                )}
                
                <Link 
                  to="/playlists" 
                  className="btn-song-action"
                >
                  <i className="bi bi-arrow-left"></i>
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
                <i className="bi bi-music-note-list"></i>
              </div>
              <h3 className="empty-playlists-title">Esta lista está vacía</h3>
              <p className="empty-playlists-description">
                No hay canciones en esta lista. Edita la lista para agregar canciones.
              </p>
              {currentUser && currentUser.uid === playlist.creatorId && (
                <Link to={`/playlists/${id}/edit`} className="btn-playlist-primary btn-playlist-action">
                  <i className="bi bi-plus-circle me-2"></i>
                  Agregar Canciones
                </Link>
              )}
            </div>
          ) : (
            <div className="playlist-songs-section">
              <div className="playlist-songs-header">
                <h3 className="section-title">
                  <i className="bi bi-music-note-list me-2"></i>
                  Canciones de la Lista
                </h3>
              </div>
              
              {cancionesVista.map((song, index) => (
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
                      {nombrarTonalidad(song.selectedKey || song.key, notacion) || "?"}
                    </div>
                  </div>
                  
                  {/* Una partitura en PDF se despliega aquí mismo, en la voz
                      del músico, para leer la lista de corrido. Para elegir
                      otra voz está la pantalla de la canción. */}
                  {!song.error && isPdfSong(song) && (
                    <div className="song-content-section">
                      <PdfEnLista
                        path={resolveScore(song, preferenciasPdf).path}
                        title={song.title}
                      />
                      <Link to={`/songs/${song.id}`} className="playlist-song-pdf-otra-voz no-print">
                        <i className="bi bi-file-earmark-music me-1"></i>
                        Ver en otra voz
                      </Link>
                    </div>
                  )}

                  {/* Contenido de la canción */}
                  {!song.error && song.formattedContent && (
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
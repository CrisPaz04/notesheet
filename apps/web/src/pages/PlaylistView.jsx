// apps/web/src/pages/PlaylistView.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getPlaylistById, getSongById } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import { formatSong } from "@notesheet/core";
import LoadingSpinner from "../components/LoadingSpinner";

function PlaylistView() {
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fontSize, setFontSize] = useState(18);
  
  const { id } = useParams();
  const { currentUser } = useAuth();

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
                
                // Formatear el contenido de la canción para visualización
                const formattedContent = formatSong(fullSong.content);
                
                // Combinar los datos de la canción con los datos de la playlist
                return {
                  ...fullSong,
                  selectedKey: song.key, // Tonalidad seleccionada en la playlist
                  formattedContent: formattedContent
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
              
              {/* Botones de acción */}
              <div className="action-buttons-song">
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
              
              {songs.map((song, index) => (
                <div key={song.id}>
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
                      {song.selectedKey || song.key || "?"}
                    </div>
                  </div>
                  
                  {/* Contenido de la canción */}
                  {!song.error && song.formattedContent && (
                    <div className="song-content-section">
                      {song.formattedContent.sections.map((section, sectionIndex) => (
                        <div key={sectionIndex} className="song-section-modern">
                          <h4 className="song-section-title">{section.title}</h4>
                          <div className="song-section-content" style={{ fontSize: `${fontSize}px` }}>
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
                      background: 'rgba(255, 255, 255, 0.1)', 
                      margin: '2rem 0' 
                    }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaylistView;
// apps/web/src/pages/PlaylistView.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getPlaylistById, getSongById } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import { formatSong } from "@notesheet/core";

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

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="text-center">
        <h2>Lista no encontrada</h2>
        <Link to="/playlists" className="btn btn-primary mt-3">
          Volver a Mis Listas
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 no-print">
        <div>
          <h1 className="h2 mb-0">{playlist.name || "Lista sin nombre"}</h1>
          <p className="text-muted mb-0">
            {playlist.date ? new Date(playlist.date.toDate()).toLocaleDateString() : "Sin fecha"} · 
            <span className="ms-2 badge bg-secondary">{playlist.public ? "Pública" : "Privada"}</span>
          </p>
        </div>
        
        <div className="d-flex gap-2">
          <div className="btn-group">
            <button
              className="btn btn-outline-secondary"
              onClick={decreaseFontSize}
              title="Disminuir tamaño"
            >
              A-
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={resetFontSize}
              title="Tamaño normal"
            >
              A
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={increaseFontSize}
              title="Aumentar tamaño"
            >
              A+
            </button>
          </div>
          
          <button
            className="btn btn-outline-secondary"
            onClick={handlePrint}
            title="Imprimir"
          >
            <i className="bi bi-printer"></i> Imprimir
          </button>
          
          {currentUser && currentUser.uid === playlist.creatorId && (
            <Link to={`/playlists/${id}/edit`} className="btn btn-outline-primary">
              <i className="bi bi-pencil"></i> Editar
            </Link>
          )}
          
          <Link to="/playlists" className="btn btn-outline-secondary">
            Volver
          </Link>
        </div>
      </div>

      <div id="playlist-content" className="mb-5" style={{ fontSize: `${fontSize}px` }}>
        {songs.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-5">
              <p className="mb-0">No hay canciones en esta lista.</p>
            </div>
          </div>
        ) : (
          songs.map((song, index) => (
            <div key={song.id} className="card mb-4">
              <div className="card-header d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center">
                  <span className="badge bg-secondary me-2">{index + 1}</span>
                  <h3 className="h5 mb-0">
                    <Link to={`/songs/${song.id}`} className={song.error ? "text-muted" : ""}>
                      {song.title || "Sin título"}
                    </Link>
                  </h3>
                </div>
                <div>
                  <span className="badge bg-light text-dark me-2">
                    Tonalidad: {song.selectedKey || song.key || "?"}
                  </span>
                  <span className="badge bg-light text-dark">
                    Tipo: {song.type || "No especificado"}
                  </span>
                </div>
              </div>
              
              {song.error ? (
                <div className="card-body">
                  <p className="text-danger">
                    Esta canción no está disponible o ha sido eliminada.
                  </p>
                </div>
              ) : (
                <div className="card-body">
                  {song.formattedContent && song.formattedContent.sections.map((section, sectionIndex) => (
                    <div key={sectionIndex} className="song-section mb-4 text-center">
                      <h4 className="h6 mb-3">{section.title}</h4>
                      <pre className="mb-0" style={{ 
                        whiteSpace: 'pre-wrap', 
                        fontFamily: 'inherit'
                      }}>
                        {section.content}
                      </pre>
                    </div>
                  ))}
                  
                  {(!song.formattedContent || song.formattedContent.sections.length === 0) && (
                    <p className="text-center text-muted">
                      No hay contenido disponible para esta canción.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default PlaylistView;
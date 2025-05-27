// apps/web/src/pages/PlaylistEditor.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPlaylist, getPlaylistById, updatePlaylist, getAllSongs } from "@notesheet/api";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import LoadingSpinner from "../components/LoadingSpinner";

function PlaylistEditor() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewPlaylist, setIsNewPlaylist] = useState(true);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  // Al cargar, verifica si es una playlist nueva o existente
  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        
        // Cargar todas las canciones disponibles
        if (currentUser) {
          const songs = await getAllSongs(currentUser.uid);
          setAvailableSongs(songs);
        }
        
        // Si hay ID, cargar la playlist existente
        if (id) {
          setIsNewPlaylist(false);
          await loadPlaylist(id);
        } else {
          // Si es nueva, establecer la fecha de hoy
          const today = new Date();
          const formattedDate = today.toISOString().split('T')[0];
          setDate(formattedDate);
          setLoading(false);
        }
      } catch (error) {
        setError("Error al inicializar: " + error.message);
        console.error("Error initializing:", error);
        setLoading(false);
      }
    };

    initialize();
  }, [id, currentUser]);

  // Cargar una playlist existente
  const loadPlaylist = async (playlistId) => {
    try {
      const playlist = await getPlaylistById(playlistId);
      
      setName(playlist.name || "");
      
      // Formatear la fecha para el input date
      if (playlist.date) {
        const dateObj = playlist.date.toDate();
        const formattedDate = dateObj.toISOString().split('T')[0];
        setDate(formattedDate);
      }
      
      setIsPublic(playlist.public || false);
      
      // Cargar las canciones seleccionadas
      if (playlist.songs && Array.isArray(playlist.songs)) {
        setSelectedSongs(playlist.songs);
      }
    } catch (error) {
      setError("Error al cargar la lista: " + error.message);
      console.error("Error loading playlist:", error);
    } finally {
      setLoading(false);
    }
  };

  // Guardar la playlist
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError("El nombre de la lista no puede estar vacío");
      return;
    }

    try {
      setLoading(true);
      
      const playlistData = {
        name,
        date: new Date(date),
        public: isPublic,
        songs: selectedSongs,
        creatorId: currentUser.uid
      };

      if (isNewPlaylist) {
        await createPlaylist(playlistData);
      } else {
        await updatePlaylist(id, playlistData);
      }

      navigate("/playlists");
    } catch (error) {
      setError("Error al guardar la lista: " + error.message);
      console.error("Error saving playlist:", error);
    } finally {
      setLoading(false);
    }
  };

  // Añadir canción a la lista
  const addSong = (song) => {
    // Verificar si la canción ya está en la lista
    const exists = selectedSongs.some(s => s.id === song.id);
    if (exists) return;
    
    // Añadir la canción con su tonalidad original
    setSelectedSongs([...selectedSongs, {
      id: song.id,
      title: song.title,
      key: song.key,
      originalKey: song.key
    }]);
  };

  // Quitar canción de la lista
  const removeSong = (songId) => {
    setSelectedSongs(selectedSongs.filter(song => song.id !== songId));
  };

  // Cambiar tonalidad de una canción en la lista
  const changeKey = (songId, newKey) => {
    setSelectedSongs(selectedSongs.map(song => {
      if (song.id === songId) {
        return { ...song, key: newKey };
      }
      return song;
    }));
  };

  // Handler para cuando se completa una acción de arrastrar y soltar
  const handleDragEnd = (result) => {
    // Si se suelta fuera de un área válida
    if (!result.destination) {
      return;
    }

    // Si se suelta en la misma posición
    if (result.destination.index === result.source.index) {
      return;
    }

    // Reordenar la lista
    const reorderedSongs = Array.from(selectedSongs);
    const [movedSong] = reorderedSongs.splice(result.source.index, 1);
    reorderedSongs.splice(result.destination.index, 0, movedSong);

    setSelectedSongs(reorderedSongs);
  };

  if (loading) {
    return (
      <div className="playlists-container">
        <div className="container">
          {/* Loading skeleton para playlist editor */}
          <div className="playlist-editor-loading-skeleton fade-in">
            <div className="skeleton-playlist-header">
              <div className="skeleton skeleton-title"></div>
              <div className="skeleton skeleton-button" style={{ width: '140px', height: '40px', marginLeft: 'auto' }}></div>
            </div>
            
            <div className="skeleton-playlist-content">
              <div className="skeleton-playlist-sidebar">
                <div className="skeleton skeleton-card">
                  <div className="skeleton skeleton-line medium"></div>
                  <div className="skeleton skeleton-line short"></div>
                  <div className="skeleton skeleton-line"></div>
                </div>
                
                <div className="skeleton skeleton-card" style={{ marginTop: '1rem' }}>
                  <div className="skeleton skeleton-line medium"></div>
                  <div className="skeleton skeleton-list">
                    <div className="skeleton skeleton-list-item"></div>
                    <div className="skeleton skeleton-list-item"></div>
                    <div className="skeleton skeleton-list-item"></div>
                  </div>
                </div>
              </div>
              
              <div className="skeleton-playlist-main">
                <div className="skeleton skeleton-card">
                  <div className="skeleton skeleton-line medium"></div>
                  <div className="skeleton skeleton-list">
                    <div className="skeleton skeleton-list-item large"></div>
                    <div className="skeleton skeleton-list-item large"></div>
                    <div className="skeleton skeleton-list-item large"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <LoadingSpinner 
              size="medium"
              text="Cargando editor de listas..." 
              subtext="Organizando tu música"
              type="playlist"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playlists-container">
      <div className="container">
        {/* Header */}
        <div className="playlists-header fade-in">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="playlists-title">
                <i className="bi bi-music-note-list"></i>
                {isNewPlaylist ? "Nueva Lista" : "Editar Lista"}
              </h1>
              <p className="playlists-subtitle">
                {isNewPlaylist ? "Crea una nueva lista para organizar tus canciones" : "Modifica tu lista existente"}
              </p>
            </div>
            
            <button 
              className="btn-playlist-primary btn-playlist-action" 
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Guardando...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Guardar
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-4 fade-in" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        <div className="playlist-editor-grid fade-in-delay">
          {/* Sidebar */}
          <div className="playlist-editor-sidebar">
            {/* Detalles de la Lista */}
            <div className="playlist-editor-card">
              <div className="playlist-editor-card-header">
                <i className="bi bi-gear me-2"></i>
                Detalles de la Lista
              </div>
              <div className="playlist-editor-card-body">
                <div className="form-group-modern mb-3">
                  <label className="form-label-modern">
                    <i className="bi bi-card-heading me-2"></i>
                    Nombre
                  </label>
                  <input
                    type="text"
                    className="form-control-modern"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre de la lista"
                  />
                </div>
                
                <div className="form-group-modern mb-3">
                  <label className="form-label-modern">
                    <i className="bi bi-calendar3 me-2"></i>
                    Fecha
                  </label>
                  <input
                    type="date"
                    className="form-control-modern"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                
                <div className="form-check-modern">
                  <input
                    type="checkbox"
                    className="form-check-input-modern"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <label className="form-check-label-modern" htmlFor="isPublic">
                    <i className="bi bi-globe me-2"></i>
                    Lista pública
                  </label>
                  <div className="form-help-text">
                    Las listas públicas pueden ser vistas por otros usuarios.
                  </div>
                </div>
              </div>
            </div>
            
            {/* Canciones Disponibles */}
            <div className="playlist-editor-card">
              <div className="playlist-editor-card-header">
                <i className="bi bi-music-note-beamed me-2"></i>
                Canciones Disponibles
                <span className="badge bg-secondary ms-2">{availableSongs.length}</span>
              </div>
              <div className="playlist-editor-card-body p-0">
                <div className="available-songs-list">
                  {availableSongs.length === 0 ? (
                    <div className="empty-state-small">
                      <i className="bi bi-music-note-list"></i>
                      <p>No hay canciones disponibles</p>
                    </div>
                  ) : (
                    availableSongs.map(song => (
                      <button
                        key={song.id}
                        className={`available-song-item ${selectedSongs.some(s => s.id === song.id) ? 'disabled' : ''}`}
                        onClick={() => addSong(song)}
                        disabled={selectedSongs.some(s => s.id === song.id)}
                      >
                        <div className="available-song-content">
                          <div className="available-song-title">{song.title || "Sin título"}</div>
                          <div className="available-song-meta">{song.key || "Sin tonalidad"} • {song.type || "Sin tipo"}</div>
                        </div>
                        {!selectedSongs.some(s => s.id === song.id) && (
                          <i className="bi bi-plus-circle available-song-add"></i>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="playlist-editor-main">
            <div className="playlist-editor-card">
              <div className="playlist-editor-card-header">
                <div>
                  <i className="bi bi-list-ol me-2"></i>
                  Canciones en la Lista
                </div>
                <span className="badge bg-primary">{selectedSongs.length} canciones</span>
              </div>
              <div className="playlist-editor-card-body p-0">
                {selectedSongs.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <i className="bi bi-music-note-list"></i>
                    </div>
                    <h4 className="empty-state-title">Lista vacía</h4>
                    <p className="empty-state-description">
                      No hay canciones en la lista. Añade canciones desde el panel izquierdo.
                    </p>
                  </div>
                ) : (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="songs-list">
                      {(provided) => (
                        <div
                          className="selected-songs-list"
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                        >
                          {selectedSongs.map((song, index) => (
                            <Draggable key={`${song.id}-${index}`} draggableId={`${song.id}-${index}`} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`selected-song-item ${snapshot.isDragging ? 'dragging' : ''}`}
                                >
                                  <div className="selected-song-drag" {...provided.dragHandleProps}>
                                    <i className="bi bi-grip-vertical"></i>
                                  </div>
                                  
                                  <div className="selected-song-number">
                                    {index + 1}
                                  </div>
                                  
                                  <div className="selected-song-content">
                                    <h5 className="selected-song-title">{song.title || "Sin título"}</h5>
                                    <div className="selected-song-controls">
                                      <label className="tonality-label">Tonalidad:</label>
                                      <select
                                        className="tonality-select"
                                        value={song.key}
                                        onChange={(e) => changeKey(song.id, e.target.value)}
                                      >
                                        <option value={song.originalKey}>Original ({song.originalKey})</option>
                                        <option disabled>──────────</option>
                                        <option value="DO">DO Mayor</option>
                                        <option value="LAm">LA menor</option>
                                        <option value="SOL">SOL Mayor</option>
                                        <option value="MIm">MI menor</option>
                                        <option value="RE">RE Mayor</option>
                                        <option value="SIm">SI menor</option>
                                        <option value="LA">LA Mayor</option>
                                        <option value="FA#m">FA# menor</option>
                                        <option value="MI">MI Mayor</option>
                                        <option value="DO#m">DO# menor</option>
                                        <option value="FA">FA Mayor</option>
                                        <option value="REm">RE menor</option>
                                        <option value="SIb">SIb Mayor</option>
                                        <option value="SOLm">SOL menor</option>
                                        <option value="MIb">MIb Mayor</option>
                                        <option value="DOm">DO menor</option>
                                      </select>
                                    </div>
                                  </div>
                                  
                                  <button
                                    className="selected-song-remove"
                                    onClick={() => removeSong(song.id)}
                                    title="Eliminar canción"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaylistEditor;
// apps/web/src/pages/PlaylistEditor.jsx - Con soporte de arrastrar y soltar
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPlaylist, getPlaylistById, updatePlaylist, getAllSongs } from "@notesheet/api";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

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
      <div className="d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 mb-0">
          {isNewPlaylist ? "Nueva Lista" : "Editar Lista"}
        </h1>
        
        <button 
          className="btn btn-primary" 
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? "Guardando..." : "Guardar"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row">
        <div className="col-md-4 mb-4">
          <div className="card">
            <div className="card-header">Detalles de la Lista</div>
            <div className="card-body">
              <div className="mb-3">
                <label htmlFor="name" className="form-label">Nombre</label>
                <input
                  type="text"
                  className="form-control"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre de la lista"
                />
              </div>
              
              <div className="mb-3">
                <label htmlFor="date" className="form-label">Fecha</label>
                <input
                  type="date"
                  className="form-control"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="isPublic">
                  Lista pública
                </label>
                <div className="form-text">
                  Las listas públicas pueden ser vistas por otros usuarios.
                </div>
              </div>
            </div>
          </div>
          
          <div className="card mt-4">
            <div className="card-header">Canciones Disponibles</div>
            <div className="card-body p-0">
              <div className="list-group list-group-flush" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {availableSongs.length === 0 ? (
                  <div className="list-group-item text-muted">
                    No hay canciones disponibles
                  </div>
                ) : (
                  availableSongs.map(song => (
                    <button
                      key={song.id}
                      className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                      onClick={() => addSong(song)}
                      disabled={selectedSongs.some(s => s.id === song.id)}
                    >
                      <div>
                        <div>{song.title || "Sin título"}</div>
                        <small className="text-muted">{song.key || "Sin tonalidad"}</small>
                      </div>
                      {!selectedSongs.some(s => s.id === song.id) && (
                        <i className="bi bi-plus-circle"></i>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Canciones en la Lista</span>
              <span className="badge bg-primary">{selectedSongs.length} canciones</span>
            </div>
            <div className="card-body p-0">
              {selectedSongs.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="mb-0 text-muted">No hay canciones en la lista. Añade canciones desde el panel izquierdo.</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="songs-list">
                    {(provided) => (
                      <div
                        className="list-group list-group-flush"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        {selectedSongs.map((song, index) => (
                          <Draggable key={`${song.id}-${index}`} draggableId={`${song.id}-${index}`} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`list-group-item ${snapshot.isDragging ? 'bg-light' : ''}`}
                              >
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <div className="d-flex align-items-center">
                                    <div 
                                      {...provided.dragHandleProps} 
                                      className="me-2"
                                      style={{ cursor: 'grab' }}
                                    >
                                      <i className="bi bi-grip-vertical"></i>
                                    </div>
                                    <h5 className="mb-0">
                                      <span className="badge bg-secondary me-2">{index + 1}</span>
                                      {song.title || "Sin título"}
                                    </h5>
                                  </div>
                                  <button
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removeSong(song.id)}
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                                
                                <div className="row g-2 align-items-center">
                                  <div className="col-auto">
                                    <label htmlFor={`key-${song.id}`} className="col-form-label">Tonalidad:</label>
                                  </div>
                                  <div className="col-auto">
                                    <select
                                      id={`key-${song.id}`}
                                      className="form-select form-select-sm"
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
  );
}

export default PlaylistEditor;
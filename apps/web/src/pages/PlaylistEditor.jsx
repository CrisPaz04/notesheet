// apps/web/src/pages/PlaylistEditor.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createPlaylist, getPlaylistById, updatePlaylist, getAllSongs, publishOwnSongs } from "@notesheet/api";
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import LoadingSpinner from "../components/LoadingSpinner";
import PlaylistKeySelector from "../components/PlaylistKeySelector";
import useSelectedSongs from "../hooks/useSelectedSongs";
import { emparejarSetlist } from "@notesheet/core";

function PlaylistEditor() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [availableSongs, setAvailableSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewPlaylist, setIsNewPlaylist] = useState(true);

  // Importar la lista que el director manda por WhatsApp
  const [textoImport, setTextoImport] = useState("");
  const [resultadoImport, setResultadoImport] = useState(null);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

  // Canciones de la lista: alta, baja, tonalidad propia y orden
  const {
    selectedSongs,
    setSelectedSongs,
    addSong,
    removeSong,
    changeKey,
    handleDragEnd
  } = useSelectedSongs();

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
    // loadPlaylist solo se usa aquí y su única dependencia inestable en
    // apariencia es setSelectedSongs, que es el setter de useState que
    // devuelve useSelectedSongs: es estable, pero ESLint no puede
    // demostrarlo al cruzar la frontera del hook. Incluirlo relanzaría la
    // carga en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  /**
   * Interpreta el texto pegado y lo empareja con el repertorio. No añade nada
   * todavía: primero se enseña qué encontró, porque el director escribe de
   * memoria y alguna coincidencia va a estar mal.
   */
  const interpretarLista = () => {
    setResultadoImport(emparejarSetlist(textoImport, availableSongs));
  };

  /** Corrige a mano la canción elegida para una de las entradas. */
  const cambiarCoincidencia = (indice, songId) => {
    setResultadoImport((prev) => prev.map((entrada, i) => {
      if (i !== indice) return entrada;
      const candidato = entrada.candidatos.find((c) => c.cancion.id === songId);
      return { ...entrada, elegida: candidato ? candidato.cancion : null };
    }));
  };

  /**
   * Vuelca a la lista lo que se haya confirmado, respetando la tonalidad que
   * el director indicó para cada bloque.
   */
  const aplicarImport = () => {
    resultadoImport.forEach((entrada) => {
      if (!entrada.elegida) return;
      addSong(entrada.elegida);
      if (entrada.key) changeKey(entrada.elegida.id, entrada.key);
    });

    setResultadoImport(null);
    setTextoImport("");
  };

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

      // Compartir la lista implica compartir lo que contiene: una canción
      // privada no la puede leer nadie más, así que una lista pública con
      // canciones privadas le aparecería vacía al resto de la banda.
      //
      // El mismo `publishOwnSongs` que usa `createSession` al abrir una sesión
      // en vivo. Antes había aquí una copia que decidía a partir de
      // `availableSongs`; tenerlo dos veces es como se pudre un invariante de
      // seguridad, y ya costó que la banda entera viera "no se pudo cargar".
      if (isPublic) {
        await publishOwnSongs(selectedSongs.map((s) => s.id), currentUser.uid);
      }

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
                
                <div className="form-group-modern mb-3">
                  <label className="form-label-modern">
                    <i className="bi bi-eye me-2"></i>
                    Visibilidad
                  </label>
                  <div className="visibility-toggle">
                    <button
                      type="button"
                      className={`visibility-option ${!isPublic ? 'active' : ''}`}
                      onClick={() => setIsPublic(false)}
                    >
                      <i className="bi bi-lock me-2"></i>
                      Privada
                    </button>
                    <button
                      type="button"
                      className={`visibility-option ${isPublic ? 'active' : ''}`}
                      onClick={() => setIsPublic(true)}
                    >
                      <i className="bi bi-globe me-2"></i>
                      Pública
                    </button>
                  </div>
                  <div className="form-help-text">
                    Las listas públicas las ve toda la banda. Al guardarla, sus
                    canciones pasan también al repertorio compartido.
                  </div>
                </div>
              </div>
            </div>
            
            {/* Importar la lista que el director manda por WhatsApp */}
            <div className="playlist-editor-card">
              <div className="playlist-editor-card-header">
                <i className="bi bi-chat-text me-2"></i>
                Pegar lista del director
              </div>
              <div className="playlist-editor-card-body">
                {!resultadoImport ? (
                  <>
                    <textarea
                      className="form-control-modern"
                      rows={6}
                      value={textoImport}
                      onChange={(e) => setTextoImport(e.target.value)}
                      placeholder={"Mi m\nTe alabare\nEn mi corazon\n\nLa m\nVoy a perder la compostura"}
                      aria-label="Lista del director"
                    />
                    <div className="form-help-text">
                      Pega el mensaje tal cual. Entiende las tonalidades sueltas
                      y busca cada canción por su título o por la letra.
                    </div>
                    <button
                      type="button"
                      className="btn-playlist-primary mt-2"
                      disabled={!textoImport.trim()}
                      onClick={interpretarLista}
                    >
                      <i className="bi bi-magic me-2"></i>
                      Interpretar
                    </button>
                  </>
                ) : (
                  <div className="import-resultado">
                    {resultadoImport.map((entrada, i) => (
                      <div
                        key={`${entrada.linea}-${i}`}
                        className={`import-entrada ${entrada.elegida ? '' : 'sin-coincidencia'}`}
                      >
                        <div className="import-consulta">
                          <i className={`bi ${entrada.elegida ? (entrada.seguro ? 'bi-check-circle' : 'bi-question-circle') : 'bi-x-circle'} me-2`}></i>
                          “{entrada.consulta}”
                          {entrada.key && <span className="import-key ms-2">{entrada.key}</span>}
                        </div>

                        {entrada.candidatos.length > 0 ? (
                          <select
                            className="form-control-modern form-control-sm"
                            aria-label={`Coincidencia para ${entrada.consulta}`}
                            value={entrada.elegida?.id || ''}
                            onChange={(e) => cambiarCoincidencia(i, e.target.value)}
                          >
                            <option value="">— No añadir —</option>
                            {entrada.candidatos.map((c) => (
                              <option key={c.cancion.id} value={c.cancion.id}>
                                {c.cancion.title} ({Math.round(c.score * 100)}%)
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="import-vacio">No se encontró ninguna canción parecida</div>
                        )}
                      </div>
                    ))}

                    <div className="import-acciones mt-3">
                      <button
                        type="button"
                        className="btn-playlist-primary"
                        onClick={aplicarImport}
                      >
                        <i className="bi bi-plus-circle me-2"></i>
                        Añadir {resultadoImport.filter((e) => e.elegida).length} a la lista
                      </button>
                      <button
                        type="button"
                        className="btn-playlist-secondary ms-2"
                        onClick={() => setResultadoImport(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
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
                                  style={{
                                    ...provided.draggableProps.style,
                                    zIndex: 1000 - index, // Z-index dinámico basado en la posición
                                    position: 'relative'
                                  }}
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
                                      <PlaylistKeySelector
                                        value={song.key}
                                        onChange={(newKey) => changeKey(song.id, newKey)}
                                        originalKey={song.originalKey}
                                      />
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
// apps/web/src/pages/PlaylistsList.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllPlaylists, deletePlaylist } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";

function PlaylistsList() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();

  // Cargar playlists al montar el componente
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        if (currentUser) {
          const fetchedPlaylists = await getAllPlaylists(currentUser.uid);
          setPlaylists(fetchedPlaylists);
        }
      } catch (error) {
        setError("Error al cargar las listas: " + error.message);
        console.error("Error fetching playlists:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, [currentUser]);

  // Eliminar una playlist
  const handleDelete = async (playlistId, playlistName) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar la lista "${playlistName}"?`)) {
      return;
    }

    try {
      await deletePlaylist(playlistId);
      setPlaylists(playlists.filter(playlist => playlist.id !== playlistId));
    } catch (error) {
      setError("Error al eliminar la lista: " + error.message);
      console.error("Error deleting playlist:", error);
    }
  };

  // Formatear fecha
  const formatDate = (date) => {
    if (!date) return "Sin fecha";
    return new Date(date.toDate()).toLocaleDateString('es-ES', {
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
            text="Cargando listas..." 
            subtext="Organizando tu música"
          />
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
                <i className="bi bi-collection-play"></i>
                Mis Listas
              </h1>
              <p className="playlists-subtitle">
                Organiza tus canciones para diferentes servicios y eventos
              </p>
            </div>
            
            <Link to="/playlists/new" className="btn-playlist-primary btn-playlist-action">
              <i className="bi bi-plus-circle"></i>
              Nueva Lista
            </Link>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-4 fade-in" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        {/* Contenido */}
        {playlists.length === 0 ? (
          <div className="empty-playlists-state fade-in">
            <div className="empty-playlists-icon">
              <i className="bi bi-collection-play"></i>
            </div>
            <h3 className="empty-playlists-title">¡Comienza a organizar tu música!</h3>
            <p className="empty-playlists-description">
              Aún no tienes listas. Crea tu primera lista para organizar canciones por servicio, 
              evento o cualquier criterio que necesites.
            </p>
            <Link to="/playlists/new" className="btn-playlist-primary btn-playlist-action">
              <i className="bi bi-plus-circle me-2"></i>
              Crear Mi Primera Lista
            </Link>
          </div>
        ) : (
          <div className="playlists-grid fade-in-delay">
            {playlists.map((playlist) => (
              <div key={playlist.id} className="playlist-card">
                <div className="playlist-card-header">
                  <h3 className="playlist-card-title">
                    <i className="bi bi-music-note-list"></i>
                    {playlist.name || "Lista sin nombre"}
                  </h3>
                  <div className="playlist-card-meta">
                    <span>
                      <i className="bi bi-calendar3 me-1"></i>
                      {formatDate(playlist.date)}
                    </span>
                    <span className={`playlist-visibility-badge ${playlist.public ? 'public' : 'private'}`}>
                      {playlist.public ? 'Pública' : 'Privada'}
                    </span>
                  </div>
                </div>
                
                <div className="playlist-card-body">
                  <div className="playlist-stats">
                    <div className="playlist-stat">
                      <i className="bi bi-music-note-beamed"></i>
                      <span>{playlist.songs?.length || 0} canciones</span>
                    </div>
                    <div className="playlist-stat">
                      <i className="bi bi-clock"></i>
                      <span>
                        {playlist.updatedAt ? 
                          `Actualizado ${new Date(playlist.updatedAt.toDate()).toLocaleDateString()}` : 
                          "Sin actualizaciones"
                        }
                      </span>
                    </div>
                  </div>
                  
                  {playlist.songs && playlist.songs.length > 0 && (
                    <div className="playlist-card-description">
                      <strong>Últimas canciones:</strong> {' '}
                      {playlist.songs.slice(0, 3).map(song => song.title).join(', ')}
                      {playlist.songs.length > 3 && '...'}
                    </div>
                  )}
                </div>
                
                <div className="playlist-card-footer">
                  <Link 
                    to={`/playlists/${playlist.id}`} 
                    className="btn-playlist-primary btn-playlist-action"
                  >
                    <i className="bi bi-eye"></i>
                    Ver
                  </Link>
                  
                  <div className="playlist-actions">
                    <Link 
                      to={`/playlists/${playlist.id}/edit`} 
                      className="btn-playlist-action"
                    >
                      <i className="bi bi-pencil"></i>
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(playlist.id, playlist.name)}
                      className="btn-playlist-action btn-playlist-danger"
                    >
                      <i className="bi bi-trash"></i>
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaylistsList;
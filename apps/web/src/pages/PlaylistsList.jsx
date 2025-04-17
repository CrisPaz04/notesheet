// apps/web/src/pages/PlaylistsList.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllPlaylists, deletePlaylist } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";

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
        setError("Error al cargar las playlists: " + error.message);
        console.error("Error fetching playlists:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, [currentUser]);

  // Eliminar una playlist
  const handleDelete = async (playlistId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta lista?")) {
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
        <h1 className="h2 mb-0">Mis Listas</h1>
        <Link to="/playlists/new" className="btn btn-primary">
          Nueva Lista
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <h3 className="h5 mb-3">Aún no tienes listas</h3>
            <p className="mb-4">Comienza creando tu primera lista para organizar tus canciones.</p>
            <Link to="/playlists/new" className="btn btn-primary">
              Crear mi primera lista
            </Link>
          </div>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
          {playlists.map((playlist) => (
            <div className="col" key={playlist.id}>
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">{playlist.name || "Sin nombre"}</h5>
                  <h6 className="card-subtitle mb-2 text-muted">
                    {playlist.date ? new Date(playlist.date.toDate()).toLocaleDateString() : "Sin fecha"}
                  </h6>
                  <p className="card-text small">
                    {playlist.songs?.length || 0} canciones
                  </p>
                  <p className="card-text">
                    <span className={`badge ${playlist.public ? 'bg-success' : 'bg-secondary'}`}>
                      {playlist.public ? 'Pública' : 'Privada'}
                    </span>
                  </p>
                </div>
                <div className="card-footer bg-transparent d-flex justify-content-between">
                  <Link to={`/playlists/${playlist.id}`} className="btn btn-sm btn-outline-primary">
                    Ver
                  </Link>
                  <div>
                    <Link to={`/playlists/${playlist.id}/edit`} className="btn btn-sm btn-outline-secondary me-2">
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(playlist.id)}
                      className="btn btn-sm btn-outline-danger"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PlaylistsList;
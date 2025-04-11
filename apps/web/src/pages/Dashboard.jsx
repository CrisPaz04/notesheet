// src/pages/Dashboard.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllSongs, deleteSong } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";

function Dashboard() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { currentUser } = useAuth();

  // Cargar canciones al montar el componente
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        if (currentUser) {
          const fetchedSongs = await getAllSongs(currentUser.uid);
          setSongs(fetchedSongs);
        }
      } catch (error) {
        setError("Error al cargar las canciones: " + error.message);
        console.error("Error fetching songs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, [currentUser]);

  // Eliminar una canción
  const handleDelete = async (songId) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar esta canción?")) {
      return;
    }

    try {
      await deleteSong(songId);
      setSongs(songs.filter(song => song.id !== songId));
    } catch (error) {
      setError("Error al eliminar la canción: " + error.message);
      console.error("Error deleting song:", error);
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
        <h1 className="h2 mb-0">Mis Canciones</h1>
        <Link to="/songs/new" className="btn btn-primary">
          Nueva Canción
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {songs.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5">
            <h3 className="h5 mb-3">Aún no tienes canciones</h3>
            <p className="mb-4">Comienza creando tu primera canción.</p>
            <Link to="/songs/new" className="btn btn-primary">
              Crear mi primera canción
            </Link>
          </div>
        </div>
      ) : (
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
          {songs.map((song) => (
            <div className="col" key={song.id}>
              <div className="card h-100">
                <div className="card-body">
                  <h5 className="card-title">{song.title || "Sin título"}</h5>
                  <h6 className="card-subtitle mb-2 text-muted">
                    {song.key || "Sin tonalidad"} · {song.type || "Sin tipo"}
                  </h6>
                  <p className="card-text small">
                    Actualizado: {song.updatedAt ? new Date(song.updatedAt.toDate()).toLocaleDateString() : "Desconocido"}
                  </p>
                </div>
                <div className="card-footer bg-transparent d-flex justify-content-between">
                  <Link to={`/songs/${song.id}`} className="btn btn-sm btn-outline-primary">
                    Ver
                  </Link>
                  <div>
                    <Link to={`/songs/${song.id}/edit`} className="btn btn-sm btn-outline-secondary me-2">
                      Editar
                    </Link>
                    <button
                      onClick={() => handleDelete(song.id)}
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

export default Dashboard;
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllSongs, deleteSong } from "@notesheet/api";
import { useAuth } from "../context/AuthContext";
import { getUserDisplayName } from "../utils/userHelpers";
import LoadingSpinner from "../components/LoadingSpinner";
import { SkeletonGrid } from "../components/SkeletonCard";

function Dashboard() {
  const [songs, setSongs] = useState([]);
  const [filteredSongs, setFilteredSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const { currentUser } = useAuth();

  // Cargar canciones al montar el componente
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        if (currentUser) {
          const fetchedSongs = await getAllSongs(currentUser.uid);
          setSongs(fetchedSongs);
          setFilteredSongs(fetchedSongs);
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

  // Filtrar canciones cuando cambie el término de búsqueda o filtro
  useEffect(() => {
    let filtered = songs;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(song =>
        song.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.key?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.version?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtrar por categoría
    if (activeFilter !== "all") {
      filtered = filtered.filter(song => {
        switch (activeFilter) {
          case "recent":
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return song.updatedAt && song.updatedAt.toDate() > oneWeekAgo;
          case "jubilo":
            return song.type === "Júbilo";
          case "adoracion":
            return song.type === "Adoración";
          case "moderada":
            return song.type === "Moderada";
          default:
            return true;
        }
      });
    }

    setFilteredSongs(filtered);
  }, [songs, searchTerm, activeFilter]);

  const getGreeting = () => {
    const greetings = [
      "Dios te bendiga",
      "Bendiciones",
      "Bendecido día",
    ];

    const hour = new Date().getHours();
    const day = new Date().getDay();
    const index = (hour + day) % greetings.length;
    
    return greetings[index];
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="container">
          {/* Skeleton del header */}
          <div className="dashboard-header fade-in">
            <div className="skeleton" style={{ height: '48px', width: '300px', marginBottom: '0.5rem' }}></div>
            <div className="skeleton" style={{ height: '20px', width: '200px' }}></div>
          </div>

          {/* Skeleton de acciones rápidas */}
          <div className="quick-actions fade-in-delay">
            <div className="skeleton" style={{ height: '32px', width: '180px', marginBottom: '1.5rem' }}></div>
            <SkeletonGrid count={4} type="action" />
          </div>

          {/* Skeleton del buscador */}
          <div className="search-section slide-up">
            <div className="search-container">
              <div className="skeleton" style={{ height: '50px', borderRadius: '25px' }}></div>
            </div>
          </div>

          {/* Skeleton de las canciones */}
          <div className="recent-section slide-up-delay">
            <div className="skeleton" style={{ height: '32px', width: '150px', marginBottom: '1.5rem' }}></div>
            <SkeletonGrid count={6} type="song" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="container">
        {/* Header de bienvenida */}
        <div className="dashboard-header fade-in">
        <h1 className="welcome-title">
          {getGreeting()}, {getUserDisplayName(currentUser)}
        </h1>
          <p className="welcome-subtitle">
            ¿Qué te gustaría hacer hoy?
          </p>
        </div>

        {error && (
          <div className="alert alert-danger mb-4 fade-in" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="quick-actions fade-in-delay">
          <h2 className="section-title">
            <i className="bi bi-lightning-charge"></i>
            Acciones Rápidas
          </h2>
          
          <div className="action-grid stagger-animation">
            <Link to="/songs/new" className="action-card card-hover">
              <div className="action-icon">
                <i className="bi bi-file-music"></i>
              </div>
              <h3 className="action-title">Nueva Canción</h3>
              <p className="action-description">Crear una canción desde cero</p>
            </Link>

            <Link to="/playlists/new" className="action-card card-hover">
              <div className="action-icon">
                <i className="bi bi-collection-play"></i>
              </div>
              <h3 className="action-title">Nueva Lista</h3>
              <p className="action-description">Organizar canciones para un servicio</p>
            </Link>

            <Link to="/playlists" className="action-card card-hover">
              <div className="action-icon">
                <i className="bi bi-list-ul"></i>
              </div>
              <h3 className="action-title">Mis Listas</h3>
              <p className="action-description">Ver todas tus listas</p>
            </Link>
          </div>
        </div>

        {/* Buscador */}
        <div className="search-section slide-up">
          <div className="search-container">
            <i className="bi bi-search search-icon"></i>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar canciones..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Mis Canciones */}
        <div className="recent-section slide-up-delay">
          <div className="content-header">
            <div className="content-header-left">
              <h2 className="section-title mb-0">
                <i className="bi bi-music-note-list"></i>
                Mis Canciones
              </h2>
              
              <div className="filter-tabs">
                <button
                  className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('all')}
                >
                  Todas
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'recent' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('recent')}
                >
                  Recientes
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'adoracion' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('adoracion')}
                >
                  Adoración
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'jubilo' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('jubilo')}
                >
                  Júbilo
                </button>
                <button
                  className={`filter-tab ${activeFilter === 'moderada' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('moderada')}
                >
                  Moderada
                </button>
              </div>
            </div>
            
            <div className="content-header-right">
              <div className="view-toggle">
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Vista de tarjetas"
                >
                  <i className="bi bi-grid-3x3-gap"></i>
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Vista de lista"
                >
                  <i className="bi bi-list"></i>
                </button>
              </div>
            </div>
          </div>

          {songs.length === 0 ? (
            <div className="empty-state fade-in">
              <div className="empty-state-icon pulse">
                <i className="bi bi-music-note-list"></i>
              </div>
              <h3 className="empty-state-title">¡Comienza tu colección musical!</h3>
              <p className="empty-state-description">
                Aún no tienes canciones. Crea tu primera canción y comienza a organizar tu repertorio.
              </p>
              <Link to="/songs/new" className="btn-primary-dashboard btn-animated">
                <i className="bi bi-plus-circle me-2"></i>
                Crear Mi Primera Canción
              </Link>
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="empty-state fade-in">
              <div className="empty-state-icon">
                <i className="bi bi-search"></i>
              </div>
              <h3 className="empty-state-title">No se encontraron canciones</h3>
              <p className="empty-state-description">
                Intenta con otros términos de búsqueda o cambia los filtros.
              </p>
              <button 
                onClick={() => {
                  setSearchTerm('');
                  setActiveFilter('all');
                }}
                className="btn-primary-dashboard btn-animated"
              >
                Limpiar Filtros
              </button>
            </div>
          ) : (
            <>
              {viewMode === 'cards' ? (
                <div className="recent-grid stagger-animation">
                  {filteredSongs.map((song) => (
                    <Link 
                      to={`/songs/${song.id}`} 
                      key={song.id} 
                      className="recent-item card-hover"
                    >
                      <div className="recent-item-header">
                        <div className="recent-item-icon">
                          <i className="bi bi-music-note-beamed"></i>
                        </div>
                        <h4 className="recent-item-title">
                          {song.title || "Sin título"}
                        </h4>
                      </div>
                      
                      <div className="recent-item-meta">
                        {song.key || "Sin tonalidad"} • {song.type || "Sin tipo"}
                      </div>
                      
                      <div className="recent-item-meta">
                        {song.updatedAt ? 
                          `Actualizado: ${new Date(song.updatedAt.toDate()).toLocaleDateString()}` : 
                          "Fecha desconocida"
                        }
                      </div>
                      
                      <div className="recent-item-preview">
                        {song.version ? `Versión de: ${song.version}` : "Click para ver la canción"}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="songs-list-view fade-in">
                  {filteredSongs.map((song, index) => (
                    <Link 
                      to={`/songs/${song.id}`} 
                      key={song.id} 
                      className="list-item"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="list-item-icon">
                        <i className="bi bi-music-note-beamed"></i>
                      </div>
                      <div className="list-item-content">
                        <h4 className="list-item-title">
                          {song.title || "Sin título"}
                        </h4>
                        <p className="list-item-meta">
                          {song.key || "Sin tonalidad"} • {song.type || "Sin tipo"}
                          {song.version && ` • Versión de: ${song.version}`}
                        </p>
                      </div>
                      <div className="list-item-date">
                        {song.updatedAt ? 
                          new Date(song.updatedAt.toDate()).toLocaleDateString() : 
                          "Sin fecha"
                        }
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
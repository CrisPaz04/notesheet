import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { getAllSongs, deleteSong } from "@notesheet/api";
import { identificarTonalidad } from "@notesheet/core";
import { useAuth } from "../context/AuthContext";
import { getUserDisplayName } from "../utils/userHelpers";
import LoadingSpinner from "../components/LoadingSpinner";
import { SkeletonGrid } from "../components/SkeletonCard";
import usePreferenciaLocal from "../hooks/usePreferenciaLocal";

const ORDENES = ["nuevas", "az", "za"];

// Minúsculas y sin tildes, para que la búsqueda no dependa de cómo se escriba
const normalizarBusqueda = (texto) => (texto || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "");

// Ordenar por título con las reglas del español: "Alégrate" va entre "Alabaré"
// y "Alístate", no al final por llevar tilde. `numeric` hace que "Salmo 3"
// vaya antes que "Salmo 21" y no al revés, que es lo que da comparar texto.
const porTitulo = new Intl.Collator("es", { sensitivity: "base", numeric: true });

function Dashboard() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  // Guarda la tonalidad identificada ("11m"), no el texto: así "RE#m" y
  // "MIbm" caen en la misma opción aunque cada una se escribiera distinta.
  const [keyFilter, setKeyFilter] = useState("");
  const [viewMode, setViewMode] = useState("cards");
  // "nuevas" respeta el orden en que llegan de Firestore (createdAt desc).
  // Se recuerda en este dispositivo: quien ordena alfabéticamente lo quiere
  // así siempre, y volver a pulsarlo cada vez que se abre el Dashboard sobra.
  const [sortOrder, setSortOrder] = usePreferenciaLocal(
    "dashboardOrden", "nuevas", ORDENES
  );
  const { currentUser, canEditSongs } = useAuth();

  // Cargar canciones al montar el componente
  useEffect(() => {
    const fetchSongs = async () => {
      try {
        if (currentUser) {
          setSongs(await getAllSongs(currentUser.uid));
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

  // `filteredSongs` es estado derivado: se calcula a partir de `songs`, el
  // término de búsqueda y el filtro activo. Antes se guardaba en su propio
  // useState y se sincronizaba a mano (también al borrar), lo que permitía
  // que ambas listas se desincronizaran.
  // Las tonalidades que de verdad hay en el repertorio, no las 30 posibles:
  // nadie quiere elegir entre opciones que devuelven la lista vacía. Salen de
  // `songs` y no de lo filtrado, para que elegir una no haga desaparecer las
  // demás. Mayores primero y luego menores, cada grupo en orden cromático.
  const tonalidades = useMemo(() => {
    const porId = new Map();
    for (const song of songs) {
      const id = identificarTonalidad(song.key);
      if (!id) continue;
      const actual = porId.get(id);
      // Se muestra como la escribe la primera canción que la trae
      if (actual) actual.cuantas++;
      else porId.set(id, { id, etiqueta: song.key.trim(), cuantas: 1 });
    }
    const orden = (id) => parseInt(id, 10) + (id.endsWith("m") ? 12 : 0);
    return [...porId.values()].sort((a, b) => orden(a.id) - orden(b.id));
  }, [songs]);

  const filteredSongs = useMemo(() => {
    let filtered = songs;

    // Filtrar por término de búsqueda
    if (searchTerm) {
      // Se normaliza para que "corazon" encuentre "corazón": nadie escribe
      // tildes buscando, y la letra de las canciones va acentuada.
      const termino = normalizarBusqueda(searchTerm);

      filtered = filtered.filter(song =>
        normalizarBusqueda(song.title).includes(termino) ||
        normalizarBusqueda(song.key).includes(termino) ||
        normalizarBusqueda(song.type).includes(termino) ||
        normalizarBusqueda(song.version).includes(termino) ||
        normalizarBusqueda(song.album).includes(termino) ||
        // La letra ya se guarda en cada canción: buscar por un verso suelto
        // es como el músico recuerda una canción cuyo título no sabe.
        //
        // Solo a partir de 4 letras, porque los nombres de nota (DO, RE, MI,
        // FA, SOL, LA, SI) aparecen dentro de cualquier palabra: buscar "RE"
        // devolvía "siempRE" y "adoraRÉ". Con 4 o más, quien escribe busca
        // una frase, no una tonalidad.
        (termino.length >= 4 && normalizarBusqueda(song.lyricsOnly).includes(termino))
      );
    }

    if (keyFilter) {
      filtered = filtered.filter(song => identificarTonalidad(song.key) === keyFilter);
    }

    // Filtrar por categoría
    if (activeFilter !== "all") {
      filtered = filtered.filter(song => {
        switch (activeFilter) {
          case "recent": {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return song.updatedAt && song.updatedAt.toDate() > oneWeekAgo;
          }
          case "mine":
            return song.isOwn;
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

    // Ordenar alfabéticamente si toca. Se copia antes de ordenar porque
    // `filtered` puede ser el propio array de estado cuando no hay ni búsqueda
    // ni filtro: `sort` ordena en el sitio y estaría mutando el estado.
    if (sortOrder !== "nuevas") {
      const sentido = sortOrder === "za" ? -1 : 1;
      filtered = [...filtered].sort(
        (a, b) => sentido * porTitulo.compare(a.title || "", b.title || "")
      );
    }

    return filtered;
  }, [songs, searchTerm, keyFilter, activeFilter, sortOrder]);

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

  // Eliminar una canción
  const handleDeleteSong = async (e, songId, songTitle) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`¿Estás seguro de que deseas eliminar "${songTitle}"? Esta acción no se puede deshacer.`)) {
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
            {canEditSongs() && (
              <Link to="/songs/new" className="action-card card-hover">
                <div className="action-icon">
                  <i className="bi bi-file-music"></i>
                </div>
                <h3 className="action-title">Nueva Canción</h3>
                <p className="action-description">Crear una canción desde cero</p>
              </Link>
            )}

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
          {tonalidades.length > 0 && (
            <div className="key-filter-wrap">
            <select
              className="search-input key-filter"
              aria-label="Filtrar por tonalidad"
              value={keyFilter}
              onChange={(e) => setKeyFilter(e.target.value)}
            >
              <option value="">Todas las tonalidades</option>
              {tonalidades.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.etiqueta} ({t.cuantas})
                </option>
              ))}
            </select>
            <i className="bi bi-chevron-down key-filter-chevron" aria-hidden="true"></i>
            </div>
          )}
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
                  className={`filter-tab ${activeFilter === 'mine' ? 'active' : ''}`}
                  onClick={() => setActiveFilter('mine')}
                >
                  Mías
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
              <div className="view-toggle" role="group" aria-label="Ordenar canciones">
                <button
                  className={`view-toggle-btn ${sortOrder === 'nuevas' ? 'active' : ''}`}
                  onClick={() => setSortOrder('nuevas')}
                  title="Nuevas primero"
                  aria-label="Nuevas primero"
                  aria-pressed={sortOrder === 'nuevas'}
                >
                  {/* Un icono de ordenar, no un reloj: el reloj se confundía
                      con la pestaña "Recientes", que filtra en vez de ordenar. */}
                  <i className="bi bi-sort-down"></i>
                </button>
                <button
                  className={`view-toggle-btn ${sortOrder === 'az' ? 'active' : ''}`}
                  onClick={() => setSortOrder('az')}
                  title="Ordenar de la A a la Z"
                  aria-label="Ordenar de la A a la Z"
                  aria-pressed={sortOrder === 'az'}
                >
                  <i className="bi bi-sort-alpha-down"></i>
                </button>
                <button
                  className={`view-toggle-btn ${sortOrder === 'za' ? 'active' : ''}`}
                  onClick={() => setSortOrder('za')}
                  title="Ordenar de la Z a la A"
                  aria-label="Ordenar de la Z a la A"
                  aria-pressed={sortOrder === 'za'}
                >
                  <i className="bi bi-sort-alpha-down-alt"></i>
                </button>
              </div>

              <div className="view-toggle" role="group" aria-label="Forma de ver las canciones">
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
              <h3 className="empty-state-title">
                {canEditSongs() ? "¡Comienza tu colección musical!" : "No hay canciones disponibles"}
              </h3>
              <p className="empty-state-description">
                {canEditSongs()
                  ? "Aún no tienes canciones. Crea tu primera canción y comienza a organizar tu repertorio."
                  : "Aún no hay canciones en la biblioteca. Contacta a un editor para agregar canciones."
                }
              </p>
              {canEditSongs() && (
                <Link to="/songs/new" className="btn-primary-dashboard btn-animated">
                  <i className="bi bi-plus-circle me-2"></i>
                  Crear Mi Primera Canción
                </Link>
              )}
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
                  setKeyFilter('');
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
                        {canEditSongs() && song.isOwn && (
                          <button
                            className="song-delete-btn"
                            onClick={(e) => handleDeleteSong(e, song.id, song.title)}
                            title="Eliminar canción"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
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
                      {canEditSongs() && song.isOwn && (
                        <button
                          className="song-delete-btn list-delete-btn"
                          onClick={(e) => handleDeleteSong(e, song.id, song.title)}
                          title="Eliminar canción"
                        >
                          <i className="bi bi-trash"></i>
                        </button>
                      )}
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
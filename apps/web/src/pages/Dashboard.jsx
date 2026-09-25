import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getAllSongs,
  deleteSong,
  getPlaylistsWithSong,
  removeSongFromPlaylists
} from "@notesheet/api";
import { identificarTonalidad, nombrarTonalidad } from "@notesheet/core";
import { useAuth } from "../context/AuthContext";
import { getUserDisplayName } from "../utils/userHelpers";
import { mensajeDeBorrado } from "../utils/avisoBorrado";
import LoadingSpinner from "../components/LoadingSpinner";
import { SkeletonGrid } from "../components/SkeletonCard";
import usePreferenciaLocal from "../hooks/usePreferenciaLocal";
import useNotacionPreferida from "../hooks/useNotacionPreferida";
import Desplegable from "../components/Desplegable";
import Icono from "../components/Icono";

const ORDENES = ["nuevas", "az", "za"];
const VISTAS = ["cards", "list"];

// Minúsculas y sin tildes, para que la búsqueda no dependa de cómo se escriba
const normalizarBusqueda = (texto) => (texto || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "");

// Ordenar por título con las reglas del español: "Alégrate" va entre "Alabaré"
// y "Alístate", no al final por llevar tilde. `numeric` hace que "Salmo 3"
// vaya antes que "Salmo 21" y no al revés, que es lo que da comparar texto.
const porTitulo = new Intl.Collator("es", { sensitivity: "base", numeric: true });

// Pestañas de tipo → valor de `song.type`
const TIPOS = { jubilo: "Júbilo", adoracion: "Adoración", moderada: "Moderada" };

function Dashboard() {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  // Pestañas: el tipo de canción (Adoración, Júbilo, Moderada)
  const [activeFilter, setActiveFilter] = useState("all");
  // "mine" o "recent", en su propio desplegable junto al de tonalidad. Antes
  // eran pestañas al lado de los tipos, y como solo había una activa no se
  // podía pedir "mis canciones de Adoración".
  const [origenFilter, setOrigenFilter] = useState("");
  // Guarda la tonalidad identificada ("11m"), no el texto: así "RE#m" y
  // "MIbm" caen en la misma opción aunque cada una se escribiera distinta.
  const [keyFilter, setKeyFilter] = useState("");
  // Tarjetas o lista. Se recuerda en este dispositivo, como el orden: quien
  // prefiere la lista la quiere siempre, no volver a elegirla en cada visita.
  const [viewMode, setViewMode] = usePreferenciaLocal("dashboardVista", "cards", VISTAS);
  // "nuevas" respeta el orden en que llegan de Firestore (createdAt desc).
  // Se recuerda en este dispositivo: quien ordena alfabéticamente lo quiere
  // así siempre, y volver a pulsarlo cada vez que se abre el Dashboard sobra.
  const [sortOrder, setSortOrder] = usePreferenciaLocal(
    "dashboardOrden", "nuevas", ORDENES
  );
  const { currentUser, canEditSongs } = useAuth();
  // Solo para mostrar las tonalidades; se guardan y se comparan en latina
  const [notacion] = useNotacionPreferida(currentUser);

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
      // Se muestra como la escribe la primera canción que la trae
      if (!porId.has(id)) porId.set(id, { id, etiqueta: song.key.trim() });
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
        // Quien lee en C-D-E busca "Bm", no "SIm"
        (notacion === "english" && normalizarBusqueda(nombrarTonalidad(song.key, notacion)).includes(termino)) ||
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

    if (origenFilter === "mine") {
      filtered = filtered.filter(song => song.isOwn);
    } else if (origenFilter === "recent") {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      filtered = filtered.filter(song => song.updatedAt && song.updatedAt.toDate() > oneWeekAgo);
    }

    // Filtrar por tipo
    if (TIPOS[activeFilter]) {
      filtered = filtered.filter(song => song.type === TIPOS[activeFilter]);
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
  }, [songs, searchTerm, keyFilter, origenFilter, activeFilter, sortOrder, notacion]);

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

    // Se mira antes de preguntar: el aviso solo sirve si dice en qué listas
    // está. `null` marca que no se ha podido consultar; no poder mirar no
    // debe impedir borrar, pero sí se avisa de que no se sabe.
    let enListas = null;
    try {
      enListas = await getPlaylistsWithSong(songId, currentUser.uid);
    } catch (error) {
      console.error("Error buscando las listas que usan la canción:", error);
    }

    if (!confirm(mensajeDeBorrado(songTitle, enListas))) {
      return;
    }

    try {
      await deleteSong(songId);
      // Forma funcional porque hay awaits por medio: `songs` capturada al
      // entrar puede no ser ya la del estado.
      setSongs(prev => prev.filter(song => song.id !== songId));
    } catch (error) {
      setError("Error al eliminar la canción: " + error.message);
      console.error("Error deleting song:", error);
      return;
    }

    // La limpieza va DESPUÉS del borrado, no antes. Si se limpiara primero y
    // fallara el borrado, habríamos vaciado las listas de una canción que
    // sigue existiendo, y ahí sí se pierden datos: cada entrada lleva su
    // propia tonalidad para esa ocasión. Al revés lo peor que queda es el
    // hueco de siempre, que la app ya sabe pintar.
    if (enListas && enListas.length > 0) {
      const { fallidas } = await removeSongFromPlaylists(
        songId, enListas, currentUser.uid
      );
      if (fallidas > 0) {
        setError(
          `Se eliminó "${songTitle}", pero no se pudo quitar de ${fallidas} ` +
          `${fallidas === 1 ? "lista" : "listas"}. Ábrelas para revisarlas.`
        );
      }
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
            <Icono nombre="warning" peso="fill" className="me-2" />
            {error}
          </div>
        )}

        {/* Acciones rápidas */}
        <div className="quick-actions fade-in-delay">
          <h2 className="section-title">
            <Icono nombre="lightning" />
            Acciones Rápidas
          </h2>

          <div className="action-grid stagger-animation">
            {canEditSongs() && (
              <Link to="/songs/new" className="action-card card-hover">
                <div className="action-icon">
                  <Icono nombre="music-notes-plus" />
                </div>
                <h3 className="action-title">Nueva Canción</h3>
                <p className="action-description">Crear una canción desde cero</p>
              </Link>
            )}

            {canEditSongs() && (
              <Link to="/partituras/importar" className="action-card card-hover">
                <div className="action-icon">
                  <Icono nombre="folder-open" />
                </div>
                <h3 className="action-title">Importar partituras</h3>
                <p className="action-description">Subir los PDF de una carpeta de golpe</p>
              </Link>
            )}

            <Link to="/playlists/new" className="action-card card-hover">
              <div className="action-icon">
                <Icono nombre="playlist" />
              </div>
              <h3 className="action-title">Nueva Lista</h3>
              <p className="action-description">Organizar canciones para un servicio</p>
            </Link>

            <Link to="/playlists" className="action-card card-hover">
              <div className="action-icon">
                <Icono nombre="list-bullets" />
              </div>
              <h3 className="action-title">Mis Listas</h3>
              <p className="action-description">Ver todas tus listas</p>
            </Link>
          </div>
        </div>

        {/* Buscador */}
        <div className="search-section slide-up">
          <div className="search-container">
            <Icono nombre="magnifying-glass" className="search-icon" />
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
              <Desplegable
                className="desplegable--pildora"
                ariaLabel="Filtrar por tonalidad"
                value={keyFilter}
                onChange={setKeyFilter}
                opciones={[
                  { value: "", label: "Todas las tonalidades" },
                  ...tonalidades.map((t) => ({
                    value: t.id,
                    label: nombrarTonalidad(t.etiqueta, notacion)
                  }))
                ]}
              />
            </div>
          )}
          <div className="key-filter-wrap">
            <Desplegable
              className="desplegable--pildora"
              ariaLabel="Mostrar canciones"
              value={origenFilter}
              onChange={setOrigenFilter}
              opciones={[
                { value: "", label: "Todas las canciones" },
                { value: "mine", label: "Solo las mías" },
                { value: "recent", label: "Editadas esta semana" }
              ]}
            />
          </div>
        </div>

        {/* Mis Canciones */}
        <div className="recent-section slide-up-delay">
          <div className="content-header">
            <div className="content-header-left">
              <h2 className="section-title mb-0">
                <Icono nombre="music-notes" />
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
                      con el filtro "Editadas esta semana", que filtra en vez
                      de ordenar. */}
                  <Icono nombre="orden-nuevas" />
                </button>
                <button
                  className={`view-toggle-btn ${sortOrder === 'az' ? 'active' : ''}`}
                  onClick={() => setSortOrder('az')}
                  title="Ordenar de la A a la Z"
                  aria-label="Ordenar de la A a la Z"
                  aria-pressed={sortOrder === 'az'}
                >
                  <Icono nombre="orden-az" />
                </button>
                <button
                  className={`view-toggle-btn ${sortOrder === 'za' ? 'active' : ''}`}
                  onClick={() => setSortOrder('za')}
                  title="Ordenar de la Z a la A"
                  aria-label="Ordenar de la Z a la A"
                  aria-pressed={sortOrder === 'za'}
                >
                  <Icono nombre="orden-za" />
                </button>
              </div>

              <div className="view-toggle" role="group" aria-label="Forma de ver las canciones">
                <button
                  className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Vista de tarjetas"
                  aria-label="Vista de tarjetas"
                  aria-pressed={viewMode === 'cards'}
                >
                  <Icono nombre="squares-four" />
                </button>
                <button
                  className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  title="Vista de lista"
                  aria-label="Vista de lista"
                  aria-pressed={viewMode === 'list'}
                >
                  <Icono nombre="list" />
                </button>
              </div>
            </div>
          </div>

          {songs.length === 0 ? (
            <div className="empty-state fade-in">
              <div className="empty-state-icon pulse">
                <Icono nombre="music-notes" />
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
                  <Icono nombre="plus-circle" className="me-2" />
                  Crear Mi Primera Canción
                </Link>
              )}
            </div>
          ) : filteredSongs.length === 0 ? (
            <div className="empty-state fade-in">
              <div className="empty-state-icon">
                <Icono nombre="magnifying-glass" />
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
                          <Icono nombre="music-notes" />
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
                            <Icono nombre="trash" />
                          </button>
                        )}
                      </div>

                      <div className="recent-item-meta">
                        {nombrarTonalidad(song.key, notacion) || "Sin tonalidad"} • {song.type || "Sin tipo"}
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
                        <Icono nombre="music-notes" />
                      </div>
                      <div className="list-item-content">
                        <h4 className="list-item-title">
                          {song.title || "Sin título"}
                        </h4>
                        <p className="list-item-meta">
                          {nombrarTonalidad(song.key, notacion) || "Sin tonalidad"} • {song.type || "Sin tipo"}
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
                          <Icono nombre="trash" />
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
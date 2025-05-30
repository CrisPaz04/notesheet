import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserDisplayName, getUserInitials } from "../utils/userHelpers";

function Navbar() {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  // Función para determinar si un link está activo
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark-custom">
      <div className="container">
        <Link className="navbar-brand-custom" to={currentUser ? "/dashboard" : "/"}>
          <i className="bi bi-music-note-beamed me-2"></i>
          NoteSheet
        </Link>
        
        <button 
          className="navbar-toggler navbar-toggler-custom" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
          aria-controls="navbarNav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon navbar-toggler-icon-custom"></span>
        </button>
        
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav navbar-nav-custom ms-auto">
            {currentUser ? (
              <>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`} 
                    to="/dashboard"
                  >
                    <i className="bi bi-speedometer2"></i>
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/songs/new') ? 'active' : ''}`} 
                    to="/songs/new"
                  >
                    <i className="bi bi-plus-circle"></i>
                    Nueva Canción
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/playlists') ? 'active' : ''}`} 
                    to="/playlists"
                  >
                    <i className="bi bi-collection-play"></i>
                    Mis Listas
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/preferences') ? 'active' : ''}`} 
                    to="/preferences"
                  >
                    <i className="bi bi-gear"></i>
                    Preferencias
                  </Link>
                </li>
                <li className="nav-item">
                  <div className="user-indicator">
                    <div className="user-avatar">
                      {getUserInitials(currentUser)}
                    </div>
                    <span className="user-name">
                      {getUserDisplayName(currentUser)}
                    </span>
                  </div>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/') ? 'active' : ''}`} 
                    to="/"
                  >
                    <i className="bi bi-house"></i>
                    Inicio
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/login') ? 'active' : ''}`} 
                    to="/login"
                  >
                    <i className="bi bi-box-arrow-in-right"></i>
                    Iniciar Sesión
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/register') ? 'active' : ''}`} 
                    to="/register"
                  >
                    <i className="bi bi-person-plus"></i>
                    Registrarse
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
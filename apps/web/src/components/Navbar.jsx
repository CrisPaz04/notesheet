import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserDisplayName, getUserInitials } from "../utils/userHelpers";
import { useThemeWithAuth } from "../hooks/useThemeWithAuth";

function Navbar() {
  const { currentUser, logout } = useAuth();
  const { theme, changeTheme } = useThemeWithAuth();
  const location = useLocation();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsUserDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setIsUserDropdownOpen(false);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  const handleThemeToggle = () => {
    console.log("Current theme:", theme);
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    console.log("New theme:", newTheme);
    console.log("HTML data-bs-theme before:", document.documentElement.getAttribute('data-bs-theme'));
    changeTheme(newTheme);
    setTimeout(() => {
      console.log("HTML data-bs-theme after:", document.documentElement.getAttribute('data-bs-theme'));
    }, 100);
    
    setIsUserDropdownOpen(false);
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
                <li className="nav-item user-dropdown" ref={dropdownRef}>
                  <button
                    className="user-indicator clickable"
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    aria-expanded={isUserDropdownOpen}
                  >
                    <div className="user-avatar">
                      {getUserInitials(currentUser)}
                    </div>
                    <div className="user-info">
                      <span className="user-name">
                        {getUserDisplayName(currentUser)}
                      </span>
                    </div>
                    <i className={`bi bi-chevron-${isUserDropdownOpen ? 'up' : 'down'} dropdown-arrow`}></i>
                  </button>
                  
                  {isUserDropdownOpen && (
                    <div className="user-dropdown-menu">
                      <div className="user-dropdown-header">
                        <div className="user-avatar-large">
                          {getUserInitials(currentUser)}
                        </div>
                        <div className="user-details">
                          <div className="user-name-large">
                            {getUserDisplayName(currentUser)}
                          </div>
                          <div className="user-email-small">
                            {currentUser?.email}
                          </div>
                        </div>
                      </div>
                      
                      <div className="user-dropdown-divider"></div>
                      
                      <Link 
                        to="/preferences" 
                        className="user-dropdown-item"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        <i className="bi bi-gear"></i>
                        <span>Preferencias</span>
                      </Link>
                      
                      <button 
                        className="user-dropdown-item" 
                        onClick={handleThemeToggle}
                      >
                        <i className={`bi ${theme === 'dark' ? 'bi-sun' : 'bi-moon'}`}></i>
                        <span>Tema {theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
                      </button>
                      
                      <div className="user-dropdown-divider"></div>
                      
                      <button 
                        className="user-dropdown-item logout" 
                        onClick={handleLogout}
                      >
                        <i className="bi bi-box-arrow-right"></i>
                        <span>Cerrar Sesión</span>
                      </button>
                    </div>
                  )}
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
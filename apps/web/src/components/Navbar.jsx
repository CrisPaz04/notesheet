// apps/web/src/components/Navbar.jsx
import { Link, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserDisplayName, getUserInitials } from "../utils/userHelpers";
import { useThemeWithAuth } from "../hooks/useThemeWithAuth";
import Icono from "./Icono";

function Navbar() {
  const { currentUser, logout } = useAuth();
  const { getCurrentThemeInfo } = useThemeWithAuth();
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

  // Función para determinar si un link está activo
  const isActive = (path) => {
    return location.pathname === path;
  };

  const currentThemeInfo = getCurrentThemeInfo();

  return (
    <nav className="navbar navbar-expand-lg navbar-dark-custom">
      <div className="container">
        <Link className="navbar-brand-custom" to={currentUser ? "/dashboard" : "/"}>
          <Icono nombre="music-notes" className="me-2" />
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
                    <Icono nombre="metronome" />
                    Dashboard
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/songs/new') ? 'active' : ''}`} 
                    to="/songs/new"
                  >
                    <Icono nombre="plus-circle" />
                    Nueva Canción
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${isActive('/playlists') ? 'active' : ''}`}
                    to="/playlists"
                  >
                    <Icono nombre="playlist" />
                    Mis Listas
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${isActive('/metronome') ? 'active' : ''}`}
                    to="/metronome"
                  >
                    <Icono nombre="metronome" />
                    Metrónomo
                  </Link>
                </li>
                <li className="nav-item">
                  <Link
                    className={`nav-link ${isActive('/tuner') ? 'active' : ''}`}
                    to="/tuner"
                  >
                    <Icono nombre="waveform" />
                    Afinador
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
                    <Icono nombre={isUserDropdownOpen ? "caret-up" : "caret-down"} className="dropdown-arrow" />
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
                        <Icono nombre="gear" />
                        <span>Preferencias</span>
                      </Link>
                      
                      <Link 
                        to="/preferences" 
                        className="user-dropdown-item"
                        onClick={() => setIsUserDropdownOpen(false)}
                      >
                        <Icono nombre="palette" />
                        <span>Temas ({currentThemeInfo.name})</span>
                      </Link>
                      
                      <div className="user-dropdown-divider"></div>
                      
                      <button 
                        className="user-dropdown-item logout" 
                        onClick={handleLogout}
                      >
                        <Icono nombre="sign-out" />
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
                    <Icono nombre="house" />
                    Inicio
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/login') ? 'active' : ''}`} 
                    to="/login"
                  >
                    <Icono nombre="sign-in" />
                    Iniciar Sesión
                  </Link>
                </li>
                <li className="nav-item">
                  <Link 
                    className={`nav-link ${isActive('/register') ? 'active' : ''}`} 
                    to="/register"
                  >
                    <Icono nombre="user-plus" />
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
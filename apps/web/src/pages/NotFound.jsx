import Icono from "../components/Icono";
import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="notfound-container">
      <div className="container">
        <div className="notfound-content fade-in">
          {/* Animated 404 */}
          <div className="notfound-number">
            <span className="number-4 bounce-in">4</span>
            <span className="number-0 bounce-in-delay">0</span>
            <span className="number-4-2 bounce-in-delay-2">4</span>
          </div>
          
          {/* Glitch Effect Text */}
          <div className="notfound-text">
            <h1 className="notfound-title slide-up">
              Página no encontrada
            </h1>
            <p className="notfound-description slide-up-delay">
              Lo sentimos, la página que estás buscando no existe o ha sido movida.
              <br />
              Pero no te preocupes, tu música te está esperando.
            </p>
          </div>
          
          {/* Floating Music Notes */}
          <div className="floating-music-notes">
            <div className="music-note note-1">♪</div>
            <div className="music-note note-2">♫</div>
            <div className="music-note note-3">♪</div>
            <div className="music-note note-4">♬</div>
            <div className="music-note note-5">♫</div>
            <div className="music-note note-6">♪</div>
          </div>
          
          {/* Action Buttons */}
          <div className="notfound-actions slide-up-delay-2">
            <Link 
              to="/" 
              className="btn-notfound-primary"
            >
              <Icono nombre="house" className="me-2" />
              Volver al Inicio
            </Link>
            
            <Link 
              to="/dashboard" 
              className="btn-notfound-secondary"
            >
              <Icono nombre="music-notes" className="me-2" />
              Ir al Dashboard
            </Link>
          </div>
          
          {/* Fun suggestions */}
          <div className="notfound-suggestions slide-up-delay-3">
            <p className="suggestions-title">¿Qué te gustaría hacer?</p>
            <div className="suggestions-grid">
              <Link to="/songs/new" className="suggestion-item">
                <Icono nombre="plus-circle" />
                <span>Crear una canción</span>
              </Link>
              <Link to="/playlists" className="suggestion-item">
                <Icono nombre="playlist" />
                <span>Ver mis listas</span>
              </Link>
              <Link to="/preferences" className="suggestion-item">
                <Icono nombre="gear" />
                <span>Configuración</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotFound;
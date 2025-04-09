import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    }
  };

  return (
    <nav className="bg-dark text-white shadow-md">
      <div className="container mx-auto px-4 py-3 flex justify-between items-center">
        <Link to="/" className="text-xl font-bold">NoteSheet</Link>
        
        <div className="flex space-x-4">
          {currentUser ? (
            <>
              <Link to="/dashboard" className="hover:text-primary">Dashboard</Link>
              <Link to="/songs/new" className="hover:text-primary">Nueva Canción</Link>
              <Link to="/playlists/new" className="hover:text-primary">Nueva Lista</Link>
              <button 
                onClick={handleLogout} 
                className="hover:text-red-400"
              >
                Cerrar Sesión
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-primary">Iniciar Sesión</Link>
              <Link to="/register" className="hover:text-primary">Registrarse</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

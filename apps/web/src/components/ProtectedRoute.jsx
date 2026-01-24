import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
}

// Ruta protegida para editores - requiere autenticación y rol de editor
export function EditorRoute({ children }) {
  const { currentUser, canEditSongs, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  if (!canEditSongs()) {
    return <Navigate to="/dashboard" />;
  }

  return children;
}

export default ProtectedRoute;

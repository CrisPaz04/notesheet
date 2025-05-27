// apps/web/src/App.jsx
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./context/AuthContext";
import ThemeToggle from "./components/ThemeToggle";

// Páginas
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import SongEditor from "./pages/SongEditor";
import SongView from "./pages/SongView";
import NotFound from "./pages/NotFound";
import UserPreferences from "./pages/UserPreferences";
import PlaylistsList from "./pages/PlaylistsList";
import PlaylistEditor from "./pages/PlaylistEditor";
import PlaylistView from "./pages/PlaylistView";

// Componentes
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

// Componente para manejar la redirección de la ruta raíz
function RootRedirect() {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="container">
          <div className="d-flex justify-content-center align-items-center" style={{minHeight: '200px'}}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Cargando...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Si el usuario está logueado, redirigir al dashboard
  // Si no está logueado, mostrar la página Home
  return currentUser ? <Navigate to="/dashboard" replace /> : <Home />;
}

// Componente que maneja el layout condicional
function AppLayout() {
  const location = useLocation();
  const { theme } = useTheme();
  
  // Páginas donde NO queremos mostrar navbar y footer
  const authPages = ['/login', '/register'];
  // Páginas que necesitan pantalla completa (sin padding del container)
  const fullScreenPages = ['/login', '/register', '/', '/dashboard', '/songs/new', '/playlists'];
  
  const isAuthPage = authPages.includes(location.pathname);
  const isFullScreenPage = fullScreenPages.includes(location.pathname) || 
                         location.pathname.match(/^\/songs\/[^\/]+\/edit$/) ||
                         location.pathname.match(/^\/songs\/[^\/]+$/) ||
                         location.pathname.match(/^\/playlists\/[^\/]+$/);
  
  return (
  <div className={`d-flex flex-column min-vh-100 ${theme === 'dark' ? 'bg-dark text-light' : ''}`}>
    {/* Solo mostrar navbar si NO estamos en páginas de auth */}
    {!isAuthPage && <Navbar />}
    
    <main className={`flex-grow-1 ${isFullScreenPage ? '' : 'container py-4'}`}>
      <Routes>
        {/* Todas tus rutas existentes */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/songs/new" element={
          <ProtectedRoute>
            <SongEditor />
          </ProtectedRoute>
        } />
        <Route path="/songs/:id" element={<SongView />} />
        <Route path="/songs/:id/edit" element={
          <ProtectedRoute>
            <SongEditor />
          </ProtectedRoute>
        } />
        <Route path="/preferences" element={
          <ProtectedRoute>
            <UserPreferences />
          </ProtectedRoute>
        } />
        <Route path="/playlists" element={
          <ProtectedRoute>
            <PlaylistsList />
          </ProtectedRoute>
        } />
        <Route path="/playlists/new" element={
          <ProtectedRoute>
            <PlaylistEditor />
          </ProtectedRoute>
        } />
        <Route path="/playlists/:id" element={<PlaylistView />} />
        <Route path="/playlists/:id/edit" element={
          <ProtectedRoute>
            <PlaylistEditor />
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </main>
    
    {/* Solo mostrar footer si NO estamos en páginas de auth */}
    {!isAuthPage && <Footer />}
    
    {/* Botón de cambio de tema */}
    <ThemeToggle />
  </div>
);
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </Router>
  );
}

export default App;
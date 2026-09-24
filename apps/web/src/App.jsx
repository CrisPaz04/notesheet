// apps/web/src/App.jsx
import { Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useTheme } from "./hooks/useTheme";
import { useAuth } from "./context/AuthContext";
import LoadingSpinner from "./components/LoadingSpinner";
import { lazyConRecarga } from "./lib/lazyConRecarga";

// Páginas (carga diferida: cada ruta viaja en su propio chunk).
//
// `lazyConRecarga` y no `lazy` a secas: tras un despliegue, los archivos de
// la versión anterior desaparecen, y quien tuviera la app abierta se queda en
// blanco al entrar en una vista que aún no había visitado. Ver el comentario
// de `lib/lazyConRecarga.js`.
const Home = lazyConRecarga(() => import("./pages/Home"));
const Login = lazyConRecarga(() => import("./pages/Login"));
const Register = lazyConRecarga(() => import("./pages/Register"));
const Dashboard = lazyConRecarga(() => import("./pages/Dashboard"));
const SongEditor = lazyConRecarga(() => import("./pages/SongEditor"));
const SongView = lazyConRecarga(() => import("./pages/SongView"));
const NotFound = lazyConRecarga(() => import("./pages/NotFound"));
const UserPreferences = lazyConRecarga(() => import("./pages/UserPreferences"));
const PlaylistsList = lazyConRecarga(() => import("./pages/PlaylistsList"));
const PlaylistEditor = lazyConRecarga(() => import("./pages/PlaylistEditor"));
const PlaylistView = lazyConRecarga(() => import("./pages/PlaylistView"));
const Metronome = lazyConRecarga(() => import("./pages/Metronome"));
const Tuner = lazyConRecarga(() => import("./pages/Tuner"));
const LiveSession = lazyConRecarga(() => import("./pages/LiveSession"));
const JoinLive = lazyConRecarga(() => import("./pages/JoinLive"));
const ImportarPartituras = lazyConRecarga(() => import("./pages/ImportarPartituras"));

// Componentes
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute, { EditorRoute } from "./components/ProtectedRoute";

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
  const fullScreenPages = ['/login', '/register', '/', '/home', '/dashboard', '/songs/new', '/playlists', '/playlists/new', '/preferences', '/metronome', '/tuner', '/live'];
  
  const isAuthPage = authPages.includes(location.pathname);
  const isFullScreenPage = fullScreenPages.includes(location.pathname) || 
                       location.pathname.match(/^\/songs\/[^/]+\/edit$/) ||
                       location.pathname.match(/^\/songs\/[^/]+$/) ||
                       location.pathname.match(/^\/playlists\/[^/]+$/) ||
                       location.pathname.match(/^\/playlists\/[^/]+\/edit$/) ||
                       // La sesión en vivo trae su propio contenedor
                       location.pathname.match(/^\/live\/[^/]+$/) ||
                       // Detectar rutas 404 (rutas que no están definidas en nuestro sistema)
                       (location.pathname !== '/' && 
                        location.pathname !== '/home' && 
                        location.pathname !== '/login' && 
                        location.pathname !== '/register' && 
                        location.pathname !== '/dashboard' && 
                        location.pathname !== '/songs/new' && 
                        location.pathname !== '/playlists' &&
                        location.pathname !== '/playlists/new' &&
                        location.pathname !== '/preferences' &&
                        location.pathname !== '/metronome' &&
                        location.pathname !== '/tuner' &&
                        !location.pathname.match(/^\/songs\/[^/]+/) &&
                        !location.pathname.match(/^\/playlists\/[^/]+/));                      
  
  return (
    <div className={`d-flex flex-column min-vh-100 ${theme === 'dark' ? 'bg-dark text-light' : ''}`}>
      {/* Solo mostrar navbar si NO estamos en páginas de auth */}
      {!isAuthPage && <Navbar />}
      
      <main className={`flex-grow-1 ${isFullScreenPage ? '' : 'container py-4'}`}>
        <Suspense fallback={<LoadingSpinner />}>
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
            <EditorRoute>
              <SongEditor />
            </EditorRoute>
          } />
          <Route path="/partituras/importar" element={
            <EditorRoute>
              <ImportarPartituras />
            </EditorRoute>
          } />
          <Route path="/songs/:id" element={<SongView />} />
          <Route path="/songs/:id/edit" element={
            <EditorRoute>
              <SongEditor />
            </EditorRoute>
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
          <Route path="/metronome" element={
            <ProtectedRoute>
              <Metronome />
            </ProtectedRoute>
          } />
          <Route path="/tuner" element={
            <ProtectedRoute>
              <Tuner />
            </ProtectedRoute>
          } />
          {/* Sesiones en vivo. Sin `ProtectedRoute` a propósito: el enlace
              llega por WhatsApp a músicos sin cuenta, y la propia pantalla
              ofrece entrar como invitado. Las reglas de Firestore siguen
              exigiendo estar autenticado para leer o escribir nada. */}
          <Route path="/live" element={<JoinLive />} />
          <Route path="/live/:code" element={<LiveSession />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </main>
      
      {/* Solo mostrar footer si NO estamos en páginas de auth */}
      {!isAuthPage && <Footer />}
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
// apps/web/src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { useTheme } from "./hooks/useTheme";

// Páginas
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import SongEditor from "./pages/SongEditor";
import SongView from "./pages/SongView";
import NotFound from "./pages/NotFound";
import UserPreferences from "./pages/UserPreferences";

// Componentes
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const { theme } = useTheme();
  
  return (
    <Router>
      <AuthProvider>
        <div className={`d-flex flex-column min-vh-100 ${theme === 'dark' ? 'bg-dark text-light' : ''}`}>
          <Navbar />
          <main className="flex-grow-1 container py-4">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Rutas protegidas */}
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
              
              {/* Ruta 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
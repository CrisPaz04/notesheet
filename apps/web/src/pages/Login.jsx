import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (error) {
      setError("Error al iniciar sesión: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(""); 
      await loginWithGoogle();
      navigate("/dashboard");
    } catch (error) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      } else if (error.code === 'auth/popup-blocked') {
        setError("Tu navegador bloqueó el popup. Por favor, permite popups para este sitio.");
      } else if (error.code === 'auth/cancelled-popup-request') {
        return;
      } else {
        setError("Error al iniciar sesión con Google. Por favor, intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = () => {
    console.log("Login con Facebook - Por implementar");
  };

  const handleAppleLogin = () => {
    console.log("Login con Apple - Por implementar");
  };

  return (
    <div className="login-container">
      {/* Formas flotantes decorativas */}
      <div className="floating-shapes">
        <div className="shape"></div>
        <div className="shape"></div>
        <div className="shape"></div>
      </div>

      <div className="login-card">
        {/* Header con icono */}
        <div className="login-header">
          <div className="login-icon">
            <i className="bi bi-music-note-beamed"></i>
          </div>
          <h1 className="h3 mb-0">Bienvenido a NoteSheet</h1>
          <p className="mb-0 opacity-75">Inicia sesión para continuar</p>
        </div>

        <div className="card-body p-4">
          {error && (
            <div className="alert alert-danger d-flex align-items-center" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <div>{error}</div>
            </div>
          )}

          {/* Botones de redes sociales */}
          <div className="mb-4">
            <div className="d-flex gap-2 mb-3">
              <button 
                onClick={handleGoogleLogin}
                className="social-btn google"
                type="button"
              >
                <i className="bi bi-google me-2"></i>
                Google
              </button>
              <button 
                onClick={handleFacebookLogin}
                className="social-btn facebook"
                type="button"
              >
                <i className="bi bi-facebook me-2"></i>
                Facebook
              </button>
              <button 
                onClick={handleAppleLogin}
                className="social-btn apple"
                type="button"
              >
                <i className="bi bi-apple me-2"></i>
                Apple
              </button>
            </div>
            
            <div className="text-center">
              <span className="text-muted small">o continúa con tu email</span>
            </div>
            <hr className="my-3" style={{borderColor: 'rgba(255, 255, 255, 0.1)'}} />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-floating">
              <input
                id="email"
                type="email"
                className="form-control"
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="email">
                <i className="bi bi-envelope me-2"></i>
                Correo electrónico
              </label>
            </div>

            <div className="form-floating">
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <label htmlFor="password">
                <i className="bi bi-lock me-2"></i>
                Contraseña
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-login w-100 mb-3"
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Iniciando sesión...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  Iniciar Sesión
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="text-muted mb-0">
              ¿No tienes una cuenta?{" "}
              <Link to="/register" className="text-decoration-none fw-semibold">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
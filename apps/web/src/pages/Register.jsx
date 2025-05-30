import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    setLoading(true);

    try {
      await register(email, password);
      navigate("/dashboard");
    } catch (error) {
      setError("Error al registrarse: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
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
        setError("Error al registrarse con Google. Por favor, intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookRegister = () => {
    console.log("Registro con Facebook - Por implementar");
  };

  const handleAppleRegister = () => {
    console.log("Registro con Apple - Por implementar");
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
            <i className="bi bi-person-plus"></i>
          </div>
          <h1 className="h3 mb-0">Únete a NoteSheet</h1>
          <p className="mb-0 opacity-75">Crea tu cuenta y comienza</p>
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
                onClick={handleGoogleRegister}
                className="social-btn google"
                type="button"
              >
                <i className="bi bi-google me-2"></i>
                Google
              </button>
              <button 
                onClick={handleFacebookRegister}
                className="social-btn facebook"
                type="button"
              >
                <i className="bi bi-facebook me-2"></i>
                Facebook
              </button>
              <button 
                onClick={handleAppleRegister}
                className="social-btn apple"
                type="button"
              >
                <i className="bi bi-apple me-2"></i>
                Apple
              </button>
            </div>
            
            <div className="text-center">
              <span className="text-muted small">o regístrate con tu email</span>
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
                required
              />
              <label htmlFor="password">
                <i className="bi bi-lock me-2"></i>
                Contraseña
              </label>
            </div>

            <div className="form-floating">
              <input
                id="confirmPassword"
                type="password"
                className="form-control"
                placeholder="Confirmar Contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <label htmlFor="confirmPassword">
                <i className="bi bi-shield-check me-2"></i>
                Confirmar Contraseña
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
                  Registrando...
                </>
              ) : (
                <>
                  <i className="bi bi-person-check me-2"></i>
                  Crear Cuenta
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p className="text-muted mb-0">
              ¿Ya tienes una cuenta?{" "}
              <Link to="/login" className="text-decoration-none fw-semibold">
                Inicia sesión aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;
// apps/web/src/pages/UserPreferences.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserPreferences, updateUserPreferences } from "@notesheet/api";
import { TRANSPOSING_INSTRUMENTS } from "@notesheet/core";
import { useThemeWithAuth } from "../hooks/useThemeWithAuth";
import LoadingSpinner from "../components/LoadingSpinner";

function UserPreferences() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  
  // Estado para las preferencias
  const [preferences, setPreferences] = useState({
    defaultInstrument: "bb_trumpet",
    defaultNotationSystem: "latin",
    defaultFontSize: 18,
    defaultTheme: "light"
  });
  
  const { currentUser } = useAuth();
  const { theme, changeTheme } = useThemeWithAuth();

  // Cargar preferencias al montar el componente
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);
        if (currentUser) {
          const userPreferences = await getUserPreferences(currentUser.uid);
          // Combinar con valores por defecto
          setPreferences({
            ...preferences,
            ...userPreferences
          });
        }
      } catch (error) {
        setError("Error al cargar preferencias: " + error.message);
        console.error("Error loading preferences:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [currentUser]);

  // Manejar cambios en los campos
  const handleChange = (field, value) => {
    setPreferences(prev => ({
      ...prev,
      [field]: value
    }));
    // Limpiar mensajes de éxito/error
    setSuccess(false);
    setError("");
  };

  // Guardar preferencias
  const handleSave = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError("");
      
      if (currentUser) {
        await updateUserPreferences(currentUser.uid, preferences);
        setSuccess(true);
        
        // Auto-hide success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (error) {
      setError("Error al guardar preferencias: " + error.message);
      console.error("Error saving preferences:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="preferences-container">
        <div className="container">
          <LoadingSpinner 
            text="Cargando preferencias..." 
            subtext="Configurando tu experiencia"
            type="default"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="preferences-container">
      <div className="container">
        {/* Header */}
        <div className="preferences-header fade-in">
          <h1 className="preferences-title">
            <i className="bi bi-gear"></i>
            Preferencias de Usuario
          </h1>
          <p className="preferences-subtitle">
            Personaliza tu experiencia en NoteSheet
          </p>
        </div>

        {/* Alert Messages */}
        <div className="preferences-alerts">
          {error && (
            <div className="alert alert-danger fade-in" role="alert">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              {error}
            </div>
          )}
          
          {success && (
            <div className="alert alert-success fade-in" role="alert">
              <i className="bi bi-check-circle-fill me-2"></i>
              Preferencias guardadas correctamente.
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="preferences-content fade-in-delay">
          <form onSubmit={handleSave}>
            <div className="preferences-grid">
              {/* Preferencias de Visualización */}
              <div className="preferences-card slide-up">
                <div className="preferences-card-header">
                  <i className="bi bi-eye me-2"></i>
                  Preferencias de Visualización
                </div>
                <div className="preferences-card-body">
                  <div className="form-group-modern mb-4">
                    <label htmlFor="defaultInstrument" className="form-label-modern">
                      <i className="bi bi-music-note-beamed me-2"></i>
                      Instrumento Predeterminado
                    </label>
                    <select
                      id="defaultInstrument"
                      className="form-control-modern"
                      value={preferences.defaultInstrument}
                      onChange={(e) => handleChange("defaultInstrument", e.target.value)}
                    >
                      {Object.entries(TRANSPOSING_INSTRUMENTS).map(([id, instrument]) => (
                        <option key={id} value={id}>
                          {instrument.name}
                        </option>
                      ))}
                    </select>
                    <div className="form-help-text">
                      Este instrumento se seleccionará por defecto al abrir una canción.
                    </div>
                  </div>
                  
                  <div className="form-group-modern mb-4">
                    <label htmlFor="defaultNotationSystem" className="form-label-modern">
                      <i className="bi bi-alphabet me-2"></i>
                      Sistema de Notación
                    </label>
                    <div className="notation-options">
                      <div className="notation-option">
                        <input
                          type="radio"
                          id="notation-latin"
                          name="defaultNotationSystem"
                          value="latin"
                          checked={preferences.defaultNotationSystem === "latin"}
                          onChange={(e) => handleChange("defaultNotationSystem", e.target.value)}
                          className="notation-radio"
                        />
                        <label htmlFor="notation-latin" className="notation-label">
                          <div className="notation-preview">DO-RE-MI</div>
                          <div className="notation-name">Notación Latina</div>
                        </label>
                      </div>
                      
                      <div className="notation-option">
                        <input
                          type="radio"
                          id="notation-english"
                          name="defaultNotationSystem"
                          value="english"
                          checked={preferences.defaultNotationSystem === "english"}
                          onChange={(e) => handleChange("defaultNotationSystem", e.target.value)}
                          className="notation-radio"
                        />
                        <label htmlFor="notation-english" className="notation-label">
                          <div className="notation-preview">C-D-E</div>
                          <div className="notation-name">Notación Anglosajona</div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group-modern mb-4">
                    <label htmlFor="defaultFontSize" className="form-label-modern">
                      <i className="bi bi-fonts me-2"></i>
                      Tamaño de Fuente: <span className="font-size-value">{preferences.defaultFontSize}px</span>
                    </label>
                    <div className="font-size-control">
                      <div className="font-size-preview" style={{ fontSize: `${preferences.defaultFontSize * 0.8}px` }}>
                        DO SOL LAm FA
                      </div>
                      <input
                        type="range"
                        className="font-size-slider"
                        id="defaultFontSize"
                        min="14"
                        max="24"
                        step="2"
                        value={preferences.defaultFontSize}
                        onChange={(e) => handleChange("defaultFontSize", parseInt(e.target.value))}
                      />
                      <div className="font-size-labels">
                        <span>14px</span>
                        <span>18px</span>
                        <span>24px</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Preferencias de Apariencia */}
              <div className="preferences-card slide-up-delay">
                <div className="preferences-card-header">
                  <i className="bi bi-palette me-2"></i>
                  Apariencia
                </div>
                <div className="preferences-card-body">
                  <div className="form-group-modern">
                    <label className="form-label-modern">
                      <i className="bi bi-moon-stars me-2"></i>
                      Tema de la Aplicación
                    </label>
                    <div className="theme-options">
                      <div className="theme-option">
                        <input
                          type="radio"
                          id="theme-light"
                          name="defaultTheme"
                          value="light"
                          checked={theme === "light"}
                          onChange={() => {
                            changeTheme("light");
                            handleChange("defaultTheme", "light");
                          }}
                          className="theme-radio"
                        />
                        <label htmlFor="theme-light" className="theme-label">
                          <div className="theme-preview light-theme">
                            <div className="theme-header"></div>
                            <div className="theme-content">
                              <div className="theme-card"></div>
                              <div className="theme-card"></div>
                            </div>
                          </div>
                          <div className="theme-name">
                            <i className="bi bi-sun-fill me-2"></i>
                            Claro
                          </div>
                        </label>
                      </div>
                      
                      <div className="theme-option">
                        <input
                          type="radio"
                          id="theme-dark"
                          name="defaultTheme"
                          value="dark"
                          checked={theme === "dark"}
                          onChange={() => {
                            changeTheme("dark");
                            handleChange("defaultTheme", "dark");
                          }}
                          className="theme-radio"
                        />
                        <label htmlFor="theme-dark" className="theme-label">
                          <div className="theme-preview dark-theme">
                            <div className="theme-header"></div>
                            <div className="theme-content">
                              <div className="theme-card"></div>
                              <div className="theme-card"></div>
                            </div>
                          </div>
                          <div className="theme-name">
                            <i className="bi bi-moon-fill me-2"></i>
                            Oscuro
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Save Button */}
            <div className="preferences-actions slide-up-delay-2">
              <button 
                type="submit" 
                className="btn-preferences-primary"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Guardando Preferencias...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Guardar Preferencias
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UserPreferences;
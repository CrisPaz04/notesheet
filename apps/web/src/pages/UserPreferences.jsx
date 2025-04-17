// apps/web/src/pages/UserPreferences.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserPreferences, updateUserPreferences } from "@notesheet/api";
import { TRANSPOSING_INSTRUMENTS } from "@notesheet/core";
import { useThemeWithAuth } from "../hooks/useThemeWithAuth";

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
      <div className="d-flex justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="h2 mb-4">Preferencias de Usuario</h1>
      
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success" role="alert">
          Preferencias guardadas correctamente.
        </div>
      )}
      
      <form onSubmit={handleSave}>
        <div className="card mb-4">
          <div className="card-header">Preferencias de Visualización</div>
          <div className="card-body">
            <div className="mb-3">
              <label htmlFor="defaultInstrument" className="form-label">Instrumento Predeterminado</label>
              <select
                id="defaultInstrument"
                className="form-select"
                value={preferences.defaultInstrument}
                onChange={(e) => handleChange("defaultInstrument", e.target.value)}
              >
                {Object.entries(TRANSPOSING_INSTRUMENTS).map(([id, instrument]) => (
                  <option key={id} value={id}>
                    {instrument.name}
                  </option>
                ))}
              </select>
              <div className="form-text">
                Este instrumento se seleccionará por defecto al abrir una canción.
              </div>
            </div>
            
            <div className="mb-3">
              <label htmlFor="defaultNotationSystem" className="form-label">Sistema de Notación</label>
              <select
                id="defaultNotationSystem"
                className="form-select"
                value={preferences.defaultNotationSystem}
                onChange={(e) => handleChange("defaultNotationSystem", e.target.value)}
              >
                <option value="latin">DO-RE-MI (Latina)</option>
                <option value="english">C-D-E (Anglosajona)</option>
              </select>
            </div>
            
            <div className="mb-3">
              <label htmlFor="defaultFontSize" className="form-label">
                Tamaño de Fuente: {preferences.defaultFontSize}px
              </label>
              <input
                type="range"
                className="form-range"
                id="defaultFontSize"
                min="14"
                max="24"
                step="2"
                value={preferences.defaultFontSize}
                onChange={(e) => handleChange("defaultFontSize", parseInt(e.target.value))}
              />
            </div>
            
            <div className="mb-3">
              <label className="form-label">Tema</label>
              <div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="defaultTheme"
                    id="themeLight"
                    value="light"
                    checked={theme === "light"}
                    onChange={() => {
                      changeTheme("light");
                      handleChange("defaultTheme", "light");
                    }}
                  />
                  <label className="form-check-label" htmlFor="themeLight">
                    Claro
                  </label>
                </div>
                <div className="form-check form-check-inline">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="defaultTheme"
                    id="themeDark"
                    value="dark"
                    checked={theme === "dark"}
                    onChange={() => {
                      changeTheme("dark");
                      handleChange("defaultTheme", "dark");
                    }}
                  />
                  <label className="form-check-label" htmlFor="themeDark">
                    Oscuro
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar Preferencias"}
        </button>
      </form>
    </div>
  );
}

export default UserPreferences;
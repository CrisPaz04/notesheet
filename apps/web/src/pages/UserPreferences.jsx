// apps/web/src/pages/UserPreferences.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getUserPreferences, updateUserPreferences } from "@notesheet/api";
import { TRANSPOSING_INSTRUMENTS } from "@notesheet/core";
import { useThemeWithAuth } from "../hooks/useThemeWithAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import PreferencesInstrumentSelector from "../components/PreferencesInstrumentSelector";

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
  const { theme, changeTheme, getThemesByCategory } = useThemeWithAuth();

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
            ...userPreferences,
            defaultTheme: theme // Usar el tema actual del hook
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
  }, [currentUser, theme]);

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

  // Manejar cambio de tema
  const handleThemeChange = async (newTheme) => {
    handleChange('defaultTheme', newTheme);
    await changeTheme(newTheme); // Cambiar tema inmediatamente
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

  const themesByCategory = getThemesByCategory();

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
                <PreferencesInstrumentSelector
                  value={preferences.defaultInstrument}
                  onChange={(value) => handleChange("defaultInstrument", value)}
                />
                <div className="form-help-text">
                  Este instrumento se seleccionará por defecto al abrir una canción.
                </div>
                  
                  <div className="form-group-modern mb-4">
                    <label className="form-label-modern">
                      <i className="bi bi-alphabet me-2"></i>
                      Sistema de Notación
                    </label>
                    <div className="notation-options">
                      <div className="notation-option">
                        <input
                          type="radio"
                          id="pref-notation-latin-only"
                          name="defaultNotationSystem"
                          value="latin"
                          checked={preferences.defaultNotationSystem === "latin"}
                          onChange={(e) => handleChange("defaultNotationSystem", e.target.value)}
                          className="notation-radio"
                        />
                        <label htmlFor="pref-notation-latin-only" className="notation-label">
                          <div className="notation-preview">DO-RE-MI</div>
                          <div className="notation-name">Notación Latina</div>
                        </label>
                      </div>
                      
                      <div className="notation-option">
                        <input
                          type="radio"
                          id="pref-notation-english-only"
                          name="defaultNotationSystem"
                          value="english"
                          checked={preferences.defaultNotationSystem === "english"}
                          onChange={(e) => handleChange("defaultNotationSystem", e.target.value)}
                          className="notation-radio"
                        />
                        <label htmlFor="pref-notation-english-only" className="notation-label">
                          <div className="notation-preview">C-D-E</div>
                          <div className="notation-name">Notación Anglosajona</div>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="form-group-modern mb-4">
                    <label htmlFor="pref-font-size-slider" className="form-label-modern">
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
                        id="pref-font-size-slider"
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
                  Temas de Apariencia
                </div>
                <div className="preferences-card-body">
                  <div className="form-group-modern">
                    <label className="form-label-modern">
                      <i className="bi bi-brush me-2"></i>
                      Seleccionar Tema
                    </label>
                    
                    {Object.entries(themesByCategory).map(([category, themes]) => (
                      <div key={category} className="theme-category">
                        <div className="theme-category-title">
                          {category === 'classic' && 'Temas Clásicos'}
                          {category === 'rainforest' && 'Temas de Bosque'}
                          {category === 'newspaper' && 'Temas de Periódico'}
                        </div>
                        
                        <div className="theme-options-grid">
                          {themes.map((themeInfo, themeIndex) => {
                            const uniqueId = `theme-selection-${category}-${themeIndex}-${themeInfo.id}`;
                            return (
                              <div key={themeInfo.id} className="theme-option-wrapper">
                                <input
                                  type="radio"
                                  id={uniqueId}
                                  name="defaultTheme"
                                  value={themeInfo.id}
                                  checked={preferences.defaultTheme === themeInfo.id}
                                  onChange={() => handleThemeChange(themeInfo.id)}
                                  className="theme-radio"
                                />
                                <label htmlFor={uniqueId} className="theme-label-new">
                                  <div className={`theme-preview-new ${themeInfo.id}`}>
                                    <div className="theme-preview-header"></div>
                                    <div className="theme-preview-content">
                                      <div className="theme-preview-sidebar"></div>
                                      <div className="theme-preview-main">
                                        <div className="theme-preview-card"></div>
                                        <div className="theme-preview-card"></div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="theme-info">
                                    <div className="theme-name">{themeInfo.name}</div>
                                    <div className="theme-description">{themeInfo.description}</div>
                                  </div>
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
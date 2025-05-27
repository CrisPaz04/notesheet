// apps/web/src/pages/SongView.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { getSongById } from "@notesheet/api";
import { 
  formatSong, 
  transposeContent, 
  convertNotationSystem, 
  detectNotationSystem,
  TRANSPOSING_INSTRUMENTS,
  transposeForInstrument,
  getVisualKeyForInstrument
} from "@notesheet/core";
import { useAuth } from "../context/AuthContext";
import { InstrumentSelector } from "../components/InstrumentSelector";
import { getUserPreferences, updateUserPreferences } from "@notesheet/api";
import LoadingSpinner from "../components/LoadingSpinner";

// Arrays de pares de tonalidades relativas
const RELATIVE_KEYS = [
  { major: "DO", minor: "LAm", english: { major: "C", minor: "Am" } },
  { major: "SOL", minor: "MIm", english: { major: "G", minor: "Em" } },
  { major: "RE", minor: "SIm", english: { major: "D", minor: "Bm" } },
  { major: "LA", minor: "FA#m", english: { major: "A", minor: "F#m" } },
  { major: "MI", minor: "DO#m", english: { major: "E", minor: "C#m" } },
  { major: "SI", minor: "SOL#m", english: { major: "B", minor: "G#m" } },
  { major: "FA#", minor: "RE#m", english: { major: "F#", minor: "D#m" } },
  { major: "DO#", minor: "LA#m", english: { major: "C#", minor: "A#m" } },
  { major: "FA", minor: "REm", english: { major: "F", minor: "Dm" } },
  { major: "SIb", minor: "SOLm", english: { major: "Bb", minor: "Gm" } },
  { major: "MIb", minor: "DOm", english: { major: "Eb", minor: "Cm" } },
  { major: "LAb", minor: "FAm", english: { major: "Ab", minor: "Fm" } },
  { major: "REb", minor: "SIbm", english: { major: "Db", minor: "Bbm" } },
  { major: "SOLb", minor: "MIbm", english: { major: "Gb", minor: "Ebm" } },
  { major: "DOb", minor: "LAbm", english: { major: "Cb", minor: "Abm" } }
];

function SongView() {
  const [song, setSong] = useState(null);
  const [formattedSong, setFormattedSong] = useState(null);
  const [formattedLyricsOnly, setFormattedLyricsOnly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Referencias a tonalidades
  const [baseKey, setBaseKey] = useState("");
  const [displayKey, setDisplayKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  
  const [originalContent, setOriginalContent] = useState("");
  const [fontSize, setFontSize] = useState(18);
  const [notationSystem, setNotationSystem] = useState("latin");
  const [currentInstrument, setCurrentInstrument] = useState("bb_trumpet");
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState({});
  
  // Estado para la vista dual
  const [activeView, setActiveView] = useState(0); // 0 = Acordes, 1 = Letra
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Estados para dropdowns
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showInstrumentDropdown, setShowInstrumentDropdown] = useState(false);
  const [showNotationDropdown, setShowNotationDropdown] = useState(false);

  // Referencias para posiciones de scroll
  const chordsScrollPosition = useRef(0);
  const lyricsScrollPosition = useRef(0);
  const chordsViewRef = useRef(null);
  const lyricsViewRef = useRef(null);
  
  const { id } = useParams();
  const { currentUser } = useAuth();

  // Función para extraer solo la letra de una canción
  const extractLyricsOnly = (formattedSongData) => {
    if (!formattedSongData || !formattedSongData.sections) return null;
    
    const lyricsOnlySections = formattedSongData.sections.map(section => {
      const newSection = { ...section };
      
      newSection.content = section.content
        .replace(/\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?(?:m)?\b/g, '')
        .replace(/\|\s*\|/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      
      return newSection;
    });
    
    return {
      ...formattedSongData,
      sections: lyricsOnlySections
    };
  };

  // Cargar canción y preferencias de usuario
  useEffect(() => {
    const loadSong = async () => {
      try {
        setLoading(true);
        
        // Cargar preferencias del usuario si está autenticado
        if (currentUser) {
          try {
            const prefs = await getUserPreferences(currentUser.uid);
            if (prefs.defaultInstrument) {
              setCurrentInstrument(prefs.defaultInstrument);
            }
            if (prefs.defaultNotationSystem) {
              setNotationSystem(prefs.defaultNotationSystem);
            }
            if (prefs.defaultFontSize) {
              setFontSize(prefs.defaultFontSize);
            }
          } catch (error) {
            console.error("Error loading user preferences:", error);
          }
        }
        
        // Cargar la canción
        const loadedSong = await getSongById(id);
        setSong(loadedSong);
        
        // Establecer tonalidad base
        const songKey = loadedSong.key || "DO";
        setBaseKey(songKey);
        setTargetKey(songKey);
        
        // Guardar lista de voces disponibles
        setAvailableVoices(loadedSong.voices || {});
        
        // Determinar qué contenido mostrar
        let contentToLoad;
        
        if (selectedVoice && 
            loadedSong.voices && 
            loadedSong.voices[currentInstrument] && 
            loadedSong.voices[currentInstrument][selectedVoice]) {
          contentToLoad = loadedSong.voices[currentInstrument][selectedVoice];
        } else {
          contentToLoad = loadedSong.content || "";
          if (selectedVoice) setSelectedVoice(null);
        }
        
        // Guardar el contenido original
        setOriginalContent(contentToLoad);
        
        // Detectar sistema de notación si no se especifica
        if (!currentUser || !notationSystem) {
          const detectedSystem = detectNotationSystem(contentToLoad);
          setNotationSystem(detectedSystem);
        }
        
        // Establecer tonalidad visual según el instrumento
        const visualKey = getVisualKeyForInstrument(songKey, currentInstrument);
        setDisplayKey(visualKey);
        
        // Preparar contenido para mostrar
        let contentToShow = contentToLoad;
        
        if (currentInstrument !== "bb_trumpet") {
          contentToShow = transposeForInstrument(
            contentToShow,
            "bb_trumpet", 
            currentInstrument
          );
        }
        
        if (notationSystem === "english") {
          contentToShow = convertNotationSystem(contentToShow, "english");
        }
        
        // Formatear para visualización
        const formatted = formatSong(contentToShow);
        setFormattedSong(formatted);
        
        // Crear versión de solo letras
        const lyricsOnly = extractLyricsOnly(formatted);
        setFormattedLyricsOnly(lyricsOnly);
      } catch (error) {
        setError("Error al cargar la canción: " + error.message);
        console.error("Error loading song:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadSong();
    }
  }, [id, currentUser, currentInstrument, selectedVoice]);

  // Eventos táctiles para el swipe
  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    if (activeView === 0 && chordsViewRef.current) {
      chordsScrollPosition.current = chordsViewRef.current.scrollTop;
    } else if (activeView === 1 && lyricsViewRef.current) {
      lyricsScrollPosition.current = lyricsViewRef.current.scrollTop;
    }
    
    const distance = touchStart - touchEnd;
    const isSwipeLeft = distance > 100;
    const isSwipeRight = distance < -100;
    
    if (isSwipeLeft && activeView === 0) {
      setActiveView(1);
    } else if (isSwipeRight && activeView === 1) {
      setActiveView(0);
    }
  };

  // Restaurar posición de scroll después de cambiar vista
  useEffect(() => {
    if (activeView === 0 && chordsViewRef.current) {
      setTimeout(() => {
        if (chordsViewRef.current) {
          chordsViewRef.current.scrollTop = chordsScrollPosition.current;
        }
      }, 10);
    } else if (activeView === 1 && lyricsViewRef.current) {
      setTimeout(() => {
        if (lyricsViewRef.current) {
          lyricsViewRef.current.scrollTop = lyricsScrollPosition.current;
        }
      }, 10);
    }
  }, [activeView]);

  // Función para transposición
  const handleTranspose = (newKey) => {
    if (newKey === targetKey || !song || !originalContent) return;
    
    try {
      setTargetKey(newKey);
      
      let transposedContent = transposeContent(originalContent, baseKey, newKey);
      
      if (currentInstrument !== "bb_trumpet") {
        transposedContent = transposeForInstrument(
          transposedContent,
          "bb_trumpet", 
          currentInstrument
        );
      }
      
      if (notationSystem === "english") {
        transposedContent = convertNotationSystem(transposedContent, "english");
      }
      
      const visualKey = getVisualKeyForInstrument(newKey, currentInstrument);
      setDisplayKey(visualKey);
      
      const formatted = formatSong(transposedContent);
      setFormattedSong(formatted);
      
      const lyricsOnly = extractLyricsOnly(formatted);
      setFormattedLyricsOnly(lyricsOnly);
      
      setShowKeyDropdown(false);
    } catch (error) {
      setError("Error al transponer: " + error.message);
      console.error("Error completo:", error);
    }
  };

  // Función para restaurar tonalidad original
  const resetTransposition = () => {
    if (targetKey !== baseKey) {
      handleTranspose(baseKey);
    }
  };

  // Función para cambiar sistema de notación
  const handleChangeNotation = (system) => {
    if (system === notationSystem || !song) return;
    
    try {
      setNotationSystem(system);
      setShowNotationDropdown(false);
      
      if (currentUser) {
        try {
          updateUserPreferences(currentUser.uid, {
            defaultNotationSystem: system
          });
        } catch (error) {
          console.error("Error saving notation preference:", error);
        }
      }
      
      let contentToProcess = originalContent;
      
      if (targetKey !== baseKey) {
        contentToProcess = transposeContent(contentToProcess, baseKey, targetKey);
      }
      
      if (currentInstrument !== "bb_trumpet") {
        contentToProcess = transposeForInstrument(
          contentToProcess,
          "bb_trumpet", 
          currentInstrument
        );
      }
      
      contentToProcess = convertNotationSystem(contentToProcess, system);
      
      const formatted = formatSong(contentToProcess);
      setFormattedSong(formatted);
      
      const lyricsOnly = extractLyricsOnly(formatted);
      setFormattedLyricsOnly(lyricsOnly);
    } catch (error) {
      setError("Error al cambiar sistema de notación: " + error.message);
      console.error("Error completo:", error);
    }
  };
  
  // Función para cambiar de instrumento
  const handleInstrumentChange = async (instrumentId) => {
    if (instrumentId === currentInstrument && !selectedVoice) return;
    
    try {
      setCurrentInstrument(instrumentId);
      setSelectedVoice(null);
      setShowInstrumentDropdown(false);
      
      if (currentUser) {
        try {
          await updateUserPreferences(currentUser.uid, {
            defaultInstrument: instrumentId
          });
        } catch (error) {
          console.error("Error saving instrument preference:", error);
        }
      }
      
      let contentToProcess = song.content;
      setOriginalContent(contentToProcess);
      
      if (targetKey !== baseKey) {
        contentToProcess = transposeContent(contentToProcess, baseKey, targetKey);
      }
      
      if (instrumentId !== "bb_trumpet") {
        contentToProcess = transposeForInstrument(
          contentToProcess,
          "bb_trumpet", 
          instrumentId
        );
      }
      
      if (notationSystem === "english") {
        contentToProcess = convertNotationSystem(contentToProcess, "english");
      }
      
      const visualKey = getVisualKeyForInstrument(targetKey, instrumentId);
      setDisplayKey(visualKey);
      
      const formatted = formatSong(contentToProcess);
      setFormattedSong(formatted);
      
      const lyricsOnly = extractLyricsOnly(formatted);
      setFormattedLyricsOnly(lyricsOnly);
    } catch (error) {
      setError("Error al cambiar de instrumento: " + error.message);
      console.error("Error completo:", error);
    }
  };

  // Funciones para ajustar tamaño de texto
  const increaseFontSize = () => {
    if (fontSize < 24) {
      const newSize = fontSize + 2;
      setFontSize(newSize);
      
      if (currentUser) {
        try {
          updateUserPreferences(currentUser.uid, {
            defaultFontSize: newSize
          });
        } catch (error) {
          console.error("Error saving font size preference:", error);
        }
      }
    }
  };

  const decreaseFontSize = () => {
    if (fontSize > 14) {
      const newSize = fontSize - 2;
      setFontSize(newSize);
      
      if (currentUser) {
        try {
          updateUserPreferences(currentUser.uid, {
            defaultFontSize: newSize
          });
        } catch (error) {
          console.error("Error saving font size preference:", error);
        }
      }
    }
  };

  const resetFontSize = () => {
    const defaultSize = 18;
    setFontSize(defaultSize);
    
    if (currentUser) {
      try {
        updateUserPreferences(currentUser.uid, {
          defaultFontSize: defaultSize
        });
      } catch (error) {
        console.error("Error saving font size preference:", error);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="song-view-container">
        <div className="container">
          <LoadingSpinner 
            text="Cargando canción..." 
            subtext="Preparando la vista musical"
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="song-view-container">
        <div className="container">
          <div className="alert alert-danger fade-in" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!song) {
    return (
      <div className="song-view-container">
        <div className="container">
          <div className="text-center fade-in">
            <h2 className="text-white mb-4">Canción no encontrada</h2>
            <Link to="/dashboard" className="btn-song-primary">
              <i className="bi bi-arrow-left me-2"></i>
              Volver al Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="song-view-container">
      <div className="container">
        {/* Header de la canción */}
        <div className="song-header fade-in">
          <h1 className="song-title-main">{song.title || "Sin título"}</h1>
          
          <div className="song-meta-grid">
            <div className="song-meta-item">
              <div className="song-meta-label">
                <i className="bi bi-music-note me-1"></i>
                Instrumento
              </div>
              <div className="song-meta-value">
                {TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || "Trompeta en Sib"}
                {selectedVoice && ` ${selectedVoice}`}
              </div>
            </div>
            
            <div className="song-meta-item">
              <div className="song-meta-label">
                <i className="bi bi-key me-1"></i>
                Tonalidad
              </div>
              <div className="song-meta-value">{displayKey}</div>
            </div>
            
            <div className="song-meta-item">
              <div className="song-meta-label">
                <i className="bi bi-heart me-1"></i>
                Tipo
              </div>
              <div className="song-meta-value">{song.type || "No especificado"}</div>
            </div>
            
            {song.version && (
              <div className="song-meta-item">
                <div className="song-meta-label">
                  <i className="bi bi-person me-1"></i>
                  Versión de
                </div>
                <div className="song-meta-value">{song.version}</div>
              </div>
            )}
          </div>
        </div>

        {/* Barra de controles */}
        <div className="controls-toolbar fade-in-delay no-print">
          <div className="controls-row">
            <div className="controls-group">
              {/* Selector de Instrumento */}
              <div className="control-dropdown">
                <button
                  className={`dropdown-button ${showInstrumentDropdown ? 'active' : ''}`}
                  onClick={() => {
                    setShowInstrumentDropdown(!showInstrumentDropdown);
                    setShowKeyDropdown(false);
                    setShowNotationDropdown(false);
                  }}
                >
                  <i className="bi bi-music-note-beamed"></i>
                  <span>{TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || "Trompeta"}</span>
                  <i className={`bi bi-chevron-${showInstrumentDropdown ? 'up' : 'down'}`}></i>
                </button>
                
                {showInstrumentDropdown && (
                  <div className="dropdown-menu-custom">
                    {Object.entries(TRANSPOSING_INSTRUMENTS).map(([id, instrument]) => (
                      <div
                        key={id}
                        className={`dropdown-item-custom ${currentInstrument === id ? 'active' : ''}`}
                        onClick={() => handleInstrumentChange(id)}
                      >
                        {instrument.name}
                        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                          {instrument.description}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Selector de Tonalidad */}
              <div className="control-dropdown">
                <button
                  className={`dropdown-button ${showKeyDropdown ? 'active' : ''}`}
                  onClick={() => {
                    setShowKeyDropdown(!showKeyDropdown);
                    setShowInstrumentDropdown(false);
                    setShowNotationDropdown(false);
                  }}
                >
                  <i className="bi bi-key"></i>
                  <span>Tonalidad: {displayKey}</span>
                  <i className={`bi bi-chevron-${showKeyDropdown ? 'up' : 'down'}`}></i>
                </button>
                
                {showKeyDropdown && (
                  <div className="dropdown-menu-custom">
                    <div className="dropdown-item-custom" onClick={resetTransposition}>
                      <strong>Original ({getVisualKeyForInstrument(baseKey, currentInstrument)})</strong>
                    </div>
                    <hr style={{ margin: '0.5rem 0', border: 'none', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
                    {RELATIVE_KEYS.map((pair, index) => {
                      const majorVisualKey = getVisualKeyForInstrument(pair.major, currentInstrument);
                      const minorVisualKey = getVisualKeyForInstrument(pair.minor, currentInstrument);
                      
                      return (
                        <div key={index}>
                          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.25rem 0.5rem' }}>
                            <div
                              className={`dropdown-item-custom ${displayKey === majorVisualKey ? 'active' : ''}`}
                              onClick={() => handleTranspose(pair.major)}
                              style={{ flex: 1, margin: 0, padding: '0.5rem' }}
                            >
                              {majorVisualKey}
                              {pair.major === baseKey && " (Original)"}
                            </div>
                            <div
                              className={`dropdown-item-custom ${displayKey === minorVisualKey ? 'active' : ''}`}
                              onClick={() => handleTranspose(pair.minor)}
                              style={{ flex: 1, margin: 0, padding: '0.5rem' }}
                            >
                              {minorVisualKey}
                              {pair.minor === baseKey && " (Original)"}
                            </div>
                          </div>
                          {index < RELATIVE_KEYS.length - 1 && (
                            <hr style={{ margin: '0.25rem 0', border: 'none', height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selector de Notación */}
              <div className="control-dropdown">
                <button
                  className={`dropdown-button ${showNotationDropdown ? 'active' : ''}`}
                  onClick={() => {
                    setShowNotationDropdown(!showNotationDropdown);
                    setShowInstrumentDropdown(false);
                    setShowKeyDropdown(false);
                  }}
                >
                  <i className="bi bi-alphabet"></i>
                  <span>{notationSystem === "latin" ? "DO-RE-MI" : "C-D-E"}</span>
                  <i className={`bi bi-chevron-${showNotationDropdown ? 'up' : 'down'}`}></i>
                </button>
                
                {showNotationDropdown && (
                  <div className="dropdown-menu-custom">
                    <div
                      className={`dropdown-item-custom ${notationSystem === 'latin' ? 'active' : ''}`}
                      onClick={() => handleChangeNotation("latin")}
                    >
                      DO-RE-MI (Latina)
                    </div>
                    <div
                      className={`dropdown-item-custom ${notationSystem === 'english' ? 'active' : ''}`}
                      onClick={() => handleChangeNotation("english")}
                    >
                      C-D-E (Anglosajona)
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="controls-group">
              {/* Controles de fuente */}
              <div className="font-controls">
                <button
                  className="font-control-btn"
                  onClick={decreaseFontSize}
                  title="Disminuir tamaño"
                >
                  A-
                </button>
                <button
                  className="font-control-btn"
                  onClick={resetFontSize}
                  title="Tamaño normal"
                >
                  A
                </button>
                <button
                  className="font-control-btn"
                  onClick={increaseFontSize}
                  title="Aumentar tamaño"
                >
                  A+
                </button>
              </div>
              
              {/* Toggle de vista */}
              <div className="view-toggle-controls">
                <button
                  className={`view-toggle-btn-song ${activeView === 0 ? 'active' : ''}`}
                  onClick={() => setActiveView(0)}
                >
                  <i className="bi bi-music-note-list"></i>
                  Acordes
                </button>
                <button
                  className={`view-toggle-btn-song ${activeView === 1 ? 'active' : ''}`}
                  onClick={() => setActiveView(1)}
                >
                  <i className="bi bi-card-text"></i>
                  Letra
                </button>
              </div>
              
              {/* Botones de acción */}
              <div className="action-buttons-song">
                <button
                  className="btn-song-action"
                  onClick={handlePrint}
                  title="Imprimir"
                >
                  <i className="bi bi-printer"></i>
                  Imprimir
                </button>
                
                {currentUser && currentUser.uid === song.userId && (
                  <Link 
                    to={`/songs/${id}/edit`} 
                    className="btn-song-action btn-song-primary"
                  >
                    <i className="bi bi-pencil"></i>
                    Editar
                  </Link>
                )}
                
                <Link 
                  to="/dashboard" 
                  className="btn-song-action"
                >
                  <i className="bi bi-arrow-left"></i>
                  Volver
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Contenido de la canción */}
        <div className="song-content slide-up">
          {/* Indicador de vista */}
          <div className="view-indicator no-print">
            <div className="view-dots">
              <button 
                onClick={() => setActiveView(0)} 
                className={`view-dot ${activeView === 0 ? 'active' : ''}`}
              />
              <button 
                onClick={() => setActiveView(1)} 
                className={`view-dot ${activeView === 1 ? 'active' : ''}`}
              />
            </div>
            <div className="view-hint">
              {activeView === 0 ? 'Deslizar para ver solo letra →' : '← Deslizar para ver acordes'}
            </div>
          </div>

          {/* Contenedor de vistas con swipe */}
          <div 
            className="song-sections-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div 
              className="song-sections"
              style={{ 
                transform: `translateX(-${activeView * 50}%)`,
              }}
            >
              {/* Vista de acordes */}
              <div 
                ref={chordsViewRef}
                className="song-view"
                style={{ fontSize: `${fontSize}px` }}
              >
                {formattedSong && formattedSong.sections.map((section, index) => (
                  <div key={index} className="song-section-modern">
                    <h3 className="song-section-title">{section.title}</h3>
                    <div className="song-section-content">
                      {section.content}
                    </div>
                  </div>
                ))}
                
                {(!formattedSong || formattedSong.sections.length === 0) && (
                  <div className="text-center" style={{ color: 'rgba(255, 255, 255, 0.6)', padding: '3rem' }}>
                    <i className="bi bi-music-note-list" style={{ fontSize: '3rem', marginBottom: '1rem' }}></i>
                    <p>No hay contenido disponible para esta canción.</p>
                  </div>
                )}
              </div>
              
              {/* Vista de solo letras */}
              <div 
                ref={lyricsViewRef}
                className="song-view"
                style={{ fontSize: `${fontSize}px` }}
              >
                {formattedLyricsOnly && formattedLyricsOnly.sections.map((section, index) => (
                  <div key={index} className="song-section-modern">
                    <h3 className="song-section-title">{section.title}</h3>
                    <div className="song-section-content">
                      {section.content}
                    </div>
                  </div>
                ))}
                
                {(!formattedLyricsOnly || formattedLyricsOnly.sections.length === 0) && (
                  <div className="text-center" style={{ color: 'rgba(255, 255, 255, 0.6)', padding: '3rem' }}>
                    <i className="bi bi-card-text" style={{ fontSize: '3rem', marginBottom: '1rem' }}></i>
                   <p>No hay contenido de letra disponible para esta canción.</p>
                 </div>
               )}
             </div>
           </div>
         </div>
       </div>
     </div>
   </div>
 );
}

export default SongView;
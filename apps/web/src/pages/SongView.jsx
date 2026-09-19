// apps/web/src/pages/SongView.jsx
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSongById, getUserPreferences, updateUserPreferences } from "@notesheet/api";
import {
  detectNotationSystem,
  getVisualKeyForInstrument,
  renderSongContent,
  buildVoicesList,
  parseVoiceKey,
  resolveInitialVoice,
  SOURCE_INSTRUMENT,
  TRANSPOSING_INSTRUMENTS
} from "@notesheet/core";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import Modal from "../components/Modal";
import Metronome from "./Metronome";
import Tuner from "./Tuner";
import useModal from "../hooks/useModal";
import useSwipeViews from "../hooks/useSwipeViews";
import useFontSizePreference from "../hooks/useFontSizePreference";

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
  // --- Canción y estado de carga ---
  const [song, setSong] = useState(null);
  const [formattedSong, setFormattedSong] = useState(null);
  const [formattedLyricsOnly, setFormattedLyricsOnly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Tonalidades ---
  const [baseKey, setBaseKey] = useState("");       // tonalidad escrita
  const [displayKey, setDisplayKey] = useState(""); // la que ve el instrumentista
  const [targetKey, setTargetKey] = useState("");   // a la que se transpone

  // --- Contenido y presentación ---
  const [originalContent, setOriginalContent] = useState("");
  const [notationSystem, setNotationSystem] = useState("latin");
  const [currentInstrument, setCurrentInstrument] = useState(SOURCE_INSTRUMENT);
  const [selectedVoiceKey, setSelectedVoiceKey] = useState(null); // ej. "bb_trumpet-1"
  const [availableVoicesList, setAvailableVoicesList] = useState([]);

  // --- Dropdowns ---
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showInstrumentDropdown, setShowInstrumentDropdown] = useState(false);
  const [showNotationDropdown, setShowNotationDropdown] = useState(false);

  const metronomeModal = useModal();
  const tunerModal = useModal();

  const { id } = useParams();
  const { currentUser, canEditSongs } = useAuth();

  const {
    fontSize,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize
  } = useFontSizePreference(currentUser);

  const {
    activeView,
    goToView: setActiveView,
    viewRefs,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useSwipeViews(2);
  const [chordsViewRef, lyricsViewRef] = viewRefs;

  /**
   * Ejecuta el pipeline de renderizado y vuelca el resultado en el estado.
   * Los `overrides` hacen falta porque setState es asincrono: cuando un
   * handler acaba de cambiar la tonalidad o el instrumento, el valor nuevo
   * todavia no esta en el estado de este render.
   */
  const applyRender = (content, overrides = {}) => {
    const rendered = renderSongContent(content, {
      baseKey,
      targetKey,
      instrument: currentInstrument,
      notationSystem,
      ...overrides
    });

    setFormattedSong(rendered.formatted);
    setFormattedLyricsOnly(rendered.lyricsOnly);
    setDisplayKey(rendered.displayKey);
  };

  // Cargar canción y preferencias de usuario.
  useEffect(() => {
    if (!id) return;

    const loadSong = async () => {
      try {
        setLoading(true);

        // Las preferencias mandan sobre los valores por defecto, pero el
        // estado todavía no las refleja en este render: las arrastramos en
        // variables locales para pasárselas al pipeline.
        let instrument = currentInstrument;
        let notation = notationSystem;

        if (currentUser) {
          try {
            const prefs = await getUserPreferences(currentUser.uid);
            if (prefs.defaultInstrument) {
              instrument = prefs.defaultInstrument;
              setCurrentInstrument(instrument);
            }
            if (prefs.defaultNotationSystem) {
              notation = prefs.defaultNotationSystem;
              setNotationSystem(notation);
            }
            if (prefs.defaultFontSize) {
              setFontSize(prefs.defaultFontSize);
            }
          } catch (prefsError) {
            console.error("Error loading user preferences:", prefsError);
          }
        }

        const loadedSong = await getSongById(id);
        setSong(loadedSong);

        const songKey = loadedSong.key || "DO";
        setBaseKey(songKey);
        setTargetKey(songKey);

        setAvailableVoicesList(buildVoicesList(loadedSong.voices, TRANSPOSING_INSTRUMENTS));

        const { content, voiceKey } = resolveInitialVoice(loadedSong, selectedVoiceKey);
        setSelectedVoiceKey(voiceKey);
        setOriginalContent(content);

        // Sin usuario no hay preferencia guardada: deducir el sistema
        if (!currentUser) {
          notation = detectNotationSystem(content);
          setNotationSystem(notation);
        }

        applyRender(content, {
          baseKey: songKey,
          targetKey: songKey,
          instrument,
          notationSystem: notation
        });
      } catch (loadError) {
        setError("Error al cargar la canción: " + loadError.message);
        console.error("Error loading song:", loadError);
      } finally {
        setLoading(false);
      }
    };

    loadSong();
    // applyRender y los setters se recrean en cada render, y selectedVoiceKey
    // lo gestiona handleVoiceChange: incluirlos relanzaría la carga en bucle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentUser, currentInstrument]);

  // Transponer a otra tonalidad
  const handleTranspose = (newKey) => {
    if (newKey === targetKey || !song || !originalContent) return;

    try {
      setTargetKey(newKey);
      setShowKeyDropdown(false);
      applyRender(originalContent, { targetKey: newKey });
    } catch (transposeError) {
      setError("Error al transponer: " + transposeError.message);
      console.error("Error completo:", transposeError);
    }
  };

  const resetTransposition = () => {
    if (targetKey !== baseKey) handleTranspose(baseKey);
  };

  // Cambiar entre notación latina y anglosajona
  const handleChangeNotation = (system) => {
    if (system === notationSystem || !song) return;

    try {
      setNotationSystem(system);
      setShowNotationDropdown(false);

      if (currentUser) {
        updateUserPreferences(currentUser.uid, { defaultNotationSystem: system })
          .catch((prefError) => console.error("Error saving notation preference:", prefError));
      }

      applyRender(originalContent, { notationSystem: system });
    } catch (notationError) {
      setError("Error al cambiar sistema de notación: " + notationError.message);
      console.error("Error completo:", notationError);
    }
  };

  // Cambiar de voz (qué parte se está leyendo)
  const handleVoiceChange = (voiceKey) => {
    setShowVoiceDropdown(false);
    if (voiceKey === selectedVoiceKey) return;

    try {
      const parsed = parseVoiceKey(voiceKey);
      const content = parsed && song.voices?.[parsed.instrumentId]?.[parsed.voiceNumber];

      if (!content) {
        setError("Voz no encontrada");
        return;
      }

      setSelectedVoiceKey(voiceKey);
      setOriginalContent(content);
      applyRender(content);
    } catch (voiceError) {
      setError("Error al cambiar de voz: " + voiceError.message);
      console.error("Error completo:", voiceError);
    }
  };

  // Cambiar de instrumento (transposición de lectura)
  const handleInstrumentChange = (instrumentId) => {
    if (instrumentId === currentInstrument) return;

    try {
      setCurrentInstrument(instrumentId);
      setShowInstrumentDropdown(false);

      if (currentUser) {
        updateUserPreferences(currentUser.uid, { defaultInstrument: instrumentId })
          .catch((prefError) => console.error("Error saving instrument preference:", prefError));
      }

      applyRender(originalContent, { instrument: instrumentId });
    } catch (instrumentError) {
      setError("Error al cambiar de instrumento: " + instrumentError.message);
      console.error("Error completo:", instrumentError);
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
                Voz
              </div>
              <div className="song-meta-value">
                {selectedVoiceKey
                  ? availableVoicesList.find(v => v.id === selectedVoiceKey)?.label || "—"
                  : "—"}
              </div>
            </div>

            <div className="song-meta-item">
              <div className="song-meta-label">
                <i className="bi bi-arrow-left-right me-1"></i>
                Transpuesto a
              </div>
              <div className="song-meta-value">
                {TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || "Trompeta en Sib"}
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
              {/* Selector de Voz (partes disponibles en la canción) */}
              {availableVoicesList.length > 0 && (
                <div className="control-dropdown">
                  <button
                    className={`dropdown-button ${showVoiceDropdown ? 'active' : ''}`}
                    onClick={() => {
                      setShowVoiceDropdown(!showVoiceDropdown);
                      setShowInstrumentDropdown(false);
                      setShowKeyDropdown(false);
                      setShowNotationDropdown(false);
                    }}
                  >
                    <i className="bi bi-music-note-list"></i>
                    <span>
                      {selectedVoiceKey
                        ? availableVoicesList.find(v => v.id === selectedVoiceKey)?.label || "Voz"
                        : "Seleccionar Voz"}
                    </span>
                    <i className={`bi bi-chevron-${showVoiceDropdown ? 'up' : 'down'}`}></i>
                  </button>

                  {showVoiceDropdown && (
                    <div className="dropdown-menu-custom">
                      {availableVoicesList.map((voice) => (
                        <div
                          key={voice.id}
                          className={`dropdown-item-custom ${selectedVoiceKey === voice.id ? 'active' : ''}`}
                          onClick={() => handleVoiceChange(voice.id)}
                        >
                          {voice.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Selector de Instrumento (Transponer a) */}
              <div className="control-dropdown">
                <button
                  className={`dropdown-button ${showInstrumentDropdown ? 'active' : ''}`}
                  onClick={() => {
                    setShowInstrumentDropdown(!showInstrumentDropdown);
                    setShowVoiceDropdown(false);
                    setShowKeyDropdown(false);
                    setShowNotationDropdown(false);
                  }}
                >
                  <i className="bi bi-music-note-beamed"></i>
                  <span>Transponer: {TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || "Trompeta"}</span>
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
                    setShowVoiceDropdown(false);
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
                    setShowVoiceDropdown(false);
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
                  onClick={metronomeModal.open}
                  title="Metrónomo"
                >
                  <i className="bi bi-hourglass-split"></i>
                  Metrónomo
                </button>

                <button
                  className="btn-song-action"
                  onClick={tunerModal.open}
                  title="Afinador"
                >
                  <i className="bi bi-soundwave"></i>
                  Afinador
                </button>

                <button
                  className="btn-song-action"
                  onClick={handlePrint}
                  title="Imprimir"
                >
                  <i className="bi bi-printer"></i>
                  Imprimir
                </button>

                {canEditSongs() && song.userId === currentUser?.uid && (
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
                style={{ fontSize: `${fontSize}px !important` }}
              > 
                {formattedSong && formattedSong.sections.map((section, index) => (
                  <div key={index} className="song-section-modern">
                    <h3 className="song-section-title">{section.title}</h3>
                    <div className="song-section-content" style={{ fontSize: `${fontSize}px` }}>
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
                style={{ fontSize: `${fontSize}px !important` }}
              >
                {formattedLyricsOnly && formattedLyricsOnly.sections.map((section, index) => (
                  <div key={index} className="song-section-modern">
                    <h3 className="song-section-title">{section.title}</h3>
                    <div className="song-section-content" style={{ fontSize: `${fontSize}px` }}>
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

     {/* Metronome Modal */}
     <Modal
       isOpen={metronomeModal.isOpen}
       onClose={metronomeModal.close}
       title="Metrónomo"
       size="large"
     >
       <Metronome compact={true} />
     </Modal>

     {/* Tuner Modal */}
     <Modal
       isOpen={tunerModal.isOpen}
       onClose={tunerModal.close}
       title="Afinador"
       size="large"
     >
       <Tuner compact={true} />
     </Modal>
   </div>
 );
}

export default SongView;

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

// Arrays de pares de tonalidades relativas (mayor y menor)
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

// Versión simplificada para tonalidades
const MAJOR_KEYS = RELATIVE_KEYS.map(pair => pair.major);
const MINOR_KEYS = RELATIVE_KEYS.map(pair => pair.minor);
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

function SongView() {
  const [song, setSong] = useState(null);
  const [formattedSong, setFormattedSong] = useState(null);
  const [formattedLyricsOnly, setFormattedLyricsOnly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Referencias a tonalidades
  const [baseKey, setBaseKey] = useState(""); // Tonalidad base para trompeta
  const [displayKey, setDisplayKey] = useState(""); // Tonalidad visual para el instrumento actual
  const [targetKey, setTargetKey] = useState(""); // Tonalidad objetivo tras transposición
  
  const [originalContent, setOriginalContent] = useState(""); // Contenido original para transposiciones exactas
  const [fontSize, setFontSize] = useState(18); // Tamaño base de fuente
  const [notationSystem, setNotationSystem] = useState("latin"); // latin (DO-RE-MI) o english (C-D-E)
  const [currentInstrument, setCurrentInstrument] = useState("bb_trumpet"); // Por defecto, trompeta en Sib
  const [selectedVoice, setSelectedVoice] = useState(null); // Voz seleccionada (null = versión principal)
  const [availableVoices, setAvailableVoices] = useState({}); // Voces disponibles por instrumento
  
  // Estado para la vista dual
  const [activeView, setActiveView] = useState(0); // 0 = Acordes, 1 = Letra
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Referencias para posiciones de scroll
  const chordsScrollPosition = useRef(0);
  const lyricsScrollPosition = useRef(0);
  const chordsViewRef = useRef(null);
  const lyricsViewRef = useRef(null);
  
  const { id } = useParams();
  const { currentUser } = useAuth();

  // Función para extraer solo la letra de una canción (sin acordes)
  const extractLyricsOnly = (formattedSongData) => {
    if (!formattedSongData || !formattedSongData.sections) return null;
    
    // Crear una copia profunda para no modificar el original
    const lyricsOnlySections = formattedSongData.sections.map(section => {
      // Crear un objeto nuevo para cada sección
      const newSection = { ...section };
      
      // Eliminar los acordes de las líneas (todo lo que está entre DO y FA#, etc.)
      // Esta regex busca palabras que sean acordes y los elimina, manteniendo el texto
      newSection.content = section.content
        .replace(/\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?(?:m)?\b/g, '')
        .replace(/\|\s*\|/g, '') // Eliminar barras dobles vacías
        .replace(/\s{2,}/g, ' ') // Reemplazar múltiples espacios por uno solo
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
        
        // Si hay un usuario autenticado, cargar sus preferencias
        if (currentUser) {
          try {
            const prefs = await getUserPreferences(currentUser.uid);
            // Aplicar preferencias del usuario
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
        
        // Establecer tonalidad base (la que se ve para trompeta)
        const songKey = loadedSong.key || "DO";
        setBaseKey(songKey);
        setTargetKey(songKey);
        
        // Guardar lista de voces disponibles
        setAvailableVoices(loadedSong.voices || {});
        
        // Determinar qué contenido mostrar (principal o voz específica)
        let contentToLoad;
        
        // Comprobar si tenemos una voz específica para este instrumento
        if (selectedVoice && 
            loadedSong.voices && 
            loadedSong.voices[currentInstrument] && 
            loadedSong.voices[currentInstrument][selectedVoice]) {
          // Usar el contenido de la voz específica
          contentToLoad = loadedSong.voices[currentInstrument][selectedVoice];
        } else {
          // Usar el contenido principal
          contentToLoad = loadedSong.content || "";
          // Resetear la voz seleccionada si no está disponible
          if (selectedVoice) setSelectedVoice(null);
        }
        
        // Guardar el contenido original para futuras transposiciones
        setOriginalContent(contentToLoad);
        
        // Detectar el sistema de notación automáticamente si no se especifica en preferencias
        if (!currentUser || !notationSystem) {
          const detectedSystem = detectNotationSystem(contentToLoad);
          setNotationSystem(detectedSystem);
        }
        
        // Establecer la tonalidad visual según el instrumento seleccionado
        const visualKey = getVisualKeyForInstrument(songKey, currentInstrument);
        setDisplayKey(visualKey);
        
        // Preparar el contenido para mostrar según el instrumento
        let contentToShow = contentToLoad;
        
        // Si el instrumento no es trompeta, aplicar transposición
        if (currentInstrument !== "bb_trumpet") {
          contentToShow = transposeForInstrument(
            contentToShow,
            "bb_trumpet", 
            currentInstrument
          );
        }
        
        // Aplicar sistema de notación si es necesario
        if (notationSystem === "english") {
          contentToShow = convertNotationSystem(contentToShow, "english");
        }
        
        // Formatear para visualización
        const formatted = formatSong(contentToShow);
        setFormattedSong(formatted);
        
        // Crear la versión de solo letras
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
    
    // Guardar posición de scroll actual antes de cambiar vista
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

  // Función para transposición a una nueva tonalidad
  const handleTranspose = (newKey) => {
    if (newKey === targetKey || !song || !originalContent) return;
    
    try {
      // Establecer nueva tonalidad objetivo
      setTargetKey(newKey);
      
      // Calcular la transposición desde la tonalidad base (trompeta) a la nueva tonalidad
      let transposedContent = transposeContent(originalContent, baseKey, newKey);
      
      // Si el instrumento actual no es trompeta, aplicar transposición adicional
      if (currentInstrument !== "bb_trumpet") {
        transposedContent = transposeForInstrument(
          transposedContent,
          "bb_trumpet", 
          currentInstrument
        );
      }
      
      // Aplicar sistema de notación si es necesario
      if (notationSystem === "english") {
        transposedContent = convertNotationSystem(transposedContent, "english");
      }
      
      // Actualizar tonalidad visual para el instrumento actual
      const visualKey = getVisualKeyForInstrument(newKey, currentInstrument);
      setDisplayKey(visualKey);
      
      // Formatear y mostrar
      const formatted = formatSong(transposedContent);
      setFormattedSong(formatted);
      
      // Actualizar versión de solo letras
      const lyricsOnly = extractLyricsOnly(formatted);
      setFormattedLyricsOnly(lyricsOnly);
      
      console.log("Transposición aplicada:", {
        desdeKey: baseKey,
        hastaKey: newKey,
        instrumento: currentInstrument,
        tonalidad_visual: visualKey
      });
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
      
      // Guardar preferencia si el usuario está autenticado
      if (currentUser) {
        try {
          updateUserPreferences(currentUser.uid, {
            defaultNotationSystem: system
          });
        } catch (error) {
          console.error("Error saving notation preference:", error);
        }
      }
      
      // Empezamos desde el contenido original
      let contentToProcess = originalContent;
      
      // Si estamos en una tonalidad diferente a la base, primero transponemos
      if (targetKey !== baseKey) {
        contentToProcess = transposeContent(contentToProcess, baseKey, targetKey);
      }
      
      // Aplicar transposición de instrumento si necesario
      if (currentInstrument !== "bb_trumpet") {
        contentToProcess = transposeForInstrument(
          contentToProcess,
          "bb_trumpet", 
          currentInstrument
        );
      }
      
      // Convertir sistema de notación
      contentToProcess = convertNotationSystem(contentToProcess, system);
      
      // Formatear y mostrar
      const formatted = formatSong(contentToProcess);
      setFormattedSong(formatted);
      
      // Actualizar versión de solo letras
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
      // Actualizar el instrumento actual
      setCurrentInstrument(instrumentId);
      setSelectedVoice(null); // Resetear la voz al cambiar de instrumento
      
      // Guardar preferencia de usuario
      if (currentUser) {
        try {
          await updateUserPreferences(currentUser.uid, {
            defaultInstrument: instrumentId
          });
        } catch (error) {
          console.error("Error saving instrument preference:", error);
        }
      }
      
      // Determinar qué contenido mostrar (principal o voz específica)
      let contentToProcess;
      
      // Usar siempre el contenido principal al cambiar de instrumento
      contentToProcess = song.content;
      setOriginalContent(contentToProcess);
      
      // Si estamos en una tonalidad diferente a la base, primero transponemos
      if (targetKey !== baseKey) {
        contentToProcess = transposeContent(contentToProcess, baseKey, targetKey);
      }
      
      // Aplicar transposición para el nuevo instrumento
      if (instrumentId !== "bb_trumpet") {
        contentToProcess = transposeForInstrument(
          contentToProcess,
          "bb_trumpet", 
          instrumentId
        );
      }
      
      // Aplicar sistema de notación si necesario
      if (notationSystem === "english") {
        contentToProcess = convertNotationSystem(contentToProcess, "english");
      }
      
      // Actualizar tonalidad visual para el nuevo instrumento
      const visualKey = getVisualKeyForInstrument(targetKey, instrumentId);
      setDisplayKey(visualKey);
      
      // Formatear y mostrar
      const formatted = formatSong(contentToProcess);
      setFormattedSong(formatted);
      
      // Actualizar versión de solo letras
      const lyricsOnly = extractLyricsOnly(formatted);
      setFormattedLyricsOnly(lyricsOnly);
      
      console.log("Cambio de instrumento:", {
        instrumento: TRANSPOSING_INSTRUMENTS[instrumentId].name,
        transposicion: TRANSPOSING_INSTRUMENTS[instrumentId].transposition,
        tonalidad_base: targetKey,
        tonalidad_visual: visualKey
      });
    } catch (error) {
      setError("Error al cambiar de instrumento: " + error.message);
      console.error("Error completo:", error);
    }
  };
  
  // Función para cambiar de voz
  const handleVoiceChange = async (voiceNumber) => {
    if (voiceNumber === selectedVoice) return;
    
    try {
      setSelectedVoice(voiceNumber);
      
      // Determinar qué contenido mostrar
      let contentToProcess;
      
      if (voiceNumber && 
          song.voices && 
          song.voices[currentInstrument] && 
          song.voices[currentInstrument][voiceNumber]) {
        // Usar el contenido de la voz específica
        contentToProcess = song.voices[currentInstrument][voiceNumber];
      } else {
        // Usar el contenido principal
        contentToProcess = song.content;
      }
      
      // Guardar este contenido como original para futuras transposiciones
      setOriginalContent(contentToProcess);
      
      // Si estamos en una tonalidad diferente a la base, aplicar transposición
      if (targetKey !== baseKey) {
        contentToProcess = transposeContent(contentToProcess, baseKey, targetKey);
      }
      
      // Aplicar transposición para el instrumento actual
      if (currentInstrument !== "bb_trumpet") {
        contentToProcess = transposeForInstrument(
          contentToProcess,
          "bb_trumpet", 
          currentInstrument
        );
      }
      
      // Aplicar sistema de notación si necesario
      if (notationSystem === "english") {
        contentToProcess = convertNotationSystem(contentToProcess, "english");
      }
      
      // Formatear y mostrar
      const formatted = formatSong(contentToProcess);
      setFormattedSong(formatted);
      
      // Actualizar versión de solo letras
      const lyricsOnly = extractLyricsOnly(formatted);
      setFormattedLyricsOnly(lyricsOnly);
      
      console.log("Cambio de voz:", {
        instrumento: TRANSPOSING_INSTRUMENTS[currentInstrument].name,
        voz: voiceNumber || "Principal",
      });
    } catch (error) {
      setError("Error al cambiar de voz: " + error.message);
      console.error("Error completo:", error);
    }
  };

  // Funciones para ajustar tamaño de texto
  const increaseFontSize = () => {
    if (fontSize < 24) {
      const newSize = fontSize + 2;
      setFontSize(newSize);
      
      // Guardar preferencia si el usuario está autenticado
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
      
      // Guardar preferencia si el usuario está autenticado
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
    
    // Guardar preferencia si el usuario está autenticado
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

  // Estilo de impresión
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-style';
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #song-content, #song-content * {
          visibility: visible;
        }
        #song-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const printStyle = document.getElementById('print-style');
      if (printStyle) {
        document.head.removeChild(printStyle);
      }
    };
  }, []);

  // Obtener el nombre del instrumento actual
  const getCurrentInstrumentName = () => {
    const baseName = TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || "Trompeta en Sib";
    if (selectedVoice) {
      return `${baseName} ${selectedVoice}`;
    }
    // Si no hay voz seleccionada, mostrar como voz 1 por defecto
    return `${baseName} 1`;
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

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!song) {
    return (
      <div className="text-center">
        <h2>Canción no encontrada</h2>
        <Link to="/dashboard" className="btn btn-primary mt-3">
          Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-end align-items-center mb-4 no-print">
        <div className="d-flex gap-2">
          <InstrumentSelector 
            selectedInstrument={currentInstrument}
            selectedVoice={selectedVoice}
            onInstrumentChange={handleInstrumentChange}
            onVoiceChange={handleVoiceChange}
            instruments={TRANSPOSING_INSTRUMENTS}
            availableVoices={availableVoices}
          />
          
          <div className="dropdown">
            <button 
              className="btn btn-outline-primary dropdown-toggle" 
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Tonalidad: {displayKey}
            </button>
            <div className="dropdown-menu dropdown-menu-end" style={{ maxHeight: '400px', overflowY: 'auto', width: '300px' }}>
              <div className="px-3">
                <div className="mb-3">
                  <button 
                    className="btn btn-sm btn-outline-secondary w-100"
                    onClick={resetTransposition}
                    disabled={targetKey === baseKey}
                  >
                    Restaurar original ({getVisualKeyForInstrument(baseKey, currentInstrument)})
                  </button>
                </div>
                
                {RELATIVE_KEYS.map((pair, index) => {
                  // Calcular las tonalidades visuales para este instrumento
                  const majorVisualKey = getVisualKeyForInstrument(pair.major, currentInstrument);
                  const minorVisualKey = getVisualKeyForInstrument(pair.minor, currentInstrument);
                  
                  return (
                    <div className="mb-2" key={index}>
                      <div className="d-flex gap-1 mb-2">
                        <button 
                          className={`btn btn-sm flex-grow-1 ${displayKey === majorVisualKey ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => handleTranspose(pair.major)}
                        >
                          {majorVisualKey}
                          {pair.major === baseKey && " (Original)"}
                        </button>
                        <button 
                          className={`btn btn-sm flex-grow-1 ${displayKey === minorVisualKey ? 'btn-primary' : 'btn-outline-secondary'}`}
                          onClick={() => handleTranspose(pair.minor)}
                        >
                          {minorVisualKey}
                          {pair.minor === baseKey && " (Original)"}
                        </button>
                      </div>
                      {index < RELATIVE_KEYS.length - 1 && <hr className="my-1" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="dropdown">
            <button 
              className="btn btn-outline-secondary dropdown-toggle" 
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Notación: {notationSystem === "latin" ? "DO-RE-MI" : "C-D-E"}
            </button>
            <ul className="dropdown-menu">
              <li>
                <button 
                  className="dropdown-item" 
                  type="button"
                  onClick={() => handleChangeNotation("latin")}
                >
                  DO-RE-MI (Latina)
                </button>
              </li>
              <li>
                <button 
                  className="dropdown-item" 
                  type="button"
                  onClick={() => handleChangeNotation("english")}
                >
                  C-D-E (Anglosajona)
                </button>
              </li>
            </ul>
          </div>
          
          <div className="btn-group">
            <button
              className="btn btn-outline-secondary"
              onClick={decreaseFontSize}
              title="Disminuir tamaño"
            >
              A-
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={resetFontSize}
              title="Tamaño normal"
            >
              A
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={increaseFontSize}
              title="Aumentar tamaño"
            >
              A+
            </button>
          </div>
          
          <div className="btn-group">
            <button
              className={`btn btn-outline-${activeView === 0 ? 'primary' : 'secondary'}`}
              onClick={() => setActiveView(0)}
              title="Ver acordes"
            >
              <i className="bi bi-music-note-list"></i>
            </button>
            <button
              className={`btn btn-outline-${activeView === 1 ? 'primary' : 'secondary'}`}
              onClick={() => setActiveView(1)}
              title="Ver letra"
            >
              <i className="bi bi-card-text"></i>
            </button>
          </div>
          
          <button
            className="btn btn-outline-secondary"
            onClick={handlePrint}
            title="Imprimir"
          >
            <i className="bi bi-printer"></i> Imprimir
          </button>
          
          {currentUser && currentUser.uid === song.userId && (
            <Link 
              to={`/songs/${id}/edit`} 
              className="btn btn-primary"
            >
              Editar
            </Link>
          )}
          
          <Link 
            to="/dashboard" 
            className="btn btn-outline-secondary"
          >
            Volver
          </Link>
        </div>
      </div>

      <div id="song-content" className="position-relative">
        {/* Encabezado fijo (igual para ambas vistas) */}
        <div className="card mb-3">
          <div className="card-body text-center">
            <h3 className="mb-2">{song.title || "Sin título"}</h3>
            <div className="row">
              <div className="col-4 text-start">
                <small className="text-muted">
                  Instrumento: {getCurrentInstrumentName()}
                </small><br/>
                <small className="text-muted">Tonalidad: {displayKey}</small>
              </div>
              <div className="col-4">
                {/* Centro - vacío para equilibrar */}
                <small className="text-muted">Versión de: {song.version || "No especificado"}</small><br/>
                <small className="text-muted">Tipo: {song.type || "No especificado"}</small>
              </div>
            </div>
          </div>
        </div>
        {/* Indicador de vista - puntos para saber en qué vista estamos */}
        <div className="text-center mb-3">
          <div className="d-inline-flex">
            <button 
              onClick={() => setActiveView(0)} 
              className={`btn btn-sm mx-1 ${activeView === 0 ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ width: '30px', height: '10px', padding: 0, borderRadius: '10px' }}
            />
            <button 
              onClick={() => setActiveView(1)} 
              className={`btn btn-sm mx-1 ${activeView === 1 ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ width: '30px', height: '10px', padding: 0, borderRadius: '10px' }}
            />
          </div>
          <div className="text-muted small mt-1">
            {activeView === 0 ? 'Deslizar a la derecha para ver solo letra' : 'Deslizar a la izquierda para ver acordes'}
          </div>
        </div>

        {/* Contenedor de vistas con swipe */}
        <div 
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ 
            width: '100%',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {/* Vista de acordes */}
          <div 
            ref={chordsViewRef}
            className="card" 
            style={{ 
              fontSize: `${fontSize}px`,
              transform: `translateX(${activeView * -100}%)`,
              transition: 'transform 0.3s ease-out',
              width: '100%',
              position: activeView === 0 ? 'relative' : 'absolute',
              height: activeView === 0 ? 'auto' : '100%',
              overflow: activeView === 0 ? 'visible' : 'hidden',
              visibility: activeView === 0 ? 'visible' : 'hidden'
            }}
          >
            <div className="card-body">
              {formattedSong && formattedSong.sections.map((section, index) => (
                <div key={index} className="song-section mb-4 text-center">
                  <h3 className="h5 mb-3">{section.title}</h3>
                  <pre className="mb-0" style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'inherit'
                  }}>
                    {section.content}
                  </pre>
                </div>
              ))}
              
              {(!formattedSong || formattedSong.sections.length === 0) && (
                <p className="text-center text-muted">
                  No hay contenido disponible para esta canción.
                </p>
              )}
            </div>
          </div>
          
          {/* Vista de solo letras */}
          <div 
            ref={lyricsViewRef}
            className="card"
            style={{ 
              fontSize: `${fontSize}px`,
              transform: `translateX(${(activeView - 1) * 100 + 100}%)`,
              transition: 'transform 0.3s ease-out',
              width: '100%',
              position: activeView === 1 ? 'relative' : 'absolute',
              height: activeView === 1 ? 'auto' : '100%',
              overflow: activeView === 1 ? 'visible' : 'hidden',
              visibility: activeView === 1 ? 'visible' : 'hidden'
            }}
          >
            <div className="card-body">
              {formattedLyricsOnly && formattedLyricsOnly.sections.map((section, index) => (
                <div key={index} className="song-section mb-4 text-center">
                  <h3 className="h5 mb-3">{section.title}</h3>
                  <pre className="mb-0" style={{ 
                    whiteSpace: 'pre-wrap', 
                    fontFamily: 'inherit'
                  }}>
                    {section.content}
                  </pre>
                </div>
              ))}
              
              {(!formattedLyricsOnly || formattedLyricsOnly.sections.length === 0) && (
                <p className="text-center text-muted">
                  No hay contenido disponible para esta canción.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SongView;
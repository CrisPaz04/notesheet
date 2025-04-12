// SongView.jsx con todas las actualizaciones
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSongById } from "@notesheet/api";
import { formatSong, transposeContent, convertNotationSystem, detectNotationSystem } from "@notesheet/core";
import { useAuth } from "../context/AuthContext";

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

// Extraer listas planas de tonalidades para usar en otros lugares
const MAJOR_KEYS = RELATIVE_KEYS.map(pair => pair.major);
const MINOR_KEYS = RELATIVE_KEYS.map(pair => pair.minor);
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

function SongView() {
  const [song, setSong] = useState(null);
  const [formattedSong, setFormattedSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentKey, setCurrentKey] = useState("");
  const [originalKey, setOriginalKey] = useState("");
  const [originalContent, setOriginalContent] = useState(""); // Contenido original para transposiciones exactas
  const [fontSize, setFontSize] = useState(18); // Aumentado el tamaño base a 18px
  const [notationSystem, setNotationSystem] = useState("latin"); // latin (DO-RE-MI) o english (C-D-E)
  
  const { id } = useParams();
  const { currentUser } = useAuth();

  useEffect(() => {
    const loadSong = async () => {
      try {
        setLoading(true);
        const loadedSong = await getSongById(id);
        setSong(loadedSong);
        setCurrentKey(loadedSong.key || "DO");
        setOriginalKey(loadedSong.key || "DO");
        setOriginalContent(loadedSong.content || ""); // Guardar el contenido original
        
        // Detectar automáticamente el sistema de notación
        const detectedSystem = detectNotationSystem(loadedSong.content);
        setNotationSystem(detectedSystem);
        
        // Formatear la canción para mostrarla
        const formatted = formatSong(loadedSong.content);
        setFormattedSong(formatted);
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
  }, [id]);

  const handleTranspose = (newKey, maintainNotation = false) => {
    if (newKey === currentKey || !song || !originalContent) return;
    
    try {
      // Siempre transponemos desde el contenido original y la tonalidad original
      const transposedContent = transposeContent(originalContent, originalKey, newKey);
      
      // Después aplicamos el sistema de notación actual si es necesario
      let finalContent = transposedContent;
      if (notationSystem === "english") {
        finalContent = convertNotationSystem(transposedContent, "english");
      }
      
      const formatted = formatSong(finalContent);
      setFormattedSong(formatted);
      setCurrentKey(newKey);
    } catch (error) {
      setError("Error al transponer: " + error.message);
    }
  };

  const resetTransposition = () => {
    if (currentKey !== originalKey) {
      try {
        // Usamos el contenido original directamente
        let finalContent = originalContent;
        
        // Aplicamos el sistema de notación actual si es necesario
        if (notationSystem === "english") {
          finalContent = convertNotationSystem(originalContent, "english");
        }
        
        const formatted = formatSong(finalContent);
        setFormattedSong(formatted);
        setCurrentKey(originalKey);
      } catch (error) {
        setError("Error al restaurar la tonalidad original: " + error.message);
      }
    }
  };

  const handleChangeNotation = (system) => {
    if (system === notationSystem || !song) return;
    
    try {
      // Obtenemos el contenido actual (que puede estar transpuesto)
      let baseContent;
      
      if (currentKey === originalKey) {
        // Si estamos en la tonalidad original, usamos el contenido original
        baseContent = originalContent;
      } else {
        // Si estamos en otra tonalidad, calculamos la transposición desde el original
        baseContent = transposeContent(originalContent, originalKey, currentKey);
      }
      
      // Convertir la notación
      const convertedContent = convertNotationSystem(baseContent, system);
      const formatted = formatSong(convertedContent);
      setFormattedSong(formatted);
      setNotationSystem(system);
    } catch (error) {
      setError("Error al cambiar el sistema de notación: " + error.message);
    }
  };

  const increaseFontSize = () => {
    if (fontSize < 24) {
      setFontSize(fontSize + 2);
    }
  };

  const decreaseFontSize = () => {
    if (fontSize > 14) {
      setFontSize(fontSize - 2);
    }
  };

  const resetFontSize = () => {
    setFontSize(18); // El tamaño normal ahora es 18px
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
      <div className="d-flex justify-content-between align-items-center mb-4 no-print">
        <h1 className="h2 mb-0">{song.title || "Sin título"}</h1>
        
        <div className="d-flex gap-2">
          <div className="dropdown">
            <button 
              className="btn btn-outline-primary dropdown-toggle" 
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Tonalidad: {currentKey}
            </button>
            <div className="dropdown-menu dropdown-menu-end" style={{ maxHeight: '400px', overflowY: 'auto', width: '300px' }}>
              <div className="px-3">
                <div className="mb-3">
                  <button 
                    className="btn btn-sm btn-outline-secondary w-100"
                    onClick={resetTransposition}
                    disabled={currentKey === originalKey}
                  >
                    Restaurar original ({originalKey})
                  </button>
                </div>
                
                {RELATIVE_KEYS.map((pair, index) => (
                  <div className="mb-2" key={index}>
                    <div className="d-flex gap-1 mb-2">
                      <button 
                        className={`btn btn-sm flex-grow-1 ${currentKey === pair.major ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleTranspose(pair.major, true)}
                      >
                        {pair.major}
                        {pair.major === originalKey && " (Original)"}
                      </button>
                      <button 
                        className={`btn btn-sm flex-grow-1 ${currentKey === pair.minor ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleTranspose(pair.minor, true)}
                      >
                        {pair.minor}
                        {pair.minor === originalKey && " (Original)"}
                      </button>
                    </div>
                    {index < RELATIVE_KEYS.length - 1 && <hr className="my-1" />}
                  </div>
                ))}
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

      <div className="card mb-4 no-print">
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-sm-4">
              <p className="mb-1"><strong>Tonalidad:</strong> {currentKey}</p>
            </div>
            <div className="col-sm-4">
              <p className="mb-1"><strong>Tipo:</strong> {song.type || "No especificado"}</p>
            </div>
            <div className="col-sm-4">
              <p className="mb-1"><strong>Autor:</strong> {song.author || "No especificado"}</p>
            </div>
          </div>
        </div>
      </div>

      <div id="song-content" className="card" style={{ fontSize: `${fontSize}px` }}>
        <div className="card-body">
          <div className="text-center mb-4">
            <h3 className="mb-2">{song.title || "Sin título"}</h3>
            <div className="d-flex justify-content-between">
              <small className="text-muted">{song.type || "Sin tipo"}</small>
              <small className="text-muted">{currentKey}</small>
            </div>
            {song.author && <small className="text-muted d-block mt-1">Autor: {song.author}</small>}
          </div>
          
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
    </div>
  );
}

export default SongView;
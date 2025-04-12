// SongView.jsx - Modificaciones para tipo de notación y visualización
import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getSongById } from "@notesheet/api";
import { formatSong, transposeContent, convertNotationSystem } from "@notesheet/core";
import { useAuth } from "../context/AuthContext";

// Arrays de tonalidades
const MAJOR_KEYS = ["DO", "SOL", "RE", "LA", "MI", "SI", "FA#", "DO#", "FA", "SIb", "MIb", "LAb", "REb", "SOLb", "DOb"];
const MINOR_KEYS = ["LAm", "MIm", "SIm", "FA#m", "DO#m", "SOL#m", "RE#m", "LA#m", "REm", "SOLm", "DOm", "FAm", "SIbm", "MIbm", "LAbm"];
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

function SongView() {
  const [song, setSong] = useState(null);
  const [formattedSong, setFormattedSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentKey, setCurrentKey] = useState("");
  const [originalKey, setOriginalKey] = useState("");
  const [fontSize, setFontSize] = useState(16);
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

  const handleTranspose = (newKey) => {
    if (newKey === currentKey || !song) return;
    
    try {
      const transposedContent = transposeContent(song.content, currentKey, newKey);
      const formatted = formatSong(transposedContent);
      setFormattedSong(formatted);
      setCurrentKey(newKey);
    } catch (error) {
      setError("Error al transponer: " + error.message);
    }
  };

  const handleChangeNotation = (system) => {
    if (system === notationSystem || !song) return;
    
    try {
      // Convertir la notación
      const convertedContent = convertNotationSystem(formattedSong.rawContent, system);
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
    if (fontSize > 12) {
      setFontSize(fontSize - 2);
    }
  };

  const resetFontSize = () => {
    setFontSize(16);
  };

  const resetTransposition = () => {
    if (currentKey !== originalKey) {
      handleTranspose(originalKey);
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
            <ul className="dropdown-menu">
              <li className="dropdown-header">Tonalidades Mayores</li>
              {MAJOR_KEYS.map((note) => (
                <li key={note}>
                  <button 
                    className="dropdown-item" 
                    type="button"
                    onClick={() => handleTranspose(note)}
                  >
                    {note} {note === originalKey ? "(Original)" : ""}
                  </button>
                </li>
              ))}
              <li><hr className="dropdown-divider" /></li>
              <li className="dropdown-header">Tonalidades Menores</li>
              {MINOR_KEYS.map((note) => (
                <li key={note}>
                  <button 
                    className="dropdown-item" 
                    type="button"
                    onClick={() => handleTranspose(note)}
                  >
                    {note} {note === originalKey ? "(Original)" : ""}
                  </button>
                </li>
              ))}
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button 
                  className="dropdown-item" 
                  type="button"
                  onClick={resetTransposition}
                >
                  Restaurar tonalidad original
                </button>
              </li>
            </ul>
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
            <h2 className="h4">{song.title || "Sin título"}</h2>
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
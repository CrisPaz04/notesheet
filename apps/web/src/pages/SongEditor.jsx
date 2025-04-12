// SongEditor.jsx con todas las actualizaciones
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createSong, getSongById, updateSong } from "@notesheet/api";
import { transposeContent, detectNotationSystem } from "@notesheet/core";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";

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

// Tipos de canciones
const SONG_TYPES = ["Júbilo", "Adoración", "Moderada"];

function SongEditor() {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("DO");
  const [type, setType] = useState("Adoración");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewSong, setIsNewSong] = useState(true);
  const [contentUpdatePending, setContentUpdatePending] = useState(false);
  const [lastExtractTime, setLastExtractTime] = useState(0);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const extractTimeoutRef = useRef(null);

  // Al cargar, verifica si es una canción nueva o existente
  useEffect(() => {
    if (id) {
      setIsNewSong(false);
      loadSong(id);
    } else {
      // Plantilla para una nueva canción
      setContent(`# Título: Nueva Canción
# Tonalidad: DO Mayor
# Tipo: Adoración
# Autor: 

## Intro
DO SOL | LA- FA | DO SOL | DO--

## Verso 1
DO        SOL       LA-      FA
Escribe aquí la letra y los acordes

## Coro
FA       SOL       DO      LA-
Escribe aquí la letra y los acordes
`);
      // Extracción inicial de metadatos
      extractMetadataDebounced(300);
    }
  }, [id]);

  // Cargar una canción existente
  const loadSong = async (songId) => {
    try {
      setLoading(true);
      const song = await getSongById(songId);
      setTitle(song.title || "");
      setKey(song.key || "DO");
      setType(song.type || "Adoración");
      setAuthor(song.author || "");
      setContent(song.content || "");
    } catch (error) {
      setError("Error al cargar la canción: " + error.message);
      console.error("Error loading song:", error);
    } finally {
      setLoading(false);
    }
  };

  // Función para extraer metadatos con debounce
  const extractMetadataDebounced = (delay = 1000) => {
    if (extractTimeoutRef.current) {
      clearTimeout(extractTimeoutRef.current);
    }
    
    extractTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastExtractTime > delay) {
        extractMetadata();
        setLastExtractTime(now);
      }
    }, delay);
  };

  // Extraer metadatos del contenido
  const extractMetadata = () => {
    if (!content) return;
    
    let updatedFields = {};
    let changed = false;
    
    // Extraer título
    const titleMatch = content.match(/^#\s*(?:Canción|Título|Title):\s*(.+)$/m);
    if (titleMatch && titleMatch[1] && titleMatch[1].trim() !== title) {
      updatedFields.title = titleMatch[1].trim();
      changed = true;
    }

    // Extraer tonalidad
    const keyMatch = content.match(/^#\s*(?:Tonalidad|Key):\s*(.+)$/m);
    if (keyMatch && keyMatch[1]) {
      const keyValue = keyMatch[1].trim().split(" ")[0]; // Tomar solo la nota, no "Mayor/Menor"
      if (keyValue !== key) {
        updatedFields.key = keyValue;
        changed = true;
      }
    }

    // Extraer tipo
    const typeMatch = content.match(/^#\s*(?:Tipo|Type):\s*(.+)$/m);
    if (typeMatch && typeMatch[1] && typeMatch[1].trim() !== type) {
      const typeValue = typeMatch[1].trim();
      // Solo actualizar si el tipo está en la lista permitida
      if (SONG_TYPES.includes(typeValue)) {
        updatedFields.type = typeValue;
        changed = true;
      }
    }
    
    // Extraer autor
    const authorMatch = content.match(/^#\s*(?:Autor|Author):\s*(.+)$/m);
    if (authorMatch && authorMatch[1] && authorMatch[1].trim() !== author) {
      updatedFields.author = authorMatch[1].trim();
      changed = true;
    }
    
    // Actualizar estados solo si hay cambios
    if (changed) {
      if (updatedFields.title) setTitle(updatedFields.title);
      if (updatedFields.key) setKey(updatedFields.key);
      if (updatedFields.type) setType(updatedFields.type);
      if (updatedFields.author) setAuthor(updatedFields.author);
    }
  };

  // Actualizar el contenido cuando los campos de metadata cambien
  useEffect(() => {
    if (contentUpdatePending) {
      updateContentMetadata();
      setContentUpdatePending(false);
    }
  }, [contentUpdatePending]);

  // Actualizar el contenido con los metadatos
  const updateContentMetadata = () => {
    if (!content) return;
    
    let updatedContent = content;
    
    // Actualizar título
    updatedContent = updatedContent.replace(
      /^#\s*(?:Canción|Título|Title):\s*.+$/m,
      `# Título: ${title}`
    );
    
    // Determinar si la tonalidad es mayor o menor
    const isMajor = !key.includes('m');
    const keyType = isMajor ? 'Mayor' : 'Menor';
    
    // Actualizar tonalidad
    updatedContent = updatedContent.replace(
      /^#\s*(?:Tonalidad|Key):\s*.+$/m,
      `# Tonalidad: ${key} ${keyType}`
    );
    
    // Actualizar tipo
    updatedContent = updatedContent.replace(
      /^#\s*(?:Tipo|Type):\s*.+$/m,
      `# Tipo: ${type}`
    );
    
    // Actualizar autor
    const authorRegex = /^#\s*(?:Autor|Author):\s*.+$/m;
    if (updatedContent.match(authorRegex)) {
      updatedContent = updatedContent.replace(
        authorRegex,
        `# Autor: ${author}`
      );
    } else {
      // Si no existe la línea de autor, agregarla después de Tipo
      updatedContent = updatedContent.replace(
        /^#\s*(?:Tipo|Type):\s*.+$/m,
        `# Tipo: ${type}\n# Autor: ${author}`
      );
    }
    
    // Solo actualizar si cambió
    if (updatedContent !== content) {
      setContent(updatedContent);
    }
  };

  // Handlers para cambios de campos
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
    setContentUpdatePending(true);
  };

  const handleKeyChange = (newKey) => {
    setKey(newKey);
    setContentUpdatePending(true);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
    setContentUpdatePending(true);
  };
  
  const handleAuthorChange = (e) => {
    setAuthor(e.target.value);
    setContentUpdatePending(true);
  };

  // Guardar la canción
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError("El contenido de la canción no puede estar vacío");
      return;
    }

    // Actualizar metadatos en contenido antes de guardar
    updateContentMetadata();

    try {
      setLoading(true);
      
      const songData = {
        title,
        key,
        type,
        author,
        content,
        userId: currentUser.uid
      };

      if (isNewSong) {
        await createSong(songData);
      } else {
        await updateSong(id, songData);
      }

      navigate("/dashboard");
    } catch (error) {
      setError("Error al guardar la canción: " + error.message);
      console.error("Error saving song:", error);
    } finally {
      setLoading(false);
    }
  };

  // Opciones para el editor SimpleMDE
  const editorOptions = {
    autofocus: false,
    spellChecker: false,
    status: false,
    toolbar: false, // Quitar la barra de herramientas completamente
    placeholder: "Escribe tu canción aquí usando la notación musical...",
  };

  // Handler para cambios en el editor
  const handleEditorChange = (value) => {
    setContent(value);
    extractMetadataDebounced();
  };

  if (loading && !content) {
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h2 mb-0">
          {isNewSong ? "Nueva Canción" : "Editar Canción"}
        </h1>
        
        <div className="d-flex gap-2">
          <button 
            className="btn btn-primary" 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="card mb-4">
        <div className="card-body">
          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="title" className="form-label">Título</label>
              <input
                type="text"
                className="form-control"
                id="title"
                value={title}
                onChange={handleTitleChange}
              />
            </div>
            <div className="col-md-6">
              <label htmlFor="author" className="form-label">Autor</label>
              <input
                type="text"
                className="form-control"
                id="author"
                value={author}
                onChange={handleAuthorChange}
              />
            </div>
          </div>
          
          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="key" className="form-label">Tonalidad</label>
              <div className="dropdown" style={{ width: '100%' }}>
                <button 
                  className="btn btn-outline-secondary dropdown-toggle w-100 d-flex justify-content-between align-items-center"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  <span>{key}</span>
                  <i className="bi bi-chevron-down ms-2"></i>
                </button>
                <div className="dropdown-menu w-100" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <div className="px-2">
                    {RELATIVE_KEYS.map((pair, index) => (
                      <div className="mb-2" key={index}>
                        <div className="d-flex gap-1 mb-1">
                          <button 
                            className={`btn btn-sm flex-grow-1 ${key === pair.major ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => handleKeyChange(pair.major)}
                          >
                            {pair.major}
                          </button>
                          <button 
                            className={`btn btn-sm flex-grow-1 ${key === pair.minor ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => handleKeyChange(pair.minor)}
                          >
                            {pair.minor}
                          </button>
                        </div>
                        {index < RELATIVE_KEYS.length - 1 && <hr className="my-1" />}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <label htmlFor="type" className="form-label">Tipo</label>
              <select
                className="form-select"
                id="type"
                value={type}
                onChange={(e) => handleTypeChange(e.target.value)}
              >
                {SONG_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          Editor de Notación Musical
        </div>
        <div className="card-body">
          <div className="text-center mb-4">
            <h3 className="mb-2">{title}</h3>
            <div className="d-flex justify-content-between">
              <small className="text-muted">{type}</small>
              <small className="text-muted">{key}</small>
            </div>
            {author && <small className="text-muted d-block mt-1">Autor: {author}</small>}
          </div>
          <SimpleMDE
            value={content}
            onChange={handleEditorChange}
            options={editorOptions}
          />
          <small className="form-text text-muted mt-2">
            Usa el formato de notación: <code className="song-notation">DO SOL LA- FA</code> para los acordes.
            Usa <code className="song-notation">## Título</code> para crear secciones.
          </small>
        </div>
      </div>
    </div>
  );
}

export default SongEditor;
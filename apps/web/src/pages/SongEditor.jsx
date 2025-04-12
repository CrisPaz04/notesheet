// SongEditor.jsx - Modificaciones para los dropdowns y autor
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createSong, getSongById, updateSong } from "@notesheet/api";
import { transposeContent } from "@notesheet/core";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";

// Arrays de tonalidades y tipos de canciones
const MAJOR_KEYS = ["DO", "SOL", "RE", "LA", "MI", "SI", "FA#", "DO#", "FA", "SIb", "MIb", "LAb", "REb", "SOLb", "DOb"];
const MINOR_KEYS = ["LAm", "MIm", "SIm", "FA#m", "DO#m", "SOL#m", "RE#m", "LA#m", "REm", "SOLm", "DOm", "FAm", "SIbm", "MIbm", "LAbm"];
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];
const SONG_TYPES = ["Adoración", "Alabanza", "Meditación", "Comunión", "Ofrenda", "Entrada", "Salida", "Otro"];

function SongEditor() {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("DO");
  const [type, setType] = useState("Adoración");
  const [author, setAuthor] = useState(""); // Agregado campo para autor
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewSong, setIsNewSong] = useState(true);
  const [shouldExtractMetadata, setShouldExtractMetadata] = useState(false);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();

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
      // Extraer metadatos iniciales
      setShouldExtractMetadata(true);
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
      setAuthor(song.author || ""); // Cargar autor
      setContent(song.content || "");
    } catch (error) {
      setError("Error al cargar la canción: " + error.message);
      console.error("Error loading song:", error);
    } finally {
      setLoading(false);
    }
  };

  // Extraer metadatos solo cuando shouldExtractMetadata es true
  useEffect(() => {
    if (content && shouldExtractMetadata) {
      // Extraer título
      const titleMatch = content.match(/^#\s*(?:Canción|Título|Title):\s*(.+)$/m);
      if (titleMatch && titleMatch[1]) {
        setTitle(titleMatch[1].trim());
      }

      // Extraer tonalidad
      const keyMatch = content.match(/^#\s*(?:Tonalidad|Key):\s*(.+)$/m);
      if (keyMatch && keyMatch[1]) {
        const keyValue = keyMatch[1].trim().split(" ")[0]; // Tomar solo la nota, no "Mayor/Menor"
        setKey(keyValue);
      }

      // Extraer tipo
      const typeMatch = content.match(/^#\s*(?:Tipo|Type):\s*(.+)$/m);
      if (typeMatch && typeMatch[1]) {
        setType(typeMatch[1].trim());
      }
      
      // Extraer autor
      const authorMatch = content.match(/^#\s*(?:Autor|Author):\s*(.+)$/m);
      if (authorMatch && authorMatch[1]) {
        setAuthor(authorMatch[1].trim());
      }
      
      // Reset the flag
      setShouldExtractMetadata(false);
    }
  }, [content, shouldExtractMetadata]);

  // Actualizar el contenido cuando los campos de metadata cambien
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

  // Handlers para cambios
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
  };

  const handleKeyChange = (e) => {
    setKey(e.target.value);
  };

  const handleTypeChange = (e) => {
    setType(e.target.value);
  };
  
  const handleAuthorChange = (e) => {
    setAuthor(e.target.value);
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
        author, // Incluir autor en los datos a guardar
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
  };

  // Handler para cuando el editor pierde el foco
  const handleEditorBlur = () => {
    setShouldExtractMetadata(true);
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
                onBlur={updateContentMetadata}
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
                onBlur={updateContentMetadata}
              />
            </div>
          </div>
          
          <div className="row mb-3">
            <div className="col-md-6">
              <label htmlFor="key" className="form-label">Tonalidad</label>
              <select
                className="form-select"
                id="key"
                value={key}
                onChange={handleKeyChange}
                onBlur={updateContentMetadata}
              >
                <optgroup label="Tonalidades Mayores">
                  {MAJOR_KEYS.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </optgroup>
                <optgroup label="Tonalidades Menores">
                  {MINOR_KEYS.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="col-md-6">
              <label htmlFor="type" className="form-label">Tipo</label>
              <select
                className="form-select"
                id="type"
                value={type}
                onChange={handleTypeChange}
                onBlur={updateContentMetadata}
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
            <h2 className="h4">{title}</h2>
            <div className="d-flex justify-content-between">
              <small className="text-muted">{type}</small>
              <small className="text-muted">{key}</small>
            </div>
          </div>
          <SimpleMDE
            value={content}
            onChange={handleEditorChange}
            onBlur={handleEditorBlur}
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
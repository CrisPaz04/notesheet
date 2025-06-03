// apps/web/src/pages/SongEditor.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createSong, getSongById, updateSong, addVoiceToSong, removeVoiceFromSong } from "@notesheet/api";
import { TRANSPOSING_INSTRUMENTS } from "@notesheet/core";
import KeySelector from "../components/KeySelector";
import LoadingSpinner from "../components/LoadingSpinner";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import TypeSelector from "../components/TypeSelector";

// Instrumentos soportados para voces adicionales
const VOICE_INSTRUMENTS = Object.entries(TRANSPOSING_INSTRUMENTS)
  .map(([id, instrument]) => ({ id, name: instrument.name }));

function SongEditor() {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("DO");
  const [type, setType] = useState("Adoración");
  const [version, setVersion] = useState("");
  const [content, setContent] = useState("");
  const [lyricsOnly, setLyricsOnly] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewSong, setIsNewSong] = useState(true);
  const [contentUpdatePending, setContentUpdatePending] = useState(false);
  const [disableMetadataExtraction, setDisableMetadataExtraction] = useState(false);
  
  // Estado para voces adicionales
  const [voices, setVoices] = useState({});
  const [currentTab, setCurrentTab] = useState("main");
  const [showVoicesManager, setShowVoicesManager] = useState(false);
  const [newVoiceInstrument, setNewVoiceInstrument] = useState("bb_trumpet");
  const [newVoiceNumber, setNewVoiceNumber] = useState("1");
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const editorRef = useRef(null);

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
# Versión de: 

## Intro
DO SOL | LA- FA | DO SOL | DO--

## Verso 1
DO        SOL       LA-      FA
Escribe aquí la letra y los acordes

## Coro
FA       SOL       DO      LA-
Escribe aquí la letra y los acordes
`);
// Generar versión solo letra
generateLyricsOnly(`# Título: Nueva Canción
# Tonalidad: DO Mayor
# Tipo: Adoración
# Versión de: 

## Intro

## Verso 1
Escribe aquí la letra y los acordes

## Coro
Escribe aquí la letra y los acordes
`);
      // Extraer metadatos iniciales
      setTimeout(() => {
        extractMetadata();
        setInitialLoading(false);
      }, 500);
    }
  }, [id]);

  // Cargar una canción existente
  const loadSong = async (songId) => {
    try {
      setInitialLoading(true);
      const song = await getSongById(songId);
      setTitle(song.title || "");
      setKey(song.key || "DO");
      setType(song.type || "Adoración");
      setVersion(song.version || "");
      setContent(song.content || "");
      
      if (song.lyricsOnly) {
        setLyricsOnly(song.lyricsOnly);
      } else {
        generateLyricsOnly(song.content || "");
      }
      
      if (song.voices) {
        setVoices(song.voices);
      }
    } catch (error) {
      setError("Error al cargar la canción: " + error.message);
      console.error("Error loading song:", error);
    } finally {
      setInitialLoading(false);
    }
  };

  // Generar versión de solo letra
  const generateLyricsOnly = (contentWithChords) => {
    const lines = contentWithChords.split('\n');
    const processedLines = lines.map(line => {
      if (line.startsWith('#') || line.startsWith('##')) {
        return line;
      }
      
      return line.replace(/\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?(?:m)?\b/g, '')
                 .replace(/\|\s*\|/g, '')
                 .replace(/\s{2,}/g, ' ')
                 .trim();
    });
    
    let result = '';
    let previousLineEmpty = false;
    
    processedLines.forEach(line => {
      const isCurrentLineEmpty = line.trim() === '';
      
      if (isCurrentLineEmpty && previousLineEmpty) {
        return;
      }
      
      result += line + '\n';
      previousLineEmpty = isCurrentLineEmpty;
    });
    
    setLyricsOnly(result.trim());
  };

  // Extraer metadatos del contenido
  const extractMetadata = () => {
    if (!content || disableMetadataExtraction) return;
    
    const titleMatch = content.match(/^#\s*(?:Canción|Título|Title):\s*(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      setTitle(titleMatch[1].trim());
    }

    const keyMatch = content.match(/^#\s*(?:Tonalidad|Key):\s*(.+)$/m);
    if (keyMatch && keyMatch[1]) {
      const keyValue = keyMatch[1].trim().split(" ")[0];
      setKey(keyValue);
    }

    const typeMatch = content.match(/^#\s*(?:Tipo|Type):\s*(.+)$/m);
    if (typeMatch && typeMatch[1]) {
      const typeValue = typeMatch[1].trim();
      if (SONG_TYPES.includes(typeValue)) {
        setType(typeValue);
      }
    }
    
    const versionMatch = content.match(/^#\s*(?:Versión de|Versión|Version|Autor|Author):\s*(.+)$/m);
    if (versionMatch && versionMatch[1]) {
      setVersion(versionMatch[1].trim());
    }
  };

  // Actualizar el contenido cuando los campos de metadata cambien
  useEffect(() => {
    if (contentUpdatePending) {
      updateContentMetadata();
      setContentUpdatePending(false);
    }
  }, [contentUpdatePending]);

  const updateContentMetadata = () => {
    if (!content) return;
    
    setDisableMetadataExtraction(true);
    
    let updatedContent = content;
    
    updatedContent = updatedContent.replace(
      /^#\s*(?:Canción|Título|Title):\s*.+$/m,
      `# Título: ${title}`
    );
    
    const isMajor = !key.includes('m');
    const keyType = isMajor ? 'Mayor' : 'Menor';
    
    updatedContent = updatedContent.replace(
      /^#\s*(?:Tonalidad|Key):\s*.+$/m,
      `# Tonalidad: ${key} ${keyType}`
    );
    
    updatedContent = updatedContent.replace(
      /^#\s*(?:Tipo|Type):\s*.+$/m,
      `# Tipo: ${type}`
    );
    
    const versionRegex = /^#\s*(?:Versión de|Versión|Version|Autor|Author):\s*.+$/m;
    if (updatedContent.match(versionRegex)) {
      updatedContent = updatedContent.replace(
        versionRegex,
        `# Versión de: ${version}`
      );
    } else {
      updatedContent = updatedContent.replace(
        /^#\s*(?:Tipo|Type):\s*.+$/m,
        `# Tipo: ${type}\n# Versión de: ${version}`
      );
    }
    
    if (updatedContent !== content) {
      setContent(updatedContent);
    }
    
    // También actualizar la versión de letras
    let updatedLyrics = lyricsOnly;
    
    updatedLyrics = updatedLyrics.replace(
      /^#\s*(?:Canción|Título|Title):\s*.+$/m,
      `# Título: ${title}`
    );
    
    updatedLyrics = updatedLyrics.replace(
      /^#\s*(?:Tonalidad|Key):\s*.+$/m,
      `# Tonalidad: ${key} ${keyType}`
    );
    
    updatedLyrics = updatedLyrics.replace(
      /^#\s*(?:Tipo|Type):\s*.+$/m,
      `# Tipo: ${type}`
    );
    
    if (updatedLyrics.match(versionRegex)) {
      updatedLyrics = updatedLyrics.replace(
        versionRegex,
        `# Versión de: ${version}`
      );
    } else {
      updatedLyrics = updatedLyrics.replace(
        /^#\s*(?:Tipo|Type):\s*.+$/m,
        `# Tipo: ${type}\n# Versión de: ${version}`
      );
    }
    
    if (updatedLyrics !== lyricsOnly) {
      setLyricsOnly(updatedLyrics);
    }
    
    setTimeout(() => {
      setDisableMetadataExtraction(false);
    }, 500);
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
  
  const handleVersionChange = (e) => {
    setVersion(e.target.value);
    setContentUpdatePending(true);
  };

  // Guardar la canción
  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError("El contenido de la canción no puede estar vacío");
      return;
    }

    updateContentMetadata();

    try {
      setLoading(true);
      
      const songData = {
        title,
        key,
        type,
        version,
        content,
        lyricsOnly,
        voices,
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

  // Funciones para manejar voces
  const handleAddVoice = async () => {
    if (!newVoiceInstrument || !newVoiceNumber) return;
    
    if (voices[newVoiceInstrument] && voices[newVoiceInstrument][newVoiceNumber]) {
      setError("Esta voz ya existe");
      return;
    }
    
    const updatedVoices = { ...voices };
    
    if (!updatedVoices[newVoiceInstrument]) {
      updatedVoices[newVoiceInstrument] = {};
    }
    
    const voiceContent = content;
    updatedVoices[newVoiceInstrument][newVoiceNumber] = voiceContent;
    
    setVoices(updatedVoices);
    
    if (!isNewSong && id) {
      try {
        await addVoiceToSong(id, newVoiceInstrument, newVoiceNumber, voiceContent);
      } catch (error) {
        console.error("Error adding voice:", error);
        setError("Error al añadir la voz: " + error.message);
      }
    }
    
    setCurrentTab(`${newVoiceInstrument}-${newVoiceNumber}`);
    setNewVoiceInstrument("bb_trumpet");
    setNewVoiceNumber("1");
    setShowVoicesManager(false);
  };
  
  const handleRemoveVoice = async (instrumentId, voiceNumber) => {
    if (!confirm(`¿Estás seguro de eliminar la voz ${voiceNumber} de ${TRANSPOSING_INSTRUMENTS[instrumentId]?.name}?`)) {
      return;
    }
    
    const updatedVoices = { ...voices };
    
    if (updatedVoices[instrumentId] && updatedVoices[instrumentId][voiceNumber]) {
      delete updatedVoices[instrumentId][voiceNumber];
      
      if (Object.keys(updatedVoices[instrumentId]).length === 0) {
        delete updatedVoices[instrumentId];
      }
      
      setVoices(updatedVoices);
      
      if (!isNewSong && id) {
        try {
          await removeVoiceFromSong(id, instrumentId, voiceNumber);
        } catch (error) {
          console.error("Error removing voice:", error);
          setError("Error al eliminar la voz: " + error.message);
        }
      }
      
      if (currentTab === `${instrumentId}-${voiceNumber}`) {
        setCurrentTab("main");
      }
    }
  };

  // Función para generar automáticamente la letra
  const handleGenerateLyrics = () => {
    if (currentTab === "main") {
      generateLyricsOnly(content);
    }
  };

  const handleTabChange = (tabId) => {
    if (currentTab === "main" && tabId !== "main") {
      updateContentMetadata();
      
      if (tabId === "lyrics") {
        // Sincronizar secciones si es necesario
      }
    }
    
    setCurrentTab(tabId);
  };

  // Función para obtener el contenido de la pestaña actual
  const getCurrentTabContent = () => {
    if (currentTab === "main") {
      return content;
    }
    
    if (currentTab === "lyrics") {
      return lyricsOnly;
    }
    
    const [instrumentId, voiceNumber] = currentTab.split('-');
    return voices[instrumentId]?.[voiceNumber] || content;
  };
  
  // Función para actualizar el contenido de la pestaña actual
  const updateCurrentTabContent = (newContent) => {
    if (currentTab === "main") {
      setContent(newContent);
      return;
    }
    
    if (currentTab === "lyrics") {
      setLyricsOnly(newContent);
      return;
    }
    
    const [instrumentId, voiceNumber] = currentTab.split('-');
    
    const updatedVoices = { ...voices };
    if (updatedVoices[instrumentId] && updatedVoices[instrumentId][voiceNumber]) {
      updatedVoices[instrumentId][voiceNumber] = newContent;
      setVoices(updatedVoices);
    }
  };

  // Opciones para el editor SimpleMDE
  const editorOptions = {
    autofocus: false,
    spellChecker: false,
    status: false,
    toolbar: false,
    placeholder: "Escribe tu canción aquí usando la notación musical...",
    shortcuts: {
      "toggleBlockquote": null,
      "toggleBold": null,
      "cleanBlock": null,
      "toggleHeadingSmaller": null,
      "toggleItalic": null,
      "drawLink": null,
      "toggleUnorderedList": null,
      "togglePreview": null,
      "toggleCodeBlock": null,
      "drawImage": null,
      "toggleOrderedList": null,
      "toggleHeadingBigger": null,
      "toggleSideBySide": null,
      "toggleFullScreen": null
    }
  };

  // Handler para cambios en el editor
  const handleEditorChange = (value) => {
    updateCurrentTabContent(value);
  };

  // Handler para cuando el editor pierde el foco
  const handleEditorBlur = () => {
    if (currentTab === "main") {
      extractMetadata();
    }
  };

  // Función para generar las pestañas
  const renderTabs = () => {
    const tabs = [
      { id: "main", label: "Acordes y Letra", icon: "bi-music-note-list" },
      { id: "lyrics", label: "Solo Letra", icon: "bi-card-text" }
    ];
    
    Object.entries(voices).forEach(([instrumentId, instrumentVoices]) => {
      Object.keys(instrumentVoices).sort().forEach(voiceNumber => {
        const instrumentName = TRANSPOSING_INSTRUMENTS[instrumentId]?.name || instrumentId;
        tabs.push({
          id: `${instrumentId}-${voiceNumber}`,
          label: `${instrumentName} ${voiceNumber}`,
          icon: "bi-music-note-beamed",
          removable: true
        });
      });
    });
    
    return (
      <div className="editor-tabs">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            className={`editor-tab ${currentTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <i className={tab.icon}></i>
            <span className="ms-1">{tab.label}</span>
            {tab.removable && (
              <button 
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  const [instId, voiceNum] = tab.id.split('-');
                  handleRemoveVoice(instId, voiceNum);
                }}
              >
                &times;
              </button>
            )}
          </button>
        ))}
        <button 
          className="editor-tab"
          onClick={() => setShowVoicesManager(!showVoicesManager)}
        >
          <i className="bi-plus-circle"></i>
          <span className="ms-1">{showVoicesManager ? 'Cancelar' : 'Añadir Voz'}</span>
        </button>
      </div>
    );
  };

  if (initialLoading) {
    return (
      <div className="editor-container">
        <div className="container">
          {/* Loading skeleton para editor */}
          <div className="editor-loading-skeleton fade-in">
            <div className="skeleton-editor-header">
              <div className="skeleton skeleton-title"></div>
              <div className="skeleton skeleton-subtitle"></div>
            </div>
            
            <div className="skeleton-metadata-section">
              <div className="skeleton-metadata-grid">
                <div className="skeleton skeleton-input"></div>
                <div className="skeleton skeleton-input"></div>
                <div className="skeleton skeleton-input"></div>
                <div className="skeleton skeleton-input"></div>
              </div>
            </div>
            
            <div className="skeleton-editor-main">
              <div className="skeleton-tabs">
                <div className="skeleton skeleton-tab"></div>
                <div className="skeleton skeleton-tab"></div>
                <div className="skeleton skeleton-tab"></div>
              </div>
              <div className="skeleton skeleton-editor-content"></div>
            </div>
            
            <LoadingSpinner 
              size="medium"
              text="Cargando editor..." 
              subtext="Preparando tu espacio de trabajo"
              type="editor"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="container">
        {/* Header */}
        <div className="editor-header fade-in">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1 className="editor-title">
                <i className="bi bi-music-note-beamed"></i>
                {isNewSong ? "Nueva Canción" : "Editar Canción"}
              </h1>
              <p className="editor-subtitle">
                {isNewSong ? "Crea una nueva canción desde cero" : "Modifica tu canción existente"}
              </p>
            </div>
            
            <div className="action-buttons">
              <button 
                className="btn-editor-secondary"
                onClick={() => navigate("/dashboard")}
              >
                <i className="bi bi-arrow-left me-2"></i>
                Cancelar
              </button>
              <button 
                className="btn-editor-primary" 
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Guardando...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger mb-4 fade-in" role="alert">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            {error}
          </div>
        )}

        {/* Preview de la canción */}
        <div className="song-preview-card fade-in-delay">
          <div className="song-preview-header">
            <h2 className="song-preview-title">{title || "Nueva Canción"}</h2>
            <div className="song-preview-meta">
              <span><i className="bi bi-music-note me-1"></i>{type}</span>
              <span><i className="bi bi-key me-1"></i>{key}</span>
              {version && <span><i className="bi bi-person me-1"></i>{version}</span>}
            </div>
          </div>
        </div>

        {/* Metadatos */}
        <div className="metadata-section slide-up">
          <h3 className="section-title mb-3">
            <i className="bi bi-tags"></i>
            Información de la Canción
          </h3>
          
          <div className="metadata-grid">
            <div className="form-group-modern">
              <label className="form-label-modern">
                <i className="bi bi-card-heading"></i>
                Título
              </label>
              <input
                type="text"
                className="form-control-modern"
                value={title}
                onChange={handleTitleChange}
                placeholder="Nombre de la canción"
              />
            </div>
            
            <div className="form-group-modern">
              <label className="form-label-modern">
                <i className="bi bi-person"></i>
                Versión de
              </label>
              <input
                type="text"
                className="form-control-modern"
                value={version}
                onChange={handleVersionChange}
                placeholder="Autor original o versión"
              />
            </div>
            
            <KeySelector
              value={key}
              onChange={handleKeyChange}
            />
            
            <TypeSelector
              value={type}
              onChange={handleTypeChange}
            />
          </div>
        </div>

        {/* Editor Principal */}
        <div className="editor-main slide-up-delay">
          {renderTabs()}
          
          {/* Formulario para añadir voces */}
          {showVoicesManager && (
            <div className="voice-manager">
              <h4 className="voice-manager-header">
                <i className="bi bi-plus-circle"></i>
                Añadir Nueva Voz
              </h4>
              <div className="voice-form">
                <div className="form-group-modern">
                  <label className="form-label-modern">Instrumento</label>
                  <select 
                    className="form-control-modern"
                    value={newVoiceInstrument}
                    onChange={(e) => setNewVoiceInstrument(e.target.value)}
                  >
                    {VOICE_INSTRUMENTS.map(inst => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern">Número de Voz</label>
                  <select 
                    className="form-control-modern"
                    value={newVoiceNumber}
                    onChange={(e) => setNewVoiceNumber(e.target.value)}
                  >
                    {[1, 2, 3, 4].map(num => (
                      <option key={num} value={num.toString()}>{num}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="btn-editor-primary"
                  onClick={handleAddVoice}
                >
                  <i className="bi bi-plus me-1"></i>
                  Añadir
                </button>
              </div>
            </div>
          )}
          
          {/* Mostrar botón "Generar letra automáticamente" solo en pestaña de letra */}
          {currentTab === "lyrics" && (
            <div className="p-3" style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button 
                className="btn-editor-secondary"
                onClick={handleGenerateLyrics}
              >
                <i className="bi bi-magic me-2"></i>
                Generar letra automáticamente
              </button>
              <div className="editor-help-text mt-2">
                Esto extraerá automáticamente la letra desde la pestaña principal, removiendo los acordes.
              </div>
            </div>
          )}
          
          {/* Contenido del editor */}
          <div className="editor-content">
            <SimpleMDE
              ref={editorRef}
              value={getCurrentTabContent()}
              onChange={handleEditorChange}
              onBlur={handleEditorBlur}
              options={editorOptions}
            />
          </div>
          
          {/* Texto de ayuda */}
          <div className="editor-help-text">
            {currentTab === "main" && (
              <>
                <i className="bi bi-info-circle me-2"></i>
                Usa el formato de notación: <code>DO SOL LA- FA</code> para los acordes.
                Usa <code>## Título</code> para crear secciones.
              </>
            )}
            
            {currentTab === "lyrics" && (
              <>
                <i className="bi bi-info-circle me-2"></i>
                Escribe solo la letra, sin acordes. Mantén los títulos de sección con <code>## Título</code>.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SongEditor;
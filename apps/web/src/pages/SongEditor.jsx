// apps/web/src/pages/SongEditor.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { createSong, getSongById, updateSong, addVoiceToSong, removeVoiceFromSong } from "@notesheet/api";
import { 
  transposeContent, 
  detectNotationSystem, 
  TRANSPOSING_INSTRUMENTS,
  extractLyricsOnly 
} from "@notesheet/core";
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

// Versión simplificada para tonalidades
const MAJOR_KEYS = RELATIVE_KEYS.map(pair => pair.major);
const MINOR_KEYS = RELATIVE_KEYS.map(pair => pair.minor);
const ALL_KEYS = [...MAJOR_KEYS, ...MINOR_KEYS];

// Tipos de canciones
const SONG_TYPES = ["Júbilo", "Adoración", "Moderada"];

// Instrumentos soportados para voces adicionales
const VOICE_INSTRUMENTS = Object.entries(TRANSPOSING_INSTRUMENTS)
  .map(([id, instrument]) => ({ id, name: instrument.name }));

function SongEditor() {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("DO");
  const [type, setType] = useState("Adoración");
  const [version, setVersion] = useState(""); // Versión
  const [content, setContent] = useState("");
  const [lyricsOnly, setLyricsOnly] = useState(""); // Nueva: contenido de solo letra
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isNewSong, setIsNewSong] = useState(true);
  const [contentUpdatePending, setContentUpdatePending] = useState(false);
  const [disableMetadataExtraction, setDisableMetadataExtraction] = useState(false);
  
  // Estado para voces adicionales
  const [voices, setVoices] = useState({});
  // Pestañas: "main" (principal), "lyrics" (solo letra), "instrumento-número" (voces)
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
      // Extraer metadatos iniciales (solo una vez al cargar)
      setTimeout(() => {
        extractMetadata();
      }, 500);
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
      
      // Cambio de author a version
      setVersion(song.version || "");
      
      // Cargar contenido principal
      setContent(song.content || "");
      
      // Cargar o generar contenido de solo letra
      if (song.lyricsOnly) {
        setLyricsOnly(song.lyricsOnly);
      } else {
        // Si no existe, generar a partir del contenido principal
        generateLyricsOnly(song.content || "");
      }
      
      // Cargar voces adicionales si existen
      if (song.voices) {
        setVoices(song.voices);
      }
    } catch (error) {
      setError("Error al cargar la canción: " + error.message);
      console.error("Error loading song:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generar versión de solo letra a partir del contenido con acordes
  const generateLyricsOnly = (contentWithChords) => {
    // Primero, procesamos línea por línea
    const lines = contentWithChords.split('\n');
    const processedLines = lines.map(line => {
      // Mantener líneas de metadatos (# Título, etc.)
      if (line.startsWith('#')) {
        return line;
      }
      
      // Mantener títulos de secciones (## Intro, etc.)
      if (line.startsWith('##')) {
        return line;
      }
      
      // Eliminar acordes (palabras que coinciden con patrones de acordes)
      return line.replace(/\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?(?:m)?\b/g, '')
                 .replace(/\|\s*\|/g, '') // Eliminar barras dobles vacías
                 .replace(/\s{2,}/g, ' ') // Reemplazar múltiples espacios por uno solo
                 .trim();
    });
    
    // Eliminar líneas vacías consecutivas
    let result = '';
    let previousLineEmpty = false;
    
    processedLines.forEach(line => {
      const isCurrentLineEmpty = line.trim() === '';
      
      if (isCurrentLineEmpty && previousLineEmpty) {
        // No agregar otra línea vacía
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
      const typeValue = typeMatch[1].trim();
      // Solo actualizar si el tipo está en la lista permitida
      if (SONG_TYPES.includes(typeValue)) {
        setType(typeValue);
      }
    }
    
    // Extraer versión (antes author)
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

  // Actualizar el contenido con los metadatos
  const updateContentMetadata = () => {
    if (!content) return;
    
    // Desactivar extracción de metadatos para evitar ciclos
    setDisableMetadataExtraction(true);
    
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
    
    // Actualizar versión (antes autor)
    const versionRegex = /^#\s*(?:Versión de|Versión|Version|Autor|Author):\s*.+$/m;
    if (updatedContent.match(versionRegex)) {
      updatedContent = updatedContent.replace(
        versionRegex,
        `# Versión de: ${version}`
      );
    } else {
      // Si no existe la línea de versión, agregarla después de Tipo
      updatedContent = updatedContent.replace(
        /^#\s*(?:Tipo|Type):\s*.+$/m,
        `# Tipo: ${type}\n# Versión de: ${version}`
      );
    }
    
    // Solo actualizar si cambió
    if (updatedContent !== content) {
      setContent(updatedContent);
    }
    
    // También actualizar metadatos en la vista de solo letras
    let updatedLyrics = lyricsOnly;
    
    // Actualizar título en lyricsOnly
    updatedLyrics = updatedLyrics.replace(
      /^#\s*(?:Canción|Título|Title):\s*.+$/m,
      `# Título: ${title}`
    );
    
    // Actualizar tonalidad en lyricsOnly
    updatedLyrics = updatedLyrics.replace(
      /^#\s*(?:Tonalidad|Key):\s*.+$/m,
      `# Tonalidad: ${key} ${keyType}`
    );
    
    // Actualizar tipo en lyricsOnly
    updatedLyrics = updatedLyrics.replace(
      /^#\s*(?:Tipo|Type):\s*.+$/m,
      `# Tipo: ${type}`
    );
    
    // Actualizar versión en lyricsOnly
    if (updatedLyrics.match(versionRegex)) {
      updatedLyrics = updatedLyrics.replace(
        versionRegex,
        `# Versión de: ${version}`
      );
    } else {
      // Si no existe la línea de versión, agregarla después de Tipo
      updatedLyrics = updatedLyrics.replace(
        /^#\s*(?:Tipo|Type):\s*.+$/m,
        `# Tipo: ${type}\n# Versión de: ${version}`
      );
    }
    
    // Solo actualizar si cambió
    if (updatedLyrics !== lyricsOnly) {
      setLyricsOnly(updatedLyrics);
    }
    
    // Re-activar extracción de metadatos después de un breve retraso
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

    // Actualizar metadatos en contenido antes de guardar
    updateContentMetadata();

    try {
      setLoading(true);
      
      const songData = {
        title,
        key,
        type,
        version,
        content,
        lyricsOnly,  // Guardar versión de solo letra
        voices,      // Incluir las voces adicionales
        userId: currentUser.uid
      };

      let savedSong;
      if (isNewSong) {
        savedSong = await createSong(songData);
      } else {
        savedSong = await updateSong(id, songData);
      }

      navigate("/dashboard");
    } catch (error) {
      setError("Error al guardar la canción: " + error.message);
      console.error("Error saving song:", error);
    } finally {
      setLoading(false);
    }
  };

  // Función para generar automáticamente la letra
  const handleGenerateLyrics = () => {
    if (currentTab === "main") {
      generateLyricsOnly(content);
    }
  };

  // Sincronizar secciones entre contenido principal y letra
  const syncSections = () => {
    // Extraer secciones del contenido principal
    const sectionRegex = /^##\s+(.+)$/gm;
    const mainSections = [];
    let match;
    
    while ((match = sectionRegex.exec(content)) !== null) {
      mainSections.push({ title: match[1], index: match.index });
    }
    
    // Si no hay secciones, no hacemos nada
    if (mainSections.length === 0) return;
    
    // Verificar si las mismas secciones existen en lyricsOnly
    const lyricsSections = [];
    sectionRegex.lastIndex = 0; // Resetear el índice
    
    while ((match = sectionRegex.exec(lyricsOnly)) !== null) {
      lyricsSections.push({ title: match[1], index: match.index });
    }
    
    // Si faltan secciones en lyricsOnly, agregarlas
    if (lyricsSections.length < mainSections.length) {
      let updatedLyrics = lyricsOnly;
      
      // Para cada sección en el contenido principal
      for (const section of mainSections) {
        // Verificar si esta sección existe en lyricsOnly
        const sectionExists = lyricsSections.some(s => s.title === section.title);
        
        if (!sectionExists) {
          // Agregar la sección al final
          updatedLyrics += `\n\n## ${section.title}\n`;
        }
      }
      
      setLyricsOnly(updatedLyrics);
    }
  };

  // Funciones para manejar las voces adicionales
  const handleAddVoice = async () => {
    if (!newVoiceInstrument || !newVoiceNumber) return;
    
    // Comprobar si ya existe esta voz
    if (voices[newVoiceInstrument] && voices[newVoiceInstrument][newVoiceNumber]) {
      setError("Esta voz ya existe");
      return;
    }
    
    // Crear una copia de la estructura de voces actual
    const updatedVoices = { ...voices };
    
    // Asegurarse de que existe la estructura para este instrumento
    if (!updatedVoices[newVoiceInstrument]) {
      updatedVoices[newVoiceInstrument] = {};
    }
    
    // Crear una versión de la voz basada en el contenido principal
    const voiceContent = content;
    updatedVoices[newVoiceInstrument][newVoiceNumber] = voiceContent;
    
    // Actualizar el estado
    setVoices(updatedVoices);
    
    // Si no es una canción nueva, guardar la voz en la base de datos
    if (!isNewSong && id) {
      try {
        await addVoiceToSong(id, newVoiceInstrument, newVoiceNumber, voiceContent);
      } catch (error) {
        console.error("Error adding voice:", error);
        setError("Error al añadir la voz: " + error.message);
      }
    }
    
    // Cambiar a la pestaña de la nueva voz
    setCurrentTab(`${newVoiceInstrument}-${newVoiceNumber}`);
    
    // Resetear el formulario
    setNewVoiceInstrument("bb_trumpet");
    setNewVoiceNumber("1");
    setShowVoicesManager(false);
  };
  
  const handleRemoveVoice = async (instrumentId, voiceNumber) => {
    if (!confirm(`¿Estás seguro de eliminar la voz ${voiceNumber} de ${TRANSPOSING_INSTRUMENTS[instrumentId]?.name}?`)) {
      return;
    }
    
    // Crear una copia de la estructura de voces actual
    const updatedVoices = { ...voices };
    
    // Eliminar la voz
    if (updatedVoices[instrumentId] && updatedVoices[instrumentId][voiceNumber]) {
      delete updatedVoices[instrumentId][voiceNumber];
      
      // Si no quedan voces para este instrumento, eliminar la entrada
      if (Object.keys(updatedVoices[instrumentId]).length === 0) {
        delete updatedVoices[instrumentId];
      }
      
      // Actualizar el estado
      setVoices(updatedVoices);
      
      // Si no es una canción nueva, guardar el cambio en la base de datos
      if (!isNewSong && id) {
        try {
          await removeVoiceFromSong(id, instrumentId, voiceNumber);
        } catch (error) {
          console.error("Error removing voice:", error);
          setError("Error al eliminar la voz: " + error.message);
        }
      }
      
      // Si estábamos editando esta voz, cambiar a la principal
      if (currentTab === `${instrumentId}-${voiceNumber}`) {
        setCurrentTab("main");
      }
    }
  };
  
  const handleTabChange = (tabId) => {
    // Guardar cualquier cambio pendiente
    if (currentTab === "main" && tabId !== "main") {
      // Si vamos de main a otra pestaña, sincronizar metadatos
      updateContentMetadata();
      
      // Si vamos a la pestaña de letra, asegurarse de que las secciones estén sincronizadas
      if (tabId === "lyrics") {
        syncSections();
      }
    }
    
    // Si el tab es "main", mostrar el contenido principal
    if (tabId === "main") {
      setCurrentTab("main");
      return;
    }
    
    // Si el tab es "lyrics", mostrar la letra
    if (tabId === "lyrics") {
      setCurrentTab("lyrics");
      return;
    }
    
    // En otro caso, el tabId debe ser "instrumentId-voiceNumber"
    const [instrumentId, voiceNumber] = tabId.split('-');
    
    // Comprobar si existe la voz
    if (voices[instrumentId] && voices[instrumentId][voiceNumber]) {
      setCurrentTab(tabId);
    } else {
      // Si no existe, mostrar el contenido principal
      setCurrentTab("main");
    }
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
    
    // Actualizar la voz en el estado
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
    toolbar: false, // Quitar la barra de herramientas completamente
    placeholder: "Escribe tu canción aquí usando la notación musical...",
    // Esto es crucial para solucionar el problema del foco
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
    // Actualizar el contenido de la pestaña actual
    updateCurrentTabContent(value);
    
    // Si estamos editando el contenido principal, actualizar automáticamente la letra
    // Pero solo si no han editado manualmente la letra
    if (currentTab === "main") {
      // Posible lógica para actualización automática si se desea
    }
  };

  // Handler para cuando el editor pierde el foco
  const handleEditorBlur = () => {
    // Extraer metadatos cuando el editor pierde el foco (solo para contenido principal)
    if (currentTab === "main") {
      extractMetadata();
    }
  };

  // Función para generar las pestañas
  const renderTabs = () => {
    // La pestaña principal y la de letra siempre están presentes
    const tabs = [
      { id: "main", label: "Acordes y Letra" },
      { id: "lyrics", label: "Solo Letra" }
    ];
    
    // Añadir las voces adicionales
    Object.entries(voices).forEach(([instrumentId, instrumentVoices]) => {
      Object.keys(instrumentVoices).sort().forEach(voiceNumber => {
        const instrumentName = TRANSPOSING_INSTRUMENTS[instrumentId]?.name || instrumentId;
        tabs.push({
          id: `${instrumentId}-${voiceNumber}`,
          label: `${instrumentName} ${voiceNumber}`,
          removable: true // Las voces adicionales pueden eliminarse
        });
      });
    });
    
    return (
      <div className="mb-3">
        <ul className="nav nav-tabs">
          {tabs.map(tab => (
            <li className="nav-item" key={tab.id}>
              <button 
                className={`nav-link ${currentTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                {tab.label}
                {tab.removable && (
                  <button 
                    className="btn btn-sm ms-2 text-danger"
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
            </li>
          ))}
          <li className="nav-item">
            <button 
              className="nav-link"
              onClick={() => setShowVoicesManager(!showVoicesManager)}
            >
              {showVoicesManager ? 'Cancelar' : '+ Añadir Voz'}
            </button>
          </li>
        </ul>
      </div>
    );
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
              <label htmlFor="version" className="form-label">Versión de</label>
              <input
                type="text"
                className="form-control"
                id="version"
                value={version}
                onChange={handleVersionChange}
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
            {version && <small className="text-muted d-block mt-1">Versión de: {version}</small>}
          </div>
          
          {/* Pestañas para contenido/letra/voces */}
          {renderTabs()}
          
          {/* Formulario para añadir voces */}
          {showVoicesManager && (
            <div className="card mb-3">
              <div className="card-body">
                <h5 className="card-title">Añadir Voz</h5>
                <div className="row">
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Instrumento</label>
                    <select 
                      className="form-select"
                      value={newVoiceInstrument}
                      onChange={(e) => setNewVoiceInstrument(e.target.value)}
                    >
                      {VOICE_INSTRUMENTS.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label">Número de Voz</label>
                    <select 
                      className="form-select"
                      value={newVoiceNumber}
                      onChange={(e) => setNewVoiceNumber(e.target.value)}
                    >
                      {[1, 2, 3, 4].map(num => (
                        <option key={num} value={num.toString()}>{num}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <button 
                    className="btn btn-primary"
                    onClick={handleAddVoice}
                  >
                    Añadir Voz
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Mostrar botón "Generar letra automáticamente" solo en pestaña de letra */}
          {currentTab === "lyrics" && (
            <div className="mb-3">
              <button 
                className="btn btn-outline-primary"
                onClick={handleGenerateLyrics}
                title="Extraer automáticamente la letra de la canción desde la pestaña principal"
              >
                <i className="bi bi-magic"></i> Generar letra automáticamente
              </button>
              <small className="text-muted ms-2">
                Esto reemplazará cualquier texto en la pestaña de letra.
              </small>
            </div>
          )}
          
          {/* Editor de contenido */}
          <SimpleMDE
            ref={editorRef}
            value={getCurrentTabContent()}
            onChange={handleEditorChange}
            onBlur={handleEditorBlur}
            options={editorOptions}
          />
          
          {/* Mostrar ayuda contextual según la pestaña actual */}
          {currentTab === "main" && (
            <small className="form-text text-muted mt-2">
              Usa el formato de notación: <code className="song-notation">DO SOL LA- FA</code> para los acordes.
              Usa <code className="song-notation">## Título</code> para crear secciones.
            </small>
          )}
          
          {currentTab === "lyrics" && (
            <small className="form-text text-muted mt-2">
              Escribe solo la letra, sin acordes. Mantén los títulos de sección con <code className="song-notation">## Título</code>.
            </small>
          )}
        </div>
      </div>
    </div>
  );
}

export default SongEditor;
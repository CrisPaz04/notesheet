// apps/web/src/pages/SongEditor.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  createSong,
  getSongById,
  updateSong,
  uploadScore,
  deleteScore
} from "@notesheet/api";
import {
  TRANSPOSING_INSTRUMENTS,
  SONG_FORMAT_CHORDS,
  SONG_FORMAT_PDF,
  getSongFormat,
  parseVoiceKey,
  setScoreInMap,
  removeScoreFromMap,
  sugerirTonalidad,
  extractLyricsOnly,
  nombrarTonalidad,
  leerVersiones,
  limpiarVersiones,
  unirVersiones,
  tempoDesdeToques,
  TEMPO_MIN,
  TEMPO_MAX,
  formatearDuracion
} from "@notesheet/core";
import KeySelector from "../components/KeySelector";
import LoadingSpinner from "../components/LoadingSpinner";
import SimpleMDE from "react-simplemde-editor";
import "easymde/dist/easymde.min.css";
import TypeSelector from "../components/TypeSelector";
import ScoreUploader from "../components/ScoreUploader";
import VersionesInput from "../components/VersionesInput";
import useNotacionPreferida from "../hooks/useNotacionPreferida";
import BuscarDatosModal from "../components/datos/BuscarDatosModal";
import useSongVoices, { LYRICS_TAB, ACORDES_TAB } from "../hooks/useSongVoices";
import Desplegable from "../components/Desplegable";

// Instrumentos soportados para voces adicionales
const VOICE_INSTRUMENTS = Object.entries(TRANSPOSING_INSTRUMENTS)
  .map(([id, instrument]) => ({ id, name: instrument.name }));

// Fuera del componente a propósito. react-simplemde-editor vuelve a crear
// el editor cada vez que `options` cambia de identidad, y un objeto escrito
// dentro del componente es nuevo en cada render: como cada tecla provoca un
// render, cada tecla destruía el editor y el cursor se perdía, así que había
// que volver a hacer clic para seguir escribiendo.
// Pestañas que son texto también en una canción en PDF: no son voces
const PESTANAS_DE_TEXTO = [LYRICS_TAB, ACORDES_TAB];

const EDITOR_OPTIONS = {
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

const COMPASES = ["2/4", "3/4", "4/4", "6/8", "12/8"];

// El tempo escrito, como número, o null si está vacío o no tiene sentido
const tempoValido = (texto) => {
  const n = Math.round(Number(String(texto).replace(",", ".")));
  return Number.isFinite(n) && n >= TEMPO_MIN && n <= TEMPO_MAX ? n : null;
};

function SongEditor() {
  const [title, setTitle] = useState("");
  const [key, setKey] = useState("DO");
  const [type, setType] = useState("Adoración");
  // Uno o varios nombres (ver versiones.js en core)
  const [versiones, setVersiones] = useState([]);
  const [album, setAlbum] = useState("");
  // El tempo de la banda (el que usa el metrónomo al abrirlo desde la
  // canción) y el compás. Como texto mientras se edita.
  const [tempo, setTempo] = useState("");
  const [compas, setCompas] = useState("");
  // Datos de la grabación original, traídos con "Buscar datos". En
  // concierto: nunca se mezclan con `key` (ver datosCancion.js en core).
  const [grabacion, setGrabacion] = useState(null);
  const [buscandoDatos, setBuscandoDatos] = useState(false);
  const toquesRef = useRef([]);
  const [content, setContent] = useState("");
  const [lyricsOnly, setLyricsOnly] = useState("");
  // En concierto, como los toca la guitarra sin cejilla (ver
  // `renderChordChart`). Se guardan tal cual se escriben.
  const [acordes, setAcordes] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [isNewSong, setIsNewSong] = useState(true);
  // Las canciones nuevas nacen en el repertorio compartido; las que ya
  // existian, sin el campo `public`, se mantienen privadas.
  const [isPublic, setIsPublic] = useState(true);
  
  // Formato del cuerpo: acordes en texto (lo de siempre) o partituras en PDF.
  // Las canciones existentes no tienen el campo y cuentan como acordes.
  const [format, setFormat] = useState(SONG_FORMAT_CHORDS);
  const [pdfs, setPdfs] = useState({});
  // Qué casilla se está subiendo ahora, como "bb_trumpet-1:conNotas"
  const [subiendo, setSubiendo] = useState("");

  // Estado del gestor de voces (UI)
  const [showVoicesManager, setShowVoicesManager] = useState(false);
  const [newVoiceInstrument, setNewVoiceInstrument] = useState("bb_trumpet");
  const [newVoiceNumber, setNewVoiceNumber] = useState("1");

  const { currentUser, canEditSongs } = useAuth();
  // Solo para mostrar las tonalidades; se guardan en latina
  const [notacion] = useNotacionPreferida(currentUser);
  const navigate = useNavigate();
  const { id } = useParams();
  const editorRef = useRef(null);

  // Alta/baja de voces, pestaña activa y contenido de cada una
  const {
    voices,
    setVoices,
    currentTab,
    setCurrentTab,
    primaryInstrument,
    setPrimaryInstrument,
    primaryVoiceNumber,
    setPrimaryVoiceNumber,
    addVoice,
    removeVoice,
    getCurrentTabContent,
    updateCurrentTabContent
  } = useSongVoices({
    songId: id,
    isNewSong,
    onError: setError,
    lyrics: { value: lyricsOnly, onChange: setLyricsOnly },
    acordes: { value: acordes, onChange: setAcordes }
  });

  // Si las notas no encajan con la tonalidad elegida, proponer la que sí.
  // Se miran todas las voces juntas: están escritas en la misma tonalidad
  // (la de la trompeta en Sib) y cuantas más notas, mejor acierta. En un PDF
  // no hay notas que leer.
  const sugerenciaTonalidad = useMemo(() => {
    if (format !== SONG_FORMAT_CHORDS) return null;
    const textos = Object.values(voices || {}).flatMap((porVoz) => Object.values(porVoz || {}));
    return sugerirTonalidad(textos, key);
  }, [voices, key, format]);

  // Al cargar, verifica si es una canción nueva o existente
  useEffect(() => {
    if (id) {
      setIsNewSong(false);
      loadSong(id);
    } else {
      // Plantilla para una nueva canción - inicializa con Trompeta 1
      const initialVoiceContent = `## Intro


## Verso 1


## Coro

`;
      setVoices({ bb_trumpet: { "1": initialVoiceContent } });
      setCurrentTab("bb_trumpet-1");
      setPrimaryInstrument("bb_trumpet");
      setPrimaryVoiceNumber("1");
      setInitialLoading(false);
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
      setVersiones(leerVersiones(song));
      setAlbum(song.album || "");
      setTempo(song.tempo ? String(song.tempo) : "");
      setCompas(song.compas || "");
      setGrabacion(song.grabacion || null);
      setIsPublic(song.public === true);
      setContent(song.content || "");
      setFormat(getSongFormat(song));
      setPdfs(song.pdfs || {});

      setAcordes(song.acordes || "");

      if (song.lyricsOnly) {
        setLyricsOnly(song.lyricsOnly);
      } else if (getSongFormat(song) !== SONG_FORMAT_PDF) {
        // En un PDF no hay acordes de los que sacar la letra. Generarla
        // igualmente dejaba dentro la plantilla de secciones de la canción
        // nueva ("## Intro", "## Verso 1"...), y el visor acababa mostrando
        // una vista de letra vacía con esos títulos sueltos.
        //
        // Con la función de core, no con una regex propia: la que había
        // borraba palabras de la letra ("A Dios" -> " Dios", porque "A" es
        // una nota) y dejaba pasar las líneas de notas de la banda ("Re# Mi
        // Fa#"), que solo reconocía en mayúsculas.
        setLyricsOnly(extractLyricsOnly(song.content || "").trim());
      }

      if (song.voices && Object.keys(song.voices).length > 0) {
        setVoices(song.voices);
        // Use saved primary instrument/voice or default to first voice
        const savedPrimaryInstrument = song.primaryInstrument || Object.keys(song.voices)[0];
        const savedPrimaryVoiceNumber = song.primaryVoiceNumber || Object.keys(song.voices[savedPrimaryInstrument])[0];
        setCurrentTab(`${savedPrimaryInstrument}-${savedPrimaryVoiceNumber}`);
        setPrimaryInstrument(savedPrimaryInstrument);
        setPrimaryVoiceNumber(savedPrimaryVoiceNumber);
      } else if (song.pdfs && Object.keys(song.pdfs).length > 0) {
        // Canción en PDF: las pestañas salen de la matriz de archivos. El
        // mapa `voices` es el que dice qué casillas tiene la canción, con
        // independencia de si el cuerpo es texto o PDF.
        const desdePdfs = {};
        Object.entries(song.pdfs).forEach(([instrumentId, porVoz]) => {
          desdePdfs[instrumentId] = {};
          Object.keys(porVoz).forEach((voiceNumber) => {
            desdePdfs[instrumentId][voiceNumber] = "";
          });
        });

        const primerInstrumento = song.primaryInstrument || Object.keys(desdePdfs)[0];
        const primeraVoz = song.primaryVoiceNumber
          || Object.keys(desdePdfs[primerInstrumento] || {})[0]
          || "1";

        setVoices(desdePdfs);
        setCurrentTab(`${primerInstrumento}-${primeraVoz}`);
        setPrimaryInstrument(primerInstrumento);
        setPrimaryVoiceNumber(primeraVoz);
      } else {
        // Legacy song without voices - create trumpet 1 with the content
        const legacyVoices = { bb_trumpet: { "1": song.content || "" } };
        setVoices(legacyVoices);
        setCurrentTab("bb_trumpet-1");
        setPrimaryInstrument("bb_trumpet");
        setPrimaryVoiceNumber("1");
      }
    } catch (error) {
      setError("Error al cargar la canción: " + error.message);
      console.error("Error loading song:", error);
    } finally {
      setInitialLoading(false);
    }
  };



  // Handlers para cambios de campos
  const handleTitleChange = (e) => {
    setTitle(e.target.value);
  };

  const handleKeyChange = (newKey) => {
    setKey(newKey);
  };

  const handleTypeChange = (newType) => {
    setType(newType);
  };

  const handleAlbumChange = (e) => {
    setAlbum(e.target.value);
  };

  // Tap tempo: cada toque apunta el instante; con tres ya hay tempo. Si pasan
  // más de 2 s entre toques, se empieza de nuevo.
  const handleTapTempo = () => {
    const ahora = performance.now();
    const toques = toquesRef.current;
    if (toques.length && ahora - toques[toques.length - 1] > 2000) toques.length = 0;
    toques.push(ahora);
    if (toques.length > 8) toques.shift();
    const calculado = tempoDesdeToques(toques);
    if (calculado) setTempo(String(calculado));
  };

  // Lo que el músico aceptó en "Buscar datos": solo rellena el formulario
  const aplicarDatos = (propuesta) => {
    if (propuesta.grabacion) setGrabacion(propuesta.grabacion);
    if (propuesta.tempo) setTempo(String(propuesta.tempo));
    if (propuesta.compas) setCompas(propuesta.compas);
    if (propuesta.versiones) setVersiones(propuesta.versiones);
  };

  // Guardar la canción
  const handleSave = async (e) => {
    e.preventDefault();

    // Get the primary voice content
    const primaryContent = voices[primaryInstrument]?.[primaryVoiceNumber] || "";
    const esPdf = format === SONG_FORMAT_PDF;

    // En una canción en PDF el cuerpo son los archivos, no el texto. Y no se
    // puede exigir que haya alguno al guardar: la regla de Storage consulta
    // la canción en Firestore para dejar subir, así que primero hay que
    // guardarla y después subir las partituras.
    if (!esPdf && !primaryContent.trim()) {
      setError("El contenido de la canción no puede estar vacío");
      return;
    }

    // Una canción en PDF recién guardada no tiene ni texto ni archivos
    // todavía: sin título no habría absolutamente nada por lo que
    // reconocerla en el repertorio.
    if (esPdf && !title.trim()) {
      setError("Ponle un título a la canción antes de guardarla");
      return;
    }

    try {
      setLoading(true);

      const songData = {
        title,
        key,
        type,
        // La lista, y el texto de siempre para todo lo que ya lee `version`
        versiones: limpiarVersiones(versiones),
        version: unirVersiones(versiones),
        album: album.trim(),
        tempo: tempoValido(tempo),
        compas: compas || null,
        grabacion: grabacion || null,
        // En un PDF el cuerpo son los archivos. Guardar aquí el texto de la
        // voz principal metía la plantilla de la canción nueva, que luego
        // reaparecía como una vista de letra fantasma.
        content: esPdf ? "" : primaryContent,
        lyricsOnly,
        acordes,
        voices,
        format,
        pdfs,
        primaryInstrument,
        primaryVoiceNumber,
        public: isPublic,
        userId: currentUser.uid
      };

      if (isNewSong) {
        // Una canción en PDF nace vacía y hay que volver a ella para subir
        // los archivos: la regla de Storage necesita que exista primero.
        const creada = await createSong(songData);
        if (esPdf) {
          setIsNewSong(false);
          navigate(`/songs/${creada.id}/edit`, { replace: true });
          return;
        }
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

  /**
   * Sube el PDF de una variante de la pestaña activa.
   *
   * Se sube y se guarda en el acto, sin esperar al botón de Guardar: subir un
   * archivo ya es un cambio hecho en Storage, y dejar el documento sin la
   * ruta hasta que alguien pulse Guardar deja partituras huérfanas cada vez
   * que se cierra la pestaña a medias.
   */
  const handleUploadScore = async (variant, file) => {
    const parsed = parseVoiceKey(currentTab);
    if (!parsed || !id) return;

    const { instrumentId, voiceNumber } = parsed;
    setSubiendo(`${currentTab}:${variant}`);
    setError("");

    try {
      const path = await uploadScore({
        songId: id,
        instrumentId,
        voiceNumber,
        variant,
        file
      });

      const actualizado = setScoreInMap(pdfs, instrumentId, voiceNumber, variant, path);
      setPdfs(actualizado);
      await updateSong(id, { pdfs: actualizado, format: SONG_FORMAT_PDF });
    } catch (uploadError) {
      console.error("Error uploading score:", uploadError);
      setError("Error al subir la partitura: " + uploadError.message);
    } finally {
      setSubiendo("");
    }
  };

  /**
   * Quita el PDF de una variante: primero de Storage y después del documento.
   *
   * Ese orden, y no el contrario: la regla de Storage mira la canción en
   * Firestore para dejar borrar, así que si se quitase antes la ruta y el
   * borrado fallase, el archivo quedaría ahí sin forma de llegar a él.
   */
  const handleRemoveScore = async (variant) => {
    const parsed = parseVoiceKey(currentTab);
    if (!parsed || !id) return;

    const { instrumentId, voiceNumber } = parsed;
    const path = pdfs?.[instrumentId]?.[voiceNumber]?.[variant];
    if (!path) return;

    if (!confirm("¿Quitar esta partitura? El archivo se borra.")) return;

    setError("");

    try {
      await deleteScore(path);

      const actualizado = removeScoreFromMap(pdfs, instrumentId, voiceNumber, variant);
      setPdfs(actualizado);
      await updateSong(id, { pdfs: actualizado });
    } catch (removeError) {
      console.error("Error removing score:", removeError);
      setError("Error al quitar la partitura: " + removeError.message);
    }
  };

  // Funciones para manejar voces
  const handleAddVoice = async () => {
    const added = await addVoice(newVoiceInstrument, newVoiceNumber, content);
    if (!added) return;

    setNewVoiceInstrument("bb_trumpet");
    setNewVoiceNumber("1");
    setShowVoicesManager(false);
  };

  const handleRemoveVoice = async (instrumentId, voiceNumber) => {
    const isPrimary = instrumentId === primaryInstrument
      && voiceNumber === primaryVoiceNumber;
    const nombre = TRANSPOSING_INSTRUMENTS[instrumentId]?.name || instrumentId;

    // La confirmación se queda aquí: el hook no toca el DOM
    if (!isPrimary && !confirm(`¿Estás seguro de eliminar la voz ${voiceNumber} de ${nombre}?`)) {
      return;
    }

    const quitada = await removeVoice(instrumentId, voiceNumber);
    if (!quitada) return;

    // Quitar la voz se lleva también sus PDF: si no, quedarían en Storage
    // sin pestaña desde la que llegar a ellos. Otra vez los archivos antes
    // que el documento, por la regla de Storage.
    const casilla = pdfs?.[instrumentId]?.[voiceNumber];
    if (!casilla || !id) return;

    try {
      let actualizado = pdfs;
      for (const variant of Object.keys(casilla)) {
        await deleteScore(casilla[variant]);
        actualizado = removeScoreFromMap(actualizado, instrumentId, voiceNumber, variant);
      }

      setPdfs(actualizado);
      await updateSong(id, { pdfs: actualizado });
    } catch (removeError) {
      console.error("Error removing scores of voice:", removeError);
      setError("La voz se quitó, pero sus partituras no: " + removeError.message);
    }
  };

  const handleTabChange = (tabId) => {
    setCurrentTab(tabId);
  };

  // Las dos casillas de PDF de la pestaña activa
  const pdfsDeLaPestana = (() => {
    const parsed = parseVoiceKey(currentTab);
    if (!parsed) return {};
    return pdfs?.[parsed.instrumentId]?.[parsed.voiceNumber] || {};
  })();


  // Handler para cambios en el editor
  const handleEditorChange = (value) => {
    updateCurrentTabContent(value);
  };

  // Handler para cuando el editor pierde el foco
  const handleEditorBlur = () => {
    // No longer needed for metadata extraction since we removed the main tab
  };

  // Función para cambiar el instrumento principal
  const handlePrimaryInstrumentChange = (newInstrument) => {
    const newTabKey = `${newInstrument}-${primaryVoiceNumber}`;

    // Get the current content
    const currentContent = voices[primaryInstrument]?.[primaryVoiceNumber] || "";

    // Create updated voices object
    const updatedVoices = { ...voices };

    // Remove old instrument if it only has this voice
    if (updatedVoices[primaryInstrument]) {
      delete updatedVoices[primaryInstrument][primaryVoiceNumber];
      if (Object.keys(updatedVoices[primaryInstrument]).length === 0) {
        delete updatedVoices[primaryInstrument];
      }
    }

    // Add new instrument with the content
    if (!updatedVoices[newInstrument]) {
      updatedVoices[newInstrument] = {};
    }
    updatedVoices[newInstrument][primaryVoiceNumber] = currentContent;

    setVoices(updatedVoices);
    setPrimaryInstrument(newInstrument);
    setCurrentTab(newTabKey);
  };

  // Función para generar las pestañas
  const renderTabs = () => {
    const tabs = [];

    // Add instrument voice tabs
    Object.entries(voices).forEach(([instrumentId, instrumentVoices]) => {
      Object.keys(instrumentVoices).sort().forEach(voiceNumber => {
        const instrumentName = TRANSPOSING_INSTRUMENTS[instrumentId]?.name || instrumentId;
        const isPrimary = instrumentId === primaryInstrument && voiceNumber === primaryVoiceNumber;
        // En PDF, cuántas de las dos variantes están subidas. Verlo en la
        // propia pestaña es lo que evita tener que entrar una por una para
        // saber qué falta con nueve instrumentos por delante.
        const subidas = Object.keys(pdfs?.[instrumentId]?.[voiceNumber] || {}).length;

        tabs.push({
          id: `${instrumentId}-${voiceNumber}`,
          label: `${instrumentName} ${voiceNumber}`,
          icon: "bi-music-note-beamed",
          badge: format === SONG_FORMAT_PDF ? `${subidas}/2` : null,
          removable: !isPrimary // Don't allow removing the primary voice
        });
      });
    });

    // Letra y acordes al final: no son voces
    tabs.push({ id: "lyrics", label: "Solo Letra", icon: "bi-card-text" });
    tabs.push({ id: "acordes", label: "Acordes", icon: "bi-music-note" });

    return (
      <div className="editor-tabs">
        {/* La pestaña es un contenedor con dos botones hermanos, elegir y
            quitar: un botón dentro de otro es HTML inválido y el de dentro
            no se alcanza bien con teclado ni con lector de pantalla. Al ser
            hermanos, quitar ya no pasa por el clic de elegir. */}
        {tabs.map(tab => {
          const activa = currentTab === tab.id;
          const quitable = tab.removable && canEditSongs();
          return (
            <div
              key={tab.id}
              className={`editor-tab ${activa ? 'active' : ''}`}
            >
              <button
                type="button"
                className="editor-tab-select"
                aria-current={activa ? 'true' : undefined}
                onClick={() => handleTabChange(tab.id)}
              >
                <i className={tab.icon}></i>
                <span className="ms-1">{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`tab-badge ${tab.badge === '2/2' ? 'tab-badge--completa' : ''}`}
                    title="Partituras subidas de las dos posibles"
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
              {quitable && (
                <button
                  type="button"
                  className="tab-close"
                  aria-label={`Quitar ${tab.label}`}
                  onClick={() => {
                    const [instId, voiceNum] = tab.id.split('-');
                    handleRemoveVoice(instId, voiceNum);
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
        {canEditSongs() && (
          <button
            className="editor-tab"
            onClick={() => setShowVoicesManager(!showVoicesManager)}
          >
            <i className="bi-plus-circle"></i>
            <span className="ms-1">{showVoicesManager ? 'Cancelar' : 'Añadir Voz'}</span>
          </button>
        )}
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
              {versiones.length > 0 && <span><i className="bi bi-person me-1"></i>{unirVersiones(versiones)}</span>}
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
              <label className="form-label-modern" htmlFor="song-versiones">
                <i className="bi bi-person"></i>
                Versión de
              </label>
              <VersionesInput
                id="song-versiones"
                value={versiones}
                onChange={setVersiones}
              />
              <div className="form-help-text">
                Pulsa Enter para añadir otro nombre.
              </div>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">
                <i className="bi bi-disc me-2"></i>
                Álbum
              </label>
              <input
                type="text"
                className="form-control-modern"
                value={album}
                onChange={handleAlbumChange}
                placeholder="Álbum al que pertenece"
              />
              <div className="form-help-text">
                Las canciones del mismo álbum se enlazan entre sí.
              </div>
            </div>

            <TypeSelector
              value={type}
              onChange={handleTypeChange}
            />

            <div>
              <KeySelector
                value={key}
                onChange={handleKeyChange}
                notacion={notacion}
              />
              {/* Solo cambia el selector: no guarda ni transpone. Se da por
                  hecho que las notas están bien y lo que falla es la etiqueta. */}
              {sugerenciaTonalidad && (
                <div className="key-suggestion" role="status">
                  <i className="bi bi-lightbulb"></i>
                  <span>Por las notas parece {sugerenciaTonalidad.map((k) => nombrarTonalidad(k, notacion)).join(" o ")}</span>
                  {sugerenciaTonalidad.map((sugerida) => (
                    <button
                      key={sugerida}
                      type="button"
                      className="key-suggestion-btn"
                      onClick={() => handleKeyChange(sugerida)}
                    >
                      Usar {nombrarTonalidad(sugerida, notacion)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern" htmlFor="song-instrumento-principal">
                <i className="bi bi-music-note-beamed"></i>
                Instrumento Principal
              </label>
              <Desplegable
                id="song-instrumento-principal"
                value={primaryInstrument}
                onChange={handlePrimaryInstrumentChange}
                opciones={VOICE_INSTRUMENTS.map((inst) => ({ value: inst.id, label: inst.name }))}
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern" htmlFor="song-tempo">
                <i className="bi bi-speedometer2"></i>
                Tempo (BPM)
              </label>
              <div className="tempo-campo">
                <input
                  id="song-tempo"
                  type="number"
                  inputMode="numeric"
                  min={TEMPO_MIN}
                  max={TEMPO_MAX}
                  className="form-control-modern"
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                  placeholder="Ej.: 72"
                />
                <button
                  type="button"
                  className="btn-editor-secondary tempo-tap"
                  onClick={handleTapTempo}
                  title="Toca al ritmo de la canción"
                >
                  Tap
                </button>
              </div>
              <div className="form-help-text">
                El metrónomo arranca con él al abrirlo desde la canción.
              </div>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern" htmlFor="song-compas">
                <i className="bi bi-grid-3x2"></i>
                Compás
              </label>
              <Desplegable
                id="song-compas"
                value={compas}
                onChange={setCompas}
                opciones={[
                  { value: "", label: "Sin indicar" },
                  ...COMPASES.map((c) => ({ value: c, label: c }))
                ]}
              />
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">
                <i className="bi bi-file-earmark-music me-2"></i>
                Formato
              </label>
              <div className="visibility-toggle">
                <button
                  type="button"
                  className={`visibility-option ${format === SONG_FORMAT_CHORDS ? 'active' : ''}`}
                  onClick={() => setFormat(SONG_FORMAT_CHORDS)}
                >
                  <i className="bi bi-music-note-list me-2"></i>
                  {/* El repertorio son notas de la melodía, no acordes */}
                  Notas
                </button>
                <button
                  type="button"
                  className={`visibility-option ${format === SONG_FORMAT_PDF ? 'active' : ''}`}
                  onClick={() => setFormat(SONG_FORMAT_PDF)}
                >
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  PDF
                </button>
              </div>
              <div className="form-help-text">
                En PDF, cada voz lleva la partitura y la versión con los
                nombres de las notas. No se transpone.
              </div>
            </div>

            <div className="form-group-modern">
              <label className="form-label-modern">
                <i className="bi bi-eye me-2"></i>
                Visibilidad
              </label>
              <div className="visibility-toggle">
                <button
                  type="button"
                  className={`visibility-option ${isPublic ? 'active' : ''}`}
                  onClick={() => setIsPublic(true)}
                >
                  <i className="bi bi-people me-2"></i>
                  Repertorio
                </button>
                <button
                  type="button"
                  className={`visibility-option ${!isPublic ? 'active' : ''}`}
                  onClick={() => setIsPublic(false)}
                >
                  <i className="bi bi-lock me-2"></i>
                  Privada
                </button>
              </div>
              <div className="form-help-text">
                Las canciones del repertorio las ven todos los músicos. Solo tú
                puedes editarlas o borrarlas.
              </div>
            </div>

            <div className="form-group-modern grabacion-original">
              <label className="form-label-modern">
                <i className="bi bi-vinyl"></i>
                Grabación original
              </label>
              <div className="grabacion-caja">
              {grabacion ? (
                <p className="grabacion-resumen">
                  {[grabacion.artista, grabacion.album, grabacion.anio, formatearDuracion(grabacion.duracion)]
                    .filter(Boolean).join(" · ") || grabacion.titulo}
                </p>
              ) : (
                <p className="grabacion-resumen grabacion-resumen-vacia">Sin datos todavía.</p>
              )}
              <div className="grabacion-acciones">
                <button type="button" className="btn-editor-secondary" onClick={() => setBuscandoDatos(true)}>
                  <i className="bi bi-search me-1"></i>
                  Buscar datos
                </button>
                {grabacion && (
                  <button type="button" className="btn-editor-secondary" onClick={() => setGrabacion(null)}>
                    Quitar
                  </button>
                )}
              </div>
              </div>
              <div className="form-help-text">
                Tonalidad, tempo y duración del disco, de MusicBrainz, iTunes y GetSongBPM.
              </div>
            </div>
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
                  <label className="form-label-modern" htmlFor="nueva-voz-instrumento">Instrumento</label>
                  <Desplegable
                    id="nueva-voz-instrumento"
                    value={newVoiceInstrument}
                    onChange={setNewVoiceInstrument}
                    opciones={VOICE_INSTRUMENTS.map((inst) => ({ value: inst.id, label: inst.name }))}
                  />
                </div>
                <div className="form-group-modern">
                  <label className="form-label-modern" htmlFor="nueva-voz-numero">Número de Voz</label>
                  <Desplegable
                    id="nueva-voz-numero"
                    value={newVoiceNumber}
                    onChange={setNewVoiceNumber}
                    opciones={[1, 2, 3, 4].map((num) => ({ value: num.toString(), label: String(num) }))}
                  />
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
          
          
          {/* Contenido del editor: el texto, o las dos casillas de PDF de
              esta voz. La pestaña de letra sigue siendo texto en los dos
              formatos: un PDF puede traer además la letra. */}
          <div className="editor-content">
            {format === SONG_FORMAT_PDF && !PESTANAS_DE_TEXTO.includes(currentTab) ? (
              <ScoreUploader
                casilla={pdfsDeLaPestana}
                disabled={isNewSong || !id}
                disabledReason="Para subir partituras la canción tiene que existir antes: el permiso de subida se comprueba contra la canción ya guardada."
                onGuardar={handleSave}
                onUpload={handleUploadScore}
                onRemove={handleRemoveScore}
                subiendo={subiendo.startsWith(`${currentTab}:`)
                  ? subiendo.split(":")[1]
                  : ""}
              />
            ) : (
              <SimpleMDE
                ref={editorRef}
                value={getCurrentTabContent()}
                onChange={handleEditorChange}
                onBlur={handleEditorBlur}
                options={EDITOR_OPTIONS}
              />
            )}
          </div>

          {/* Texto de ayuda */}
          <div className="editor-help-text">
            {format === SONG_FORMAT_PDF && !PESTANAS_DE_TEXTO.includes(currentTab) ? (
              <>
                <i className="bi bi-info-circle me-2"></i>
                Sube el PDF de esta voz. La versión <strong>con nombres de
                notas</strong> es para quien todavía no lee partitura: si no
                está, a quien la tenga elegida se le muestra la normal y se le
                avisa.
              </>
            ) : currentTab === "acordes" ? (
              <>
                <i className="bi bi-info-circle me-2"></i>
                Escribe los acordes <strong>como suenan</strong> (en concierto, lo que
                toca la guitarra sin cejilla), una línea de acordes por línea:
                {" "}<code>DO SOL LAm FA</code>. Puedes poner la letra debajo de cada
                línea y usar <code>## Título</code> para las secciones. Cada músico
                los verá en su instrumento y su notación.
              </>
            ) : currentTab === "lyrics" ? (
              <>
                <i className="bi bi-info-circle me-2"></i>
                Escribe solo la letra, sin acordes. Mantén los títulos de sección con <code>## Título</code>.
              </>
            ) : (
              <>
                <i className="bi bi-info-circle me-2"></i>
                Escribe las notas para tu instrumento. Usa <code>## Título</code> para crear secciones (Intro, Verso, Coro)
                y un <code>##</code> suelto para cerrar una sin empezar otra.
              </>
            )}
          </div>
        </div>
      </div>
      <BuscarDatosModal
        isOpen={buscandoDatos}
        onClose={() => setBuscandoDatos(false)}
        titulo={title}
        artista={versiones[0] || ""}
        versiones={versiones}
        notacion={notacion}
        onAplicar={aplicarDatos}
      />
    </div>
  );
}

export default SongEditor;
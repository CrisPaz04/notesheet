// apps/web/src/pages/SongView.jsx
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getSongById,
  getAllSongs,
  getUserPreferences,
  updateUserPreferences,
  getScoreUrl
} from "@notesheet/api";
import {
  detectNotationSystem,
  nombrarTonalidad,
  leerVersiones,
  getVisualKeyForInstrument,
  transposeKeyBySemitones,
  renderSongContent,
  renderChordChart,
  formatLyrics,
  buildVoicesList,
  parseVoiceKey,
  resolveInitialVoice,
  isPdfSong,
  readsChordChart,
  vistaPreferida,
  supportsCapo,
  buildScoreVoicesList,
  resolveScore,
  SCORE_VARIANTS,
  SCORE_VARIANT_LABELS,
  DEFAULT_SCORE_VARIANT,
  SOURCE_INSTRUMENT,
  TRANSPOSING_INSTRUMENTS
} from "@notesheet/core";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "../components/LoadingSpinner";
import HerramientasFlotantes from "../components/herramientas/HerramientasFlotantes";
import useHerramientas from "../hooks/useHerramientas";
import useSwipeViews from "../hooks/useSwipeViews";
import useFontSizePreference from "../hooks/useFontSizePreference";
import { recordarNotacionEnDispositivo } from "../hooks/useNotacionPreferida";
import PdfScoreViewer from "../components/PdfScoreViewer";
import AlineacionTexto from "../components/AlineacionTexto";
import useAlineacionTexto from "../hooks/useAlineacionTexto";
import DatosGrabacion from "../components/datos/DatosGrabacion";

// Trastes donde se pone la cejilla. Más allá del VII ya no queda mástil para
// tocar cómodo, y la guitarra se queda sin graves.
const TRASTES_CAPO = [0, 1, 2, 3, 4, 5, 6, 7];

// Los trastes se numeran en romanos en toda la literatura de guitarra.
const TRASTES_ROMANOS = ["", "I", "II", "III", "IV", "V", "VI", "VII"];

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
  const [formattedAcordes, setFormattedAcordes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- Tonalidades ---
  const [baseKey, setBaseKey] = useState("");       // tonalidad escrita
  const [displayKey, setDisplayKey] = useState(""); // la que ve el instrumentista
  const [soundingKey, setSoundingKey] = useState(""); // la que oye la banda (difiere con capo)
  const [targetKey, setTargetKey] = useState("");   // a la que se transpone

  // --- Contenido y presentación ---
  const [originalContent, setOriginalContent] = useState("");
  const [notationSystem, setNotationSystem] = useState("latin");
  const [currentInstrument, setCurrentInstrument] = useState(SOURCE_INSTRUMENT);
  // Traste de la cejilla. No se guarda: depende de la tonalidad de esta
  // canción, así que arrastrarlo a la siguiente daría un valor equivocado.
  const [capo, setCapo] = useState(0);
  const [showCapoDropdown, setShowCapoDropdown] = useState(false);
  const [selectedVoiceKey, setSelectedVoiceKey] = useState(null); // ej. "bb_trumpet-1"
  const [availableVoicesList, setAvailableVoicesList] = useState([]);
  const [hermanasDeAlbum, setHermanasDeAlbum] = useState([]);

  // --- Partituras en PDF ---
  // Una canción en PDF no tiene `content` que renderizar: lo que se elige es
  // un archivo de la matriz instrumento × voz × variante.
  const [scoreVariant, setScoreVariant] = useState(DEFAULT_SCORE_VARIANT);
  const [score, setScore] = useState(null);
  const [scoreVoicesList, setScoreVoicesList] = useState([]);

  // --- Dropdowns ---
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showKeyDropdown, setShowKeyDropdown] = useState(false);
  const [showInstrumentDropdown, setShowInstrumentDropdown] = useState(false);
  const [showNotationDropdown, setShowNotationDropdown] = useState(false);
  const [showVariantDropdown, setShowVariantDropdown] = useState(false);

  // Metrónomo, afinador y círculo de quintas en paneles flotantes: se
  // pueden usar sin dejar de ver la canción, que con una ventana modal no.
  const herramientas = useHerramientas();

  const { id } = useParams();
  const { currentUser, canEditSongs } = useAuth();

  // Una canción sin `format` es de acordes, como las 118 importadas. Lo que
  // sigue se apoya en esto para decidir qué controles tienen sentido: un
  // selector de tonalidad que no hace nada es peor que no tenerlo.
  const esPdf = isPdfSong(song);

  // Un PDF puede traer además la letra (las 118 la tienen aparte). Si la
  // trae, se mantienen las dos vistas y el deslizamiento; si no, sobra.
  const tieneLetra = esPdf
    ? Boolean(song?.lyricsOnly?.trim())
    : true;

  // Los acordes (guitarra, piano) son una vista más. Está siempre, aunque la
  // canción aún no los tenga: así se sabe dónde van, y quien puede editarla
  // tiene ahí el enlace para añadirlos. Salvo en un PDF sin acordes, que se
  // queda con su vista única (el tamaño lo manda el zoom del visor).
  const hayAcordes = Boolean(song?.acordes?.trim());
  const tieneAcordes = hayAcordes || !esPdf;
  const puedeEditar = canEditSongs() && song?.userId === currentUser?.uid;

  // Las vistas entre las que se desliza, en orden. La principal siempre está.
  const vistas = [
    {
      id: "principal",
      etiqueta: esPdf ? "Partitura" : "Notas",
      icono: esPdf ? "bi bi-file-earmark-music" : "bi bi-music-note-list",
      objeto: esPdf ? "la partitura" : "las notas"
    },
    ...(tieneLetra ? [{ id: "letra", etiqueta: "Letra", icono: "bi bi-card-text", objeto: "la letra" }] : []),
    ...(tieneAcordes ? [{ id: "acordes", etiqueta: "Acordes", icono: "bi bi-music-note", objeto: "los acordes" }] : [])
  ];
  const variasVistas = vistas.length > 1;
  const indiceDe = (vistaId) => vistas.findIndex((v) => v.id === vistaId);

  const {
    fontSize,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize
  } = useFontSizePreference(currentUser);
  const [alineacion, setAlineacion] = useAlineacionTexto();

  const {
    activeView,
    goToView: setActiveView,
    viewRefs,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  } = useSwipeViews(vistas.length);
  const refDe = (vistaId) => viewRefs[indiceDe(vistaId)];

  // Cada músico abre la canción en lo suyo, según el instrumento de sus
  // preferencias: la voz en la letra, guitarra, piano y bajo en los acordes,
  // los vientos en las notas (`vistaPreferida`). Solo al abrirla, no cada vez
  // que se recarga, y nunca en una vista vacía.
  const vistaInicialDe = useRef(null);
  useEffect(() => {
    if (!song || vistaInicialDe.current === song.id) return;
    vistaInicialDe.current = song.id;
    const preferida = vistaPreferida(currentInstrument, {
      hayLetra: tieneLetra && formattedLyricsOnly?.sections?.length > 0,
      hayAcordes
    });
    if (indiceDe(preferida) > 0) setActiveView(indiceDe(preferida));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song]);

  /**
   * Ejecuta el pipeline de renderizado y vuelca el resultado en el estado.
   * Los `overrides` hacen falta porque setState es asincrono: cuando un
   * handler acaba de cambiar la tonalidad o el instrumento, el valor nuevo
   * todavia no esta en el estado de este render.
   */
  const applyRender = (content, overrides = {}) => {
    const { acordes = song?.acordes, ...opciones } = overrides;
    const todas = {
      baseKey,
      targetKey,
      instrument: currentInstrument,
      notationSystem,
      capo,
      ...opciones
    };
    const rendered = renderSongContent(content, todas);
    // Los acordes siguen a las notas: misma tonalidad, instrumento, cejilla y
    // notación (están guardados en concierto; ver `renderChordChart`).
    setFormattedAcordes(renderChordChart(acordes, todas));

    setFormattedSong(rendered.formatted);
    setFormattedLyricsOnly(rendered.lyricsOnly);
    setDisplayKey(rendered.displayKey);
    setSoundingKey(rendered.soundingKey);
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
        let variant = scoreVariant;

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
            if (prefs.defaultScoreVariant) {
              variant = prefs.defaultScoreVariant;
              setScoreVariant(variant);
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

        if (isPdfSong(loadedSong)) {
          // En un PDF no hay nada que transponer ni notación que convertir:
          // `defaultInstrument` deja de servir para transponer y pasa a elegir
          // el archivo, que es justo lo que quiere el músico.
          const lista = buildScoreVoicesList(loadedSong.pdfs, TRANSPOSING_INSTRUMENTS);
          const elegida = resolveScore(loadedSong, {
            voiceKey: selectedVoiceKey,
            variant,
            instrument
          });

          setScoreVoicesList(lista);
          setScore(elegida);
          setSelectedVoiceKey(elegida.voiceKey);
          setAvailableVoicesList([]);
          setOriginalContent("");
          setFormattedSong(null);

          // La letra, si la hay, se muestra tal cual: en un PDF no hay
          // acordes que quitar, así que aquí no pinta el pipeline entero.
          setFormattedLyricsOnly(formatLyrics(loadedSong.lyricsOnly));
          setFormattedAcordes(renderChordChart(loadedSong.acordes, {
            baseKey: songKey,
            targetKey: songKey,
            instrument,
            notationSystem: notation
          }));
        } else {
          setScore(null);
          setScoreVoicesList([]);
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
            notationSystem: notation,
            acordes: loadedSong.acordes
          });
        }
        // Canciones del mismo álbum. Solo se consulta el repertorio si esta
        // canción pertenece a uno, para no traerlo entero en cada visita.
        if (loadedSong.album) {
          try {
            const repertorio = await getAllSongs(currentUser?.uid);
            setHermanasDeAlbum(
              repertorio.filter((c) => c.album === loadedSong.album && c.id !== loadedSong.id)
            );
          } catch (albumError) {
            // Que falle esto no debe impedir leer la canción
            console.error("Error loading album siblings:", albumError);
          }
        } else {
          setHermanasDeAlbum([]);
        }
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

  // Las etiquetas de tonalidad, en la notación elegida. Solo para mostrar:
  // las comparaciones y lo que se transpone siguen en latina.
  const verTonalidad = (k) => nombrarTonalidad(k, notationSystem);

  // Cambiar entre notación latina y anglosajona
  const handleChangeNotation = (system) => {
    if (system === notationSystem || !song) return;

    try {
      setNotationSystem(system);
      setShowNotationDropdown(false);

      recordarNotacionEnDispositivo(system);
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

    // En un PDF cambiar de voz no re-renderiza nada: elige otro archivo
    if (esPdf) {
      const elegida = resolveScore(song, { voiceKey, variant: scoreVariant });
      setScore(elegida);
      setSelectedVoiceKey(elegida.voiceKey);
      return;
    }

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

      // Al salir de la guitarra el capo deja de existir. Si se quedara puesto,
      // el trompetista heredaría una transposición invisible: el control ya no
      // se ve, pero seguiría bajándole los acordes.
      const capoNuevo = supportsCapo(instrumentId) ? capo : 0;
      if (capoNuevo !== capo) setCapo(capoNuevo);

      if (currentUser) {
        updateUserPreferences(currentUser.uid, { defaultInstrument: instrumentId })
          .catch((prefError) => console.error("Error saving instrument preference:", prefError));
      }

      applyRender(originalContent, { instrument: instrumentId, capo: capoNuevo });
    } catch (instrumentError) {
      setError("Error al cambiar de instrumento: " + instrumentError.message);
      console.error("Error completo:", instrumentError);
    }
  };

  /**
   * Cambia el traste de la cejilla.
   *
   * No va a las preferencias del usuario: el capo que sirve depende de la
   * tonalidad de esta canción, así que guardarlo y aplicarlo a la siguiente
   * daría un valor equivocado sin avisar.
   */
  const handleCapoChange = (traste) => {
    setShowCapoDropdown(false);
    if (traste === capo) return;

    setCapo(traste);
    applyRender(originalContent, { capo: traste });
  };

  /**
   * Cambia la variante (con o sin los nombres de las notas encima).
   *
   * Se guarda en las preferencias porque quien no lee partitura la quiere así
   * siempre, no canción por canción. El botón del visor sirve para salirse de
   * la preferencia un rato, y queda guardado igual: si la toca, es la que
   * quiere.
   */
  const handleVariantChange = (variant) => {
    setShowVariantDropdown(false);
    if (variant === scoreVariant) return;

    setScoreVariant(variant);
    setScore(resolveScore(song, { voiceKey: selectedVoiceKey, variant }));

    if (currentUser) {
      updateUserPreferences(currentUser.uid, { defaultScoreVariant: variant })
        .catch((prefError) => console.error("Error saving variant preference:", prefError));
    }
  };

  /**
   * Abre el PDF tal cual en otra pestaña.
   *
   * Imprimir un PDF desde aquí no sale bien: lo que hay en pantalla son
   * canvas, y solo están pintadas las páginas cercanas a la vista. Para papel
   * vale más el visor del propio dispositivo, que además sabe imprimir.
   */
  const handleOpenPdf = async () => {
    if (!score?.path) return;

    try {
      const url = await getScoreUrl(score.path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError("No se pudo abrir el PDF: " + openError.message);
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

          {song.album && (
            <div className="song-album-line no-print">
              <i className="bi bi-disc me-2"></i>
              <span className="song-album-name">{song.album}</span>
              {hermanasDeAlbum.length > 0 && (
                <span className="song-album-siblings">
                  {" · "}
                  {hermanasDeAlbum.map((hermana, i) => (
                    <span key={hermana.id}>
                      {i > 0 && ", "}
                      <Link to={`/songs/${hermana.id}`} className="song-album-link">
                        {hermana.title || "Sin título"}
                      </Link>
                    </span>
                  ))}
                </span>
              )}
            </div>
          )}

          <div className="song-meta-grid">
            <div className="song-meta-item">
              <div className="song-meta-label">
                <i className="bi bi-music-note me-1"></i>
                Voz
              </div>
              <div className="song-meta-value">
                {selectedVoiceKey
                  ? (esPdf ? scoreVoicesList : availableVoicesList)
                      .find(v => v.id === selectedVoiceKey)?.label || "—"
                  : "—"}
              </div>
            </div>

            {/* En un PDF no hay transposición: lo que distingue un archivo de
                otro es la variante, con o sin los nombres de las notas. */}
            {esPdf ? (
              <div className="song-meta-item">
                <div className="song-meta-label">
                  <i className="bi bi-file-earmark-music me-1"></i>
                  Partitura
                </div>
                <div className="song-meta-value">
                  {score?.variant ? SCORE_VARIANT_LABELS[score.variant] : "—"}
                </div>
              </div>
            ) : (
              <div className="song-meta-item">
                <div className="song-meta-label">
                  <i className="bi bi-arrow-left-right me-1"></i>
                  Transpuesto a
                </div>
                <div className="song-meta-value">
                  {TRANSPOSING_INSTRUMENTS[currentInstrument]?.name || "Trompeta en Sib"}
                </div>
              </div>
            )}

            {/* En un PDF la tonalidad es informativa: está impresa en el papel
                y no se puede cambiar, pero saberla sigue sirviendo.

                Con capo, la que se lee y la que suena no son la misma. Hay que
                decir las dos: el guitarrista necesita la suya para tocar, y la
                de concierto para entenderse con el resto de la banda. */}
            <div className="song-meta-item">
              <div className="song-meta-label">
                <i className="bi bi-key me-1"></i>
                Tonalidad
              </div>
              <div className="song-meta-value">
                {esPdf ? (verTonalidad(song.key) || "—") : verTonalidad(displayKey)}
                {!esPdf && capo > 0 && (
                  <span className="song-meta-nota">
                    {" "}· capo {TRASTES_ROMANOS[capo]}, suena en {verTonalidad(soundingKey)}
                  </span>
                )}
              </div>
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

        {/* Datos de la grabación original: cerrado de entrada */}
        <DatosGrabacion
          grabacion={song.grabacion}
          titulo={song.title}
          artista={song.grabacion?.artista || leerVersiones(song)[0] || ""}
          instrumento={currentInstrument}
          notacion={notationSystem}
        />

        {/* Barra de controles */}
        <div className="controls-toolbar fade-in-delay no-print">
          <div className="controls-row">
            <div className="controls-group">
              {/* Selector de Voz (partes disponibles en la canción).
                  En un PDF la lista sale del mapa `pdfs`, y elegir voz no
                  transpone nada: cambia de archivo.

                  A quien lee la hoja de acordes no se le ofrece: un guitarrista
                  no toca "la voz 2", toca los acordes. En un PDF sí se deja,
                  porque ahí la voz elige qué archivo se abre. */}
              {(esPdf || !readsChordChart(currentInstrument)) &&
               (esPdf ? scoreVoicesList : availableVoicesList).length > 0 && (
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
                        ? (esPdf ? scoreVoicesList : availableVoicesList)
                            .find(v => v.id === selectedVoiceKey)?.label || "Voz"
                        : "Seleccionar Voz"}
                    </span>
                    <i className={`bi bi-chevron-${showVoiceDropdown ? 'up' : 'down'}`}></i>
                  </button>

                  {showVoiceDropdown && (
                    <div className="dropdown-menu-custom">
                      {(esPdf ? scoreVoicesList : availableVoicesList).map((voice) => (
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

              {/* Selector de variante, solo en PDF: la partitura normal o la
                  que lleva los nombres de las notas encima. Ocupa el sitio de
                  los tres controles de abajo, que aquí no pintan nada. */}
              {esPdf && score?.voiceKey && (
                <div className="control-dropdown">
                  <button
                    className={`dropdown-button ${showVariantDropdown ? 'active' : ''}`}
                    onClick={() => {
                      setShowVariantDropdown(!showVariantDropdown);
                      setShowVoiceDropdown(false);
                    }}
                  >
                    <i className="bi bi-eyeglasses"></i>
                    <span>{SCORE_VARIANT_LABELS[score.variant] || "Partitura"}</span>
                    <i className={`bi bi-chevron-${showVariantDropdown ? 'up' : 'down'}`}></i>
                  </button>

                  {showVariantDropdown && (
                    <div className="dropdown-menu-custom">
                      {SCORE_VARIANTS.map((variant) => (
                        <div
                          key={variant}
                          className={`dropdown-item-custom ${scoreVariant === variant ? 'active' : ''}`}
                          onClick={() => handleVariantChange(variant)}
                        >
                          {SCORE_VARIANT_LABELS[variant]}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Transposición, tonalidad y notación no existen en un PDF: es
                  una imagen. Se ocultan en vez de dejarlos puestos sin efecto,
                  que confunde más que no tenerlos. */}
              {!esPdf && (
                <>
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

              {/* Cejilla. Solo para la guitarra: al resto no se le pone.
                  Baja los acordes que se leen sin tocar lo que suena, por eso
                  al lado se recuerda en qué tonalidad sigue sonando. */}
              {supportsCapo(currentInstrument) && (
                <div className="control-dropdown">
                  <button
                    className={`dropdown-button ${showCapoDropdown ? 'active' : ''}`}
                    onClick={() => {
                      setShowCapoDropdown(!showCapoDropdown);
                      setShowInstrumentDropdown(false);
                      setShowVoiceDropdown(false);
                      setShowKeyDropdown(false);
                      setShowNotationDropdown(false);
                    }}
                  >
                    <i className="bi bi-sliders"></i>
                    <span>{capo ? `Capo ${TRASTES_ROMANOS[capo]}` : "Sin capo"}</span>
                    <i className={`bi bi-chevron-${showCapoDropdown ? 'up' : 'down'}`}></i>
                  </button>

                  {showCapoDropdown && (
                    <div className="dropdown-menu-custom">
                      {TRASTES_CAPO.map((traste) => (
                        <div
                          key={traste}
                          className={`dropdown-item-custom ${capo === traste ? 'active' : ''}`}
                          onClick={() => handleCapoChange(traste)}
                        >
                          {traste === 0 ? "Sin capo" : `Traste ${TRASTES_ROMANOS[traste]}`}
                          {traste > 0 && (
                            <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                              Se lee en {verTonalidad(transposeKeyBySemitones(soundingKey, -traste))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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
                  <span>Tonalidad: {verTonalidad(displayKey)}</span>
                  <i className={`bi bi-chevron-${showKeyDropdown ? 'up' : 'down'}`}></i>
                </button>
                
                {showKeyDropdown && (
                  <div className="dropdown-menu-custom">
                    <div className="dropdown-item-custom" onClick={resetTransposition}>
                      <strong>Original ({verTonalidad(getVisualKeyForInstrument(baseKey, currentInstrument))})</strong>
                    </div>
                    <hr style={{ margin: '0.5rem 0', border: 'none', height: '1px', background: 'rgba(var(--overlay-rgb), 0.1)' }} />
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
                              {verTonalidad(majorVisualKey)}
                              {pair.major === baseKey && " (Original)"}
                            </div>
                            <div
                              className={`dropdown-item-custom ${displayKey === minorVisualKey ? 'active' : ''}`}
                              onClick={() => handleTranspose(pair.minor)}
                              style={{ flex: 1, margin: 0, padding: '0.5rem' }}
                            >
                              {verTonalidad(minorVisualKey)}
                              {pair.minor === baseKey && " (Original)"}
                            </div>
                          </div>
                          {index < RELATIVE_KEYS.length - 1 && (
                            <hr style={{ margin: '0.25rem 0', border: 'none', height: '1px', background: 'rgba(var(--overlay-rgb), 0.05)' }} />
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
                </>
              )}
            </div>
            
            <div className="controls-group">
              {/* Controles de fuente. En un PDF el tamaño no lo manda la
                  fuente sino el zoom, que vive en el propio visor. */}
              <div className="font-controls" hidden={esPdf && !variasVistas}>
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

              {!(esPdf && !variasVistas) && (
                <AlineacionTexto alineacion={alineacion} onCambiar={setAlineacion} />
              )}
              
              {/* Toggle de vista. Un PDF sin letra ni acordes tiene una sola
                  vista: el botón sobraría. */}
              {variasVistas && (
                <div className="view-toggle-controls">
                  {vistas.map((vista, indice) => (
                    <button
                      key={vista.id}
                      className={`view-toggle-btn-song ${activeView === indice ? 'active' : ''}`}
                      onClick={() => setActiveView(indice)}
                    >
                      <i className={vista.icono}></i>
                      {vista.etiqueta}
                    </button>
                  ))}
                </div>
              )}

              {/* Botones de acción */}
              <div className="action-buttons-song">
                <button
                  className="btn-song-action"
                  onClick={() => herramientas.alternar("metronomo")}
                  aria-pressed={herramientas.estaAbierto("metronomo")}
                  title="Metrónomo"
                >
                  <i className="bi bi-hourglass-split"></i>
                  Metrónomo
                </button>

                <button
                  className="btn-song-action"
                  onClick={() => herramientas.alternar("afinador")}
                  aria-pressed={herramientas.estaAbierto("afinador")}
                  title="Afinador"
                >
                  <i className="bi bi-soundwave"></i>
                  Afinador
                </button>

                {/* En un PDF lo que hay en pantalla son canvas, y solo están
                    pintadas las páginas cercanas a la vista: imprimir desde
                    aquí saldría medio en blanco. El visor del dispositivo lo
                    hace mejor, y además sabe imprimir. */}
                {esPdf ? (
                  <button
                    className="btn-song-action"
                    onClick={handleOpenPdf}
                    disabled={!score?.path}
                    title="Abrir el PDF"
                  >
                    <i className="bi bi-box-arrow-up-right"></i>
                    Abrir PDF
                  </button>
                ) : (
                  <button
                    className="btn-song-action"
                    onClick={handlePrint}
                    title="Imprimir"
                  >
                    <i className="bi bi-printer"></i>
                    Imprimir
                  </button>
                )}

                {puedeEditar && (
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
          {/* Indicador de vista. Sin segunda vista no hay nada entre lo que
              deslizar, y los puntos solo despistarían. */}
          {variasVistas && (
            <div className="view-indicator no-print">
              <div className="view-dots">
                {vistas.map((vista, indice) => (
                  <button
                    key={vista.id}
                    onClick={() => setActiveView(indice)}
                    className={`view-dot ${activeView === indice ? 'active' : ''}`}
                    aria-label={`Ver ${vista.objeto}`}
                  />
                ))}
              </div>
              <div className="view-hint">
                {[
                  vistas[activeView - 1] && `← Deslizar para ver ${vistas[activeView - 1].objeto}`,
                  vistas[activeView + 1] && `Deslizar para ver ${vistas[activeView + 1].objeto} →`
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          )}

          {/* Contenedor de vistas con swipe */}
          <div
            className="song-sections-container"
            onTouchStart={variasVistas ? handleTouchStart : undefined}
            onTouchMove={variasVistas ? handleTouchMove : undefined}
            onTouchEnd={variasVistas ? handleTouchEnd : undefined}
          >
            {/* Una tira con todas las vistas, una al lado de otra, que se
                desplaza: su ancho y el de cada vista dependen de cuántas hay */}
            <div
              className={`song-sections${variasVistas ? '' : ' song-sections--sola'}`}
              style={variasVistas ? {
                width: `${vistas.length * 100}%`,
                transform: `translateX(-${(activeView * 100) / vistas.length}%)`
              } : undefined}
            >
              {/* Vista principal: la partitura en PDF o los acordes */}
              <div
                ref={refDe("principal")}
                className="song-view"
                style={variasVistas ? { width: `${100 / vistas.length}%` } : undefined}
              >
                {esPdf ? (
                  <>
                    {/* Si la variante que pidió el músico no está, se muestra
                        la que hay y se dice. Quedarse delante de una partitura
                        que no es la que esperaba, sin explicación, es peor. */}
                    {score?.variantFallback && (
                      <div className="alert alert-warning pdf-score-fallback no-print" role="status">
                        <i className="bi bi-info-circle"></i>
                        <span>
                          Esta voz no tiene la versión
                          {" "}<strong>{SCORE_VARIANT_LABELS[score.requestedVariant]?.toLowerCase()}</strong>.
                          {" "}Se muestra la de <strong>{SCORE_VARIANT_LABELS[score.variant]?.toLowerCase()}</strong>.
                        </span>
                      </div>
                    )}

                    <PdfScoreViewer path={score?.path || null} title={song.title} />
                  </>
                ) : (
                  <>
                    {formattedSong && formattedSong.sections.map((section, index) => (
                      <div key={index} className="song-section-modern">
                        {section.title && <h3 className="song-section-title">{section.title}</h3>}
                        <div className={`song-section-content alinear-${alineacion}`} style={{ fontSize: `${fontSize}px` }}>
                          {section.content}
                        </div>
                      </div>
                    ))}

                    {(!formattedSong || formattedSong.sections.length === 0) && (
                      <div className="text-center vista-vacia" style={{ color: 'rgba(var(--overlay-rgb), 0.6)', padding: '3rem' }}>
                        <i className="bi bi-music-note-list" style={{ fontSize: '3rem', marginBottom: '1rem' }}></i>
                        <p>Esta canción todavía no tiene notas.</p>
                        {puedeEditar && (
                          <Link to={`/songs/${id}/edit`} className="btn-song-action btn-song-primary">
                            <i className="bi bi-plus-lg"></i>
                            Añadir notas
                          </Link>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Vista de solo letras */}
              {tieneLetra && (
              <div
                ref={refDe("letra")}
                className="song-view"
                style={{ width: `${100 / vistas.length}%` }}
              >
                {formattedLyricsOnly && formattedLyricsOnly.sections.map((section, index) => (
                  <div key={index} className="song-section-modern">
                    {section.title && <h3 className="song-section-title">{section.title}</h3>}
                    <div className={`song-section-content alinear-${alineacion}`} style={{ fontSize: `${fontSize}px` }}>
                      {section.content}
                    </div>
                  </div>
                ))}
                
                {(!formattedLyricsOnly || formattedLyricsOnly.sections.length === 0) && (
                  <div className="text-center vista-vacia" style={{ color: 'rgba(var(--overlay-rgb), 0.6)', padding: '3rem' }}>
                    <i className="bi bi-card-text" style={{ fontSize: '3rem', marginBottom: '1rem' }}></i>
                    <p>Esta canción todavía no tiene letra.</p>
                    {puedeEditar && (
                      <Link to={`/songs/${id}/edit`} className="btn-song-action btn-song-primary">
                        <i className="bi bi-plus-lg"></i>
                        Añadir letra
                      </Link>
                    )}
                  </div>
               )}
             </div>
              )}

              {/* Vista de acordes, para guitarra y piano */}
              {tieneAcordes && (
                <div
                  ref={refDe("acordes")}
                  className="song-view song-view--acordes"
                  style={{ width: `${100 / vistas.length}%` }}
                >
                  {formattedAcordes && formattedAcordes.sections.map((section, index) => (
                    <div key={index} className="song-section-modern">
                      {section.title && <h3 className="song-section-title">{section.title}</h3>}
                      <div className={`song-section-content alinear-${alineacion}`} style={{ fontSize: `${fontSize}px` }}>
                        {section.content}
                      </div>
                    </div>
                  ))}

                  {!hayAcordes && (
                    <div className="text-center vista-vacia" style={{ color: 'rgba(var(--overlay-rgb), 0.6)', padding: '3rem' }}>
                      <i className="bi bi-music-note" style={{ fontSize: '3rem', marginBottom: '1rem' }}></i>
                      <p>Esta canción todavía no tiene acordes.</p>
                      {puedeEditar && (
                        <Link to={`/songs/${id}/edit`} className="btn-song-action btn-song-primary">
                          <i className="bi bi-plus-lg"></i>
                          Añadir acordes
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
           </div>
         </div>
       </div>
     </div>

     {/* Metrónomo y afinador se abren con los botones de arriba; en la
         barra solo queda lo que no tiene botón propio. El metrónomo arranca
         con el tempo y el compás de la canción, si los tiene. */}
     <HerramientasFlotantes
       herramientas={herramientas}
       notacion={notationSystem}
       metronomo={{ tempoInicial: song?.tempo || null, compasInicial: song?.compas || null }}
       ocultarBotones={["metronomo", "afinador"]}
     />
   </div>
 );
}

export default SongView;

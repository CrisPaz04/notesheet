import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  subscribeToSession,
  subscribeToParticipants,
  joinSession,
  leaveSession,
  touchParticipant,
  updateParticipant,
  setActiveSong,
  setSongKey,
  setSessionSongs,
  endSession,
  isParticipantOnline,
  SessionConflictError
} from "@notesheet/api";

/** Cada cuánto se avisa de que uno sigue ahí. */
const LATIDO_MS = 30 * 1000;

/**
 * Margen para que llegue el snapshot con la versión nueva antes de reintentar
 * una escritura que chocó. Un conflicto significa que el cambio de otro ya se
 * guardó en el servidor, así que el listener lo trae casi de inmediato.
 */
const ESPERA_REINTENTO_MS = 250;

/**
 * Estado compartido de una sesión en vivo.
 *
 * Lo que viaja: el orden de las canciones, cuál se está tocando y la tonalidad
 * de cada una. La tonalidad es siempre la **de concierto**; cada cliente la
 * pasa luego por `renderSongContent` con su propio instrumento, que es lo que
 * hace que el director pueda bajar una canción sin pensar en las trompetas.
 *
 * Lo que NO viaja, y por eso no está aquí: instrumento, voz, tamaño de letra,
 * sistema de notación y scroll. Eso es de cada músico y vive en su dispositivo
 * (`usePreferenciaLocal`). Lo único que se comparte de cada quien es qué toca,
 * y solo para poder pintarlo en la lista de conectados.
 *
 * @param {string} code - Código de la sesión
 * @param {Object} options
 * @param {Object} options.user - Usuario actual (`currentUser` de AuthContext)
 * @param {boolean} [options.autoJoin] - Entrar solo al abrir la pantalla
 */
export default function useLiveSession(code, { user, autoJoin = true } = {}) {
  const [session, setSession] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [estado, setEstado] = useState("loading"); // loading | live | ended | missing | error
  const [sinRed, setSinRed] = useState(false);
  const [error, setError] = useState("");
  const [entrado, setEntrado] = useState(false);
  const [salido, setSalido] = useState(false);

  /**
   * La sesión también en una ref, y actualizada desde el propio snapshot.
   *
   * Las acciones necesitan la versión y las canciones del momento exacto en
   * que se pulsa el botón. Si las leyeran del estado quedarían congeladas en
   * el closure del render en que se crearon.
   *
   * Se asigna en el callback y no durante el render a propósito: entre que
   * llega un snapshot y React vuelve a pintar hay un hueco, y justo ahí cae el
   * reintento de una escritura que chocó. Asignando en el render, el reintento
   * volvería a mandar la versión vieja y fallaría otra vez.
   */
  const sesionRef = useRef(null);

  const uid = user?.uid || null;

  // --- Escucha del estado compartido --------------------------------------
  useEffect(() => {
    if (!code || !uid) return undefined;

    setEstado("loading");

    const cancelar = subscribeToSession(code, {
      onChange: (datos, meta) => {
        setSinRed(Boolean(meta?.fromCache));

        if (!datos) {
          // Sin red y sin nada en caché, Firestore entrega un snapshot vacío
          // que no significa "no existe" sino "todavía no lo sé". Decirle al
          // músico que la sesión no existe cuando solo se cayó el wifi sería
          // mandarlo a buscar un código que está bien.
          if (!meta?.fromCache) {
            sesionRef.current = null;
            setSession(null);
            setEstado("missing");
          }
          return;
        }

        sesionRef.current = datos;
        setSession(datos);
        setEstado(datos.status === "ended" ? "ended" : "live");
      },
      onError: (e) => {
        console.error("Error escuchando la sesión:", e);
        setError("Se perdió la conexión con la sesión: " + e.message);
        setEstado("error");
      }
    });

    return cancelar;
  }, [code, uid]);

  // --- Entrar -------------------------------------------------------------
  //
  // Entrar crea tu documento en `participants`, que es lo que las reglas
  // miran para dejarte escribir. Va después de que el primer snapshot
  // confirme que la sesión existe, porque la regla de creación exige que
  // exista: intentarlo antes fallaría siempre.
  useEffect(() => {
    if (!autoJoin || !code || !user?.uid) return;
    if (estado !== "live" || entrado) return;
    // Que el snapshot sea de ESTA sesión y no de la anterior: al navegar de
    // una sesión a otra sin desmontar, `estado` sigue valiendo "live" por la
    // que acabamos de dejar, y entraríamos en la nueva sin haberla visto.
    if (session?.id !== code) return;
    // Sin esto, salir de la sesión la volvería a abrir al instante: el efecto
    // se vuelve a evaluar en cuanto `entrado` pasa a false y las condiciones
    // de entrada siguen cumpliéndose.
    if (salido) return;

    let cancelado = false;

    joinSession(code, { user })
      .then(() => {
        if (!cancelado) setEntrado(true);
      })
      .catch((e) => {
        if (cancelado) return;
        console.error("Error entrando en la sesión:", e);
        setError("No se pudo entrar en la sesión: " + e.message);
      });

    return () => { cancelado = true; };
  }, [autoJoin, code, user, estado, entrado, salido, session]);

  // Cambiar de sesión (o de usuario) empieza de cero.
  useEffect(() => {
    setEntrado(false);
    setSalido(false);
  }, [code, uid]);

  // --- Quién está ---------------------------------------------------------
  //
  // Solo después de entrar: las reglas dejan listar los participantes a quien
  // ya tiene el suyo.
  useEffect(() => {
    if (!code || !entrado) return undefined;

    return subscribeToParticipants(code, {
      onChange: setParticipants,
      onError: (e) => console.error("Error escuchando participantes:", e)
    });
  }, [code, entrado]);

  // --- Latido -------------------------------------------------------------
  useEffect(() => {
    if (!code || !uid || !entrado || estado !== "live") return undefined;

    const id = setInterval(() => {
      touchParticipant(code, uid).catch((e) => {
        // Que falle un latido no es motivo para molestar al músico: el
        // siguiente lo arregla, y mientras tanto solo se le ve gris.
        console.warn("Latido de presencia fallido:", e?.message || e);
      });
    }, LATIDO_MS);

    return () => clearInterval(id);
  }, [code, uid, entrado, estado]);

  /**
   * Ejecuta un cambio sobre el estado compartido, con un reintento.
   *
   * El reintento es para el choque normal de dos músicos tocando cosas a la
   * vez: el segundo manda una versión que acaba de quedarse vieja, se la
   * rechazan, y al repetir ya tiene la buena. Solo uno, porque si el segundo
   * intento también choca lo que hay es un problema de verdad (o no eres
   * participante, que desde el cliente da el mismo error) y conviene decirlo
   * en vez de insistir.
   */
  const ejecutar = useCallback(async (accion) => {
    setError("");

    for (let intento = 0; intento < 2; intento += 1) {
      const actual = sesionRef.current;
      if (!actual) return false;

      try {
        await accion({
          expectedVersion: actual.version,
          songs: actual.songs || [],
          activeSongId: actual.activeSongId
        });
        return true;
      } catch (e) {
        if (e instanceof SessionConflictError && intento === 0) {
          await new Promise((r) => setTimeout(r, ESPERA_REINTENTO_MS));
          continue;
        }
        console.error("Error cambiando la sesión:", e);
        setError(e.message);
        return false;
      }
    }

    return false;
  }, []);

  const songs = useMemo(() => session?.songs || [], [session]);
  const activeSongId = session?.activeSongId || null;
  const activeIndex = useMemo(
    () => songs.findIndex((s) => s.id === activeSongId),
    [songs, activeSongId]
  );

  // --- Acciones sobre el estado compartido --------------------------------

  const irACancion = useCallback((songId) => ejecutar(
    ({ expectedVersion }) => setActiveSong(code, { songId, expectedVersion, user })
  ), [ejecutar, code, user]);

  /**
   * Avanza o retrocede en la lista.
   *
   * Si la canción activa ya no está (otro la quitó mientras tanto),
   * `findIndex` da -1 y el salto cae en la primera, que es lo razonable.
   */
  const moverse = useCallback((salto) => {
    const actual = sesionRef.current;
    if (!actual) return Promise.resolve(false);

    const lista = actual.songs || [];
    if (lista.length === 0) return Promise.resolve(false);

    const desde = lista.findIndex((s) => s.id === actual.activeSongId);
    const destino = Math.min(Math.max(desde + salto, 0), lista.length - 1);
    if (destino === desde) return Promise.resolve(false);

    return irACancion(lista[destino].id);
  }, [irACancion]);

  const siguiente = useCallback(() => moverse(1), [moverse]);
  const anterior = useCallback(() => moverse(-1), [moverse]);

  const cambiarTonalidad = useCallback((songId, key) => ejecutar(
    ({ expectedVersion, songs: actuales }) =>
      setSongKey(code, { songs: actuales, songId, key, expectedVersion, user })
  ), [ejecutar, code, user]);

  const moverCancion = useCallback((desde, hasta) => ejecutar(
    ({ expectedVersion, songs: actuales, activeSongId: activa }) => {
      if (desde === hasta) return Promise.resolve();
      if (desde < 0 || hasta < 0 || desde >= actuales.length || hasta >= actuales.length) {
        return Promise.resolve();
      }

      const reordenadas = Array.from(actuales);
      const [movida] = reordenadas.splice(desde, 1);
      reordenadas.splice(hasta, 0, movida);

      return setSessionSongs(code, {
        songs: reordenadas,
        activeSongId: activa,
        expectedVersion,
        user
      });
    }
  ), [ejecutar, code, user]);

  const agregarCancion = useCallback((song) => ejecutar(
    ({ expectedVersion, songs: actuales, activeSongId: activa }) => {
      if (!song?.id || actuales.some((s) => s.id === song.id)) return Promise.resolve();

      return setSessionSongs(code, {
        songs: [...actuales, {
          id: song.id,
          title: song.title,
          key: song.key,
          originalKey: song.originalKey || song.key
        }],
        activeSongId: activa,
        expectedVersion,
        user
      });
    }
  ), [ejecutar, code, user]);

  /**
   * Quita una canción de la sesión.
   *
   * `setSessionSongs` se encarga de mover la canción activa si justo se quitó
   * la que se estaba tocando: por eso la activa se guarda por id y no por
   * posición.
   */
  const quitarCancion = useCallback((songId) => ejecutar(
    ({ expectedVersion, songs: actuales, activeSongId: activa }) => setSessionSongs(code, {
      songs: actuales.filter((s) => s.id !== songId),
      activeSongId: activa,
      expectedVersion,
      user
    })
  ), [ejecutar, code, user]);

  const cerrarSesion = useCallback(() => ejecutar(
    ({ expectedVersion }) => endSession(code, { expectedVersion, user })
  ), [ejecutar, code, user]);

  // --- Acciones sobre lo mío ----------------------------------------------

  /** Anuncia qué toco, para que salga en la lista de conectados. */
  const anunciarInstrumento = useCallback(async (instrumentId, voiceNumber) => {
    if (!code || !uid) return false;

    try {
      await updateParticipant(code, uid, { instrumentId, voiceNumber });
      return true;
    } catch (e) {
      // No pasa nada si no se anuncia: la partitura se sigue viendo bien,
      // simplemente el resto no ve qué toco.
      console.warn("No se pudo anunciar el instrumento:", e?.message || e);
      return false;
    }
  }, [code, uid]);

  const salir = useCallback(async () => {
    if (!code || !uid) return;

    try {
      await leaveSession(code, uid);
    } catch (e) {
      console.warn("No se pudo borrar la presencia:", e?.message || e);
    } finally {
      setEntrado(false);
      setSalido(true);
    }
  }, [code, uid]);

  /** Volver a entrar después de haber salido, sin recargar la pantalla. */
  const entrar = useCallback(() => setSalido(false), []);

  /**
   * Conectados, calculado en cada render.
   *
   * No hace falta un temporizador: cada latido de cualquier músico dispara el
   * listener de participantes y vuelve a renderizar, así que los puntos se
   * refrescan solos cada 30 segundos.
   */
  const participantesConEstado = useMemo(() => {
    const ahora = Date.now();
    return participants.map((p) => ({ ...p, isOnline: isParticipantOnline(p, ahora) }));
  }, [participants]);

  return {
    // Estado compartido
    session,
    songs,
    activeSongId,
    activeIndex,
    activeSong: activeIndex >= 0 ? songs[activeIndex] : null,
    estado,
    error,
    sinRed,

    // Quién está
    participants: participantesConEstado,
    me: participants.find((p) => p.uid === uid) || null,
    isHost: Boolean(uid && session?.hostId === uid),
    entrado,

    // Acciones compartidas
    irACancion,
    siguiente,
    anterior,
    cambiarTonalidad,
    moverCancion,
    agregarCancion,
    quitarCancion,
    cerrarSesion,

    // Acciones propias
    anunciarInstrumento,
    salir,
    entrar
  };
}

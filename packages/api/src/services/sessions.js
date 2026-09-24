// packages/api/src/services/sessions.js
//
// Sesiones en vivo: varios músicos mirando la misma lista durante el
// servicio, de modo que un cambio de tonalidad o de canción activa le llegue
// a todos al instante.
//
// Tres decisiones dan forma a todo lo de abajo:
//
// 1. La sesión NO es la lista. Nace copiando una lista y a partir de ahí vive
//    sola. Las reglas de `playlists` solo dejan escribir al creador, y en el
//    servicio el que baja una tonalidad puede ser otro; además lo que se
//    decide sobre la marcha ("hoy en RE que el cantante está ronco") no debe
//    reescribir el repertorio guardado.
//
// 2. El código es la llave. No hay lista de invitados: quien conoce el código
//    puede entrar, porque el código ES el id del documento y no se puede
//    adivinar (32^6 = 1.073.741.824 combinaciones). Entrar crea tu documento
//    en `participants`, y las reglas solo dejan escribir la sesión a quien
//    tiene uno. Por eso el código se genera con `crypto.getRandomValues` y no
//    con `Math.random`, que es predecible.
//
// 3. Lo compartido y lo de cada quien viven en documentos distintos:
//
//      sessions/{code}                     -> estado compartido, cambia poco
//      sessions/{code}/participants/{uid}  -> presencia, cambia cada 30 s
//
//    Juntos, cada latido de presencia de cada músico reescribiría el
//    documento compartido y dispararía el listener de los doce, y Firestore
//    cobra por documento leído.
import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { limpiarMensajeDirector } from '@notesheet/core';
import { db } from '../firebase/config';
import { publishOwnSongs } from './songs';

const SESSIONS = 'sessions';
const PARTICIPANTS = 'participants';

/**
 * Alfabeto Crockford base32: sin I, L, O ni U.
 *
 * Las cuatro fuera por motivos distintos. I/L/O se confunden con 1 y 0 cuando
 * alguien dicta el código en voz alta o lo copia de una pantalla; la U, para
 * que no salgan palabrotas por casualidad.
 */
export const SESSION_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const SESSION_CODE_LENGTH = 6;

/** Cuánto dura una sesión antes de que la política TTL la borre sola. */
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Tope que imponen también las reglas: nadie deja una sesión inmortal. */
export const SESSION_MAX_TTL_MS = 24 * 60 * 60 * 1000;

/** Sin latido en este tiempo, el músico se considera desconectado. */
export const PRESENCE_TIMEOUT_MS = 90 * 1000;

/**
 * Error de concurrencia: alguien cambió la sesión entre que leímos y
 * escribimos, y la regla de versión rechazó la escritura.
 *
 * Firestore devuelve `permission-denied` tanto aquí como cuando de verdad no
 * tienes permiso, y desde el cliente no hay forma de distinguirlos. Por eso
 * esto se trata como "reintenta una vez y si vuelve a fallar, avisa".
 */
export class SessionConflictError extends Error {
  constructor(cause) {
    super('La sesión cambió mientras guardabas. Vuelve a intentarlo.');
    this.name = 'SessionConflictError';
    this.cause = cause;
  }
}

/**
 * Genera un código de sesión imposible de adivinar.
 *
 * `crypto.getRandomValues` en vez de `Math.random`: el código es la única
 * barrera que protege la sesión, y `Math.random` es predecible a partir de
 * unas cuantas salidas.
 *
 * El rechazo (`byte >= limite`) evita el sesgo de hacer `% 32` sobre un byte.
 * Con 32 símbolos 256 sí es múltiplo exacto y no descarta nada, pero deja el
 * patrón correcto para cuando alguien toque el alfabeto.
 */
export const generateSessionCode = (length = SESSION_CODE_LENGTH) => {
  const alfabeto = SESSION_CODE_ALPHABET;
  const limite = Math.floor(256 / alfabeto.length) * alfabeto.length;
  let codigo = '';

  while (codigo.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    for (const byte of bytes) {
      if (codigo.length === length) break;
      if (byte >= limite) continue; // descartado para no sesgar el reparto
      codigo += alfabeto[byte % alfabeto.length];
    }
  }

  return codigo;
};

/**
 * Normaliza un código tecleado a mano.
 *
 * Acepta minúsculas, espacios y guiones ("k7m-2qx"), y aplica el mapeo de
 * Crockford para los caracteres que la gente confunde al copiar: la O es un
 * cero, y la I y la L son unos.
 *
 * @returns {string} código en mayúsculas, o "" si no queda nada válido
 */
export const normalizeSessionCode = (raw) => {
  if (typeof raw !== 'string') return '';

  return raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .split('')
    .filter((c) => SESSION_CODE_ALPHABET.includes(c))
    .join('');
};

export const isValidSessionCode = (code) =>
  normalizeSessionCode(code).length === SESSION_CODE_LENGTH;

const sessionRef = (code) => doc(db, SESSIONS, code);
const participantsRef = (code) => collection(db, SESSIONS, code, PARTICIPANTS);
const participantRef = (code, uid) => doc(db, SESSIONS, code, PARTICIPANTS, uid);

/**
 * Deja una canción de la sesión con solo los campos que el modelo conoce.
 *
 * La lista de origen puede traer campos de más (o de menos, si viene de una
 * versión vieja): lo que se guarde aquí es lo que van a leer doce clientes,
 * así que se fija la forma en un solo sitio.
 */
const sanitizeSong = (song) => ({
  id: song.id,
  title: song.title || '',
  key: song.key || song.originalKey || '',
  originalKey: song.originalKey || song.key || ''
});

const sanitizeSongs = (songs) =>
  (Array.isArray(songs) ? songs : []).filter((s) => s?.id).map(sanitizeSong);

/** Quién hizo el último cambio, para poder mostrarlo en pantalla. */
const actorFrom = (user) => ({
  uid: user?.uid || null,
  name: user?.displayName || user?.name || 'Alguien'
});

/**
 * Crea la sesión a partir de una lista y entra como anfitrión.
 *
 * Si el código ya existiera, la regla de `create` rechaza la escritura (en
 * Firestore `create` solo se evalúa cuando el documento no existe) y se
 * reintenta con otro. Con mil millones de combinaciones esto no debería pasar
 * nunca, pero un reintento es más barato que pisar la sesión de otro.
 *
 * @param {Object} options
 * @param {Object} options.playlist - Lista de origen: `{ id, name, songs, mensajeDirector }`
 * @param {Object} options.host - Usuario que abre la sesión
 * @param {number} [options.ttlMs] - Duración antes de que expire
 * @returns {Promise<Object>} la sesión creada, con su `code`
 */
export const createSession = async ({ playlist, host, ttlMs = SESSION_TTL_MS }) => {
  if (!host?.uid) throw new Error('Hace falta un usuario para abrir la sesión');

  const songs = sanitizeSongs(playlist?.songs);
  const duracion = Math.min(ttlMs, SESSION_MAX_TTL_MS);

  // Abrir una sesión es compartir: si las canciones siguen privadas, la banda
  // entera ve "no se pudo cargar" donde debería haber partitura, porque la
  // regla de lectura de `songs` solo deja ver lo propio o lo publicado.
  //
  // Va antes de crear la sesión a propósito. Si falla, no se llega a repartir
  // un código que lleva a una sesión rota.
  await publishOwnSongs(songs.map((s) => s.id), host.uid);

  for (let intento = 0; intento < 5; intento += 1) {
    const code = generateSessionCode();
    const data = {
      code,
      playlistId: playlist?.id || null,
      name: playlist?.name || 'Sesión en vivo',
      hostId: host.uid,
      songs,
      // El mensaje del director con el que se armó la lista, para el panel
      // "Lista" de la sesión. Viaja copiado, como las canciones.
      mensajeDirector: limpiarMensajeDirector(playlist?.mensajeDirector),
      activeSongId: songs[0]?.id || null,
      status: 'live',
      // Arranca en 0 y sube de uno en uno: ver `applySessionChange`.
      version: 0,
      updatedBy: actorFrom(host),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + duracion)
    };

    try {
      await setDoc(sessionRef(code), data);
    } catch (error) {
      // `permission-denied` en un create con código nuevo = colisión: el
      // documento ya existía, así que la regla evaluada fue la de `update` y
      // no somos participantes de esa sesión ajena.
      if (error?.code !== 'permission-denied') throw error;
      continue;
    }

    // Fuera del try a propósito: si entrar falla, la sesión ya está creada y
    // reintentar con otro código dejaría la primera huérfana. Que suba el
    // error y lo vea quien llama.
    await joinSession(code, { user: host, ttlMs: duracion });
    return { ...data, id: code };
  }

  throw new Error('No se pudo generar un código de sesión libre');
};

/**
 * Lee una sesión una sola vez, sin escuchar.
 * Sirve para comprobar que el código existe antes de entrar.
 */
export const getSession = async (code) => {
  const snap = await getDoc(sessionRef(code));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
};

/**
 * Escucha el estado compartido de la sesión.
 *
 * `includeMetadataChanges` es lo que permite avisar de que se cayó la red: sin
 * él, el snapshot que solo cambia `fromCache` no llega y la pantalla diría que
 * todo va bien mientras el músico está en realidad desconectado. Lo cual, en
 * el wifi de una iglesia, pasa.
 *
 * @returns {Function} corta la escucha
 */
export const subscribeToSession = (code, { onChange, onError } = {}) =>
  onSnapshot(
    sessionRef(code),
    { includeMetadataChanges: true },
    (snap) => {
      if (!snap.exists()) {
        onChange?.(null, { fromCache: snap.metadata.fromCache });
        return;
      }
      onChange?.(
        { id: snap.id, ...snap.data() },
        {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        }
      );
    },
    (error) => onError?.(error)
  );

/** Escucha quién está en la sesión y con qué instrumento. */
export const subscribeToParticipants = (code, { onChange, onError } = {}) =>
  onSnapshot(
    participantsRef(code),
    (snap) => {
      onChange?.(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
    },
    (error) => onError?.(error)
  );

/**
 * Aplica un cambio al estado compartido.
 *
 * Todas las mutaciones pasan por aquí porque todas necesitan lo mismo: subir
 * `version` exactamente en uno. Las reglas comprueban que la versión que
 * mandas es la siguiente a la guardada, y ese detalle es lo que salva el caso
 * feo del directo: el móvil que perdió la red encola la escritura, y al
 * reconectar tres minutos después Firestore la manda igual. Sin el guardia,
 * un cambio de tonalidad viejo pisaría el actual delante de toda la banda.
 * Con él, el servidor la rechaza.
 *
 * Por eso la versión viaja como número calculado aquí y no como `increment()`:
 * con `increment()` el servidor calcularía el valor y la comparación de la
 * regla se cumpliría siempre, que es justo lo que no queremos.
 */
const applySessionChange = async (code, expectedVersion, changes, user) => {
  if (!Number.isInteger(expectedVersion)) {
    throw new Error('Hace falta la versión actual de la sesión');
  }

  try {
    await updateDoc(sessionRef(code), {
      ...changes,
      version: expectedVersion + 1,
      updatedBy: actorFrom(user),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    if (error?.code === 'permission-denied') throw new SessionConflictError(error);
    throw error;
  }
};

/** Pone una canción como la que se está tocando. */
export const setActiveSong = (code, { songId, expectedVersion, user }) =>
  applySessionChange(code, expectedVersion, { activeSongId: songId || null }, user);

/**
 * Cambia la tonalidad de una canción dentro de la sesión.
 *
 * La tonalidad que se guarda es la de concierto. Cada cliente la pasa por
 * `renderSongContent` con su propio instrumento, así que el que la cambia no
 * tiene que pensar en las trompetas: cada quien ve la suya.
 */
export const setSongKey = (code, { songs, songId, key, expectedVersion, user }) => {
  const actualizadas = sanitizeSongs(songs).map((song) =>
    song.id === songId ? { ...song, key } : song
  );
  return applySessionChange(code, expectedVersion, { songs: actualizadas }, user);
};

/**
 * Reemplaza la lista de canciones: sirve para reordenar, añadir y quitar.
 *
 * La canción activa se referencia por id y no por posición justo para esto:
 * quitar la segunda canción no debe cambiar cuál se está tocando. Si se quita
 * la activa, se pasa a la primera que quede.
 */
export const setSessionSongs = (code, { songs, activeSongId, expectedVersion, user }) => {
  const actualizadas = sanitizeSongs(songs);
  const sigueEstando = actualizadas.some((s) => s.id === activeSongId);

  return applySessionChange(
    code,
    expectedVersion,
    {
      songs: actualizadas,
      activeSongId: sigueEstando ? activeSongId : actualizadas[0]?.id || null
    },
    user
  );
};

/**
 * Cierra la sesión.
 *
 * Marca `ended` en vez de borrar: los que sigan con la pantalla abierta ven
 * que terminó en lugar de un error de "no existe". El borrado lo hace sola la
 * política TTL sobre `expiresAt`.
 */
export const endSession = (code, { expectedVersion, user }) =>
  applySessionChange(code, expectedVersion, { status: 'ended' }, user);

/**
 * Entra en la sesión y crea tu documento de participante.
 *
 * Ese documento es el que te da permiso de escritura sobre la sesión: las
 * reglas comprueban que existe. Por eso se crea al entrar y no al primer
 * cambio.
 */
export const joinSession = async (code, {
  user,
  instrumentId = null,
  voiceNumber = null,
  ttlMs = SESSION_TTL_MS
} = {}) => {
  if (!user?.uid) throw new Error('Hace falta un usuario para entrar');

  const data = {
    uid: user.uid,
    name: user.displayName || user.name || 'Músico',
    instrumentId,
    voiceNumber,
    joinedAt: serverTimestamp(),
    lastSeen: serverTimestamp(),
    // La TTL del documento padre no alcanza a la subcolección: si el
    // participante no lleva su propio `expiresAt`, al expirar la sesión estos
    // documentos quedan huérfanos para siempre.
    expiresAt: Timestamp.fromMillis(Date.now() + Math.min(ttlMs, SESSION_MAX_TTL_MS))
  };

  await setDoc(participantRef(code, user.uid), data, { merge: true });
  return data;
};

/** Cambia tu instrumento o tu voz, para que el resto vea quién toca qué. */
export const updateParticipant = (code, uid, changes) =>
  updateDoc(participantRef(code, uid), { ...changes, lastSeen: serverTimestamp() });

/** Latido de presencia. */
export const touchParticipant = (code, uid) =>
  updateDoc(participantRef(code, uid), { lastSeen: serverTimestamp() });

/** Sale de la sesión y borra tu presencia. */
export const leaveSession = (code, uid) => deleteDoc(participantRef(code, uid));

/**
 * Si un participante sigue conectado, según su último latido.
 *
 * Se compara contra el reloj local, que puede ir desfasado respecto al del
 * servidor. Con un margen de 90 segundos para un latido de 30, el desfase
 * tendría que ser enorme para importar, y equivocarse aquí solo significa
 * pintar un punto verde de más.
 */
export const isParticipantOnline = (participant, now = Date.now()) => {
  const lastSeen = participant?.lastSeen;
  if (!lastSeen) return false;

  const millis = typeof lastSeen.toMillis === 'function'
    ? lastSeen.toMillis()
    : new Date(lastSeen).getTime();

  if (Number.isNaN(millis)) return false;
  return now - millis < PRESENCE_TIMEOUT_MS;
};

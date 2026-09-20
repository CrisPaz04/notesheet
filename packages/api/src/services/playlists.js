// packages/api/src/services/playlists.js
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  getDocs,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Colección de listas
const playlistsCollection = collection(db, 'playlists');

// Crear una lista
export const createPlaylist = async (playlistData) => {
  try {
    const docRef = await addDoc(playlistsCollection, {
      ...playlistData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { id: docRef.id, ...playlistData };
  } catch (error) {
    throw error;
  }
};

// Obtener todas las listas
export const getAllPlaylists = async (userId) => {
  try {
    const q = query(
      playlistsCollection, 
      where("creatorId", "==", userId),
      orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    throw error;
  }
};

// Obtener listas públicas
export const getPublicPlaylists = async () => {
  try {
    const q = query(
      playlistsCollection, 
      where("public", "==", true),
      orderBy("date", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    throw error;
  }
};

// Obtener una lista por ID
export const getPlaylistById = async (playlistId) => {
  try {
    const playlistDoc = await getDoc(doc(db, 'playlists', playlistId));
    
    if (playlistDoc.exists()) {
      return {
        id: playlistDoc.id,
        ...playlistDoc.data()
      };
    } else {
      throw new Error('Lista no encontrada');
    }
  } catch (error) {
    throw error;
  }
};

// Actualizar una lista
export const updatePlaylist = async (playlistId, playlistData) => {
  try {
    const playlistRef = doc(db, 'playlists', playlistId);
    await updateDoc(playlistRef, {
      ...playlistData,
      updatedAt: new Date()
    });
    
    return {
      id: playlistId,
      ...playlistData
    };
  } catch (error) {
    throw error;
  }
};

// Eliminar una lista
export const deletePlaylist = async (playlistId) => {
  try {
    await deleteDoc(doc(db, 'playlists', playlistId));
    return playlistId;
  } catch (error) {
    throw error;
  }
};
// --- Referencias a canciones dentro de las listas -------------------------
//
// Cada entrada de `songs[]` es una copia parcial de la canción
// (`{ id, title, key, originalKey }`) más la tonalidad elegida para esa
// ocasión. Borrar la canción del repertorio no toca esas entradas, así que
// quedan apuntando a un documento que ya no existe.
//
// Desde el cliente no se puede distinguir "borrada" de "privada de otro
// músico": la regla de lectura de `songs` evalúa `resource.data.userId`, y
// sobre un documento inexistente `resource` es null, no se puede evaluar y
// deniega. Sale `permission-denied`, nunca `not-found`. Por eso el momento de
// detectarlo es al borrar, cuando todavía se sabe qué está pasando, y no al
// leer la lista, cuando ya no.

/**
 * ¿Esta lista contiene esa canción?
 *
 * Solo se compara el `id`. El resto de campos de la entrada son una foto del
 * momento en que se añadió y pueden haber quedado desfasados respecto a la
 * canción real.
 */
export const playlistReferencesSong = (playlist, songId) =>
  (playlist?.songs || []).some((entrada) => entrada?.id === songId);

/**
 * El `songs[]` de la lista sin las entradas de esa canción.
 *
 * Quita **todas** sus apariciones: nada impide repetir una canción dentro de
 * un mismo ensayo, y dejar una a medias sería peor que no limpiar.
 */
export const playlistWithoutSong = (playlist, songId) =>
  (playlist?.songs || []).filter((entrada) => entrada?.id !== songId);

/**
 * Las listas visibles que contienen una canción, para poder avisar antes de
 * borrarla.
 *
 * Alcance: las del usuario más las públicas. Una lista **privada de otro
 * músico** no se puede leer, así que el recuento es un mínimo, no un total.
 * Se acepta a sabiendas: es el mismo límite que impone la regla de lectura de
 * `playlists`, y no hay forma de sortearlo desde el cliente.
 *
 * Cada lista vuelve marcada con `isOwn`, que es lo que decide si se puede
 * limpiar o solo avisar.
 *
 * @param {string} songId
 * @param {string} userId
 * @returns {Promise<Array>} Listas que la contienen, cada una con `isOwn`
 */
export const getPlaylistsWithSong = async (songId, userId) => {
  const [propias, publicas] = await Promise.all([
    getAllPlaylists(userId),
    getPublicPlaylists()
  ]);

  // Una lista pública propia sale en las dos consultas.
  const porId = new Map();
  propias.forEach((lista) => porId.set(lista.id, lista));
  publicas.forEach((lista) => {
    if (!porId.has(lista.id)) porId.set(lista.id, lista);
  });

  return [...porId.values()]
    .filter((lista) => playlistReferencesSong(lista, songId))
    .map((lista) => ({ ...lista, isOwn: lista.creatorId === userId }));
};

/**
 * Quita una canción de las listas indicadas.
 *
 * Solo toca las del propio usuario: la regla de escritura de `playlists` exige
 * ser el creador, así que intentarlo con la lista de otro músico sería un
 * `permission-denied` garantizado.
 *
 * No lanza. Cuando esto se ejecuta la canción ya está borrada, y no hay nada
 * que deshacer: lo único útil es contar qué se ha podido limpiar para poder
 * avisar de lo que no.
 *
 * @returns {Promise<{limpiadas: number, fallidas: number, ajenas: number}>}
 */
export const removeSongFromPlaylists = async (songId, playlists, userId) => {
  const todas = playlists || [];
  const mias = todas.filter((lista) => lista.creatorId === userId);

  const resultados = await Promise.allSettled(
    mias.map((lista) =>
      updatePlaylist(lista.id, { songs: playlistWithoutSong(lista, songId) })
    )
  );

  return {
    limpiadas: resultados.filter((r) => r.status === 'fulfilled').length,
    fallidas: resultados.filter((r) => r.status === 'rejected').length,
    ajenas: todas.length - mias.length
  };
};

// packages/api/src/services/songs.js
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

// Colección de canciones
const songsCollection = collection(db, 'songs');

// Crear una canción
export const createSong = async (songData) => {
  try {
    // Manejar la migración de author a version
    const dataToSave = { ...songData };
    
    // Si hay un campo author, convertirlo a version
    if (dataToSave.author !== undefined) {
      dataToSave.version = dataToSave.author;
      delete dataToSave.author;
    }
    
    // Asegurarse de que voices sea un objeto si no está definido
    if (!dataToSave.voices) {
      dataToSave.voices = {};
    }
    
    // Asegurarse de que lyricsOnly exista
    if (!dataToSave.lyricsOnly) {
      dataToSave.lyricsOnly = ""; // Campo vacío por defecto
    }
    
    const docRef = await addDoc(songsCollection, {
      ...dataToSave,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { id: docRef.id, ...dataToSave };
  } catch (error) {
    throw error;
  }
};

// Normaliza un documento de canción a la forma que espera la aplicación
const mapSongDoc = (doc, userId) => {
  const songData = { ...doc.data() };

  // Manejar la migración de author a version para canciones existentes
  if (songData.author !== undefined && songData.version === undefined) {
    songData.version = songData.author;
    delete songData.author;
  }

  // Las canciones anteriores al repertorio compartido no tienen el campo:
  // se tratan como privadas para no publicar nada sin querer.
  songData.public = songData.public === true;

  return {
    id: doc.id,
    ...songData,
    isOwn: songData.userId === userId
  };
};

/**
 * Devuelve el repertorio visible para un usuario: sus propias canciones
 * (públicas o no) más las que otros músicos hayan publicado.
 *
 * Son dos consultas porque Firestore no sabe hacer un OR entre campos
 * distintos; se fusionan aquí quitando duplicados.
 *
 * @param {string} userId - ID del usuario
 * @returns {Promise<Array>} Canciones, cada una con `isOwn`
 */
export const getAllSongs = async (userId) => {
  const propias = query(
    songsCollection,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const compartidas = query(
    songsCollection,
    where("public", "==", true),
    orderBy("createdAt", "desc")
  );

  const [snapPropias, snapCompartidas] = await Promise.all([
    getDocs(propias),
    getDocs(compartidas)
  ]);

  const porId = new Map();
  // Las propias van primero para que ganen sobre su copia de la consulta pública
  snapPropias.docs.forEach(doc => porId.set(doc.id, mapSongDoc(doc, userId)));
  snapCompartidas.docs.forEach(doc => {
    if (!porId.has(doc.id)) porId.set(doc.id, mapSongDoc(doc, userId));
  });

  return [...porId.values()];
};


// Obtener una canción por ID
export const getSongById = async (songId) => {
  try {
    const songDoc = await getDoc(doc(db, 'songs', songId));
    
    if (songDoc.exists()) {
      const data = songDoc.data();
      
      // Manejar la migración de author a version para canciones existentes
      const songData = { ...data };
      if (songData.author !== undefined && songData.version === undefined) {
        songData.version = songData.author;
        delete songData.author;
      }
      
      // Asegurarse de que voices sea un objeto si no está definido
      if (!songData.voices) {
        songData.voices = {};
      }
      
      // Asegurarse de que lyricsOnly exista
      if (!songData.lyricsOnly) {
        songData.lyricsOnly = ""; // Campo vacío por defecto
      }
      
      return {
        id: songDoc.id,
        ...songData
      };
    } else {
      throw new Error('Canción no encontrada');
    }
  } catch (error) {
    throw error;
  }
};

// Actualizar una canción
export const updateSong = async (songId, songData) => {
  try {
    const songRef = doc(db, 'songs', songId);
    
    // Manejar la migración de author a version
    const dataToUpdate = { ...songData };
    
    if (dataToUpdate.author !== undefined) {
      dataToUpdate.version = dataToUpdate.author;
      delete dataToUpdate.author;
    }
    
    await updateDoc(songRef, {
      ...dataToUpdate,
      updatedAt: new Date()
    });
    
    return {
      id: songId,
      ...dataToUpdate
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Publica en el repertorio las canciones propias que todavía sean privadas.
 *
 * Compartir algo que contiene canciones implica compartir las canciones: la
 * regla de lectura solo deja ver lo propio o lo publicado, así que una lista
 * (o una sesión en vivo) con canciones privadas le aparece vacía al resto de
 * la banda. No es un detalle cosmético: sin esto, doce músicos ven "no se
 * pudo cargar" donde debería haber partitura.
 *
 * Solo se tocan las propias. Las ajenas ya estaban publicadas, porque es la
 * única forma de haberlas podido añadir, y además las reglas no dejarían
 * cambiarlas.
 *
 * Una canción que ya no existe —borrada del repertorio pero todavía
 * referenciada por una lista vieja— se salta sin ruido: no hay nada que
 * publicar y no es motivo para impedir que empiece el servicio.
 *
 * @param {string[]} songIds - Canciones a revisar
 * @param {string} userId - Dueño que publica
 * @returns {Promise<string[]>} ids de las que se han publicado ahora
 */
export const publishOwnSongs = async (songIds, userId) => {
  if (!userId || !Array.isArray(songIds) || songIds.length === 0) return [];

  const unicos = [...new Set(songIds.filter(Boolean))];

  const candidatas = await Promise.all(unicos.map(async (songId) => {
    try {
      const snap = await getDoc(doc(db, 'songs', songId));
      if (!snap.exists()) return null;

      const data = snap.data();
      const esPropia = data.userId === userId;
      const yaPublicada = data.public === true;

      return esPropia && !yaPublicada ? songId : null;
    } catch (error) {
      // Solo se ignora el permiso denegado: es una canción ajena y privada,
      // que ni podemos leer ni nos toca publicar.
      //
      // Lo demás se propaga a propósito. Un `catch` que se lo tragara todo
      // convertiría un fallo de red —o un error de programación aquí dentro—
      // en "esta canción no hacía falta publicarla", y el resultado sería
      // repartir el código de una sesión que la banda no puede leer.
      if (error?.code === 'permission-denied') return null;
      throw error;
    }
  }));

  const porPublicar = candidatas.filter(Boolean);

  await Promise.all(
    porPublicar.map((songId) => updateSong(songId, { public: true }))
  );

  return porPublicar;
};

// Eliminar una canción
export const deleteSong = async (songId) => {
  try {
    await deleteDoc(doc(db, 'songs', songId));
    return songId;
  } catch (error) {
    throw error;
  }
};

// Añadir una voz a una canción
export const addVoiceToSong = async (songId, instrumentId, voiceNumber, content) => {
  try {
    const songRef = doc(db, 'songs', songId);
    const songDoc = await getDoc(songRef);
    
    if (!songDoc.exists()) {
      throw new Error('Canción no encontrada');
    }
    
    const songData = songDoc.data();
    const voices = songData.voices || {};
    
    // Asegurarse de que existe la estructura para este instrumento
    if (!voices[instrumentId]) {
      voices[instrumentId] = {};
    }
    
    // Añadir/actualizar la voz
    voices[instrumentId][voiceNumber] = content;
    
    // Guardar cambios
    await updateDoc(songRef, {
      voices,
      updatedAt: new Date()
    });
    
    return {
      id: songId,
      voices
    };
  } catch (error) {
    throw error;
  }
};

// Eliminar una voz de una canción
export const removeVoiceFromSong = async (songId, instrumentId, voiceNumber) => {
  try {
    const songRef = doc(db, 'songs', songId);
    const songDoc = await getDoc(songRef);
    
    if (!songDoc.exists()) {
      throw new Error('Canción no encontrada');
    }
    
    const songData = songDoc.data();
    const voices = songData.voices || {};
    
    // Verificar si existe la voz para eliminarla
    if (voices[instrumentId] && voices[instrumentId][voiceNumber]) {
      delete voices[instrumentId][voiceNumber];
      
      // Si no quedan voces para este instrumento, eliminar la entrada
      if (Object.keys(voices[instrumentId]).length === 0) {
        delete voices[instrumentId];
      }
      
      // Guardar cambios
      await updateDoc(songRef, {
        voices,
        updatedAt: new Date()
      });
    }
    
    return {
      id: songId,
      voices
    };
  } catch (error) {
    throw error;
  }
};
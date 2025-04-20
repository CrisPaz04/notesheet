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

// Obtener todas las canciones
export const getAllSongs = async (userId) => {
  try {
    const q = query(
      songsCollection, 
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Manejar la migración de author a version para canciones existentes
      const songData = { ...data };
      if (songData.author !== undefined && songData.version === undefined) {
        songData.version = songData.author;
        delete songData.author;
      }
      
      return {
        id: doc.id,
        ...songData
      };
    });
  } catch (error) {
    throw error;
  }
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
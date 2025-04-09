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
    const docRef = await addDoc(songsCollection, {
      ...songData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return { id: docRef.id, ...songData };
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
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    throw error;
  }
};

// Obtener una canción por ID
export const getSongById = async (songId) => {
  try {
    const songDoc = await getDoc(doc(db, 'songs', songId));
    
    if (songDoc.exists()) {
      return {
        id: songDoc.id,
        ...songDoc.data()
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
    await updateDoc(songRef, {
      ...songData,
      updatedAt: new Date()
    });
    
    return {
      id: songId,
      ...songData
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
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
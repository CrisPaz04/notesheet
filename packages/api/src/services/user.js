// packages/api/src/services/user.js
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc 
} from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Obtiene las preferencias del usuario
 * @param {string} userId - ID del usuario
 * @returns {Object} Objeto con las preferencias del usuario
 */
export const getUserPreferences = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data().preferences || {};
    }
    return {};
  } catch (error) {
    console.error("Error getting user preferences:", error);
    throw error;
  }
};

/**
 * Actualiza las preferencias del usuario
 * @param {string} userId - ID del usuario
 * @param {Object} preferences - Objeto con las preferencias a actualizar
 * @returns {Object} Objeto con todas las preferencias actualizadas
 */
export const updateUserPreferences = async (userId, preferences) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // El usuario ya existe, actualizar sus preferencias
      const currentPrefs = userDoc.data().preferences || {};
      const updatedPrefs = { ...currentPrefs, ...preferences };
      
      await updateDoc(userRef, {
        preferences: updatedPrefs
      });
      
      return updatedPrefs;
    } else {
      // El usuario no existe, crear un nuevo documento
      const newUserData = {
        id: userId,
        preferences: preferences,
        createdAt: new Date()
      };
      
      await setDoc(userRef, newUserData);
      return preferences;
    }
  } catch (error) {
    console.error("Error updating user preferences:", error);
    throw error;
  }
};
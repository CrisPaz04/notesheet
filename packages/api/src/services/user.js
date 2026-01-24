// packages/api/src/services/user.js
import {
  doc,
  setDoc,
  getDoc
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

    // Use setDoc with merge to avoid race conditions and handle both
    // existing and non-existing documents in a single operation
    await setDoc(userRef, {
      id: userId,
      preferences: preferences,
      updatedAt: new Date()
    }, { merge: true });

    // Return the preferences that were set
    return preferences;
  } catch (error) {
    console.error("Error updating user preferences:", error);
    throw error;
  }
};

/**
 * Obtiene el rol del usuario
 * @param {string} userId - ID del usuario
 * @returns {string} Rol del usuario ('editor' o 'viewer'), defaults to 'viewer'
 */
export const getUserRole = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data().role || 'viewer';
    }
    return 'viewer';
  } catch (error) {
    console.error("Error getting user role:", error);
    return 'viewer';
  }
};

/**
 * Establece el rol del usuario (para uso administrativo)
 * @param {string} userId - ID del usuario
 * @param {string} role - Rol a establecer ('editor' o 'viewer')
 */
export const setUserRole = async (userId, role) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      id: userId,
      role: role,
      updatedAt: new Date()
    }, { merge: true });
    return role;
  } catch (error) {
    console.error("Error setting user role:", error);
    throw error;
  }
};
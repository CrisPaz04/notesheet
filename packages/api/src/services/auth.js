// packages/api/src/services/auth.js
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase/config';

// Autenticación con Google
export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    provider.addScope('profile');
    provider.addScope('email');
    
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error('Error en Google Sign In:', error);
    throw error;
  }
};

// Registro de usuario con email/password
export const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

// Inicio de sesión con email/password
export const signIn = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    throw error;
  }
};

// Cerrar sesión
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
    throw error;
  }
};

/**
 * Entra como invitado, sin cuenta.
 *
 * Existe por las sesiones en vivo: el director manda el link por WhatsApp
 * diez minutos antes del servicio y el trompetista que no tiene cuenta no va a
 * registrarse ahí mismo. Las reglas piden `request.auth != null`, y un usuario
 * anónimo lo cumple.
 *
 * Lo que ve un invitado sigue limitado por las mismas reglas de siempre: solo
 * las canciones publicadas. Por eso al compartir una lista se publican sus
 * canciones (`publicarCancionesDeLaLista`).
 *
 * Requiere tener habilitado el proveedor anónimo en la consola de Firebase.
 *
 * @param {string} nombre - Cómo quiere que le llamen en la sesión
 */
export const signInAsGuest = async (nombre) => {
  const { user } = await signInAnonymously(auth);

  const limpio = (nombre || '').trim();
  if (limpio) {
    // El perfil es lo único que distingue a un invitado de otro en la lista
    // de conectados: sin nombre son todos "Músico".
    await updateProfile(user, { displayName: limpio.slice(0, 40) });
  }

  return user;
};

// Observador de estado de autenticación
export const authStateListener = (callback) => {
  return onAuthStateChanged(auth, callback);
};
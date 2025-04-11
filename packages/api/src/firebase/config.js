// packages/api/src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase para la aplicación web
const firebaseConfig = {
  apiKey: "AIzaSyBSzEkng9WcFu6-Wr6okmwyHMJxkQuqYtQ",
  authDomain: "notesheet-d63e8.firebaseapp.com",
  projectId: "notesheet-d63e8",
  storageBucket: "notesheet-d63e8.firebasestorage.app",
  messagingSenderId: "698849739065",
  appId: "1:698849739065:web:2d60e955262d81e24fe8e8",
  measurementId: "G-QH769ZM91Q"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
// packages/api/src/firebase/config.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuración de Firebase para la aplicación web
// Las credenciales se obtienen de variables de entorno por seguridad
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar servicios
const auth = getAuth(app);

/**
 * Firestore con caché persistente en IndexedDB.
 *
 * El caso de uso manda: el músico abre la partitura sobre el escenario, donde
 * el wifi de la iglesia suele fallar. Con la caché activada, todo lo que ya
 * vio queda disponible sin red, y las escrituras se encolan hasta que vuelva.
 *
 * `persistentMultipleTabManager` permite tener varias pestañas abiertas a la
 * vez (por ejemplo la lista y una canción) sin que se peleen por la caché.
 *
 * Si IndexedDB no está disponible —modo incógnito, almacenamiento bloqueado,
 * navegador antiguo— se cae a la versión en memoria: la app sigue funcionando
 * igual, solo que sin offline.
 */
const createDb = () => {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } catch (error) {
    console.warn(
      'Firestore sin caché offline (IndexedDB no disponible):',
      error?.message || error
    );
    return getFirestore(app);
  }
};

const db = createDb();
const storage = getStorage(app);

export { app, auth, db, storage };
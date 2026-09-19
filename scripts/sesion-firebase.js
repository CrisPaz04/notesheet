/**
 * Saca de la sesión del navegador lo que hace falta para hablar con Firestore
 * por REST: uid, projectId y un token válido.
 *
 * Este archivo se **inyecta** dentro de los importadores (ver
 * `scripts/generar-importador-servido.mjs`); no se carga por separado. Está
 * aparte para no tener la misma lógica copiada en dos sitios.
 *
 * Tres cosas que no son obvias y costaron un "No hay sesión iniciada" con la
 * sesión abierta delante:
 *
 * 1. El SDK de Firebase guarda la sesión en **IndexedDB**, no en localStorage.
 *    Mirar solo en localStorage da "no hay sesión" aunque la haya.
 * 2. La clave es `firebase:authUser:<apiKey>:<nombreDeApp>`. Lo que va entre
 *    corchetes es `[DEFAULT]`, el nombre de la app, **no** el projectId.
 * 3. El projectId sí está dentro del propio token: es el `aud` del JWT.
 */
const leerSesionFirebase = async () => {
  const deLocalStorage = () => {
    try {
      const clave = Object.keys(localStorage).find((k) => k.includes('firebase:authUser'));
      return clave ? JSON.parse(localStorage.getItem(clave)) : null;
    } catch {
      return null;
    }
  };

  const deIndexedDB = () => new Promise((resolve) => {
    let peticion;
    try {
      peticion = indexedDB.open('firebaseLocalStorageDb');
    } catch {
      return resolve(null);
    }
    peticion.onerror = () => resolve(null);
    peticion.onsuccess = () => {
      const bd = peticion.result;
      if (!bd.objectStoreNames.contains('firebaseLocalStorage')) return resolve(null);
      const todo = bd.transaction('firebaseLocalStorage', 'readonly')
        .objectStore('firebaseLocalStorage')
        .getAll();
      todo.onerror = () => resolve(null);
      todo.onsuccess = () => {
        const fila = todo.result.find((r) => String(r.fbase_key).includes('firebase:authUser'));
        resolve(fila ? fila.value : null);
      };
    };
  });

  const usuario = deLocalStorage() || await deIndexedDB();
  if (!usuario?.stsTokenManager?.accessToken) return null;

  const { accessToken, refreshToken, expirationTime } = usuario.stsTokenManager;
  let token = accessToken;

  // El token dura una hora. Si está a punto de caducar se renueva, que la
  // importación son más de cien escrituras seguidas.
  if (Number(expirationTime) - Date.now() < 5 * 60 * 1000 && refreshToken && usuario.apiKey) {
    try {
      const r = await fetch(`https://securetoken.googleapis.com/v1/token?key=${usuario.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
      });
      if (r.ok) token = (await r.json()).access_token;
    } catch {
      // Si falla la renovación se sigue con el que había: puede que aún valga.
    }
  }

  // El projectId vive en el `aud` del JWT.
  let projectId = null;
  try {
    const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    projectId = JSON.parse(atob(cuerpo)).aud;
  } catch {
    return null;
  }

  if (!projectId || !usuario.uid) return null;
  return { uid: usuario.uid, token, projectId };
};

// apps/web/src/lib/lazyConRecarga.js
import { lazy } from "react";

/**
 * Carga diferida que sobrevive a un despliegue.
 *
 * Cada ruta viaja en su propio archivo con un hash en el nombre
 * (`SongView-D-_n3MBa.js`). Cuando se despliega una versión nueva, esos
 * nombres cambian y los viejos desaparecen del servidor. Quien tuviera la
 * aplicación abierta se queda con el `index.html` anterior en memoria, así
 * que al entrar en una vista que aún no había visitado pide un archivo que
 * ya no existe.
 *
 * Y no falla de forma reconocible: la regla de `netlify.toml` manda todo lo
 * que no encuentra a `index.html`, así que el servidor responde HTML donde el
 * navegador esperaba JavaScript, y lo que sale es «Expected a JavaScript
 * module but the server responded with a MIME type of "text/html"» y una
 * pantalla en blanco. Le pasó a la banda justo después de un despliegue.
 *
 * La solución es recargar: al recargar se pide el `index.html` nuevo, que
 * apunta a los archivos que sí existen. Se hace **una sola vez** por sesión
 * de pestaña; si tras recargar vuelve a fallar, el problema es otro y hay que
 * dejar que el error se vea en vez de recargar en bucle.
 */
const CLAVE = "notesheet:recarga-por-chunk";

const leerMarca = () => {
  try {
    return sessionStorage.getItem(CLAVE) === "1";
  } catch {
    // Modo incógnito o almacenamiento bloqueado: sin marca no se puede
    // garantizar que no haya bucle, así que se prefiere no recargar.
    return true;
  }
};

const marcar = () => {
  try {
    sessionStorage.setItem(CLAVE, "1");
    return true;
  } catch {
    return false;
  }
};

/** Se llama cuando una carga va bien: la próxima vez se podrá reintentar. */
export const olvidarRecarga = () => {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Da igual: solo significa que no habrá segundo intento en esta pestaña.
  }
};

/**
 * Envuelve un `import()` dinámico con un reintento por recarga.
 *
 * @param {Function} importar - La función que hace el `import()`
 * @param {Object} [deps] - Inyectables, para poder probarlo
 * @returns {React.LazyExoticComponent}
 */
export const lazyConRecarga = (importar, deps = {}) => {
  const recargar = deps.recargar || (() => window.location.reload());

  return lazy(() => importar().then(
    (modulo) => {
      olvidarRecarga();
      return modulo;
    },
    (error) => {
      if (leerMarca() || !marcar()) throw error;

      recargar();

      // La página se está yendo: esta promesa no debe resolverse, o React
      // intentaría pintar un componente que no existe mientras tanto.
      return new Promise(() => {});
    }
  ));
};

export default lazyConRecarga;

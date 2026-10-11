// El service worker de la PWA (offline y app instalable).
//
// Hace lo mismo que el `registerSW.js` que inyectaba vite-plugin-pwa (registrar
// /sw.js al cargar la página), pero con un catch. Hay navegadores que rechazan
// el registro (un WebView de Android lo hizo, aviso JAVASCRIPT-REACT-3 de
// Sentry), y el script del plugin no lo gestionaba: cada uno era un error sin
// gestionar. La app funciona igual sin service worker, solo que sin offline.
//
// No se usa `registerSW` de `virtual:pwa-register`: con `registerType:
// 'autoUpdate'` recarga la página al activarse una versión nueva, y en mitad
// del culto eso no. La versión nueva entra en la siguiente carga, como hasta
// ahora (y `lazyConRecarga` cubre las vistas que falten).

/**
 * @param {Navigator} [nav]
 * @param {Window} [ventana]
 */
export function registrarServiceWorker(nav = navigator, ventana = window) {
  if (!nav?.serviceWorker) return;
  ventana.addEventListener('load', () =>
    nav.serviceWorker.register('/sw.js', { scope: '/' }).then(
      () => undefined,
      (error) => {
        console.warn('No se pudo registrar el service worker (la app sigue, sin modo offline):', error);
      }
    )
  );
}

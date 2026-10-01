// Registro de errores en producción (Sentry). Sin él, lo que le fallara a un
// músico el domingo no dejaba rastro.
//
// Solo se activa con VITE_SENTRY_DSN (en Netlify): en desarrollo, en los tests
// y mientras no haya cuenta, no hace nada. Nada de datos personales: ni IP ni
// correo ni nombre; del usuario solo el id de la cuenta, para saber si un
// error le pasa siempre a la misma persona.
import * as Sentry from "@sentry/react";

let activo = false;

/**
 * @param {Record<string, string>} env - `import.meta.env`
 * @param {string} [version] - El commit desplegado (lo pone Vite al compilar)
 * @returns {boolean} si quedó activo
 */
export function iniciarSentry(env, version) {
  const dsn = env?.VITE_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: env.MODE || "production",
    release: version || undefined,
    sendDefaultPii: false,
    // Ruido de los navegadores que no indica ningún fallo de la app
    ignoreErrors: ["ResizeObserver loop limit exceeded", "ResizeObserver loop completed with undelivered notifications"],
  });
  activo = true;
  return true;
}

/**
 * Las opciones de `createRoot` para que React 19 pase sus errores a Sentry.
 * Sin Sentry activo, ninguna: React sigue con su comportamiento de siempre.
 */
export function opcionesDeRaiz() {
  if (!activo) return {};
  return {
    onUncaughtError: Sentry.reactErrorHandler(),
    onCaughtError: Sentry.reactErrorHandler(),
    onRecoverableError: Sentry.reactErrorHandler(),
  };
}

/** Del usuario, solo el id de la cuenta (o nada al cerrar sesión). */
export function ponerUsuarioEnSentry(usuario) {
  if (!activo) return;
  Sentry.setUser(usuario?.uid ? { id: usuario.uid } : null);
}

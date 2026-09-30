/**
 * Si el músico ya dio permiso al micrófono, sin preguntarle nada.
 *
 * El afinador arranca solo únicamente con 'granted': si no, el aviso del
 * navegador saltaría sin que nadie lo pidiera, y un "Bloquear" por reflejo
 * cuesta mucho deshacer. Safari antiguo y algunos navegadores no dejan
 * consultarlo (o no conocen 'microphone'): ahí queda el botón.
 *
 * @returns {Promise<'granted'|'prompt'|'denied'|'desconocido'>}
 */
export async function permisoMicrofono() {
  try {
    if (!navigator.permissions?.query) return "desconocido";
    const estado = await navigator.permissions.query({ name: "microphone" });
    return estado.state;
  } catch {
    return "desconocido";
  }
}

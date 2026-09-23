import { useEffect, useRef } from "react";
import { getUserPreferences, updateUserPreferences } from "@notesheet/api";
import usePreferenciaLocal from "./usePreferenciaLocal";

export const NOTACIONES = ["latin", "english"];

/**
 * Actualiza la copia del dispositivo cuando la notación se guarda en el
 * perfil por otro camino (el visor de canciones, la pantalla de
 * Preferencias). Sin esto, la siguiente vista arrancaría un instante con la
 * notación vieja hasta que llegara la del perfil.
 */
export const recordarNotacionEnDispositivo = (notacion, claveLocal = "notacion") => {
  if (!NOTACIONES.includes(notacion)) return;
  try {
    localStorage.setItem(claveLocal, notacion);
  } catch {
    // Almacenamiento bloqueado: la vista esperará al perfil, sin más.
  }
};

/**
 * La notación (DO-RE-MI o C-D-E) que el músico eligió en su perfil, para
 * cualquier vista que muestre notas.
 *
 * El perfil manda: la vista arranca con `defaultNotationSystem`, y si el
 * músico la cambia desde un interruptor de la vista, se guarda en el perfil,
 * como ya hacía el visor de canciones. Así no hay dos ajustes que puedan
 * contradecirse.
 *
 * Además se guarda una copia en el dispositivo, por dos motivos: la vista
 * arranca ya con la notación buena sin esperar a Firestore (sin parpadeo, y
 * sin red sobre el escenario), y quien entra sin cuenta, como los músicos que
 * llegan a una sesión en vivo por el enlace de WhatsApp, también la conserva.
 *
 * @param {Object|null} currentUser - Usuario autenticado, o null
 * @param {string} [claveLocal] - Clave de la copia en el dispositivo
 * @returns {[string, (notacion: string) => void]}
 */
export default function useNotacionPreferida(currentUser, claveLocal = "notacion") {
  const [notacion, setLocal] = usePreferenciaLocal(claveLocal, "latin", NOTACIONES);

  // Si el músico ya la cambió en esta pantalla, lo que llegue después del
  // perfil no la pisa: Firestore puede tardar y sería volver atrás su clic.
  const elegidaAqui = useRef(false);

  const conCuenta = Boolean(currentUser && !currentUser.isAnonymous);
  const uid = conCuenta ? currentUser.uid : null;

  useEffect(() => {
    if (!uid) return;

    let cancelado = false;
    Promise.resolve()
      .then(() => getUserPreferences(uid))
      .then((prefs) => {
        if (cancelado || elegidaAqui.current) return;
        // `setLocal` ya descarta lo que no sea una notación conocida
        if (prefs?.defaultNotationSystem) setLocal(prefs.defaultNotationSystem);
      })
      .catch((error) => console.error("Error cargando la notación del perfil:", error));

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const cambiar = (nueva) => {
    if (!NOTACIONES.includes(nueva)) return;
    elegidaAqui.current = true;
    setLocal(nueva);

    if (!uid) return;
    // Best-effort, como el tamaño de letra: si falla, se aplica igual aquí
    Promise.resolve()
      .then(() => updateUserPreferences(uid, { defaultNotationSystem: nueva }))
      .catch((error) => console.error("Error guardando la notación del perfil:", error));
  };

  return [notacion, cambiar];
}

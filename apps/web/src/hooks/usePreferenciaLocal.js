import { useState } from "react";

/**
 * Preferencia de interfaz que se recuerda en este dispositivo.
 *
 * Va a `localStorage` y no a las preferencias del usuario en Firestore, como
 * el tema (`useTheme`): son ajustes de cómo se ve la pantalla, se aplican al
 * instante y tienen que funcionar sin red, que la app se usa sobre el
 * escenario. Que cada músico lo tenga distinto en el móvil y en el portátil
 * es lo esperable, no un problema.
 *
 * `opcionesValidas` evita que un valor viejo o manipulado deje la pantalla en
 * un estado que el código ya no entiende: si no está en la lista, se usa el
 * valor por defecto.
 *
 * @param {string} clave - Clave en localStorage
 * @param {string} porDefecto - Valor si no hay nada guardado o no vale
 * @param {string[]} opcionesValidas - Valores que el componente sabe manejar
 * @returns {[string, (valor: string) => void]}
 */
export default function usePreferenciaLocal(clave, porDefecto, opcionesValidas) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = localStorage.getItem(clave);
      return opcionesValidas.includes(guardado) ? guardado : porDefecto;
    } catch {
      // Modo incógnito o almacenamiento bloqueado: se usa el valor por
      // defecto y la pantalla funciona igual, solo que sin recordar.
      return porDefecto;
    }
  });

  const guardar = (nuevo) => {
    if (!opcionesValidas.includes(nuevo)) return;
    setValor(nuevo);
    try {
      localStorage.setItem(clave, nuevo);
    } catch {
      // Si no se puede guardar, al menos se aplica en esta sesión.
    }
  };

  return [valor, guardar];
}

import usePreferenciaLocal from "./usePreferenciaLocal";

export const ALINEACIONES = ["left", "center", "right"];

/**
 * Alineación del texto de las canciones (izquierda, centro o derecha).
 *
 * Es del dispositivo, no del perfil: en el móvil puede apetecer centrado y en
 * la tablet del atril a la izquierda. La comparten el visor de la canción, la
 * lista y la sesión en vivo, así que se elige una vez para todas.
 *
 * Arranca centrado porque es como se veía siempre (`.song-section-modern`
 * centra), y nadie tiene que encontrarse el repertorio cambiado sin tocar
 * nada.
 *
 * @returns {[string, (valor: string) => void]}
 */
export default function useAlineacionTexto() {
  return usePreferenciaLocal("alineacionTexto", "center", ALINEACIONES);
}

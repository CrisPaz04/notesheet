import { NUMEROS_DE_VOZ } from "@notesheet/core";
import usePreferenciaLocal from "./usePreferenciaLocal";

/**
 * Qué número es este músico en su sección ("soy la trompeta 2").
 *
 * Es del dispositivo, como el instrumento de la sesión en vivo: cambia de un
 * servicio a otro según quién haya ido, así que no va al perfil. Lo usan la
 * sesión en vivo, la lista y la canción para abrir en cada una la voz que le
 * toca (`vozParaMusico`, en core).
 *
 * @returns {[string, (numero: string) => void]}
 */
export default function useNumeroDeVoz() {
  return usePreferenciaLocal("numeroDeVoz", "1", NUMEROS_DE_VOZ);
}

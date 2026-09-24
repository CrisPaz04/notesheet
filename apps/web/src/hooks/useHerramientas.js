import { useCallback, useState } from "react";

// En un móvil no caben dos paneles: abrir uno cierra el otro
const PANTALLA_ESTRECHA = "(max-width: 767px)";
const CLAVE_POSICIONES = "herramientas:posiciones";

export const esPantallaEstrecha = () => (
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    && Boolean(window.matchMedia(PANTALLA_ESTRECHA)?.matches)
);

const leerPosiciones = () => {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_POSICIONES) || "{}");
    return guardado && typeof guardado === "object" ? guardado : {};
  } catch {
    return {};
  }
};

/**
 * Qué paneles flotantes (lista, afinador, metrónomo, círculo de quintas)
 * están abiertos y dónde está cada uno. Está fuera del componente para que
 * la vista pueda abrirlos desde sus propios botones, como el "Metrónomo" de
 * la canción.
 *
 * Las posiciones (lado y altura) se recuerdan en el dispositivo: quien deja
 * el afinador arriba a la derecha lo quiere ahí el domingo siguiente.
 *
 * @returns {{abiertos: string[], alternar: (id: string) => void,
 *            cerrar: (id: string) => void, estaAbierto: (id: string) => boolean,
 *            posiciones: Object<string, {lado: string, top?: number}>,
 *            colocar: (cambios: Object) => void}}
 */
export default function useHerramientas() {
  const [abiertos, setAbiertos] = useState([]);
  const [posiciones, setPosiciones] = useState(leerPosiciones);

  const alternar = useCallback((id) => {
    setAbiertos((previos) => {
      if (previos.includes(id)) return previos.filter((p) => p !== id);
      return esPantallaEstrecha() ? [id] : [...previos, id];
    });
  }, []);

  const cerrar = useCallback((id) => {
    setAbiertos((previos) => previos.filter((p) => p !== id));
  }, []);

  const estaAbierto = useCallback((id) => abiertos.includes(id), [abiertos]);

  /** Mezcla posiciones nuevas (id → {lado, top}) y las guarda. */
  const colocar = useCallback((cambios) => {
    setPosiciones((previas) => {
      const siguientes = { ...previas };
      Object.entries(cambios).forEach(([id, pos]) => {
        siguientes[id] = { ...previas[id], ...pos };
      });
      try {
        localStorage.setItem(CLAVE_POSICIONES, JSON.stringify(siguientes));
      } catch {
        // Sin almacenamiento se colocan igual, solo que no se recuerdan
      }
      return siguientes;
    });
  }, []);

  return { abiertos, alternar, cerrar, estaAbierto, posiciones, colocar };
}

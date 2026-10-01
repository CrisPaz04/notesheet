import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * El primer elemento que alcanza el teclado: salta la barra de navegación y
 * lleva al contenido. Solo se ve cuando tiene el foco.
 */
export function SaltarAlContenido() {
  return (
    <a href="#contenido" className="saltar-al-contenido">
      Saltar al contenido
    </a>
  );
}

/**
 * Al cambiar de pantalla, lleva el foco al contenido (`#contenido`). Si no, se
 * quedaba en el enlace del menú que se había pulsado, y con teclado o lector
 * de pantalla había que recorrer la barra entera cada vez. Al cargar la app no
 * hace nada: ahí el foco tiene que empezar arriba.
 */
export function FocoAlCambiarDePantalla() {
  const { pathname } = useLocation();
  // Se compara con la ruta anterior y no con un "es la primera vez": en
  // desarrollo React monta los efectos dos veces y el segundo ya no sería
  // la primera, así que robaba el foco al cargar
  const anterior = useRef(pathname);

  useEffect(() => {
    if (anterior.current === pathname) return;
    anterior.current = pathname;
    document.getElementById("contenido")?.focus({ preventScroll: true });
  }, [pathname]);

  return null;
}

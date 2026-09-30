import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * Lleva un número hacia `objetivo` fotograma a fotograma y se lo pasa a
 * `aplicar`, que lo escribe en el DOM (el giro de una aguja, la posición de
 * una marca). Sin estado de React: mover una aguja no necesita 60 renders por
 * segundo, y así se desliza aunque las lecturas lleguen a trompicones o la
 * pantalla vaya a 120 Hz.
 *
 * El acercamiento es exponencial: en `tau` segundos recorre el 63% de lo que
 * le falta. Es independiente de la frecuencia de la pantalla.
 *
 * @param {number} objetivo
 * @param {(valor: number) => void} aplicar
 * @param {number} [tau=0.05]
 */
export default function useValorSuave(objetivo, aplicar, tau = 0.05) {
  const valorRef = useRef(objetivo);
  const objetivoRef = useRef(objetivo);
  const aplicarRef = useRef(aplicar);
  const rafRef = useRef(null);

  useLayoutEffect(() => {
    aplicarRef.current = aplicar;
  });

  // Al montar, ya en su sitio
  useLayoutEffect(() => {
    aplicarRef.current(valorRef.current);
  }, []);

  useEffect(() => {
    objetivoRef.current = objetivo;
    if (rafRef.current !== null) return; // ya se está moviendo hacia él

    let anterior = performance.now();
    const paso = (ahora) => {
      const dt = Math.min(Math.max((ahora - anterior) / 1000, 0), 0.1);
      anterior = ahora;
      const destino = objetivoRef.current;
      valorRef.current += (destino - valorRef.current) * (1 - Math.exp(-dt / tau));
      if (Math.abs(destino - valorRef.current) < 0.01) valorRef.current = destino;
      aplicarRef.current(valorRef.current);
      rafRef.current = valorRef.current === destino ? null : requestAnimationFrame(paso);
    };
    rafRef.current = requestAnimationFrame(paso);
  }, [objetivo, tau]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);
}

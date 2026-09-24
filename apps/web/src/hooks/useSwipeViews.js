import { useState, useRef, useEffect } from "react";

const SWIPE_THRESHOLD = 100;

/**
 * Navegación por swipe entre varias vistas (acordes / letra), conservando la
 * posición de scroll de cada una al cambiar.
 *
 * @param {number} viewCount - Número de vistas
 * @returns {Object} `viewRefs` para enlazar a cada contenedor, más el estado
 *                   y los handlers táctiles
 */
export default function useSwipeViews(viewCount = 2) {
  const [activeView, setActiveView] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Una ref de contenedor y una posición de scroll por vista. El número de
  // vistas puede crecer después de montar (la de acordes aparece al cargar
  // la canción), así que la lista se amplía, pero las refs que ya había se
  // conservan: tienen que ser estables entre renders.
  const viewRefs = useRef([]).current;
  while (viewRefs.length < viewCount) viewRefs.push({ current: null });
  const scrollPositions = useRef([]);

  // Si desaparece la vista en la que se estaba, a la última que queda
  useEffect(() => {
    if (activeView > viewCount - 1) setActiveView(Math.max(0, viewCount - 1));
  }, [activeView, viewCount]);

  const saveScrollPosition = () => {
    const element = viewRefs[activeView]?.current;
    if (element) {
      scrollPositions.current[activeView] = element.scrollTop;
    }
  };

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;

    saveScrollPosition();

    const distance = touchStart - touchEnd;
    if (distance > SWIPE_THRESHOLD && activeView < viewCount - 1) {
      setActiveView(activeView + 1);
    } else if (distance < -SWIPE_THRESHOLD && activeView > 0) {
      setActiveView(activeView - 1);
    }
  };

  const goToView = (index) => {
    if (index === activeView) return;
    saveScrollPosition();
    setActiveView(index);
  };

  // Restaurar la posición de scroll tras cambiar de vista. El timeout deja
  // que React pinte el contenedor antes de moverlo.
  useEffect(() => {
    const timer = setTimeout(() => {
      const element = viewRefs[activeView]?.current;
      if (element) {
        element.scrollTop = scrollPositions.current[activeView] || 0;
      }
    }, 10);

    return () => clearTimeout(timer);
  }, [activeView, viewRefs]);

  return {
    activeView,
    goToView,
    viewRefs,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}

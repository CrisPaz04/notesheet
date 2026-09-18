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

  // Una ref de contenedor y una posición de scroll por vista. Se crean una
  // sola vez para que las refs sean estables entre renders.
  const viewRefs = useRef(Array.from({ length: viewCount }, () => ({ current: null }))).current;
  const scrollPositions = useRef(new Array(viewCount).fill(0));

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

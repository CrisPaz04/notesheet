// apps/web/src/components/PdfScoreViewer.jsx
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import usePdfDocument from "../hooks/usePdfDocument";
import LoadingSpinner from "./LoadingSpinner";
import PdfScorePage from "./PdfScorePage";
import Icono from "./Icono";

// Cuánto alrededor de lo que se ve se pinta por adelantado. Una pantalla
// entera por arriba y otra por abajo: al pasar página ya está lista, y no se
// mantienen en memoria diez canvas a tamaño completo.
const MARGEN_DE_PINTADO = "100% 0px";

// Tope de resolución del canvas. En una tablet con devicePixelRatio 3 una
// página A4 a pantalla completa se iría a más de 50 MB de píxeles ella sola;
// a 2 ya no se distingue sobre un atril y la memoria aguanta.
const MAX_DENSIDAD = 2;

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
// De 5 en 5: afinar el tamaño sobre el atril pide pasos pequeños.
const ZOOM_PASO = 0.05;

// Sumar 0,05 una y otra vez acumula error de coma flotante (1,1500000002) y
// el tope dejaría de coincidir exacto. Se redondea a centésimas.
const redondearZoom = (z) => Math.round(z * 100) / 100;

/**
 * Muestra una partitura en PDF.
 *
 * Pinta **solo las páginas cercanas a la vista**, no todas de golpe. Cada
 * página es un canvas a tamaño completo, y un popurrí de quince páginas
 * pintado entero tumba la tablet más barata de la sección antes de llegar a
 * verse. Las que se alejan sueltan su canvas y dejan el hueco reservado, así
 * la barra de desplazamiento no se mueve.
 *
 * @param {Object} props
 * @param {string|null} props.path - Ruta en Storage de la partitura
 * @param {string} [props.title] - Para el texto de descarga
 * @param {number} [props.zoomInicial] - Con el que arranca
 * @param {(zoom: number) => void} [props.onZoom] - Avisa de cada cambio, para
 *   que quien lo desmonta (`PdfEnLista`) pueda devolvérselo al volver
 */
function PdfScoreViewer({ path, title = "partitura", zoomInicial = 1, onZoom }) {
  const { doc, pages, loading, error } = usePdfDocument(path);

  const [zoom, setZoom] = useState(zoomInicial);
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;
  useEffect(() => { onZoomRef.current?.(zoom); }, [zoom]);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const [visibles, setVisibles] = useState(() => new Set([0]));

  const contenedorRef = useRef(null);
  // En estado y no en una ref: las páginas se dan de alta en sus efectos, que
  // corren ANTES que el del visor que crea el observador. Con una ref se
  // apuntaban al observador viejo (o a ninguno), este se desconectaba, y solo
  // se veía la página 1, la que arranca marcada como visible. Al cambiar el
  // observador cambia `observarPagina` y todas se vuelven a dar de alta.
  const [observer, setObserver] = useState(null);

  // Ancho útil del contenedor, para encajar la página a lo ancho. Se mide con
  // ResizeObserver y no con `window.resize` porque el contenedor también
  // cambia al girar la tablet o al abrir el teclado.
  useEffect(() => {
    const nodo = contenedorRef.current;
    if (!nodo) return undefined;

    const medir = () => setAnchoDisponible(nodo.clientWidth);
    medir();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", medir);
      return () => window.removeEventListener("resize", medir);
    }

    const ro = new ResizeObserver(medir);
    ro.observe(nodo);
    return () => ro.disconnect();
  }, [doc]);

  // Escala común a todas las páginas: la más ancha encaja justo, y las demás
  // quedan alineadas entre sí en vez de cada una a su tamaño.
  const escala = useMemo(() => {
    if (!anchoDisponible || pages.length === 0) return 0;
    const masAncha = Math.max(...pages.map((p) => p.width));
    return (anchoDisponible / masAncha) * zoom;
  }, [anchoDisponible, pages, zoom]);

  const densidad = useMemo(() => (
    Math.min(window.devicePixelRatio || 1, MAX_DENSIDAD)
  ), []);

  // Un solo observador para todas las páginas: una instancia por página
  // multiplicaría el trabajo del navegador en un popurrí largo.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      // Sin IntersectionObserver no hay forma de saber qué se ve: se pinta
      // todo. Es peor para la memoria, pero se ve, que es lo que importa.
      setVisibles(new Set(pages.map((_, i) => i)));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibles((previas) => {
          const siguientes = new Set(previas);
          let cambio = false;

          entries.forEach((entry) => {
            const indice = Number(entry.target.dataset.pagina);
            if (entry.isIntersecting && !siguientes.has(indice)) {
              siguientes.add(indice);
              cambio = true;
            } else if (!entry.isIntersecting && siguientes.has(indice)) {
              siguientes.delete(indice);
              cambio = true;
            }
          });

          return cambio ? siguientes : previas;
        });
      },
      { root: null, rootMargin: MARGEN_DE_PINTADO, threshold: 0 }
    );

    setObserver(observer);
    return () => {
      observer.disconnect();
      setObserver(null);
    };
  }, [pages]);

  // Cada página se apunta al observador al montarse y se da de baja al
  // desmontarse. Solo cambia cuando cambia el observador, para que las
  // páginas no se den de alta y de baja en cada render.
  const observarPagina = useCallback((nodo, indice) => {
    if (!observer || !nodo) return undefined;

    nodo.dataset.pagina = String(indice);
    observer.observe(nodo);
    return () => observer.unobserve(nodo);
  }, [observer]);

  // El zoom se hace desde el centro de lo que se ve, no desde la esquina de
  // arriba a la izquierda. Antes de cambiarlo se apunta qué punto de la
  // partitura está en el centro de la pantalla (en proporción, porque el
  // tamaño va a cambiar), y después de pintar se desplaza para que siga ahí.
  const anclaRef = useRef(null);

  const cambiarZoom = (calcular) => {
    const nodo = contenedorRef.current;
    if (nodo) {
      const caja = nodo.getBoundingClientRect();
      anclaRef.current = {
        x: nodo.scrollWidth
          ? (nodo.scrollLeft + nodo.clientWidth / 2) / nodo.scrollWidth
          : 0.5,
        y: caja.height ? (window.innerHeight / 2 - caja.top) / caja.height : null
      };
    }
    setZoom(calcular);
  };

  // `useLayoutEffect` y no `useEffect`: el desplazamiento tiene que ocurrir
  // antes de que el navegador pinte, o la partitura da un salto visible.
  useLayoutEffect(() => {
    const ancla = anclaRef.current;
    const nodo = contenedorRef.current;
    if (!ancla || !nodo) return;
    anclaRef.current = null;

    nodo.scrollLeft = ancla.x * nodo.scrollWidth - nodo.clientWidth / 2;

    // En vertical solo si el centro de la pantalla cae dentro de la
    // partitura: en una lista puede estar mirando otra canción.
    if (ancla.y !== null && ancla.y > 0 && ancla.y < 1) {
      const caja = nodo.getBoundingClientRect();
      window.scrollBy(0, ancla.y * caja.height - (window.innerHeight / 2 - caja.top));
    }
  }, [escala]);

  const alejar = () => cambiarZoom((z) => Math.max(ZOOM_MIN, redondearZoom(z - ZOOM_PASO)));
  const acercar = () => cambiarZoom((z) => Math.min(ZOOM_MAX, redondearZoom(z + ZOOM_PASO)));
  const encajar = () => cambiarZoom(1);

  // Con zoom la partitura se mueve de lado a lado arrastrando el dedo. Ese
  // gesto no debe llegar al deslizamiento de la canción, que lo tomaría por
  // "ir a la letra".
  const retenerGestoSiDesborda = (e) => {
    const nodo = contenedorRef.current;
    if (nodo && nodo.scrollWidth > nodo.clientWidth) e.stopPropagation();
  };

  if (!path) {
    return (
      <div className="pdf-score-empty">
        <Icono nombre="file-pdf" />
        <p>Esta voz todavía no tiene partitura.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <LoadingSpinner
        text="Cargando partitura..."
        subtext="Preparando las páginas"
      />
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        <Icono nombre="warning" peso="fill" className="me-2" />
        {error}
      </div>
    );
  }

  return (
    <div className="pdf-score">
      <div className="pdf-score-toolbar no-print">
        <button
          type="button"
          className="font-control-btn"
          onClick={alejar}
          disabled={zoom <= ZOOM_MIN}
          title="Alejar"
          aria-label="Alejar"
        >
          <Icono nombre="magnifying-glass-minus" />
        </button>
        <button
          type="button"
          className="font-control-btn"
          onClick={encajar}
          title="Ajustar al ancho"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="font-control-btn"
          onClick={acercar}
          disabled={zoom >= ZOOM_MAX}
          title="Acercar"
          aria-label="Acercar"
        >
          <Icono nombre="magnifying-glass-plus" />
        </button>

        <span className="pdf-score-pagecount">
          {pages.length} {pages.length === 1 ? "página" : "páginas"}
        </span>
      </div>

      <div
        className="pdf-score-pages"
        ref={contenedorRef}
        onTouchStart={retenerGestoSiDesborda}
        onTouchMove={retenerGestoSiDesborda}
        onTouchEnd={retenerGestoSiDesborda}
      >
        <div className="pdf-score-pages-lienzo">
          {pages.map((medida, indice) => (
            <PdfScorePage
              key={indice}
              doc={doc}
              indice={indice}
              numero={indice + 1}
              medida={medida}
              escala={escala}
              densidad={densidad}
              activa={visibles.has(indice)}
              registrar={observarPagina}
              title={title}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default PdfScoreViewer;

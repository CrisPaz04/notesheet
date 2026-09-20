// apps/web/src/components/PdfScoreViewer.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import usePdfDocument from "../hooks/usePdfDocument";
import LoadingSpinner from "./LoadingSpinner";
import PdfScorePage from "./PdfScorePage";

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
const ZOOM_PASO = 0.25;

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
 */
function PdfScoreViewer({ path, title = "partitura" }) {
  const { doc, pages, loading, error } = usePdfDocument(path);

  const [zoom, setZoom] = useState(1);
  const [anchoDisponible, setAnchoDisponible] = useState(0);
  const [visibles, setVisibles] = useState(() => new Set([0]));

  const contenedorRef = useRef(null);
  const observerRef = useRef(null);

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

    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [pages]);

  // Cada página se apunta al observador al montarse y se da de baja al
  // desmontarse. La función es estable (`useCallback` sin dependencias) para
  // que las páginas no se den de alta y de baja en cada render.
  const observarPagina = useCallback((nodo, indice) => {
    const observer = observerRef.current;
    if (!observer || !nodo) return undefined;

    nodo.dataset.pagina = String(indice);
    observer.observe(nodo);
    return () => observer.unobserve(nodo);
  }, []);

  const alejar = () => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_PASO));
  const acercar = () => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_PASO));
  const encajar = () => setZoom(1);

  if (!path) {
    return (
      <div className="pdf-score-empty">
        <i className="bi bi-file-earmark-music"></i>
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
        <i className="bi bi-exclamation-triangle-fill me-2"></i>
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
          <i className="bi bi-zoom-out"></i>
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
          <i className="bi bi-zoom-in"></i>
        </button>

        <span className="pdf-score-pagecount">
          {pages.length} {pages.length === 1 ? "página" : "páginas"}
        </span>
      </div>

      <div className="pdf-score-pages" ref={contenedorRef}>
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
  );
}

export default PdfScoreViewer;

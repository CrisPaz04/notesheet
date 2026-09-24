import { useEffect, useRef, useState } from "react";
import PdfScoreViewer from "./PdfScoreViewer";

// Cuánto antes de llegar se abre el PDF, y cuánto después de pasarlo se
// cierra: una pantalla y media. Al bajar por la lista la siguiente partitura
// ya está abierta, y las que quedan lejos no ocupan memoria.
const MARGEN = "150% 0px";

/**
 * Una partitura en PDF desplegada dentro de una lista.
 *
 * Una lista puede llevar varios PDF, y abrirlos todos a la vez (cada uno con
 * su documento de pdf.js y su worker) es lo que no aguanta la tablet más
 * barata de la sección. Así que el visor **solo existe mientras la canción
 * está cerca de la pantalla**: se monta al acercarse y se desmonta al
 * alejarse, y dentro de él solo se pintan las páginas visibles.
 *
 * Al desmontarse deja reservado el alto que tenía. Si no, la lista se
 * encogería por encima de lo que se está leyendo y el texto saltaría bajo el
 * dedo.
 *
 * @param {Object} props
 * @param {string|null} props.path - Ruta en Storage
 * @param {string} [props.title]
 */
function PdfEnLista({ path, title }) {
  const [cerca, setCerca] = useState(
    () => typeof IntersectionObserver === "undefined"
  );
  const [alto, setAlto] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      // Se mide antes de desmontar, cuando aún tiene el visor dentro
      if (!entry.isIntersecting) setAlto(nodo.offsetHeight || null);
      setCerca(entry.isIntersecting);
    }, { rootMargin: MARGEN });

    observer.observe(nodo);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="playlist-pdf"
      style={alto ? { minHeight: alto } : undefined}
    >
      {cerca && <PdfScoreViewer path={path} title={title} />}
    </div>
  );
}

export default PdfEnLista;

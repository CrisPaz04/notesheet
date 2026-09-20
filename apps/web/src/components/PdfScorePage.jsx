// apps/web/src/components/PdfScorePage.jsx
import { useEffect, useRef } from "react";

/**
 * Una página de una partitura en PDF.
 *
 * El hueco se reserva siempre con el tamaño real de la página, esté pintada o
 * no: así la barra de desplazamiento mide lo que tiene que medir desde el
 * principio y el papel no da saltos bajo el dedo mientras se pasa página.
 *
 * El canvas solo existe mientras `activa`. Al dejar de estarlo se pone a 0x0,
 * que es lo que de verdad suelta los píxeles: quitar el nodo del DOM no basta
 * si algo mantiene la referencia, y un canvas de página entera son decenas de
 * megas.
 *
 * @param {Object} props
 * @param {Object} props.doc - Documento de pdf.js
 * @param {number} props.indice - Posición en la lista (base 0)
 * @param {number} props.numero - Número de página para pdf.js (base 1)
 * @param {{width: number, height: number}} props.medida - Tamaño a escala 1
 * @param {number} props.escala
 * @param {number} props.densidad - devicePixelRatio ya acotado
 * @param {boolean} props.activa - Si toca pintarla
 * @param {Function} props.registrar - Alta en el observador de visibilidad
 */
function PdfScorePage({
  doc,
  indice,
  numero,
  medida,
  escala,
  densidad,
  activa,
  registrar
}) {
  const huecoRef = useRef(null);
  const canvasRef = useRef(null);

  // Alta en el observador de visibilidad del padre
  useEffect(() => {
    if (!huecoRef.current) return undefined;
    return registrar(huecoRef.current, indice);
  }, [registrar, indice]);

  useEffect(() => {
    const canvas = canvasRef.current;

    const soltar = () => {
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    };

    if (!activa || !doc || !escala || !canvas) {
      soltar();
      return undefined;
    }

    // Si el músico pasa de largo o cambia el zoom a mitad de pintado, lo que
    // venía en camino se cancela en vez de aparecer encima de lo siguiente.
    let cancelado = false;
    let tarea = null;

    const pintar = async () => {
      const page = await doc.getPage(numero);
      if (cancelado) return;

      const viewport = page.getViewport({ scale: escala });
      canvas.width = Math.floor(viewport.width * densidad);
      canvas.height = Math.floor(viewport.height * densidad);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      tarea = page.render({
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: densidad !== 1 ? [densidad, 0, 0, densidad, 0, 0] : null
      });

      await tarea.promise;
    };

    pintar().catch((error) => {
      // Cancelar es lo normal aquí, no un fallo que contar
      if (error?.name === "RenderingCancelledException") return;
      console.error(`Error al pintar la página ${numero}:`, error);
    });

    return () => {
      cancelado = true;
      tarea?.cancel();
      soltar();
    };
  }, [activa, doc, numero, escala, densidad]);

  const ancho = escala ? Math.floor(medida.width * escala) : undefined;
  const alto = escala ? Math.floor(medida.height * escala) : undefined;

  return (
    <div
      ref={huecoRef}
      className="pdf-score-page"
      style={{ width: ancho, height: alto }}
    >
      <canvas ref={canvasRef} className="pdf-score-canvas" />
      {!activa && (
        <span className="pdf-score-page-number" aria-hidden="true">
          {numero}
        </span>
      )}
    </div>
  );
}

export default PdfScorePage;

// apps/web/src/hooks/usePdfDocument.js
import { useEffect, useRef, useState } from "react";
import { getScoreUrl } from "@notesheet/api";
import { loadPdfjs } from "../lib/pdfjs";

/**
 * Abre una partitura de Storage con pdf.js y mide sus páginas.
 *
 * Solo abre el documento: no pinta nada. Quién pinta y cuándo lo decide
 * `PdfScoreViewer`, que es lo que evita que un popurrí largo reviente la
 * tablet más barata de la sección.
 *
 * Se miden **todas** las páginas al abrir (`getViewport` no rasteriza, solo
 * lee el tamaño). Así el contenedor tiene la altura real desde el principio y
 * la barra de desplazamiento no pega saltos según se van pintando páginas.
 *
 * @param {string|null} path - Ruta en Storage, no URL
 * @returns {{doc: Object|null, pages: Array<{width: number, height: number}>,
 *            loading: boolean, error: string}}
 */
export default function usePdfDocument(path) {
  const [doc, setDoc] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState("");

  // Para poder cerrar el documento anterior al cambiar de voz: cada uno se
  // lleva su worker y su memoria, y dejarlos abiertos los va acumulando.
  const docRef = useRef(null);

  useEffect(() => {
    if (!path) {
      setDoc(null);
      setPages([]);
      setLoading(false);
      setError("");
      return undefined;
    }

    // Si el músico pasa de voz rápido, lo que llegue tarde no debe pisar lo
    // que se está mirando ahora.
    let vigente = true;
    let abierto = null;

    const abrir = async () => {
      setLoading(true);
      setError("");

      try {
        const [pdfjs, url] = await Promise.all([loadPdfjs(), getScoreUrl(path)]);
        if (!vigente) return;

        abierto = await pdfjs.getDocument({ url }).promise;
        if (!vigente) {
          abierto.destroy();
          return;
        }

        // En serie a propósito: pedir las 15 páginas de un popurrí a la vez
        // le mete al worker más trabajo del que la tablet más barata de la
        // sección lleva bien, y no hay prisa por medirlas.
        const medidas = [];
        for (let n = 1; n <= abierto.numPages; n += 1) {
          const page = await abierto.getPage(n);
          if (!vigente) {
            abierto.destroy();
            return;
          }
          const { width, height } = page.getViewport({ scale: 1 });
          medidas.push({ width, height });
        }

        docRef.current?.destroy();
        docRef.current = abierto;
        setDoc(abierto);
        setPages(medidas);
      } catch (abrirError) {
        if (!vigente) return;
        console.error("Error al abrir la partitura:", abrirError);
        setError(
          abrirError?.name === "PasswordException"
            ? "Esta partitura pide contraseña"
            : "No se pudo abrir la partitura"
        );
        setDoc(null);
        setPages([]);
      } finally {
        if (vigente) setLoading(false);
      }
    };

    abrir();

    return () => {
      vigente = false;
    };
  }, [path]);

  // Al desmontar, cerrar el que quede abierto
  useEffect(() => () => {
    docRef.current?.destroy();
    docRef.current = null;
  }, []);

  return { doc, pages, loading, error };
}

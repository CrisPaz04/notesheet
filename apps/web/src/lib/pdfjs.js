// apps/web/src/lib/pdfjs.js
//
// Carga de pdf.js, una sola vez y solo cuando hace falta.
//
// Por que pdf.js y no un `<iframe>`: probado en una tab Samsung, `iframe`,
// `object` y `embed` salen **en blanco**. Chrome de escritorio trae visor de
// PDF integrado y por eso ahi un iframe funciona, pero en Android no. La
// seccion de vientos mezcla tabs Samsung, iPads y otras marcas, asi que hace
// falta una sola via que funcione en todas: ramificar por dispositivo seria
// dejar al musico sin saber por que a su companero se le ve y a el no.
//
// Por que la build `legacy` y la 4.x: la 5 y la 6 dan por hecho navegadores
// recientes, y en la seccion hay iPads viejos. La `legacy` viene transpilada
// para ellos. Si el navegador no soporta workers de modulo, pdf.js se cae
// solo a renderizar en el hilo principal: va mas lento, pero se ve.
//
// La biblioteca son ~320 KB y el worker cerca de 1 MB. Por eso el `import()`
// es dinamico: quien solo abre canciones de texto no se los descarga.

// `?url` no empaqueta el worker: lo emite como archivo aparte y aqui solo
// llega su ruta. Es una cadena, no pesa nada en el bundle inicial.
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

let cargando = null;

/**
 * Devuelve el modulo de pdf.js, ya configurado con su worker.
 * Las llamadas siguientes reutilizan la misma promesa.
 *
 * @returns {Promise<Object>}
 */
export const loadPdfjs = () => {
  if (!cargando) {
    cargando = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        return pdfjs;
      })
      .catch((error) => {
        // Sin esto un fallo de red dejaria la promesa rechazada cacheada
        // para siempre y el visor no se recuperaria ni recargando la vista.
        cargando = null;
        throw error;
      });
  }

  return cargando;
};

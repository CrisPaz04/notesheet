/**
 * Los archivos de lo que se suelta en una zona de arrastre, entrando en las
 * carpetas: `dataTransfer.files` solo trae lo de primer nivel, y una carpeta
 * soltada llega como un "archivo" vacío.
 *
 * Las entradas hay que pedirlas **dentro del evento** (`webkitGetAsEntry`),
 * antes de cualquier `await`: al terminar el manejador, `items` se vacía. Por
 * eso esta función las saca antes de esperar nada.
 *
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<File[]>}
 */
export function archivosSoltados(dataTransfer) {
  const entradas = [...(dataTransfer?.items || [])]
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  // Sin soporte de entradas: lo de primer nivel
  if (!entradas.length) return Promise.resolve([...(dataTransfer?.files || [])]);
  return leerEntradas(entradas);
}

async function leerEntradas(entradas) {
  const archivos = [];
  const recorrer = async (entrada) => {
    if (entrada.isFile) {
      archivos.push(await new Promise((ok, mal) => entrada.file(ok, mal)));
    } else if (entrada.isDirectory) {
      const lector = entrada.createReader();
      // readEntries devuelve por tandas (100 en Chrome): se pide hasta que
      // venga una vacía, o de una carpeta grande solo llegarían las primeras
      let tanda;
      do {
        tanda = await new Promise((ok, mal) => lector.readEntries(ok, mal));
        for (const hija of tanda) await recorrer(hija);
      } while (tanda.length);
    }
  };
  for (const entrada of entradas) await recorrer(entrada);
  return archivos;
}

// Lo que insertan los botones de la barra del editor (secciones y notas).
//
// Cada función recibe el texto y la selección (como índices) y devuelve la
// edición que hay que hacer, como la pide CodeMirror: qué tramo se sustituye
// (`desde`, `hasta`), por qué (`insertar`) y dónde queda el cursor. Puras, para
// probarlas sin el editor de verdad.

// Una nota latina o anglosajona sin alteración, sola (al principio o tras un
// espacio): "RE", "SOL", "D"
const NOTA_SIN_ALTERACION = /(?:^|\s)(?:DO|RE|MI|FA|SOL|LA|SI|[A-G])$/;

/**
 * Una cabecera de sección (`## Coro`) en una línea propia: si el cursor está
 * a mitad de línea, la parte en dos, y el cursor queda en la línea de debajo.
 */
export const insertarSeccion = (texto, inicio, fin, linea) => {
  const antes = texto.slice(0, inicio);
  const despues = texto.slice(fin);
  const prefijo = antes === '' || antes.endsWith('\n') ? '' : '\n';
  const sufijo = despues.startsWith('\n') ? '' : '\n';
  const insertar = `${prefijo}${linea}${sufijo}`;
  // Tras el salto de la cabecera, sea el nuevo o el que ya había
  const cursor = inicio + prefijo.length + linea.length + 1;
  return { desde: inicio, hasta: fin, insertar, cursor };
};

/** Una nota con un espacio detrás, separada de lo anterior si hace falta. */
export const insertarNota = (texto, inicio, fin, nota) => {
  const antes = texto.slice(0, inicio);
  const despues = texto.slice(fin);
  const separador = antes === '' || /\s$/.test(antes) ? '' : ' ';
  const yaHayEspacio = despues.startsWith(' ');
  const insertar = `${separador}${nota}${yaHayEspacio ? '' : ' '}`;
  return { desde: inicio, hasta: fin, insertar, cursor: inicio + insertar.length + (yaHayEspacio ? 1 : 0) };
};

/**
 * `#` o `b` pegado a la nota que se acaba de poner ("RE " → "RE# "). Si
 * delante no hay una nota sin alteración, se escribe tal cual.
 */
export const insertarAlteracion = (texto, inicio, fin, alteracion) => {
  const antes = texto.slice(0, inicio);
  if (inicio === fin && NOTA_SIN_ALTERACION.test(antes.replace(/ $/, ''))) {
    const desde = antes.endsWith(' ') ? inicio - 1 : inicio;
    const insertar = `${alteracion} `;
    return { desde, hasta: fin, insertar, cursor: desde + insertar.length };
  }
  return { desde: inicio, hasta: fin, insertar: alteracion, cursor: inicio + alteracion.length };
};

/** Aplica una edición a un texto (lo que hace CodeMirror con `replaceRange`). */
export const aplicarEdicion = (texto, { desde, hasta, insertar }) =>
  texto.slice(0, desde) + insertar + texto.slice(hasta);

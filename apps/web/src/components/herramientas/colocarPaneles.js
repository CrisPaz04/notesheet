// Dónde queda cada panel flotante al soltarlo.
//
// Cada panel va pegado a un lado (izquierda o derecha) y a la altura donde
// se soltó. Si cae encima de otro del mismo lado, el que se mueve es el otro:
// el que acaba de soltar el músico se queda donde lo dejó.

export const HUECO = 12;

/**
 * Lleva `top` dentro de la pantalla para un panel de `alto`.
 * Si el panel no cabe entero, manda que se vea su cabecera (arriba).
 */
export const acotar = (top, alto, { minTop, maxBottom }) => (
  Math.max(minTop, Math.min(top, maxBottom - alto))
);

/**
 * El lado que corresponde a un panel soltado con el centro en `centroX`.
 */
export const ladoPorPosicion = (centroX, anchoVentana) => (
  centroX < anchoVentana / 2 ? "izquierda" : "derecha"
);

/**
 * Recoloca los paneles de un lado para que no se pisen, moviendo lo menos
 * posible el fijo.
 *
 * Los de debajo del fijo se empujan hacia abajo y los de encima hacia
 * arriba. Si los de debajo no caben, sube el fijo. Si aun así no caben
 * todos, se quedan en el borde aunque se solapen: mejor eso que esconder un
 * panel fuera de la pantalla.
 *
 * @param {Array<{id: string, top: number, alto: number}>} paneles - Los de un lado
 * @param {string} fijoId - El que se acaba de soltar
 * @param {{minTop: number, maxBottom: number}} limites
 * @returns {Object<string, number>} id → top
 */
export const separar = (paneles, fijoId, limites) => {
  const fijo = paneles.find((p) => p.id === fijoId);
  if (!fijo) return Object.fromEntries(paneles.map((p) => [p.id, p.top]));

  const centro = (p) => p.top + p.alto / 2;
  const otros = paneles.filter((p) => p.id !== fijoId);
  const debajo = otros.filter((p) => centro(p) >= centro(fijo)).sort((a, b) => a.top - b.top);
  const encima = otros.filter((p) => centro(p) < centro(fijo)).sort((a, b) => b.top - a.top);

  // Si los de debajo no caben entre el fijo y el borde, el fijo sube lo que
  // haga falta: mejor moverlo un poco que dejar dos paneles uno encima del
  // otro (pasa cuando un panel crece al terminar de cargar).
  const sitioDebajo = debajo.reduce((suma, p) => suma + p.alto + HUECO, 0);
  const topFijo = Math.max(
    limites.minTop,
    Math.min(fijo.top, limites.maxBottom - sitioDebajo - fijo.alto)
  );

  const resultado = { [fijo.id]: topFijo };

  let borde = topFijo + fijo.alto + HUECO;
  debajo.forEach((p) => {
    const top = acotar(Math.max(p.top, borde), p.alto, limites);
    resultado[p.id] = top;
    borde = top + p.alto + HUECO;
  });

  borde = topFijo - HUECO;
  encima.forEach((p) => {
    const top = acotar(Math.min(p.top, borde - p.alto), p.alto, limites);
    resultado[p.id] = top;
    borde = top - HUECO;
  });

  return resultado;
};

/**
 * Altura para un panel que se abre sin posición guardada: encima de los que
 * ya hay en ese lado, como una pila que crece desde abajo. Si no cabe, abajo.
 *
 * @param {Array<{top: number, alto: number}>} delLado
 * @param {number} alto - El del panel nuevo
 */
export const alturaInicial = (delLado, alto, limites) => {
  const abajo = limites.maxBottom - alto;
  if (delLado.length === 0) return acotar(abajo, alto, limites);
  const masAlto = Math.min(...delLado.map((p) => p.top));
  const top = masAlto - HUECO - alto;
  return top >= limites.minTop ? top : acotar(abajo, alto, limites);
};

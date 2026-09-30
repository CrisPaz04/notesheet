/**
 * El estilo de una canción de la lista que se puede arrastrar para reordenar.
 *
 * En reposo cada fila lleva `position: relative` y un z-index que baja con la
 * posición, para que el desplegable de tonalidad de una canción se abra por
 * encima de las de debajo y no por detrás.
 *
 * **Mientras se arrastra no se toca nada**: la librería (@hello-pangea/dnd)
 * mueve la fila con `position: fixed` y le pone como `top`/`left` su sitio en
 * la pantalla. Con el `relative` de encima, esas coordenadas se sumaban a
 * donde ya estaba, y la canción saltaba abajo a la derecha tanto como lejos
 * estuviera de la esquina.
 *
 * @param {Object} estiloDnd - `provided.draggableProps.style`
 * @param {boolean} arrastrando - `snapshot.isDragging`
 * @param {number} indice - Posición en la lista
 */
export function estiloCancionArrastrable(estiloDnd, arrastrando, indice) {
  if (arrastrando) return estiloDnd;
  return { ...estiloDnd, position: 'relative', zIndex: 1000 - indice };
}

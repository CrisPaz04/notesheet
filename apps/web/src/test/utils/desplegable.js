import { act, fireEvent } from '@testing-library/react';

/**
 * Elige una opción de un `Desplegable`, el sustituto del `<select>` nativo:
 * lo abre y pulsa la opción. `opcion` puede ser el valor (`'eb_alto_sax'`) o
 * el texto que se ve (`'SOL (1)'`), como aceptaba `userEvent.selectOptions`.
 *
 * @param {Object} user - De `userEvent.setup()`, o el propio `userEvent`
 * @param {HTMLElement} combobox - El botón con rol `combobox`
 * @param {string} opcion
 */
export const elegirEnDesplegable = async (user, combobox, opcion) => {
  if (combobox.getAttribute('aria-expanded') !== 'true') await user.click(combobox);
  const lista = document.getElementById(combobox.getAttribute('aria-controls'));
  if (!lista) throw new Error('El desplegable no se abrió');
  const opciones = [...lista.querySelectorAll('[role="option"]')];
  const elegida = opciones.find((o) => o.dataset.valor === String(opcion))
    || opciones.find((o) => o.textContent.trim() === String(opcion));
  if (!elegida) {
    throw new Error(`No hay opción "${opcion}". Hay: ${opciones.map((o) => o.textContent.trim()).join(', ')}`);
  }
  fireEvent.mouseDown(elegida);
};

/** El valor elegido de un `Desplegable`. */
export const valorDe = (combobox) => combobox.dataset.valor;

/**
 * Los textos de las opciones de un `Desplegable`. Lo abre para leerlas y lo
 * deja como estaba: las opciones solo existen con la lista abierta.
 */
export const opcionesDe = (combobox) => {
  const estabaAbierto = combobox.getAttribute('aria-expanded') === 'true';
  if (!estabaAbierto) act(() => { fireEvent.click(combobox); });
  const lista = document.getElementById(combobox.getAttribute('aria-controls'));
  const textos = [...(lista?.querySelectorAll('[role="option"]') || [])].map((o) => o.textContent);
  if (!estabaAbierto) act(() => { fireEvent.click(combobox); });
  return textos;
};

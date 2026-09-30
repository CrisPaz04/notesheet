/**
 * Las fechas de la app, en español y sin saltos de día.
 *
 * La fecha de una lista es un **día**, no un instante: el editor la guarda
 * como la medianoche UTC del día elegido (`new Date("2026-09-20")`). Leída en
 * la hora local, en Honduras (UTC−6) esa medianoche cae el día anterior, y la
 * lista del domingo salía como del sábado. Por eso se lee y se enseña en UTC.
 */

const aFecha = (valor) => (valor?.toDate ? valor.toDate() : new Date(valor));

/** "2026-09-20" para el `<input type="date">` a partir de la fecha guardada */
export function diaParaInput(valor) {
  return aFecha(valor).toISOString().slice(0, 10);
}

/** Hoy en el reloj del músico, para el `<input type="date">` de una lista nueva */
export function hoyParaInput(ahora = new Date()) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${ahora.getFullYear()}-${dos(ahora.getMonth() + 1)}-${dos(ahora.getDate())}`;
}

/** El día de una lista: "20 de septiembre de 2026" (con `conDia`, "Domingo, 20 de…") */
export function formatearDiaLista(valor, { conDia = false } = {}) {
  if (!valor) return "Sin fecha";
  const texto = aFecha(valor).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    ...(conDia && { weekday: "long" }),
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  // Encabeza la línea: "Domingo, 20 de…" (en español sale en minúscula)
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Un instante (cuándo se editó algo), corto y en español: "29/9/2026" */
export function formatearFechaCorta(valor) {
  if (!valor) return "";
  return aFecha(valor).toLocaleDateString("es-ES");
}

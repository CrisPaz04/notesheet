/**
 * Cuánto del deslizador va "lleno" (del mínimo hasta el valor), como variable
 * CSS. La barra la pinta `_bootstrap-theme.css` con el color del tema hasta
 * `--relleno` y el resto apagado: los navegadores basados en Chromium no
 * tienen un pseudoelemento para la parte recorrida, así que hay que decírselo.
 *
 * @returns {{'--relleno': string}}
 */
export const rellenoDeslizador = (valor, min, max) => {
  const v = Number(valor);
  const a = Number(min);
  const b = Number(max);
  const pct = b > a ? ((v - a) / (b - a)) * 100 : 0;
  return { "--relleno": `${Math.max(0, Math.min(100, pct))}%` };
};

import { nombrarTonalidad } from "@notesheet/core";

/**
 * Las tonalidades de una canción que modula, en la notación del músico y en
 * el orden en que se leen: "SIm → DO#m". Sin modulaciones, solo una.
 *
 * @param {string[]} tonalidades - `tonalidadesLeidas` de `renderSongContent`
 * @param {'latin'|'english'} notacion
 * @returns {string}
 */
export const recorridoTonalidades = (tonalidades, notacion) =>
  (tonalidades || []).filter(Boolean).map((tonalidad) => nombrarTonalidad(tonalidad, notacion)).join(" → ");

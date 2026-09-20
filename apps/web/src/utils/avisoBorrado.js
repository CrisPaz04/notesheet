// Texto del aviso previo a borrar una canción.
//
// Borrarla no la quita de las listas que la contienen, y una entrada huérfana
// no se distingue desde el cliente de una canción que simplemente no está
// compartida: en la lista sale "Esta canción no está disponible" y ahí se
// acaba la información. Este aviso es el único momento en que todavía se sabe
// qué está pasando, así que dice lo que hay antes de que sea irreversible.
//
// `enListas` es `null` cuando no se ha podido consultar (fallo de red o de
// permisos). Se dice, en vez de callar y dar a entender que no está en
// ninguna.
export const mensajeDeBorrado = (titulo, enListas) => {
  const cabecera = `¿Estás seguro de que deseas eliminar "${titulo}"? Esta acción no se puede deshacer.`;

  if (enListas === null) {
    return `${cabecera}\n\nNo se ha podido comprobar en qué listas aparece.`;
  }
  if (enListas.length === 0) {
    return cabecera;
  }

  const mias = enListas.filter((lista) => lista.isOwn);
  const ajenas = enListas.length - mias.length;

  const lineas = [
    cabecera,
    "",
    `Está en ${enListas.length} ${enListas.length === 1 ? "lista" : "listas"}:`,
    ...enListas.map((lista) => `  · ${lista.name || "(sin nombre)"}`)
  ];

  if (mias.length > 0) {
    lineas.push(
      "",
      `Se quitará de ${mias.length === 1 ? "la que es tuya" : `las ${mias.length} que son tuyas`}.`
    );
  }
  if (ajenas > 0) {
    lineas.push(
      "",
      ajenas === 1
        ? "1 es de otro músico y seguirá mostrando un hueco: no puedes editarla."
        : `${ajenas} son de otros músicos y seguirán mostrando un hueco: no puedes editarlas.`
    );
  }

  return lineas.join("\n");
};

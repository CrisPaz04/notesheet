import { Fragment } from "react";
import { estructurarMensaje, nombrarTonalidad } from "@notesheet/core";

/**
 * La lista del servicio en pequeño, para tenerla a la vista mientras se lee.
 *
 * Si la lista se armó pegando el mensaje del director, se enseña **ese
 * mensaje tal cual**, con sus bloques (*Intro, *Lentas…) y sus tonalidades:
 * es el papel que todos tienen en el móvil y así se habla de lo mismo. Cada
 * canción que se confirmó al importar es un enlace que lleva a ella. Las que
 * se añadieron a la lista después (y no salen en el mensaje) van en su sitio,
 * tras la canción que las precede en la lista, como una línea más: si no, no
 * estaban en el panel aunque sí en la lista. Si
 * no hay mensaje, la lista numerada con su tonalidad.
 *
 * Tocar una canción solo mueve la pantalla de este músico: en la sesión en
 * vivo no cambia la canción de la banda.
 *
 * @param {Object} props
 * @param {{texto: string, enlaces: Object}|null} props.mensaje
 * @param {Array<{id: string, title: string, key?: string}>} props.canciones
 * @param {string|null} [props.activaId] - La que está tocando la banda
 * @param {(id: string) => void} props.onIr
 * @param {string} [props.notacion]
 */
function PanelLista({ mensaje, canciones = [], activaId = null, onIr, notacion = "latin" }) {
  const porId = new Map(canciones.map((c) => [c.id, c]));

  if (mensaje?.texto) {
    const lineas = estructurarMensaje(mensaje.texto, mensaje.enlaces);

    // En qué línea del mensaje está cada canción de la lista (la primera vez)
    const lineaDe = new Map();
    lineas.forEach((l, i) => {
      if (l.songId && porId.has(l.songId) && !lineaDe.has(l.songId)) lineaDe.set(l.songId, i);
    });

    // Las añadidas después van donde están en la lista: tras la canción del
    // mensaje que las precede. Las que van antes de todas, delante de la
    // primera; si ninguna canción del mensaje sigue en la lista, al final.
    const tras = new Map();
    const alPrincipio = [];
    let anterior = null;
    let primera = null;
    canciones.forEach((c) => {
      if (lineaDe.has(c.id)) {
        anterior = lineaDe.get(c.id);
        if (primera === null) primera = anterior;
      } else if (anterior === null) {
        alPrincipio.push(c);
      } else {
        tras.set(anterior, [...(tras.get(anterior) || []), c]);
      }
    });

    const añadida = (c) => (
      <button
        key={`añadida-${c.id}`}
        type="button"
        className={`panel-lista-linea panel-lista-ir${c.id === activaId ? " activa" : ""}`}
        onClick={() => onIr(c.id)}
        aria-current={c.id === activaId ? "true" : undefined}
      >
        <span className="panel-lista-texto">{c.title || "Sin título"}</span>
        {c.key && <span className="panel-lista-key">{nombrarTonalidad(c.key, notacion)}</span>}
      </button>
    );

    const linea = (l) => {
      if (l.tipo === "seccion") {
        return <div key={l.linea} className="panel-lista-seccion">{l.texto}</div>;
      }
      if (l.tipo === "tonalidad") {
        return <div key={l.linea} className="panel-lista-tonalidad">{nombrarTonalidad(l.key, notacion)}</div>;
      }

      // Enlace solo si la canción sigue en la lista: se puede haber
      // quitado después de importar.
      const cancion = l.songId ? porId.get(l.songId) : null;
      if (!cancion) {
        return <div key={l.linea} className="panel-lista-linea">{l.texto}</div>;
      }
      return (
        <button
          key={l.linea}
          type="button"
          className={`panel-lista-linea panel-lista-ir${cancion.id === activaId ? " activa" : ""}`}
          onClick={() => onIr(cancion.id)}
          aria-current={cancion.id === activaId ? "true" : undefined}
          title={cancion.title}
        >
          <span className="panel-lista-texto">{l.texto}</span>
          {cancion.key && <span className="panel-lista-key">{nombrarTonalidad(cancion.key, notacion)}</span>}
        </button>
      );
    };

    return (
      <div className="panel-lista panel-lista--mensaje">
        {lineas.map((l, i) => (
          <Fragment key={l.linea}>
            {i === primera && alPrincipio.map(añadida)}
            {linea(l)}
            {(tras.get(i) || []).map(añadida)}
          </Fragment>
        ))}
        {primera === null && alPrincipio.map(añadida)}
      </div>
    );
  }

  if (canciones.length === 0) {
    return <p className="panel-lista-vacia">La lista está vacía.</p>;
  }

  return (
    <ol className="panel-lista">
      {canciones.map((c, i) => (
        <li key={c.id}>
          <button
            type="button"
            className={`panel-lista-linea panel-lista-ir${c.id === activaId ? " activa" : ""}`}
            onClick={() => onIr(c.id)}
            aria-current={c.id === activaId ? "true" : undefined}
          >
            <span className="panel-lista-numero">{i + 1}</span>
            <span className="panel-lista-titulo">{c.title || "Sin título"}</span>
            {c.key && <span className="panel-lista-key">{nombrarTonalidad(c.key, notacion)}</span>}
          </button>
        </li>
      ))}
    </ol>
  );
}

export default PanelLista;

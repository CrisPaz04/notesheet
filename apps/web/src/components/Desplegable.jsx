import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icono from "./Icono";

/**
 * Un desplegable con los colores del tema, en lugar del `<select>` nativo.
 *
 * La lista abierta de un `<select>` no es HTML de la página: la dibujan el
 * navegador y el sistema, y en Windows marcan la opción en azul hagas lo que
 * hagas con el CSS. En seis temas, ese azul se salía siempre de sitio.
 *
 * Sigue el patrón de ARIA de combobox con lista: el botón tiene rol
 * `combobox`, la lista `listbox` y cada opción `option`. Con el teclado:
 * flechas para moverse (abren la lista si está cerrada), Enter o espacio
 * para elegir, Esc para cerrar, Inicio/Fin para ir a los extremos.
 *
 * La lista abierta se pinta en `body` (un portal) con posición fija junto al
 * botón. Dentro del botón quedaba recortada por cualquier contenedor con
 * scroll: en el panel del metrónomo, el compás se abría "dentro" del panel y
 * había que desplazarlo para ver las opciones. Tampoco vale `position: fixed`
 * sin portal: un antepasado con `transform` (las animaciones de entrada del
 * Dashboard) la recoloca respecto a él.
 *
 * El valor elegido también va en `data-valor` del botón, para los tests.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(valor: string) => void} props.onChange
 * @param {Array<{value: string, label: string}>} [props.opciones]
 * @param {Array<{label: string, opciones: Array<{value: string, label: string}>}>} [props.grupos]
 *   En lugar de `opciones`, para listas con apartados (como `<optgroup>`)
 * @param {string} [props.id] - Para asociarlo a un `<label htmlFor>`
 * @param {string} [props.ariaLabel] - Si no hay `<label>` visible
 * @param {boolean} [props.disabled]
 * @param {string} [props.className] - Clase extra para el tamaño en cada vista
 * @param {string} [props.placeholder] - Si el valor no está entre las opciones
 */
function Desplegable({
  value,
  onChange,
  opciones,
  grupos,
  id,
  ariaLabel,
  disabled = false,
  className = "",
  placeholder = "—"
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1); // índice en la lista plana
  const [haciaArriba, setHaciaArriba] = useState(false);
  const [posicion, setPosicion] = useState(null); // estilo fijo de la lista

  const raizRef = useRef(null);
  const botonRef = useRef(null);
  const listaRef = useRef(null);
  const idLista = useId();

  // Todas las opciones en una lista plana, para el teclado y el índice activo
  const secciones = grupos || [{ label: null, opciones: opciones || [] }];
  const planas = secciones.flatMap((g) => g.opciones);
  const indiceElegido = planas.findIndex((o) => String(o.value) === String(value));
  const elegida = indiceElegido >= 0 ? planas[indiceElegido] : null;
  const idOpcion = (i) => `${idLista}-op-${i}`;

  const abrir = () => {
    if (disabled) return;
    setActivo(indiceElegido >= 0 ? indiceElegido : 0);
    setAbierto(true);
  };

  const cerrar = (devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) botonRef.current?.focus();
  };

  const elegir = (i) => {
    const opcion = planas[i];
    if (!opcion) return;
    if (String(opcion.value) !== String(value)) onChange(opcion.value);
    cerrar();
  };

  // Cerrar al tocar fuera
  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => {
      // La lista está en un portal, fuera de la raíz
      if (!raizRef.current?.contains(e.target) && !listaRef.current?.contains(e.target)) {
        cerrar(false);
      }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("touchstart", fuera);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("touchstart", fuera);
    };
  }, [abierto]);

  // La lista va pegada al botón. Si no cabe debajo (al pie de la pantalla,
  // o en un panel flotante) se abre hacia arriba, y no se sale por la
  // derecha. Sigue al botón si la página o un panel se desplazan.
  useLayoutEffect(() => {
    if (!abierto) {
      setPosicion(null);
      return undefined;
    }
    const colocar = () => {
      if (!botonRef.current) return;
      const caja = botonRef.current.getBoundingClientRect();
      const lista = listaRef.current;
      const alto = Math.min(lista?.scrollHeight || 0, 280);
      const ancho = Math.max(lista?.offsetWidth || 0, caja.width);
      const debajo = window.innerHeight - caja.bottom;
      const arriba = debajo < alto + 8 && caja.top > debajo;
      setHaciaArriba(arriba);
      setPosicion({
        left: Math.max(8, Math.min(caja.left, window.innerWidth - ancho - 8)),
        minWidth: caja.width,
        ...(arriba
          ? { bottom: window.innerHeight - caja.top + 4 }
          : { top: caja.bottom + 4 })
      });
    };
    colocar();
    window.addEventListener("scroll", colocar, true);
    window.addEventListener("resize", colocar);
    return () => {
      window.removeEventListener("scroll", colocar, true);
      window.removeEventListener("resize", colocar);
    };
  }, [abierto]);

  // La opción activa siempre a la vista al moverse con el teclado
  useEffect(() => {
    if (!abierto || activo < 0) return;
    document.getElementById(idOpcion(activo))?.scrollIntoView?.({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, activo]);

  const alTeclear = (e) => {
    if (disabled) return;
    const ultimo = planas.length - 1;

    if (!abierto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActivo((a) => Math.min(ultimo, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActivo((a) => Math.max(0, a - 1));
        break;
      case "Home":
        e.preventDefault();
        setActivo(0);
        break;
      case "End":
        e.preventDefault();
        setActivo(ultimo);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        elegir(activo);
        break;
      case "Escape":
        e.preventDefault();
        cerrar();
        break;
      case "Tab":
        cerrar(false);
        break;
      default:
        break;
    }
  };

  let indice = -1;

  return (
    <div
      ref={raizRef}
      className={`desplegable${abierto ? " abierto" : ""}${haciaArriba ? " hacia-arriba" : ""} ${className}`.trim()}
    >
      <button
        ref={botonRef}
        id={id}
        type="button"
        role="combobox"
        className="desplegable-boton"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-label={ariaLabel}
        aria-activedescendant={abierto && activo >= 0 ? idOpcion(activo) : undefined}
        data-valor={value ?? ""}
        disabled={disabled}
        onClick={() => (abierto ? cerrar() : abrir())}
        onKeyDown={alTeclear}
      >
        <span className="desplegable-texto">{elegida ? elegida.label : placeholder}</span>
        <Icono nombre="caret-down" className="desplegable-flecha" aria-hidden="true" />
      </button>

      {abierto && createPortal(
        <ul
          ref={listaRef}
          id={idLista}
          role="listbox"
          className="desplegable-lista"
          aria-label={ariaLabel}
          // Hasta medir, invisible: así no asoma un instante en otro sitio
          style={posicion || { visibility: "hidden" }}
        >
          {secciones.map((g, gi) => {
            const items = g.opciones.map((o) => {
              indice += 1;
              const i = indice;
              const esElegida = i === indiceElegido;
              return (
                <li
                  key={`${o.value}`}
                  id={idOpcion(i)}
                  role="option"
                  aria-selected={esElegida}
                  data-valor={o.value}
                  className={`desplegable-opcion${esElegida ? " elegida" : ""}${i === activo ? " activa" : ""}`}
                  // mousedown y no click: si no, el botón pierde el foco antes
                  // y la lista se cierra sin elegir
                  onMouseDown={(e) => { e.preventDefault(); elegir(i); }}
                  onMouseEnter={() => setActivo(i)}
                >
                  {o.label}
                </li>
              );
            });
            if (!g.label) return items;
            return (
              <li key={`g-${gi}`} role="presentation">
                <div className="desplegable-grupo" id={`${idLista}-g-${gi}`}>{g.label}</div>
                <ul role="group" aria-labelledby={`${idLista}-g-${gi}`} className="desplegable-sublista">
                  {items}
                </ul>
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}

export default Desplegable;

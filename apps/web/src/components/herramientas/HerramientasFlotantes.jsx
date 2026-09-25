import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { lazyConRecarga } from "../../lib/lazyConRecarga";
import useHerramientas, { esPantallaEstrecha } from "../../hooks/useHerramientas";
import PanelLista from "./PanelLista";
import CirculoQuintas from "./CirculoQuintas";
import { acotar, alturaInicial, ladoPorPosicion, separar } from "./colocarPaneles";
import Icono from "../Icono";

// El afinador y el metrónomo arrastran el motor de audio: se cargan al abrir
// su panel, no al entrar en la lista.
const Tuner = lazyConRecarga(() => import("../../pages/Tuner"));
const Metronome = lazyConRecarga(() => import("../../pages/Metronome"));

const HERRAMIENTAS = {
  lista: { titulo: "Lista", icono: "list-numbers", lado: "derecha" },
  quintas: { titulo: "Círculo de quintas", icono: "compass", lado: "derecha" },
  afinador: { titulo: "Afinador", icono: "waveform", lado: "izquierda" },
  metronomo: { titulo: "Metrónomo", icono: "metronome", lado: "izquierda" }
};

// Lo que no pueden tapar: arriba un margen, abajo la barra de herramientas
const MARGEN_ARRIBA = 8;
const ESPACIO_BARRA = 76;

const limites = () => ({
  minTop: MARGEN_ARRIBA,
  maxBottom: (typeof window !== "undefined" ? window.innerHeight : 800) - ESPACIO_BARRA
});

/** Si la pantalla es de móvil, y se entera si cambia (girar la tablet). */
function usePantallaEstrecha() {
  const [estrecha, setEstrecha] = useState(esPantallaEstrecha);
  useEffect(() => {
    const mq = typeof window.matchMedia === "function" ? window.matchMedia("(max-width: 767px)") : null;
    if (!mq?.addEventListener) return undefined;
    const alCambiar = () => setEstrecha(mq.matches);
    mq.addEventListener("change", alCambiar);
    return () => mq.removeEventListener("change", alCambiar);
  }, []);
  return estrecha;
}

function PanelFlotante({ id, lado, onCerrar, onCambiarLado, arrastrable, cabeceraProps, children }) {
  const { titulo, icono } = HERRAMIENTAS[id];
  const otroLado = lado === "izquierda" ? "derecha" : "izquierda";
  return (
    <>
      <header
        className={`panel-flotante-cabecera${arrastrable ? " panel-flotante-cabecera--arrastrable" : ""}`}
        {...cabeceraProps}
      >
        <span>
          {arrastrable && <Icono nombre="dots-six-vertical" className="panel-flotante-asa" aria-hidden="true" />}
          <Icono nombre={icono} className="me-2" />
          {titulo}
        </span>
        <span className="panel-flotante-acciones">
          {arrastrable && (
            <button
              type="button"
              className="panel-flotante-cerrar"
              onClick={onCambiarLado}
              aria-label={`Mover ${titulo.toLowerCase()} a la ${otroLado}`}
              title={`Mover a la ${otroLado}`}
            >
              <Icono nombre="arrows-left-right" />
            </button>
          )}
          <button
            type="button"
            className="panel-flotante-cerrar"
            onClick={onCerrar}
            aria-label={`Cerrar ${titulo.toLowerCase()}`}
          >
            <Icono nombre="x" />
          </button>
        </span>
      </header>
      <div className="panel-flotante-cuerpo">
        <Suspense fallback={<p className="panel-flotante-cargando">Cargando…</p>}>
          {children}
        </Suspense>
      </div>
    </>
  );
}

/**
 * Herramientas a mano mientras se lee: la lista del servicio, el afinador,
 * el metrónomo y el círculo de quintas.
 *
 * Son paneles **flotantes, no ventanas modales**: no tapan la pantalla ni
 * bloquean el desplazamiento, porque se usan tocando, con la partitura
 * delante. Cada uno va pegado a un lado y a una altura; se arrastran por la
 * cabecera y, al soltarlos, se pegan al lado más cercano a la altura donde
 * se dejaron. Si caen encima de otro, se aparta el otro. En un móvil sale
 * uno cada vez, abajo y sin arrastre.
 *
 * Cerrar el panel del afinador o del metrónomo los para: se desmontan.
 *
 * @param {Object} props
 * @param {Object} [props.herramientas] - Lo que devuelve `useHerramientas`,
 *   si la vista quiere abrir paneles desde sus propios botones
 * @param {Object|null} [props.lista] - `{ mensaje, canciones, activaId, onIr }`;
 *   sin ella no hay botón de lista
 * @param {{tempoInicial?: number, compasInicial?: string}} [props.metronomo]
 * @param {string} [props.notacion]
 * @param {string[]} [props.ocultarBotones] - Los que ya tiene la vista a mano
 */
function HerramientasFlotantes({
  herramientas,
  lista = null,
  metronomo = {},
  notacion = "latin",
  ocultarBotones = []
}) {
  const propias = useHerramientas();
  const { abiertos, alternar, cerrar, posiciones, colocar } = herramientas || propias;
  const estrecha = usePantallaEstrecha();

  const nodos = useRef({});
  const [arrastre, setArrastre] = useState(null); // { id, x, y, dx, dy }

  const disponibles = Object.keys(HERRAMIENTAS).filter((id) => id !== "lista" || lista);
  const visibles = abiertos.filter((id) => disponibles.includes(id));

  const ladoDe = useCallback(
    (id) => posiciones[id]?.lado || HERRAMIENTAS[id].lado,
    [posiciones]
  );
  const altoDe = (id) => nodos.current[id]?.offsetHeight || 0;

  // Los que se abren sin altura guardada se apilan encima de los que ya hay
  // en su lado; los que tienen una que ya no cabe (pantalla más pequeña que
  // la última vez) se meten dentro.
  useLayoutEffect(() => {
    if (estrecha) return;
    const lim = limites();
    const cambios = {};
    const colocados = [];

    visibles.forEach((id) => {
      const top = posiciones[id]?.top;
      if (Number.isFinite(top)) {
        const dentro = acotar(top, altoDe(id), lim);
        if (dentro !== top) cambios[id] = { lado: ladoDe(id), top: dentro };
        colocados.push({ id, lado: ladoDe(id), top: dentro, alto: altoDe(id) });
      }
    });

    visibles.forEach((id) => {
      if (Number.isFinite(posiciones[id]?.top)) return;
      const lado = ladoDe(id);
      const top = alturaInicial(colocados.filter((p) => p.lado === lado), altoDe(id), lim);
      cambios[id] = { lado, top };
      colocados.push({ id, lado, top, alto: altoDe(id) });
    });

    if (Object.keys(cambios).length > 0) colocar(cambios);
    // Solo al abrir o cerrar paneles: las posiciones cambian por aquí mismo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles.join(","), estrecha]);

  /** Deja `id` en `lado` a la altura `top`, apartando a los que pise. */
  const soltarEn = (id, lado, top) => {
    const lim = limites();
    const alto = altoDe(id);
    const delLado = visibles
      .filter((otro) => otro !== id && ladoDe(otro) === lado)
      .map((otro) => ({ id: otro, top: posiciones[otro]?.top ?? lim.minTop, alto: altoDe(otro) }));

    const tops = separar(
      [...delLado, { id, top: acotar(top, alto, lim), alto }],
      id,
      lim
    );
    colocar(Object.fromEntries(Object.entries(tops).map(([pid, t]) => [pid, { lado, top: t }])));
  };

  // Un panel que cambia de alto después de colocarlo (el afinador termina de
  // cargar, sale un aviso) se vuelve a acomodar, apartando a los vecinos.
  // Por una ref: el observador vive entre renders y tiene que usar las
  // posiciones de ahora, no las del render en que se creó.
  const reubicarRef = useRef(null);
  reubicarRef.current = (id) => {
    const pos = posiciones[id];
    if (arrastre || !Number.isFinite(pos?.top)) return;
    soltarEn(id, ladoDe(id), pos.top);
  };

  useEffect(() => {
    if (estrecha || typeof ResizeObserver === "undefined") return undefined;
    const observador = new ResizeObserver((entradas) => {
      entradas.forEach((e) => reubicarRef.current(e.target.dataset.herramienta));
    });
    visibles.forEach((id) => nodos.current[id] && observador.observe(nodos.current[id]));
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles.join(","), estrecha]);

  // Si la ventana encoge (girar la tablet a horizontal, abrir el teclado),
  // un panel colocado abajo quedaría fuera de la pantalla: se meten dentro
  // otra vez, cada lado de una pasada para que no se pisen entre ellos.
  const reacomodarRef = useRef(null);
  reacomodarRef.current = () => {
    if (arrastre) return;
    const lim = limites();
    const cambios = {};
    ["izquierda", "derecha"].forEach((lado) => {
      const delLado = visibles
        .filter((id) => ladoDe(id) === lado && Number.isFinite(posiciones[id]?.top))
        .map((id) => ({ id, alto: altoDe(id), top: acotar(posiciones[id].top, altoDe(id), lim) }))
        .sort((a, b) => a.top - b.top);
      if (delLado.length === 0) return;
      const tops = separar(delLado, delLado[0].id, lim);
      Object.entries(tops).forEach(([pid, top]) => {
        if (top !== posiciones[pid].top) cambios[pid] = { lado, top };
      });
    });
    if (Object.keys(cambios).length > 0) colocar(cambios);
  };

  useEffect(() => {
    if (estrecha) return undefined;
    const alCambiar = () => reacomodarRef.current();
    window.addEventListener("resize", alCambiar);
    return () => window.removeEventListener("resize", alCambiar);
  }, [estrecha]);

  const cabeceraProps = (id) => ({
    onPointerDown: (e) => {
      // Los botones de la cabecera (cerrar, cambiar de lado) no arrastran
      if (e.button !== 0 || e.target.closest("button")) return;
      const caja = nodos.current[id]?.getBoundingClientRect();
      if (!caja) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setArrastre({ id, x: caja.left, y: caja.top, dx: e.clientX - caja.left, dy: e.clientY - caja.top });
    },
    onPointerMove: (e) => {
      if (arrastre?.id !== id) return;
      setArrastre((a) => ({ ...a, x: e.clientX - a.dx, y: e.clientY - a.dy }));
    },
    onPointerUp: (e) => {
      if (arrastre?.id !== id) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      const ancho = nodos.current[id]?.offsetWidth || 0;
      soltarEn(id, ladoPorPosicion(arrastre.x + ancho / 2, window.innerWidth), arrastre.y);
      setArrastre(null);
    },
    onPointerCancel: () => setArrastre(null)
  });

  const contenido = (id) => {
    switch (id) {
      case "lista":
        return (
          <PanelLista
            mensaje={lista.mensaje}
            canciones={lista.canciones}
            activaId={lista.activaId}
            onIr={lista.onIr}
            notacion={notacion}
          />
        );
      case "quintas":
        return <CirculoQuintas notacion={notacion} />;
      case "afinador":
        return <Tuner compact={true} mini={true} />;
      case "metronomo":
        return (
          <Metronome
            compact={true}
            mini={true}
            tempoInicial={metronomo.tempoInicial ?? null}
            compasInicial={metronomo.compasInicial ?? null}
          />
        );
      default:
        return null;
    }
  };

  const estiloPanel = (id) => {
    if (arrastre?.id === id) return { left: arrastre.x, top: arrastre.y, right: "auto" };
    const top = posiciones[id]?.top;
    const lado = ladoDe(id);
    return {
      top: Number.isFinite(top) ? top : undefined,
      // Hasta medirlo, abajo del todo: así no aparece un instante arriba
      bottom: Number.isFinite(top) ? undefined : ESPACIO_BARRA,
      left: lado === "izquierda" ? "1rem" : "auto",
      right: lado === "derecha" ? "1rem" : "auto"
    };
  };

  const botones = disponibles.filter((id) => !ocultarBotones.includes(id));

  const paneles = visibles.map((id) => (
    <section
      key={id}
      ref={(nodo) => { if (nodo) nodos.current[id] = nodo; else delete nodos.current[id]; }}
      className={`panel-flotante panel-flotante--${id}${estrecha ? "" : " panel-flotante--suelto"}${arrastre?.id === id ? " arrastrando" : ""}`}
      data-lado={ladoDe(id)}
      data-herramienta={id}
      style={estrecha ? undefined : estiloPanel(id)}
      aria-label={HERRAMIENTAS[id].titulo}
    >
      <PanelFlotante
        id={id}
        lado={ladoDe(id)}
        arrastrable={!estrecha}
        onCerrar={() => cerrar(id)}
        onCambiarLado={() => soltarEn(
          id,
          ladoDe(id) === "izquierda" ? "derecha" : "izquierda",
          posiciones[id]?.top ?? limites().minTop
        )}
        cabeceraProps={estrecha ? {} : cabeceraProps(id)}
      >
        {contenido(id)}
      </PanelFlotante>
    </section>
  ));

  return (
    <>
      {botones.length > 0 && <div className="barra-herramientas-hueco" aria-hidden="true" />}

      {paneles.length > 0 && (
        estrecha
          ? <div className="paneles-flotantes no-print">{paneles}</div>
          : <div className="paneles-sueltos no-print">{paneles}</div>
      )}

      {botones.length > 0 && (
        <nav className="barra-herramientas no-print" aria-label="Herramientas">
          {botones.map((id) => (
            <button
              key={id}
              type="button"
              className={`barra-herramientas-btn${abiertos.includes(id) ? " activo" : ""}`}
              onClick={() => alternar(id)}
              aria-pressed={abiertos.includes(id)}
              title={HERRAMIENTAS[id].titulo}
            >
              <Icono nombre={HERRAMIENTAS[id].icono} />
              <span className="barra-herramientas-texto">{HERRAMIENTAS[id].titulo}</span>
            </button>
          ))}
        </nav>
      )}
    </>
  );
}

export default HerramientasFlotantes;

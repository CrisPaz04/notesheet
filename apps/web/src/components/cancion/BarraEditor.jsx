import { useState } from "react";
import { nombrarTonalidad, nombrarNota, ortografiaDe, ORTOGRAFIA_NEUTRA } from "@notesheet/core";
import Icono from "../Icono";
import { TONALIDADES_RELATIVAS } from "../../lib/tonalidadesRelativas";
import { insertarSeccion, insertarNota, insertarAlteracion } from "../../utils/insertarEnEditor";

// Botones para escribir más rápido: las secciones, las notas y la
// modulación. Escribir a mano sigue valiendo; los botones dejan cada cosa
// bien escrita ("## Coro" con su espacio, "DO RE MI" en mayúsculas), y en
// una tablet permiten escribir una línea de notas sin abrir el teclado.
//
// No tocan el texto: devuelven una edición (`onEditar`) que el editor aplica
// donde está el cursor.

const SECCIONES = ["Intro", "Verso", "Coro", "Puente", "Solo", "Final"];

// Una octava de piano: las blancas (teclas 0, 2, 4…) llevan siempre su nombre
// natural; las negras, el de la ortografía de la tonalidad. En FA# mayor la
// blanca de FA se llama MI#, pero en un teclado se busca FA.
const BLANCAS = [0, 2, 4, 5, 7, 9, 11];
const NATURALES = { latin: ["DO", "RE", "MI", "FA", "SOL", "LA", "SI"], english: ["C", "D", "E", "F", "G", "A", "B"] };
// Cada negra, tras cuántas blancas va (DO# tras la 1.ª…)
const NEGRAS = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]];

// Que el botón no le quite el foco al texto: así se sigue escribiendo donde
// estaba el cursor, y en la tablet no se cierra (ni se abre) el teclado.
const sinQuitarFoco = (e) => e.preventDefault();

/**
 * @param {Object} props
 * @param {(crear: Function) => void} props.onEditar - Recibe una función
 *   `(texto, inicio, fin) => edición` y la aplica en el editor
 * @param {'latin'|'english'} props.notacion
 * @param {boolean} props.conNotas - Notas y modulación (no en "Solo letra")
 * @param {() => string} [props.tonalidadEnCursor] - La del tramo donde está el
 *   cursor, para preelegirla al abrir la modulación
 * @param {string} [props.tonalidad] - La misma, ya calculada: da nombre a las
 *   teclas negras (DO# en RE, REb en LAb)
 * @param {string} [props.referencia] - En qué se escribe la tonalidad
 *   ("trompeta en Sib", "concierto")
 */
function BarraEditor({ onEditar, notacion = "latin", conNotas = true, tonalidadEnCursor, tonalidad, referencia }) {
  const [eligiendoModulacion, setEligiendoModulacion] = useState(null);
  const sistema = notacion === "english" ? "english" : "latin";
  const ortografia = ortografiaDe(tonalidad) || ORTOGRAFIA_NEUTRA;

  const seccion = (linea) => onEditar((texto, inicio, fin) => insertarSeccion(texto, inicio, fin, linea));
  const nota = (n) => onEditar((texto, inicio, fin) => insertarNota(texto, inicio, fin, n));
  const alteracion = (a) => onEditar((texto, inicio, fin) => insertarAlteracion(texto, inicio, fin, a));

  const modular = (tonalidad) => {
    seccion(`## Modulación [${tonalidad}]`);
    setEligiendoModulacion(null);
  };

  return (
    <div className="barra-editor" role="toolbar" aria-label="Insertar en el texto">
      <div className="barra-editor-grupo" role="group" aria-label="Secciones">
        {SECCIONES.map((titulo) => (
          <button key={titulo} type="button" className="barra-editor-boton"
            onMouseDown={sinQuitarFoco} onClick={() => seccion(`## ${titulo}`)}>
            {titulo}
          </button>
        ))}
        <button type="button" className="barra-editor-boton"
          title="Cierra la sección anterior sin abrir otra con nombre"
          onMouseDown={sinQuitarFoco} onClick={() => seccion("##")}>
          Fin de sección
        </button>
        {conNotas && (
          <button type="button"
            className={`barra-editor-boton barra-editor-boton--modulacion ${eligiendoModulacion ? "activo" : ""}`}
            aria-expanded={Boolean(eligiendoModulacion)}
            onMouseDown={sinQuitarFoco}
            onClick={() => setEligiendoModulacion(eligiendoModulacion ? null : (tonalidadEnCursor?.() || "DO"))}>
            <Icono nombre="arrow-up-right" className="me-1" />
            Modulación
          </button>
        )}
      </div>

      {conNotas && (
        <div className="barra-editor-grupo barra-editor-notas">
          <div className="teclado-notas" role="group" aria-label="Notas">
            {BLANCAS.map((tecla, i) => {
              const n = NATURALES[sistema][i];
              return (
                <button key={tecla} type="button" className="tecla-blanca"
                  onMouseDown={sinQuitarFoco} onClick={() => nota(n)}>
                  {n}
                </button>
              );
            })}
            {NEGRAS.map(([tecla, tras]) => {
              const n = nombrarNota(tecla, ortografia, sistema);
              return (
                <button key={tecla} type="button" className="tecla-negra" style={{ "--tras": tras }}
                  onMouseDown={sinQuitarFoco} onClick={() => nota(n)}>
                  {n}
                </button>
              );
            })}
          </div>
          {/* Para los casos raros (MI#, DOb) o para corregir la nota de antes */}
          <button type="button" className="barra-editor-boton barra-editor-nota" aria-label="Sostenido"
            onMouseDown={sinQuitarFoco} onClick={() => alteracion("#")}>#</button>
          <button type="button" className="barra-editor-boton barra-editor-nota" aria-label="Bemol"
            onMouseDown={sinQuitarFoco} onClick={() => alteracion("b")}>b</button>
        </div>
      )}

      {eligiendoModulacion && (
        <div className="barra-editor-modulacion" role="group" aria-label="Tonalidad de la modulación">
          <p className="barra-editor-ayuda">
            ¿A qué tonalidad modula? Desde aquí las notas van escritas en ella
            {referencia ? <> (en {referencia}, como el resto de esta pestaña)</> : null}.
          </p>
          <div className="barra-editor-tonalidades">
            {TONALIDADES_RELATIVAS.flatMap(({ major, minor }) => [major, minor]).map((tonalidad) => (
              <button key={tonalidad} type="button"
                className={`key-option ${tonalidad === eligiendoModulacion ? "active" : ""}`}
                onMouseDown={sinQuitarFoco} onClick={() => modular(tonalidad)}>
                {nombrarTonalidad(tonalidad, notacion)}
              </button>
            ))}
          </div>
          <button type="button" className="barra-editor-boton" onClick={() => setEligiendoModulacion(null)}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

export default BarraEditor;

import { useEffect, useRef, useState } from "react";
import { getAudioContext, resumeAudioContext } from "@notesheet/core/src/audio/audioContext";
import { midiToFrequency } from "@notesheet/core/src/audio/pitchDetection";
import usePreferenciaLocal from "../../hooks/usePreferenciaLocal";
import { esPantallaEstrecha } from "../../hooks/useHerramientas";
import Icono from "../Icono";
import { bufferPara, cargarMuestras, muestrasListas, suena } from "../../lib/pianoMuestras";

const SONIDOS = [
  { id: "piano", nombre: "Piano" },
  { id: "trompeta", nombre: "Trompeta" }
];

const NOMBRES = {
  latin: ["DO", "DO#", "RE", "RE#", "MI", "FA", "FA#", "SOL", "SOL#", "LA", "LA#", "SI"],
  english: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
};
const BLANCAS = [0, 2, 4, 5, 7, 9, 11];
// Dónde cae cada negra entre las blancas: tras la blanca n.º…
const NEGRAS = { 1: 0, 3: 1, 6: 3, 8: 4, 10: 5 };
const OCTAVAS = ["1", "2", "3", "4", "5", "6"];

/**
 * Una nota con la grabación del piano (pianoMuestras.js), afinada a su tecla.
 * Suena lo que dura la grabación mientras se mantiene la tecla, y al soltarla
 * se apaga en un momento, como cuando el apagador vuelve a la cuerda.
 */
function tocarMuestra(ctx, destino, { buffer, velocidad }, apagar = 0.35) {
  const ahora = ctx.currentTime;
  const fuente = ctx.createBufferSource();
  fuente.buffer = buffer;
  fuente.playbackRate.value = velocidad;
  const volumen = ctx.createGain();
  volumen.gain.value = 0.9;
  fuente.connect(volumen);
  volumen.connect(destino);
  fuente.start(ahora);

  return () => {
    const t = ctx.currentTime;
    volumen.gain.cancelScheduledValues(t);
    volumen.gain.setValueAtTime(volumen.gain.value, t);
    volumen.gain.exponentialRampToValueAtTime(0.001, t + apagar);
    fuente.stop(t + apagar + 0.05);
  };
}

/**
 * Mientras cargan las grabaciones (o si alguna falla): una nota sintetizada, tres parciales que se apagan a ritmos
 * distintos (los agudos antes), como una cuerda percutida. Suena mientras se
 * mantiene la tecla y se apaga al soltarla, como con el pedal levantado.
 */
function tocarNota(ctx, destino, frecuencia) {
  const ahora = ctx.currentTime;
  const salida = ctx.createGain();
  salida.gain.setValueAtTime(0, ahora);
  salida.gain.linearRampToValueAtTime(0.5, ahora + 0.005);
  salida.gain.exponentialRampToValueAtTime(0.18, ahora + 0.4);
  salida.gain.exponentialRampToValueAtTime(0.02, ahora + 4);
  salida.connect(destino);

  const osciladores = [[1, 0.6, "triangle"], [2, 0.25, "sine"], [3, 0.1, "sine"]].map(([armonico, nivel, tipo]) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia * armonico;
    g.gain.setValueAtTime(nivel, ahora);
    g.gain.exponentialRampToValueAtTime(nivel * 0.1, ahora + 1.5 / armonico);
    osc.connect(g);
    g.connect(salida);
    osc.start(ahora);
    return osc;
  });

  return () => {
    const t = ctx.currentTime;
    salida.gain.cancelScheduledValues(t);
    salida.gain.setValueAtTime(salida.gain.value, t);
    salida.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osciladores.forEach((osc) => osc.stop(t + 0.3));
  };
}

/**
 * Un piano para sacar una nota de oído, comprobar un acorde o darle el tono a
 * quien canta sin salir de la canción. Va en las herramientas flotantes, abajo.
 * Dos octavas (una en el móvil) y la octava de inicio aparte. Varios dedos a la
 * vez suenan a la vez: cada toque lleva su propio puntero.
 *
 * Suena en concierto, como un piano de verdad, con el diapasón estándar.
 */
function Piano({ notacion = "latin" }) {
  const [octava, setOctava] = usePreferenciaLocal("pianoOctava", "4", OCTAVAS);
  const [pulsadas, setPulsadas] = useState(() => new Set());
  const sonando = useRef(new Map()); // puntero → { midi, parar }
  const salidaRef = useRef(null);
  const octavasVisibles = esPantallaEstrecha() ? 1 : 2;
  // Con qué suena: piano o trompeta (recordado en el dispositivo)
  const [sonido, setSonido] = usePreferenciaLocal("pianoSonido", "piano", SONIDOS.map((x) => x.id));
  const [cargando, setCargando] = useState(() => !muestrasListas(sonido));

  // Las grabaciones de cada instrumento se piden al elegirlo la primera vez
  useEffect(() => {
    let vivo = true;
    setCargando(!muestrasListas(sonido));
    cargarMuestras(getAudioContext(), sonido).finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [sonido]);
  const nombres = NOMBRES[notacion] || NOMBRES.latin;

  const salida = () => {
    if (!salidaRef.current) {
      const ctx = getAudioContext();
      const g = ctx.createGain();
      g.gain.value = 0.7;
      g.connect(ctx.destination);
      salidaRef.current = { ctx, g };
    }
    return salidaRef.current;
  };

  const soltar = (puntero) => {
    const nota = sonando.current.get(puntero);
    if (!nota) return;
    nota.parar();
    sonando.current.delete(puntero);
    setPulsadas((p) => {
      const s = new Set(p);
      if (![...sonando.current.values()].some((n) => n.midi === nota.midi)) s.delete(nota.midi);
      return s;
    });
  };

  const pulsar = (midi) => (e) => {
    e.preventDefault();
    // Fuera del registro del instrumento (la trompeta no baja de MI3) no suena
    if (!suena(midi, sonido)) return;
    // En táctil el dedo queda "capturado" por la primera tecla; soltándolo,
    // deslizarlo a otra la toca (glissando)
    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // Sin captura que soltar
    }
    soltar(e.pointerId);
    const { ctx, g } = salida();
    resumeAudioContext().catch(() => {});
    const grabacion = bufferPara(midi, sonido);
    // La trompeta corta enseguida al soltar (deja de soplar); el piano, con
    // la resonancia del apagador
    const parar = grabacion
      ? tocarMuestra(ctx, g, grabacion, sonido === "trompeta" ? 0.12 : 0.35)
      : tocarNota(ctx, g, midiToFrequency(midi));
    sonando.current.set(e.pointerId, { midi, parar });
    setPulsadas((p) => new Set(p).add(midi));
  };

  // Deslizar el dedo a otra tecla la toca (glissando)
  const entrar = (midi) => (e) => {
    if (e.buttons === 0 || !sonando.current.has(e.pointerId)) return;
    if (sonando.current.get(e.pointerId).midi === midi) return;
    pulsar(midi)(e);
  };

  const salir = (e) => soltar(e.pointerId);

  // Al cerrar el panel no se queda nada sonando
  useEffect(() => () => {
    sonando.current.forEach((n) => n.parar());
    sonando.current.clear();
  }, []);

  const base = 12 * (Number(octava) + 1);
  const blancas = [];
  for (let o = 0; o < octavasVisibles; o++) BLANCAS.forEach((n) => blancas.push(base + 12 * o + n));
  blancas.push(base + 12 * octavasVisibles); // el DO de cierre
  const negras = [];
  for (let o = 0; o < octavasVisibles; o++) {
    Object.entries(NEGRAS).forEach(([n, tras]) => negras.push({ midi: base + 12 * o + Number(n), tras: 7 * o + tras }));
  }

  const nombre = (midi) => nombres[midi % 12];
  const octavaDe = (midi) => Math.floor(midi / 12) - 1;
  const eventos = (midi) => ({
    onPointerDown: pulsar(midi),
    onPointerEnter: entrar(midi),
    onPointerUp: salir,
    onPointerLeave: salir,
    onPointerCancel: salir
  });
  const i = OCTAVAS.indexOf(octava);

  return (
    <div className="piano">
      <div className="piano-teclado" style={{ "--blancas": blancas.length }} role="group" aria-label="Teclado">
        {blancas.map((midi) => (
          <button
            key={midi}
            type="button"
            className={`piano-blanca${pulsadas.has(midi) ? " pulsada" : ""}${suena(midi, sonido) ? "" : " fuera"}`}
            aria-label={`${nombre(midi)}${octavaDe(midi)}`}
            {...eventos(midi)}
          >
            <span>{nombre(midi)}{midi % 12 === 0 && <small>{octavaDe(midi)}</small>}</span>
          </button>
        ))}
        {negras.map(({ midi, tras }) => (
          <button
            key={midi}
            type="button"
            className={`piano-negra${pulsadas.has(midi) ? " pulsada" : ""}${suena(midi, sonido) ? "" : " fuera"}`}
            style={{ "--tras": tras + 1 }}
            aria-label={`${nombre(midi)}${octavaDe(midi)}`}
            {...eventos(midi)}
          />
        ))}
      </div>

      <div className="piano-octava">
        <div className="piano-sonido" role="group" aria-label="Sonido">
          {SONIDOS.map((x) => (
            <button
              key={x.id}
              type="button"
              className={`piano-sonido-btn${sonido === x.id ? " activo" : ""}`}
              aria-pressed={sonido === x.id}
              onClick={() => setSonido(x.id)}
            >
              {x.nombre}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="piano-octava-btn"
          onClick={() => setOctava(OCTAVAS[i - 1])}
          disabled={i <= 0}
          aria-label="Octava más grave"
        >
          <Icono nombre="caret-left" />
        </button>
        <span>
          Desde {nombres[0]}{octava}
          {cargando && <small className="piano-cargando"> · cargando el sonido…</small>}
        </span>
        <button
          type="button"
          className="piano-octava-btn"
          onClick={() => setOctava(OCTAVAS[i + 1])}
          disabled={i >= OCTAVAS.length - 1}
          aria-label="Octava más aguda"
        >
          <Icono nombre="caret-right" />
        </button>
      </div>
    </div>
  );
}

export default Piano;

/**
 * El sonido del piano de las herramientas: grabaciones de instrumentos de
 * verdad, con el sintetizador de reserva mientras cargan.
 *
 * - **Piano**: el Salamander Grand Piano (Yamaha C5, Alexander Holm, CC BY 3.0),
 *   una grabación cada tres semitonos de DO1 a DO8 (29 archivos, ~2 MB).
 * - **Trompeta**: VSCO 2 Community Edition (Versilian Studios, CC0), notas
 *   largas sin vibrato de FA3 a DO6, lo que da una trompeta en Sib (10 archivos,
 *   ~0,7 MB). Esa librería nombra las octavas una más abajo ("A4" suena a 880 Hz):
 *   aquí van ya con su nombre de verdad. Fuera de su registro no suena.
 *
 * Ver `public/audio/LEEME.txt`. No hay una grabación por tecla: las de en medio
 * se afinan subiendo o bajando la más cercana (como mucho dos semitonos), que no
 * se nota. Se descargan al elegir el instrumento la primera vez, no al entrar en
 * la app, y el service worker las guarda para usarlas sin conexión
 * (`runtimeCaching` en `vite.config.js`).
 */

const NOMBRES = ["C", "Cs", "D", "Ds", "E", "F", "Fs", "G", "Gs", "A", "As", "B"];

const deDoAdo = [];
for (let m = 24; m <= 108; m += 3) deDoAdo.push(m);

export const INSTRUMENTOS = {
  piano: { carpeta: "piano", notas: deDoAdo, desde: 21, hasta: 108 },
  // La trompeta en Sib suena de MI3 a DO6 (escrito, FA#3 a RE6)
  trompeta: { carpeta: "trompeta", notas: [53, 57, 60, 63, 67, 70, 74, 77, 81, 84], desde: 52, hasta: 86 }
};

/** Las notas (MIDI) grabadas del piano, para compatibilidad */
export const NOTAS_GRABADAS = INSTRUMENTOS.piano.notas;

/** El archivo de una nota grabada: 60 → "C4.mp3", 63 → "Ds4.mp3" */
export const archivoDe = (midi) => `${NOMBRES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;

/** Si el instrumento puede tocar esa nota */
export const suena = (midi, instrumento = "piano") => {
  const inst = INSTRUMENTOS[instrumento] || INSTRUMENTOS.piano;
  return midi >= inst.desde && midi <= inst.hasta;
};

/**
 * Qué grabación usar para una tecla y a qué velocidad reproducirla para que
 * suene en su nota: cada semitono es ×2^(1/12).
 *
 * @param {number} midi
 * @param {string} [instrumento]
 * @returns {{ muestra: number, velocidad: number }}
 */
export function muestraPara(midi, instrumento = "piano") {
  const { notas } = INSTRUMENTOS[instrumento] || INSTRUMENTOS.piano;
  const muestra = notas.reduce((mejor, n) => (Math.abs(n - midi) < Math.abs(mejor - midi) ? n : mejor), notas[0]);
  return { muestra, velocidad: Math.pow(2, (midi - muestra) / 12) };
}

const cargas = new Map();
const buffers = new Map(); // "instrumento:midi" → AudioBuffer

/**
 * Descarga y decodifica las grabaciones de un instrumento (una sola vez por
 * sesión). Si alguna falla, esa tecla sigue con el sintetizador.
 *
 * @param {BaseAudioContext} ctx
 * @param {string} [instrumento]
 */
export function cargarMuestras(ctx, instrumento = "piano") {
  if (!cargas.has(instrumento)) {
    const { carpeta, notas } = INSTRUMENTOS[instrumento];
    cargas.set(instrumento, Promise.all(notas.map(async (midi) => {
      try {
        const respuesta = await fetch(`/audio/${carpeta}/${archivoDe(midi)}`);
        if (!respuesta.ok) return;
        buffers.set(`${instrumento}:${midi}`, await ctx.decodeAudioData(await respuesta.arrayBuffer()));
      } catch {
        // Sin esta grabación: la tecla usa el sintetizador
      }
    })).then(() => undefined));
  }
  return cargas.get(instrumento);
}

/** La grabación ya cargada para una tecla, o null */
export function bufferPara(midi, instrumento = "piano") {
  const { muestra, velocidad } = muestraPara(midi, instrumento);
  const buffer = buffers.get(`${instrumento}:${muestra}`);
  return buffer ? { buffer, velocidad } : null;
}

/** Si ya están todas las de un instrumento (para quitar el aviso de "cargando") */
export const muestrasListas = (instrumento = "piano") =>
  INSTRUMENTOS[instrumento].notas.every((m) => buffers.has(`${instrumento}:${m}`));

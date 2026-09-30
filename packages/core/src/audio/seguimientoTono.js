// packages/core/src/audio/seguimientoTono.js

/**
 * Lo que va entre el detector y la pantalla del afinador. El detector da una
 * lectura por cuadro, y cada una trae su poco de ruido; pintarlas tal cual es
 * lo que hacía temblar la aguja y parpadear la nota. Aquí:
 *
 * - **Se confirma la nota** antes de cambiarla: un salto de más de medio tono
 *   tiene que repetirse unos cuadros seguidos. Un golpe de lengua o una lectura
 *   una octava abajo no mueven la aguja.
 * - **Se suaviza** con un filtro "1 €" (Casiez, Roussel y Vogel, 2012): mucho
 *   cuando la nota está quieta (se ve firme) y poco cuando se mueve de verdad
 *   (el músico ve enseguida que la está subiendo).
 * - **Se mantiene** la última lectura un momento cuando se corta el sonido
 *   (una respiración, el final de una nota corta), en vez de borrarla.
 *
 * Todo en semitonos (69 = LA4 a 440 Hz), que es como se oye: un cent es lo
 * mismo en un DO grave que en uno agudo. Puro y con el tiempo como argumento,
 * para poder probarlo sin micrófono.
 */

const aSemitonos = (frecuencia) => 69 + 12 * Math.log2(frecuencia / 440);
const aFrecuencia = (semitonos) => 440 * Math.pow(2, (semitonos - 69) / 12);

const mediana = (valores) => {
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
};

// El coeficiente de un filtro de paso bajo de primer orden
const alfa = (corte, dt) => 1 / (1 + 1 / (2 * Math.PI * corte * dt));

/** Filtro 1 € sobre un valor: más suave cuanto más quieto está */
class FiltroUnEuro {
  constructor({ corteMinimo, beta, corteDerivada }) {
    this.corteMinimo = corteMinimo;
    this.beta = beta;
    this.corteDerivada = corteDerivada;
    this.reiniciar();
  }

  reiniciar(valor = null, t = null) {
    this.valor = valor;
    this.derivada = 0;
    this.t = t;
  }

  filtrar(x, t) {
    if (this.valor === null) {
      this.reiniciar(x, t);
      return x;
    }
    const dt = Math.max((t - this.t) / 1000, 1e-3);
    const derivada = (x - this.valor) / dt;
    this.derivada += alfa(this.corteDerivada, dt) * (derivada - this.derivada);
    const corte = this.corteMinimo + this.beta * Math.abs(this.derivada);
    this.valor += alfa(corte, dt) * (x - this.valor);
    this.t = t;
    return this.valor;
  }
}

export const SEGUIMIENTO_POR_DEFECTO = {
  // Cuánto se sigue enseñando la última nota tras cortarse el sonido
  mantenerMs: 400,
  // Cuántas lecturas seguidas hacen falta para dar por buena una nota nueva
  confirmar: 3,
  // Un salto mayor (en semitonos) es otra nota, y hay que confirmarla
  salto: 0.6,
  // Cuánto pueden separarse entre sí las lecturas que confirman una nota
  coherencia: 0.35,
  // El filtro: corte en reposo (Hz), cuánto se abre al moverse y el de la
  // derivada. Elegidos simulando 60 lecturas por segundo con 1,5 cents de
  // ruido: la aguja tiembla ~0,3 cents quieta y recorre el 90% de una
  // corrección de 20 cents en ~80 ms.
  corteMinimo: 0.8,
  beta: 2,
  corteDerivada: 1
};

export class SeguidorDeTono {
  constructor(opciones = {}) {
    this.opciones = { ...SEGUIMIENTO_POR_DEFECTO, ...opciones };
    this.filtro = new FiltroUnEuro(this.opciones);
    this.reiniciar();
  }

  reiniciar() {
    this.actual = null; // en semitonos
    this.ultimaValida = null;
    this.candidatas = [];
    this.filtro.reiniciar();
  }

  /**
   * @param {number|null} frecuencia - Lo que ha leído el detector (null: nada)
   * @param {number} ahora - Milisegundos (`performance.now()`)
   * @returns {number|null} La frecuencia a enseñar, o null si no hay nota
   */
  actualizar(frecuencia, ahora) {
    const { mantenerMs, salto } = this.opciones;

    if (frecuencia === null || !(frecuencia > 0)) {
      this.candidatas = [];
      return this.mantener(ahora);
    }

    const p = aSemitonos(frecuencia);

    // Cerca de la nota que ya se enseña: se sigue, suavizada
    if (this.actual !== null && Math.abs(p - this.actual) <= salto) {
      this.candidatas = [];
      this.actual = this.filtro.filtrar(p, ahora);
      this.ultimaValida = ahora;
      return aFrecuencia(this.actual);
    }

    // Lejos (o sin nota todavía): candidata, hasta que se repita
    const confirmada = this.confirmar(p);
    if (confirmada !== null) {
      this.filtro.reiniciar(confirmada, ahora);
      this.actual = confirmada;
      this.ultimaValida = ahora;
      return aFrecuencia(this.actual);
    }
    return this.actual !== null && ahora - this.ultimaValida <= mantenerMs
      ? aFrecuencia(this.actual)
      : this.olvidar();
  }

  // Suma la lectura a las candidatas y, si ya son bastantes y coinciden,
  // devuelve la nota confirmada
  confirmar(p) {
    const { confirmar, coherencia } = this.opciones;
    // Si no casa con las anteriores, empieza de nuevo desde esta
    if (this.candidatas.length && Math.abs(p - mediana(this.candidatas)) > coherencia) {
      this.candidatas = [];
    }
    this.candidatas.push(p);
    if (this.candidatas.length < confirmar) return null;
    const nota = mediana(this.candidatas);
    this.candidatas = [];
    return nota;
  }

  mantener(ahora) {
    if (this.actual !== null && ahora - this.ultimaValida <= this.opciones.mantenerMs) {
      return aFrecuencia(this.actual);
    }
    return this.olvidar();
  }

  olvidar() {
    if (this.actual !== null) this.reiniciar();
    return null;
  }
}

/**
 * La nota (MIDI) de una altura, sin que parpadee en la frontera: quien toca
 * justo a +50 cents vería saltar la nota entre LA y LA#. Se queda con la
 * anterior mientras no se aleje de ella más de medio tono y un margen.
 *
 * @param {number} semitonos - Altura exacta (69 = el LA del diapasón)
 * @param {number|null} anterior - La nota que se estaba enseñando
 * @param {number} margen - En semitonos
 */
export function notaConHisteresis(semitonos, anterior, margen = 0.08) {
  if (anterior !== null && anterior !== undefined && Math.abs(semitonos - anterior) <= 0.5 + margen) {
    return anterior;
  }
  return Math.round(semitonos);
}

/**
 * 'in-tune', 'flat' o 'sharp'. Afinado hasta ±5 cents, pero quien ya lo
 * estaba no lo deja hasta pasar de ±7: si no, en el borde el "Afinado"
 * parpadeaba con cada lectura.
 */
export function estadoAfinacion(cents, anterior = null) {
  const limite = anterior === 'in-tune' ? 7 : 5;
  if (Math.abs(cents) <= limite) return 'in-tune';
  return cents < 0 ? 'flat' : 'sharp';
}

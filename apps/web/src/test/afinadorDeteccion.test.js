import { describe, it, expect } from 'vitest';
import {
  DetectorDeTono,
  detectPitch,
  frequencyToMidi,
  getCentsDeviation
} from '@notesheet/core/src/audio/pitchDetection';
import {
  SeguidorDeTono,
  notaConHisteresis,
  estadoAfinacion
} from '@notesheet/core/src/audio/seguimientoTono';

const SR = 48000;
const cents = (a, b) => 1200 * Math.log2(a / b);

// Ruido reproducible: con Math.random un test podría fallar una vez de cada mil
function aleatorio(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// Un tono con armónicos, como un metal: la fundamental no es la más fuerte
// sola, que es lo que confundía al detector anterior con la octava de abajo
function tono(f, { n = 4096, ruido = 0.005, armonicos = [1, 0.8, 0.6, 0.5, 0.4, 0.3], semilla = 1 } = {}) {
  const azar = aleatorio(semilla);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    armonicos.forEach((a, k) => { v += a * Math.sin((2 * Math.PI * f * (k + 1) * i) / SR + k); });
    b[i] = (0.2 * v) / armonicos.length + ruido * (azar() * 2 - 1);
  }
  return b;
}

describe('DetectorDeTono (McLeod)', () => {
  const detector = new DetectorDeTono(4096);

  // En la tuba caben menos de cuatro periodos en la ventana y el ruido pesa
  // más en cada lectura; el seguimiento lo promedia después
  it.each([
    ['la tuba grave', 43.65, 3],
    ['el SIb de la trompeta', 233.08, 1],
    ['el LA del diapasón', 440, 1],
    ['un agudo', 1046.5, 1]
  ])('acierta %s (a menos de %s cents)', (_, f, tolerancia) => {
    for (const desafinado of [-17, 0, 23]) {
      const real = f * 2 ** (desafinado / 1200);
      const lectura = detector.detectar(tono(real), SR);
      expect(Math.abs(cents(lectura.frecuencia, real))).toBeLessThan(tolerancia);
    }
  });

  it('sin ruido no tiene sesgo, ni en la tuba', () => {
    for (const f of [43.65, 440]) {
      const lectura = detector.detectar(tono(f, { ruido: 0 }), SR);
      expect(Math.abs(cents(lectura.frecuencia, f))).toBeLessThan(0.1);
    }
  });

  // El anterior se quedaba con el retardo de mayor correlación, que a menudo
  // era el doble del periodo
  it('no se va a la octava de abajo', () => {
    for (let semilla = 1; semilla <= 20; semilla++) {
      const lectura = detector.detectar(tono(466.16, { ruido: 0.02, semilla }), SR);
      expect(Math.abs(cents(lectura.frecuencia, 466.16))).toBeLessThan(30);
    }
  });

  // Sin interpolar, a 440 Hz solo se podían leer 436,4 / 440,4 / 444,4...
  it('no lee a escalones: distingue dos cents', () => {
    const a = detector.detectar(tono(440), SR).frecuencia;
    const b = detector.detectar(tono(440 * 2 ** (2 / 1200)), SR).frecuencia;
    expect(cents(b, a)).toBeCloseTo(2, 0);
  });

  it('el silencio no es una nota', () => {
    expect(detector.detectar(new Float32Array(4096), SR)).toBeNull();
    expect(detector.detectar(tono(440).map((v) => v * 0.01), SR)).toBeNull();
  });

  it('el ruido no es una nota', () => {
    const azar = aleatorio(7);
    const ruido = Float32Array.from({ length: 4096 }, () => 0.2 * (azar() * 2 - 1));
    expect(detector.detectar(ruido, SR)).toBeNull();
  });

  it('detectPitch sigue dando solo la frecuencia', () => {
    expect(Math.abs(cents(detectPitch(tono(440, { n: 8192 }), SR), 440))).toBeLessThan(1.5);
  });
});

describe('frecuencia -> nota', () => {
  it('con otro diapasón las fronteras se mueven', () => {
    // 453 Hz queda a +50 cents del LA a 440 (ya es LA#) y a +42 del de 442
    expect(frequencyToMidi(453)).toBe(70);
    expect(frequencyToMidi(453, 442)).toBe(69);
  });

  it('los cents no se redondean', () => {
    expect(getCentsDeviation(441, 440)).toBeCloseTo(3.93, 2);
  });
});

// 60 lecturas por segundo
const DT = 1000 / 60;

describe('SeguidorDeTono', () => {
  it('no enseña nada hasta confirmar la nota', () => {
    const s = new SeguidorDeTono();
    expect(s.actualizar(440, 0)).toBeNull();
    expect(s.actualizar(440, DT)).toBeNull();
    expect(s.actualizar(440, 2 * DT)).toBeCloseTo(440, 5);
  });

  it('una lectura suelta (un golpe de lengua) no aparece', () => {
    const s = new SeguidorDeTono();
    expect(s.actualizar(440, 0)).toBeNull();
    expect(s.actualizar(null, DT)).toBeNull();
    expect(s.actualizar(440, 2 * DT)).toBeNull();
  });

  it('una octava suelta no mueve la aguja', () => {
    const s = new SeguidorDeTono();
    let t = 0;
    for (let i = 0; i < 10; i++) s.actualizar(440, (t += DT));
    expect(s.actualizar(220, (t += DT))).toBeCloseTo(440, 5);
    expect(s.actualizar(440, (t += DT))).toBeCloseTo(440, 5);
  });

  it('una nota nueva que se mantiene sí entra, sin arrastrarse desde la anterior', () => {
    const s = new SeguidorDeTono();
    let t = 0;
    for (let i = 0; i < 10; i++) s.actualizar(440, (t += DT));
    s.actualizar(587.33, (t += DT));
    s.actualizar(587.33, (t += DT));
    expect(s.actualizar(587.33, (t += DT))).toBeCloseTo(587.33, 5);
  });

  it('tiembla poco con una nota quieta y ruidosa', () => {
    const s = new SeguidorDeTono();
    const azar = aleatorio(3);
    let t = 0;
    const salidas = [];
    for (let i = 0; i < 180; i++) {
      const r = s.actualizar(440 * 2 ** ((3 * (azar() * 2 - 1)) / 1200), (t += DT));
      if (i > 60) salidas.push(cents(r, 440));
    }
    const media = salidas.reduce((a, b) => a + b, 0) / salidas.length;
    const desviacion = Math.sqrt(salidas.reduce((a, b) => a + (b - media) ** 2, 0) / salidas.length);
    // La entrada varía ±3 cents (desviación 1,7)
    expect(desviacion).toBeLessThan(0.6);
    expect(Math.abs(media)).toBeLessThan(0.5);
  });

  it('sigue enseguida una corrección de verdad', () => {
    const s = new SeguidorDeTono();
    let t = 0;
    for (let i = 0; i < 60; i++) s.actualizar(440, (t += DT));
    const subida = 440 * 2 ** (20 / 1200);
    let ms = 0;
    while (cents(s.actualizar(subida, (t += DT)), 440) < 18) ms += DT;
    expect(ms).toBeLessThan(200);
  });

  it('mantiene la nota un momento al cortarse el sonido y luego la suelta', () => {
    const s = new SeguidorDeTono({ mantenerMs: 400 });
    let t = 0;
    for (let i = 0; i < 10; i++) s.actualizar(440, (t += DT));
    expect(s.actualizar(null, t + 300)).toBeCloseTo(440, 5);
    expect(s.actualizar(null, t + 500)).toBeNull();
    // Y la siguiente nota vuelve a confirmarse desde cero
    expect(s.actualizar(440, t + 520)).toBeNull();
  });
});

describe('notaConHisteresis', () => {
  it('sin nota anterior, la más cercana', () => {
    expect(notaConHisteresis(69.4, null)).toBe(69);
    expect(notaConHisteresis(69.6, null)).toBe(70);
  });

  it('en la frontera se queda con la que había', () => {
    expect(notaConHisteresis(69.55, 69)).toBe(69);
    expect(notaConHisteresis(69.45, 70)).toBe(70);
  });

  it('pasado el margen, cambia', () => {
    expect(notaConHisteresis(69.7, 69)).toBe(70);
  });
});

describe('estadoAfinacion', () => {
  it('afinado hasta 5 cents', () => {
    expect(estadoAfinacion(4.9)).toBe('in-tune');
    expect(estadoAfinacion(6)).toBe('sharp');
    expect(estadoAfinacion(-6)).toBe('flat');
  });

  it('quien ya estaba afinado lo sigue hasta 7', () => {
    expect(estadoAfinacion(6, 'in-tune')).toBe('in-tune');
    expect(estadoAfinacion(-7.5, 'in-tune')).toBe('flat');
  });
});

describe('semitonosAEscrito (qué lee cada instrumento)', () => {
  it('con la octava real de cada uno', async () => {
    const { semitonosAEscrito, TRANSPOSING_INSTRUMENTS } = await import('@notesheet/core');
    const esperados = {
      bb_trumpet: 2, bb_clarinet: 2, bb_soprano_sax: 2, bb_trombone: 2,
      bb_tenor_sax: 14, eb_alto_sax: 9, eb_baritone_sax: 21, f_horn: 7,
      c_flute: 0, c_piano: 0, c_voice: 0, c_guitar: 12, c_bass: 12
    };
    // Si se añade un instrumento, que se decida aquí también
    expect(Object.keys(esperados).sort()).toEqual(Object.keys(TRANSPOSING_INSTRUMENTS).sort());
    for (const [id, semitonos] of Object.entries(esperados)) {
      expect(semitonosAEscrito(id), id).toBe(semitonos);
    }
    expect(semitonosAEscrito('concierto')).toBe(0);
  });
});

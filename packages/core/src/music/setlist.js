// packages/core/src/music/setlist.js
//
// Interpreta la lista que el director manda por WhatsApp y la empareja con el
// repertorio.
//
// El texto llega más o menos así:
//
//     Mi m
//     Te alabare
//     En mi corazon
//
//     La m
//     Voy a perder la compostura
//
// Dos cosas que condicionan todo el diseño:
//
//   1. Las líneas sueltas como "Mi m" o "La m" NO son canciones: son la
//      tonalidad que se aplica a las que vienen debajo.
//
//   2. El director casi nunca escribe el título. Lo normal es que ponga un
//      fragmento de la letra, porque así recuerda la canción. Pero a veces sí
//      pone el título correcto. Por eso el emparejamiento puntúa varias
//      señales por separado y se queda con la mejor: un título exacto gana por
//      su vía y un verso suelto gana por la suya, sin estorbarse.

const RAICES_LATINAS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI'];

const INGLES_A_LATIN = {
  C: 'DO', D: 'RE', E: 'MI', F: 'FA', G: 'SOL', A: 'LA', B: 'SI'
};

// "Mi m", "Lam", "RE menor", "Am", "Fa#", "SIb"...
const LINEA_TONALIDAD = new RegExp(
  `^\\s*(${RAICES_LATINAS.join('|')}|[A-G])\\s*(#|b|♯|♭)?\\s*(m|min|menor|minor)?\\s*$`,
  'i'
);

/**
 * Minúsculas, sin tildes, sin puntuación y con los espacios colapsados.
 * Es la forma en la que se comparan todos los textos: nadie escribe tildes
 * en WhatsApp y la letra guardada sí las lleva.
 */
export const normalizarTexto = (texto) => (texto || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^\w\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * ¿Es esta línea una tonalidad? Devuelve la tonalidad en el formato de la
 * aplicación ("LAm", "DO", "FA#") o null si es otra cosa.
 *
 * Ojo: una canción que se llamase solo "Mi" se confundiría con la tonalidad.
 * Es un caso raro y la ambigüedad es real incluso para una persona; el
 * emparejador deja siempre ver qué interpretó para poder corregirlo.
 */
export const parsearTonalidad = (linea) => {
  const m = LINEA_TONALIDAD.exec(linea || '');
  if (!m) return null;

  let raiz = m[1].toUpperCase();
  if (!RAICES_LATINAS.includes(raiz)) raiz = INGLES_A_LATIN[raiz];
  if (!raiz) return null;

  const alteracion = m[2] ? m[2].replace('♯', '#').replace('♭', 'b') : '';
  const menor = m[3] ? 'm' : '';

  return `${raiz}${alteracion}${menor}`;
};

/**
 * Divide el texto en entradas: cada canción mencionada con la tonalidad que
 * estaba vigente en ese punto.
 *
 * @param {string} texto - La lista tal cual la mandó el director
 * @returns {Array<{consulta: string, key: string|null, linea: number}>}
 */
export const parsearSetlist = (texto) => {
  const entradas = [];
  let tonalidadActual = null;

  (texto || '').split('\n').forEach((lineaCruda, i) => {
    const linea = lineaCruda.trim();
    if (!linea) return;

    const tonalidad = parsearTonalidad(linea);
    if (tonalidad) {
      tonalidadActual = tonalidad;
      return;
    }

    entradas.push({ consulta: linea, key: tonalidadActual, linea: i + 1 });
  });

  return entradas;
};

// --- Emparejamiento ----------------------------------------------------------

/** Distancia de edición, recortada: solo interesa saber si es 0, 1 o más. */
const distancia = (a, b) => {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      siguiente[j] = Math.min(
        fila[j] + 1,
        siguiente[j - 1] + 1,
        fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    fila = siguiente;
  }
  return fila[b.length];
};

/** Dos palabras cuentan como la misma si coinciden o casi. */
const palabrasIguales = (a, b) => {
  if (a === b) return true;
  // "compostura" / "compostora": una errata no debería romper la búsqueda
  if (a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1) return true;
  // "alabare" / "alabaremos": el director acorta
  if (a.length >= 4 && (b.startsWith(a) || a.startsWith(b))) return true;
  return false;
};

/**
 * Qué parte de la consulta aparece en el texto, pesando cada palabra por su
 * longitud. Así "de", "la" o "que" no inflan la puntuación y el peso se lo
 * llevan las palabras que de verdad identifican la canción.
 */
const cobertura = (palabrasConsulta, palabrasTexto) => {
  if (palabrasConsulta.length === 0 || palabrasTexto.length === 0) return 0;

  let total = 0;
  let encontrado = 0;

  palabrasConsulta.forEach((palabra) => {
    const peso = Math.min(palabra.length, 8);
    total += peso;
    if (palabrasTexto.some((otra) => palabrasIguales(palabra, otra))) {
      encontrado += peso;
    }
  });

  return total === 0 ? 0 : encontrado / total;
};

/**
 * Puntúa cuánto se parece lo que escribió el director a una canción concreta.
 *
 * Se evalúan varias señales independientes y gana la más alta, porque los dos
 * casos reales son distintos: "Te Alabaré" (el título) y "voy a perder la
 * compostura" (un verso). Penalizar uno por el otro sería un error.
 *
 * @returns {{score: number, razon: string}} score de 0 a 1
 */
export const puntuarCoincidencia = (consulta, cancion) => {
  const q = normalizarTexto(consulta);
  if (!q) return { score: 0, razon: 'vacia' };

  const titulo = normalizarTexto(cancion?.title);
  const letra = normalizarTexto(cancion?.lyricsOnly);
  const palabrasQ = q.split(' ').filter(Boolean);

  const señales = [];

  if (titulo) {
    if (titulo === q) señales.push({ score: 1, razon: 'titulo exacto' });
    else if (titulo.includes(q) || q.includes(titulo)) {
      señales.push({ score: 0.88, razon: 'titulo contiene' });
    }
    señales.push({
      score: 0.8 * cobertura(palabrasQ, titulo.split(' ')),
      razon: 'palabras del titulo'
    });
  }

  if (letra) {
    // El caso más frecuente: el director escribe un verso literal
    if (letra.includes(q)) señales.push({ score: 0.85, razon: 'verso de la letra' });
    señales.push({
      score: 0.7 * cobertura(palabrasQ, letra.split(' ')),
      razon: 'palabras de la letra'
    });
  }

  return señales.reduce(
    (mejor, s) => (s.score > mejor.score ? s : mejor),
    { score: 0, razon: 'sin coincidencia' }
  );
};

// Por encima de esto se da por buena; por debajo del mínimo, ni se ofrece.
export const UMBRAL_SEGURO = 0.62;
export const UMBRAL_MINIMO = 0.34;

/**
 * Empareja una entrada suelta con el repertorio.
 *
 * @param {string} consulta - Lo que escribió el director
 * @param {Array} repertorio - Canciones disponibles
 * @returns {{candidatos: Array, elegida: Object|null, seguro: boolean}}
 */
export const buscarCandidatos = (consulta, repertorio = []) => {
  const candidatos = repertorio
    .map((cancion) => ({ cancion, ...puntuarCoincidencia(consulta, cancion) }))
    .filter((c) => c.score >= UMBRAL_MINIMO)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const mejor = candidatos[0] || null;

  return {
    candidatos,
    elegida: mejor ? mejor.cancion : null,
    seguro: Boolean(mejor && mejor.score >= UMBRAL_SEGURO)
  };
};

/**
 * Interpreta la lista entera y la empareja con el repertorio.
 *
 * No decide por el usuario: devuelve lo que encontró y con cuánta confianza,
 * para que la interfaz pueda enseñar lo dudoso y dejar corregirlo.
 *
 * @param {string} texto - La lista del director
 * @param {Array} repertorio - Canciones disponibles
 * @returns {Array<{consulta, key, candidatos, elegida, seguro, linea}>}
 */
export const emparejarSetlist = (texto, repertorio = []) =>
  parsearSetlist(texto).map((entrada) => ({
    ...entrada,
    ...buscarCandidatos(entrada.consulta, repertorio)
  }));

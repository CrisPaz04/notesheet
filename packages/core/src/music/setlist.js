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
 * ¿Es esta línea el nombre de un bloque ("*Intro", "*Rápidas*")? Devuelve el
 * nombre sin asteriscos, o null.
 *
 * El director separa la lista por momentos del servicio marcándolos con un
 * asterisco, que en WhatsApp es la negrita. No son canciones: sin esto,
 * "*Lentas" se buscaba en el repertorio como si lo fuera.
 */
export const parsearCabecera = (linea) => {
  const m = /^\s*\*+\s*([^*]+?)\s*\**\s*$/.exec(linea || '');
  return m ? m[1] : null;
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
    if (!linea || parsearCabecera(linea)) return;

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
  // "Por quién eres tú (Coalo)", "Camino al Cielo yo voy (yo tengo gozo)".
  // Lo que va entre paréntesis puede ser ruido (el artista, "versión nueva")
  // o justo lo que identifica la canción (otro título, un verso). Se prueba
  // con la línea entera, sin el paréntesis y con solo el paréntesis, y gana
  // la mejor: así el ruido no resta y la pista sí suma.
  const dentro = entreParentesis(consulta);
  if (dentro.length === 0) return puntuarUna(consulta, cancion);

  const fuera = (consulta || '').replace(/\([^)]*\)?/g, ' ');
  const mejor = [consulta, fuera, ...dentro]
    .filter((v) => normalizarTexto(v))
    .map((v) => puntuarUna(v, cancion))
    .reduce((m, r) => (r.score > m.score ? r : m));

  // El paréntesis suele ser el autor: "Por quién eres tú (Coalo)" es la de
  // Coalo Zamorano. No sube la puntuación (el título ya dice qué canción
  // es), pero desempata entre dos versiones con el mismo título.
  return { ...mejor, autor: dentro.some((d) => coincideAutor(d, cancion)) };
};

const entreParentesis = (texto) => (
  [...(texto || '').matchAll(/\(([^)]*)\)/g)].map((m) => m[1])
);

/** ¿Lo que escribió está en el "Versión de" de la canción? "Coalo" → "Coalo Zamorano". */
const coincideAutor = (texto, cancion) => {
  const t = normalizarTexto(texto);
  if (t.length < 3) return false;
  const autores = [
    ...(Array.isArray(cancion?.versiones) ? cancion.versiones : []),
    ...String(cancion?.version || '').split(',')
  ].map(normalizarTexto).filter(Boolean);
  return autores.some((a) => a.includes(t) || t.includes(a));
};

const puntuarUna = (consulta, cancion) => {
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
    // A igual puntuación, la del autor que indicó el director
    .sort((a, b) => (b.score - a.score) || (Number(Boolean(b.autor)) - Number(Boolean(a.autor))))
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

/**
 * El mensaje del director, línea a línea, listo para enseñarlo tal cual.
 *
 * Es lo que se ve en el panel "Lista" durante el servicio: el mismo texto que
 * mandó por WhatsApp, con sus bloques y sus tonalidades, pero con cada
 * canción enlazada a la suya. Los enlaces no se vuelven a adivinar aquí: son
 * los que el músico confirmó al importar (`linea` → id de canción), que para
 * eso los revisó.
 *
 * @param {string} texto - El mensaje tal cual
 * @param {Object<string, string>} [enlaces] - Número de línea → id de canción
 * @returns {Array<{tipo: 'seccion'|'tonalidad'|'cancion', texto: string,
 *                  linea: number, key?: string, songId?: string|null}>}
 */
export const estructurarMensaje = (texto, enlaces = {}) => {
  const lineas = [];

  (texto || '').split('\n').forEach((lineaCruda, i) => {
    const linea = lineaCruda.trim();
    if (!linea) return;
    const numero = i + 1;

    const cabecera = parsearCabecera(linea);
    if (cabecera) {
      lineas.push({ tipo: 'seccion', texto: cabecera, linea: numero });
      return;
    }

    const tonalidad = parsearTonalidad(linea);
    if (tonalidad) {
      lineas.push({ tipo: 'tonalidad', texto: linea, key: tonalidad, linea: numero });
      return;
    }

    lineas.push({
      tipo: 'cancion',
      texto: linea,
      linea: numero,
      songId: enlaces?.[numero] || enlaces?.[String(numero)] || null
    });
  });

  return lineas;
};

// Un mensaje de WhatsApp con la lista del domingo no pasa de unos cientos de
// caracteres. El tope es por si alguien pega otra cosa: el documento de la
// lista viaja entero a cada músico, y en la sesión en vivo a cada latido.
const MENSAJE_MAX = 4000;

/**
 * El mensaje del director tal y como se guarda: `{ texto, enlaces }`, o null
 * si no hay nada. Los enlaces (nº de línea → id de canción) son solo los que
 * apuntan a una línea que existe y a un id con forma de id.
 *
 * @param {*} mensaje
 * @returns {{texto: string, enlaces: Object<string, string>}|null}
 */
export const limpiarMensajeDirector = (mensaje) => {
  const texto = typeof mensaje?.texto === 'string' ? mensaje.texto.slice(0, MENSAJE_MAX) : '';
  if (!texto.trim()) return null;

  const totalLineas = texto.split('\n').length;
  const enlaces = {};
  Object.entries(mensaje?.enlaces || {}).forEach(([linea, songId]) => {
    const n = Number(linea);
    if (Number.isInteger(n) && n >= 1 && n <= totalLineas
        && typeof songId === 'string' && songId && songId.length <= 128) {
      enlaces[String(n)] = songId;
    }
  });

  return { texto, enlaces };
};

// packages/core/src/music/scores.js
//
// Partituras en PDF: la matriz de archivos de una cancion y como se elige uno.
//
// Una cancion en PDF no es un tipo nuevo de elemento: es una cancion cuyo
// cuerpo esta en otro formato. Por eso entra en las listas sin tocar nada.
// Lo que cambia es de donde sale el contenido:
//
//   format: "pdf"
//   pdfs: {
//     bb_trumpet: {
//       "1": { partitura: "partituras/abc/bb_trumpet-1-partitura.pdf",
//              conNotas:  "partituras/abc/bb_trumpet-1-conNotas.pdf" },
//       "2": { partitura: "..." }
//     }
//   }
//
// Tres ejes: instrumento x numero de voz x variante. La variante "conNotas"
// lleva los nombres de las notas escritos encima del pentagrama, para quien
// todavia no lee partitura.
//
// Aqui no se toca Firebase ni React: solo se decide que archivo toca. Asi se
// puede probar de verdad.

/**
 * Variantes de una misma voz, en el orden en que se ofrecen.
 * `partitura` es la normal; `conNotas` lleva los nombres encima.
 */
export const SCORE_VARIANTS = ['partitura', 'conNotas'];

export const SCORE_VARIANT_LABELS = {
  partitura: 'Partitura',
  conNotas: 'Con nombres de notas'
};

export const DEFAULT_SCORE_VARIANT = 'partitura';

/** Formato del cuerpo de una cancion. */
export const SONG_FORMAT_CHORDS = 'chords';
export const SONG_FORMAT_PDF = 'pdf';

/**
 * Formato de una cancion. Las 118 importadas no tienen el campo: la ausencia
 * cuenta como acordes, igual que la ausencia de `public` cuenta como privada.
 * Asi no hay que migrar nada.
 *
 * @param {Object} song
 * @returns {'chords'|'pdf'}
 */
export const getSongFormat = (song) => (
  song?.format === SONG_FORMAT_PDF ? SONG_FORMAT_PDF : SONG_FORMAT_CHORDS
);

/** @returns {boolean} true si el cuerpo de la cancion son PDF. */
export const isPdfSong = (song) => getSongFormat(song) === SONG_FORMAT_PDF;

/**
 * Ruta en Storage de una partitura. La ruta la manda el codigo, no el nombre
 * del archivo que suba el usuario: asi dos subidas a la misma casilla se
 * pisan en vez de acumular basura, y la regla de seguridad puede sacar el
 * `songId` de la propia ruta.
 *
 * @param {string} songId
 * @param {string} instrumentId
 * @param {string|number} voiceNumber
 * @param {string} variant
 * @returns {string}
 */
export const buildScorePath = (songId, instrumentId, voiceNumber, variant) => (
  `partituras/${songId}/${instrumentId}-${voiceNumber}-${variant}.pdf`
);

/**
 * Ordena numeros de voz. Un `.sort()` pelado los ordena como texto y pondria
 * la voz 10 antes que la 2. Hoy el editor solo ofrece de la 1 a la 4, pero el
 * mapa lo escribe Firestore y no tiene por que quedarse ahi.
 *
 * Para todo lo demas devuelve 0, que deja el orden que ya traiga
 * `Object.keys`: las claves enteras primero y en orden ascendente, y detras
 * las que no lo sean. Es justo donde queremos una voz con nombre, y evita
 * escribir ramas que `Object.keys` no llega a ejercitar nunca.
 */
const compareVoiceNumbers = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return 0;
};

/**
 * Lista plana de las voces que tienen PDF, ordenada por instrumento y numero.
 * Es el equivalente de `buildVoicesList` para el mapa `pdfs`, y devuelve
 * ademas que variantes existen en cada casilla.
 *
 * Una casilla sin ninguna variante (mapa vacio) no aparece: no hay nada que
 * mostrar y ofrecerla seria mandar al musico a una pantalla en blanco.
 *
 * @param {Object} pdfs - Mapa `{ instrumento: { voz: { variante: ruta } } }`
 * @param {Object} instrumentCatalog - Mapa de instrumentos, para los nombres
 * @returns {Array<{id: string, instrumentId: string, voiceNumber: string,
 *                  label: string, variants: string[]}>}
 */
export const buildScoreVoicesList = (pdfs, instrumentCatalog = {}) => {
  if (!pdfs) return [];

  const list = [];
  Object.keys(pdfs).sort().forEach((instrumentId) => {
    const porVoz = pdfs[instrumentId];
    if (!porVoz) return;

    Object.keys(porVoz).sort(compareVoiceNumbers).forEach((voiceNumber) => {
      const variants = SCORE_VARIANTS.filter((v) => porVoz[voiceNumber]?.[v]);
      if (variants.length === 0) return;

      const instrumentName = instrumentCatalog[instrumentId]?.name || instrumentId;
      list.push({
        id: `${instrumentId}-${voiceNumber}`,
        instrumentId,
        voiceNumber,
        label: `${instrumentName} ${voiceNumber}`,
        variants
      });
    });
  });

  return list;
};

/**
 * Elige que PDF mostrar al abrir una cancion.
 *
 * El orden de preferencia para la voz:
 *   1. La que ya estaba seleccionada, si sigue existiendo.
 *   2. La del instrumento del musico (`instrument`). En una cancion de texto
 *      esa preferencia sirve para transponer; en un PDF no hay nada que
 *      transponer, asi que lo que hace es elegir el archivo. Es justo lo que
 *      se quiere: el trombonista abre el popurri y le sale la de trombon.
 *   3. La voz principal de la cancion.
 *   4. La primera que haya.
 *
 * Y para la variante: la pedida si existe, y si no la otra, avisando. Caerse
 * a la que hay es mejor que una pantalla en blanco, pero callarselo no.
 *
 * @param {Object} song - Cancion cargada (con `pdfs`)
 * @param {Object} [options]
 * @param {string|null} [options.voiceKey] - Voz ya seleccionada ("bb_trumpet-1")
 * @param {string} [options.variant] - Variante preferida del musico
 * @param {string|null} [options.instrument] - Instrumento preferido del musico
 * @returns {{path: string|null, voiceKey: string|null, variant: string|null,
 *            requestedVariant: string, variantFallback: boolean}}
 */
export const resolveScore = (song, {
  voiceKey = null,
  variant = DEFAULT_SCORE_VARIANT,
  instrument = null
} = {}) => {
  const requestedVariant = SCORE_VARIANTS.includes(variant)
    ? variant
    : DEFAULT_SCORE_VARIANT;

  const vacio = {
    path: null,
    voiceKey: null,
    variant: null,
    requestedVariant,
    variantFallback: false
  };

  const pdfs = song?.pdfs;
  if (!pdfs) return vacio;

  const disponibles = buildScoreVoicesList(pdfs);
  if (disponibles.length === 0) return vacio;

  const buscar = (id) => disponibles.find((v) => v.id === id) || null;

  // 1. La voz que ya estaba seleccionada
  let elegida = voiceKey ? buscar(voiceKey) : null;

  // 2. El instrumento del musico: su voz principal si la cancion la declara
  //    para ese instrumento, y si no la primera que tenga
  if (!elegida && instrument) {
    elegida = buscar(`${instrument}-${song.primaryVoiceNumber}`)
      || disponibles.find((v) => v.instrumentId === instrument)
      || null;
  }

  // 3. La voz principal de la cancion
  if (!elegida && song.primaryInstrument) {
    elegida = buscar(`${song.primaryInstrument}-${song.primaryVoiceNumber}`)
      || disponibles.find((v) => v.instrumentId === song.primaryInstrument)
      || null;
  }

  // 4. La primera que haya
  if (!elegida) elegida = disponibles[0];

  const casilla = pdfs[elegida.instrumentId][elegida.voiceNumber];
  const variantFallback = !casilla[requestedVariant];
  const variantFinal = variantFallback ? elegida.variants[0] : requestedVariant;

  return {
    path: casilla[variantFinal],
    voiceKey: elegida.id,
    variant: variantFinal,
    requestedVariant,
    variantFallback
  };
};

/**
 * Coloca la ruta de una partitura en el mapa `pdfs`, sin mutar el original.
 *
 * @param {Object} pdfs - Mapa actual (puede ser undefined)
 * @param {string} instrumentId
 * @param {string|number} voiceNumber
 * @param {string} variant
 * @param {string} path
 * @returns {Object} Mapa nuevo
 */
export const setScoreInMap = (pdfs, instrumentId, voiceNumber, variant, path) => {
  const voz = String(voiceNumber);
  const actual = pdfs || {};

  return {
    ...actual,
    [instrumentId]: {
      ...(actual[instrumentId] || {}),
      [voz]: { ...(actual[instrumentId]?.[voz] || {}), [variant]: path }
    }
  };
};

/**
 * Quita una variante del mapa `pdfs`, sin mutar el original. Si la casilla se
 * queda sin variantes desaparece, y si el instrumento se queda sin voces
 * desaparece tambien: asi el mapa no acumula ramas vacias que luego habria
 * que filtrar en cada sitio que lo recorra.
 *
 * @returns {Object} Mapa nuevo
 */
export const removeScoreFromMap = (pdfs, instrumentId, voiceNumber, variant) => {
  const voz = String(voiceNumber);
  if (!pdfs?.[instrumentId]?.[voz]?.[variant]) return pdfs || {};

  const casilla = { ...pdfs[instrumentId][voz] };
  delete casilla[variant];

  const porVoz = { ...pdfs[instrumentId] };
  if (Object.keys(casilla).length === 0) {
    delete porVoz[voz];
  } else {
    porVoz[voz] = casilla;
  }

  const resultado = { ...pdfs };
  if (Object.keys(porVoz).length === 0) {
    delete resultado[instrumentId];
  } else {
    resultado[instrumentId] = porVoz;
  }

  return resultado;
};

/**
 * Todas las rutas de partitura de una cancion. Sirve para borrarlas de
 * Storage cuando se borra la cancion: sin esto los archivos quedarian ahi
 * ocupando sitio y sin dueno.
 *
 * @param {Object} pdfs
 * @returns {string[]}
 */
export const listScorePaths = (pdfs) => {
  if (!pdfs) return [];

  const rutas = [];
  Object.values(pdfs).forEach((porVoz) => {
    Object.values(porVoz || {}).forEach((casilla) => {
      SCORE_VARIANTS.forEach((variant) => {
        if (casilla?.[variant]) rutas.push(casilla[variant]);
      });
    });
  });

  return rutas;
};

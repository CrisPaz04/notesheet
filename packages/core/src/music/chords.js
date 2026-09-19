// packages/core/src/music/chords.js
//
// Parseo de acordes y detección de líneas de acordes.
//
// El problema que resuelve este módulo: no se puede distinguir un acorde de una
// palabra con solo una expresión regular. "LAm" es un acorde, pero "Amor" o
// "Dame" son letra. Históricamente esto se evitaba con un lookahead negativo
// (`(?![#b\w])`) que impedía convertir o transponer cualquier acorde con sufijo
// ("LAm", "Cmaj7", "DO7"...).
//
// La solución correcta es decidir primero si una línea es de acordes: si todos
// sus tokens son acordes válidos (o separadores), es una línea de acordes y se
// puede transformar sin riesgo; si no, se deja intacta.

// --- Gramática de acordes ----------------------------------------------------

// Las raíces latinas van primero para que "DO" gane sobre "D", "SOL" sobre "S".
// Se aceptan MAYUSCULAS y Capitalizado ("DO" y "Do"), porque mucha gente
// escribe asi los nombres de nota a mano. NO se acepta todo en minusculas:
// "la", "mi", "si" o "sol" son palabras corrientes en espanol y una linea de
// letra entera podria confundirse con notas.
//
// La insensibilidad se limita a la raiz a proposito: en el sufijo, "M" es
// mayor y "m" es menor, asi que ahi la caja distingue.
const ROOT = '(?:DO|Do|RE|Re|MI|Mi|FA|Fa|SOL|Sol|LA|La|SI|Si|[A-G])';
const ACCIDENTAL = '(?:#|b)?';
// "maj" antes que "M"/"m", "min" antes que "m", "dim" antes que "d".
const QUALITY = '(?:maj|Maj|MAJ|min|Min|MIN|dim|Dim|DIM|aug|Aug|AUG|M|m|°|º|ø|[+])?';
// Los multicarácter van primero para que "6/9" no se parta en "6" + bajo "/9".
const EXTENSION = '(?:6[/]9|11|13|2|4|5|6|7|9)?';
const MODIFIERS = '(?:(?:sus|add|omit|no)(?:2|4|6|9|11|13)?|[#b](?:5|9|11|13)|[+-]5)*';
const BASS = `(?:[/]${ROOT}${ACCIDENTAL})?`;

const SUFFIX = `${QUALITY}${EXTENSION}${MODIFIERS}`;

const LATIN_ROOTS = new Set(['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI']);

/** Acorde completo, anclado: raíz + alteración + sufijo + bajo opcional. */
const CHORD_ANCHORED = new RegExp(`^${ROOT}${ACCIDENTAL}${SUFFIX}${BASS}$`);

/** Igual, pero capturando raíz, alteración, sufijo, raíz del bajo y su alteración. */
const CHORD_PARTS = new RegExp(
  `^(${ROOT})((?:#|b)?)(${SUFFIX})(?:[/](${ROOT})((?:#|b)?))?$`
);

/**
 * Tokens que pueden acompañar a los acordes en una línea de acordes sin serlo:
 * barras de compás, repeticiones, guiones, "N.C.", etc.
 */
const FILLER = /^(?:[|:%*\-–—/()[\]]+|\(?[xX]\s?\d+\)?|\(?\d+\s?[xX]\)?|N\.?C\.?)$/;

// Adornos que pueden envolver a un acorde: "(LAm)", "|DO", "C,".
// `//` marca repetición y suele ir pegado a la nota: "//RE" o "RE//".
const LEADING_WRAP = /^[([{|:/]+/;
const TRAILING_WRAP = /[)\]}|:/,.;!?]+$/;

// Metadato de tonalidad: la única línea que empieza con '#' cuyo valor es un acorde.
const KEY_METADATA = /^(\s*#+\s*(?:Tonalidad|Key)\s*:\s*)(.+)$/i;

// Etiqueta de sección seguida de acordes: "Intro: C - G - Am".
const LABEL_PREFIX = /^([^:\n]{1,40}:\s*)(.+)$/;

/**
 * Separa un token en adorno inicial, núcleo y adorno final.
 * @param {string} token
 * @returns {{lead: string, core: string, trail: string}}
 */
const splitToken = (token) => {
  const lead = (token.match(LEADING_WRAP) || [''])[0];
  const rest = token.slice(lead.length);
  const trail = (rest.match(TRAILING_WRAP) || [''])[0];
  return { lead, core: trail ? rest.slice(0, -trail.length) : rest, trail };
};

/**
 * ¿Es este texto un acorde válido? ("LAm", "Cmaj7", "F#m7b5", "DO/SOL"...)
 * @param {string} text - Texto a evaluar
 * @returns {boolean}
 */
export const isChord = (text) => !!text && CHORD_ANCHORED.test(text);

/**
 * ¿Es esta línea una línea de acordes?
 * Lo es si, ignorando separadores ("|", "-", "x2"...), tiene al menos un acorde
 * y todos sus tokens son acordes.
 * @param {string} line - Línea a evaluar
 * @returns {boolean}
 */
export const isChordLine = (line) => {
  if (!line || !line.trim()) return false;

  let chordCount = 0;
  for (const token of line.trim().split(/\s+/)) {
    if (FILLER.test(token)) continue;
    const { core } = splitToken(token);
    if (!core) continue;
    if (!isChord(core)) return false;
    chordCount++;
  }

  return chordCount > 0;
};

/**
 * Localiza la parte de la línea que contiene acordes.
 * @param {string} line - Línea a analizar
 * @returns {{prefix: string, body: string}|null} `null` si no hay acordes que transformar
 */
export const splitChordSegment = (line) => {
  if (!line) return null;

  // Los encabezados y metadatos no se tocan, salvo la tonalidad.
  if (/^\s*#/.test(line)) {
    const keyMatch = KEY_METADATA.exec(line);
    if (keyMatch && isChordLine(keyMatch[2])) {
      return { prefix: keyMatch[1], body: keyMatch[2] };
    }
    return null;
  }

  if (isChordLine(line)) return { prefix: '', body: line };

  const labelMatch = LABEL_PREFIX.exec(line);
  if (labelMatch && isChordLine(labelMatch[2])) {
    return { prefix: labelMatch[1], body: labelMatch[2] };
  }

  return null;
};

/**
 * Aplica `mapRoot` a la raíz de cada acorde de la línea, conservando sufijos
 * ("m", "7", "maj7", "sus4"...), bajos ("/SOL") y el espaciado original.
 * Si la línea no es de acordes, se devuelve tal cual.
 * @param {string} line - Línea a transformar
 * @param {(root: string) => string} mapRoot - Recibe raíz + alteración ("DO#", "Bb")
 * @returns {string} Línea transformada
 */
export const mapChordLine = (line, mapRoot) => {
  const segment = splitChordSegment(line);
  if (!segment) return line;

  const body = segment.body.replace(/\S+/g, (token) => {
    if (FILLER.test(token)) return token;

    const { lead, core, trail } = splitToken(token);
    const parts = core && CHORD_PARTS.exec(core);
    if (!parts) return token;

    const [, root, accidental, suffix, bassRoot, bassAccidental] = parts;
    // Los mapas de conversion y transposicion tienen las claves en mayusculas
    const enMayusculas = (r) => (LATIN_ROOTS.has(r.toUpperCase()) ? r.toUpperCase() : r);

    let chord = mapRoot(enMayusculas(root) + accidental) + suffix;
    if (bassRoot) chord += '/' + mapRoot(enMayusculas(bassRoot) + bassAccidental);

    return lead + chord + trail;
  });

  return segment.prefix + body;
};

/**
 * Cuenta las raíces de acorde por sistema de notación en las líneas de acordes.
 * @param {string} content - Contenido de la canción
 * @returns {{latin: number, english: number}}
 */
export const countChordRoots = (content) => {
  const counts = { latin: 0, english: 0 };
  if (!content) return counts;

  for (const line of content.split('\n')) {
    mapChordLine(line, (root) => {
      counts[LATIN_ROOTS.has(root.replace(/[#b]$/, '')) ? 'latin' : 'english']++;
      return root;
    });
  }

  return counts;
};

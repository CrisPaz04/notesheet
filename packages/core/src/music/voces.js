// packages/core/src/music/voces.js
//
// Qué voz le toca a cada músico de la sección.
//
// Cada uno dice qué número es en el servicio ("soy la trompeta 2") y cada
// canción se ajusta a las voces que tiene: si tu número no está, te toca la
// más alta de las que hay por debajo. Con tres trompetas y una canción a dos
// voces, la 1 lee la voz 1 y la 2 y la 3 leen la voz 2. Con cuatro y tres
// voces: 1, 2, 3, 3.

/** Los números de voz que se pueden elegir. */
export const NUMEROS_DE_VOZ = ['1', '2', '3', '4'];

/**
 * El número de voz que le toca a un músico entre los que tiene la canción.
 *
 * @param {Array<string|number>} disponibles - Números de voz de la canción
 * @param {string|number|null} miNumero - El que eligió el músico
 * @returns {string|null} El número asignado, o null si no hay voces o el
 *   músico no eligió número (entonces manda la regla de siempre)
 */
export const numeroDeVozAsignado = (disponibles, miNumero) => {
  const mio = Number(miNumero);
  if (!miNumero || !Number.isFinite(mio)) return null;

  const numeros = [...new Set((disponibles || []).map(Number).filter(Number.isFinite))]
    .sort((a, b) => a - b);
  if (numeros.length === 0) return null;

  const hastaElMio = numeros.filter((n) => n <= mio);
  // Si la canción solo tiene voces por encima (una "2" y una "3" para la
  // trompeta 1), la más baja de ellas
  return String(hastaElMio.length ? hastaElMio[hastaElMio.length - 1] : numeros[0]);
};

/**
 * La voz de una canción que le toca a un músico por su instrumento y número.
 *
 * Primero entre las voces de su instrumento. Si la canción no tiene ninguna
 * escrita para él (un saxo en una canción solo con trompetas), entre las del
 * instrumento principal, que se le transponen: el saxo 2 lee la segunda voz.
 *
 * @param {Array<{id: string, instrumentId: string, voiceNumber: string}>} voces
 *   Las de `buildVoicesList` o `buildScoreVoicesList`
 * @param {Object} musico
 * @param {string|null} musico.instrument
 * @param {string|null} musico.voiceNumber
 * @param {string|null} [musico.primaryInstrument] - El de la canción
 * @returns {Object|null} Una de `voces`, o null si no hay número elegido o
 *   ninguna encaja (entonces manda la regla de siempre)
 */
export const vozParaMusico = (voces, { instrument, voiceNumber, primaryInstrument = null }) => {
  if (!voiceNumber || !Array.isArray(voces) || voces.length === 0) return null;

  const elegirEntre = (lista) => {
    const numero = numeroDeVozAsignado(lista.map((v) => v.voiceNumber), voiceNumber);
    return numero ? lista.find((v) => String(v.voiceNumber) === numero) || null : null;
  };

  const propias = voces.filter((v) => v.instrumentId === instrument);
  if (propias.length > 0) return elegirEntre(propias);

  const principales = voces.filter((v) => v.instrumentId === primaryInstrument);
  if (principales.length > 0) return elegirEntre(principales);

  return null;
};

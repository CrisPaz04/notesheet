// Comprueba el repertorio importado (`scripts/repertorio/repertorio.json`)
// contra el pipeline real de la app, no contra una copia de la gramática.
//
// `scripts/validate-songs.mjs` reimplementa el reconocimiento de acordes con su
// propia expresión regular porque corre suelto, sin bundler. Eso vale para
// revisar un lote antes de importarlo, pero las dos gramáticas pueden separarse.
// Aquí se usa la de verdad: si alguien toca `chords.js` o `transposition.js` y
// deja de reconocer cómo está escrito este repertorio, salta aquí.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { cwd } from 'node:process';
import { isChordLine, transposeForInstrument, transposeContent } from '@notesheet/core';
import { renderSongContent } from '../../../../packages/core/src/music/songRendering.js';

// Se busca hacia arriba porque los tests se lanzan tanto desde `apps/web` como
// desde la raíz del monorepo, y `import.meta.url` no es una ruta de archivo
// cuando vitest transforma el módulo.
const buscarArriba = (relativa) => {
  let dir = resolve(cwd());
  for (let i = 0; i < 6; i += 1) {
    const candidata = join(dir, relativa);
    if (existsSync(candidata)) return candidata;
    const padre = dirname(dir);
    if (padre === dir) break;
    dir = padre;
  }
  throw new Error(`No se encontró ${relativa} desde ${cwd()}`);
};

const CANCIONES = JSON.parse(readFileSync(buscarArriba('scripts/repertorio/repertorio.json'), 'utf8'));

// Las tonalidades a las que la banda suele mover una canción.
const TONOS = ['DO', 'RE', 'MI', 'FA', 'SOL', 'LA', 'SI', 'FA#', 'SIb', 'MIb', 'LAb'];
const INSTRUMENTOS = ['eb_alto_sax', 'c_flute', 'f_horn', 'bb_trombone', 'bb_tenor_sax'];

// Una doble alteración ("FA##", "SIbb") es la señal de que la transposición se
// ha ido: la app no sabe mostrarlas y el músico no sabe tocarlas.
const DOBLE_ALTERACION = /(DO|RE|MI|FA|SOL|LA|SI|[A-G])(##|bb)/;

const lineasDeMusica = (contenido) =>
  contenido.split('\n').filter((l) => l.trim() && !l.startsWith('##'));

// Altura de cada nota, para comparar dos versiones de la misma melodía sin que
// estorbe la enarmonía: al transponer, "SIb" y "LA#" son la misma tecla y la
// app elige una u otra según la tonalidad. Las claves van del todo en
// mayúsculas ("SIB", no "SIb") porque el nombre se normaliza antes de buscarlo.
const ALTURAS = {
  DO: 0, 'DO#': 1, REB: 1, RE: 2, 'RE#': 3, MIB: 3, MI: 4, FA: 5,
  'FA#': 6, SOLB: 6, SOL: 7, 'SOL#': 8, LAB: 8, LA: 9, 'LA#': 10, SIB: 10, SI: 11,
  DOB: 11, 'MI#': 5, 'SI#': 0, FAB: 4
};

// La raíz va en MAYÚSCULAS o Capitalizada, como en las partituras; la app las
// normaliza a mayúsculas al transponer, así que aquí se acepta cualquiera de
// las dos y se compara ya normalizado.
const RAIZ = /^[([{|:/]*((?:DO|Do|RE|Re|MI|Mi|FA|Fa|SOL|Sol|LA|La|SI|Si)(?:#|b)?)/;

/** Las alturas de todas las notas de un contenido, en orden. */
const alturasDe = (contenido) =>
  lineasDeMusica(contenido)
    .filter(isChordLine)
    .flatMap((linea) => linea.trim().split(/\s+/))
    .map((token) => (RAIZ.exec(token) || [])[1])
    .filter(Boolean)
    .map((nota) => {
      const altura = ALTURAS[nota.toUpperCase()];
      if (altura === undefined) throw new Error(`Nota desconocida: ${nota}`);
      return altura;
    });

describe('repertorio importado', () => {
  it('tiene canciones', () => {
    expect(CANCIONES.length).toBeGreaterThan(0);
  });

  it('no repite títulos: el importador salta el segundo y se perdería', () => {
    const vistos = CANCIONES.map((c) => c.title.trim().toLowerCase());
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  // Comprobar solo que cada canción tiene "alguna" línea de acordes no sirve:
  // se puede estropear una línea suelta y el test sigue pasando. Con la cuenta
  // exacta, cualquier línea que deje de reconocerse mueve el número.
  //
  // Las que no son de acordes son letra o pistas de letra, escritas a mano en
  // la partitura. Si cambias el repertorio, actualiza los dos números.
  it('la app reconoce exactamente las mismas líneas que el día que se importó', () => {
    let acordes = 0;
    let letra = 0;

    CANCIONES.forEach((cancion) => {
      const textos = cancion.voices?.bb_trumpet
        ? Object.values(cancion.voices.bb_trumpet)
        : [cancion.content];

      textos.forEach((texto) => {
        lineasDeMusica(texto).forEach((linea) => {
          if (isChordLine(linea)) acordes += 1;
          else letra += 1;
        });
      });
    });

    expect({ acordes, letra }).toEqual({ acordes: 1509, letra: 109 });
  });

  CANCIONES.forEach((cancion) => {
    describe(cancion.title, () => {
      const voces = cancion.voices?.bb_trumpet
        ? Object.entries(cancion.voices.bb_trumpet).map(([n, t]) => [`voz ${n}`, t])
        : [['contenido', cancion.content]];

      voces.forEach(([donde, texto]) => {
        it(`${donde}: la app reconoce sus líneas de acordes`, () => {
          const acordes = lineasDeMusica(texto).filter(isChordLine);
          expect(acordes.length).toBeGreaterThan(0);
        });

        it(`${donde}: se transpone a cualquier tonalidad y vuelve igual`, () => {
          const original = alturasDe(texto);

          TONOS.forEach((tono) => {
            const movida = transposeContent(texto, cancion.key, tono);
            expect(movida, `a ${tono}`).not.toMatch(DOBLE_ALTERACION);

            // Toda la melodía tiene que moverse el mismo intervalo: si una nota
            // se va por su cuenta, la canción suena mal en esa tonalidad.
            const alturas = alturasDe(movida);
            expect(alturas.length, `a ${tono} cambia el número de notas`).toBe(original.length);
            const salto = (alturas[0] - original[0] + 12) % 12;
            alturas.forEach((altura, i) => {
              expect((altura - original[i] + 12) % 12, `a ${tono}, nota ${i + 1}`).toBe(salto);
            });

            // Y al volver tiene que sonar lo mismo que al empezar.
            expect(alturasDe(transposeContent(movida, tono, cancion.key)), `ida y vuelta por ${tono}`)
              .toEqual(original);
          });
        });

        it(`${donde}: se adapta a cualquier instrumento de la banda`, () => {
          INSTRUMENTOS.forEach((instrumento) => {
            expect(transposeForInstrument(texto, 'bb_trumpet', instrumento), instrumento)
              .not.toMatch(DOBLE_ALTERACION);
          });
        });
      });

      it('se muestra con contenido en todas sus secciones', () => {
        const { formatted } = renderSongContent(cancion.content, {
          baseKey: cancion.key,
          targetKey: cancion.key
        });
        expect(formatted.sections.length).toBeGreaterThan(0);
        expect(formatted.sections.map((s) => s.content).join('').trim()).not.toBe('');
      });
    });
  });
});

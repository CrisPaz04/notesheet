// Tests de propiedades (fast-check): en vez de unos ejemplos elegidos a mano,
// una regla que tiene que cumplirse con cualquier entrada, y el generador
// busca la que la rompe. Cuando encuentra una, la reduce al caso más pequeño
// y la imprime; para repetirla, `fc.assert(..., { seed })` con la semilla que
// sale en el error.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  transposeBySemitones,
  ortografiaDe,
  transponerTonalidad,
  leerTonalidad,
  mismaTonalidad,
  nombrarNota,
  convertNotationSystem,
  numeroDeVozAsignado,
  limpiarVersiones,
  leerVersiones,
  unirVersiones,
  interpretarNombrePdf,
  limpiarMensajeDirector,
  normalizarBusqueda,
} from '@notesheet/core';
import { separar, HUECO } from '../components/herramientas/colocarPaneles';

// 100 casos por propiedad en el día a día; para una pasada larga,
// FC_RUNS=5000 npx vitest run src/test/propiedades.test.js
fc.configureGlobal({ numRuns: Number(globalThis.process?.env?.FC_RUNS) || 100 });

// --- Generadores -----------------------------------------------------------

// Todas las formas de escribir una tecla que entiende la app, raras incluidas
const NOTAS = [
  'DO', 'DO#', 'REb', 'RE', 'RE#', 'MIb', 'MI', 'MI#', 'FAb', 'FA', 'FA#', 'SOLb',
  'SOL', 'SOL#', 'LAb', 'LA', 'LA#', 'SIb', 'SI', 'SI#', 'DOb',
];
const nota = fc.constantFrom(...NOTAS);

// Una línea de melodía como las del repertorio: "RE# MI FA# SOL#"
const lineaDeNotas = fc.array(nota, { minLength: 1, maxLength: 8 }).map((ns) => ns.join(' '));

// Letra: palabras que empiezan como una nota ("Amor", "Dame", "Solo", "Mira")
// y que el transpositor no puede tocar
const PALABRAS = ['Amor', 'Dame', 'Solo', 'Mira', 'Fiel', 'Señor', 'Rey', 'Sion', 'gloria', 'cantaré', 'Dios', 'Santo', 'Reina', 'alaba'];
const lineaDeLetra = fc.array(fc.constantFrom(...PALABRAS), { minLength: 2, maxLength: 6 }).map((ps) => ps.join(' '));

const contenido = fc
  .array(fc.oneof(lineaDeNotas, lineaDeLetra, fc.constant('## Coro'), fc.constant('')), { minLength: 1, maxLength: 10 })
  .map((ls) => ls.join('\n'));

const semitonos = fc.integer({ min: -11, max: 11 }).filter((n) => n !== 0);

// Las tonalidades con nombre habitual, mayores y menores
const TONALIDADES = [
  'DO', 'SOL', 'RE', 'LA', 'MI', 'SI', 'FA#', 'SOLb', 'REb', 'DO#', 'LAb', 'MIb', 'SIb', 'FA',
  'LAm', 'MIm', 'SIm', 'FA#m', 'DO#m', 'SOL#m', 'RE#m', 'MIbm', 'SIbm', 'FAm', 'DOm', 'SOLm', 'REm',
];
const tonalidad = fc.constantFrom(...TONALIDADES);

// La tecla (0–11) de una nota escrita, por un camino distinto al del transpositor
const tecla = (n) => leerTonalidad(n)?.indice;
const teclas = (texto) =>
  texto.split('\n').flatMap((l) => (/^[A-Z]{2}/.test(l) && !l.startsWith('##') && NOTAS.includes(l.split(' ')[0]) ? l.split(' ').map(tecla) : []));

// --- Transposición ---------------------------------------------------------

describe('propiedades: transposición', () => {
  it('ida y vuelta: subir n y bajar n devuelve las mismas teclas', () => {
    fc.assert(
      fc.property(contenido, semitonos, tonalidad, (c, n, t) => {
        const ida = transposeBySemitones(c, n, ortografiaDe(t));
        const vuelta = transposeBySemitones(ida, -n, ortografiaDe(t));
        expect(teclas(vuelta)).toEqual(teclas(c));
      })
    );
  });

  it('dos saltos seguidos suenan como uno solo de la suma', () => {
    fc.assert(
      fc.property(contenido, semitonos, semitonos, (c, a, b) => {
        const enDos = transposeBySemitones(transposeBySemitones(c, a), b);
        const enUno = transposeBySemitones(c, a + b);
        expect(teclas(enDos)).toEqual(teclas(enUno));
      })
    );
  });

  it('cada nota sube exactamente n semitonos', () => {
    fc.assert(
      fc.property(lineaDeNotas, semitonos, tonalidad, (l, n, t) => {
        const movida = transposeBySemitones(l, n, ortografiaDe(t));
        const esperadas = l.split(' ').map((x) => (((tecla(x) + n) % 12) + 12) % 12);
        expect(movida.split(' ').map(tecla)).toEqual(esperadas);
      })
    );
  });

  it('la letra, las cabeceras y las líneas vacías no se tocan', () => {
    fc.assert(
      fc.property(contenido, semitonos, tonalidad, (c, n, t) => {
        const movida = transposeBySemitones(c, n, ortografiaDe(t)).split('\n');
        c.split('\n').forEach((linea, i) => {
          const esNotas = NOTAS.includes(linea.split(' ')[0]);
          if (!esNotas) expect(movida[i]).toBe(linea);
        });
        expect(movida).toHaveLength(c.split('\n').length);
      })
    );
  });
});

// --- Ortografía ------------------------------------------------------------

describe('propiedades: ortografía', () => {
  it('cada nombre de la ortografía de una tonalidad suena en su tecla, sin dobles alteraciones', () => {
    fc.assert(
      fc.property(tonalidad, fc.integer({ min: 0, max: 11 }), (t, i) => {
        const nombre = nombrarNota(i, ortografiaDe(t));
        expect(tecla(nombre)).toBe(i);
        expect(nombre).not.toMatch(/##|bb$/);
      })
    );
  });

  it('una escala mayor usa las siete letras, una vez cada una', () => {
    const mayor = fc.constantFrom(...TONALIDADES.filter((t) => !t.endsWith('m')));
    fc.assert(
      fc.property(mayor, (t) => {
        const o = ortografiaDe(t);
        const tonica = tecla(t);
        const letras = [0, 2, 4, 5, 7, 9, 11].map((g) => o[(tonica + g) % 12].replace(/[#b]$/, ''));
        expect(new Set(letras).size).toBe(7);
      })
    );
  });

  it('transponer una tonalidad es ida y vuelta, y conserva el modo', () => {
    fc.assert(
      fc.property(tonalidad, semitonos, (t, n) => {
        const ida = transponerTonalidad(t, n);
        expect(ida.endsWith('m')).toBe(t.endsWith('m'));
        expect(mismaTonalidad(transponerTonalidad(ida, -n), t)).toBe(true);
      })
    );
  });

  it('el nombre de una tonalidad transpuesta es siempre uno de los habituales', () => {
    fc.assert(
      fc.property(tonalidad, semitonos, (t, n) => {
        expect(TONALIDADES).toContain(transponerTonalidad(t, n));
      })
    );
  });
});

// --- Paneles flotantes -----------------------------------------------------

// Paneles de un lado de la pantalla, con alturas y posiciones cualesquiera
const LIM = { minTop: 8, maxBottom: 724 };
const panelesQueCaben = fc
  .array(fc.record({ top: fc.integer({ min: -100, max: 900 }), alto: fc.integer({ min: 60, max: 320 }) }), { minLength: 1, maxLength: 4 })
  .filter((ps) => ps.reduce((s, p) => s + p.alto, 0) + HUECO * (ps.length - 1) <= LIM.maxBottom - LIM.minTop)
  .chain((ps) => fc.tuple(fc.constant(ps.map((p, i) => ({ ...p, id: `p${i}` }))), fc.integer({ min: 0, max: ps.length - 1 })));

describe('propiedades: paneles flotantes', () => {
  it('si caben todos, ninguno se sale de la pantalla', () => {
    fc.assert(
      fc.property(panelesQueCaben, ([ps, i]) => {
        const tops = separar(ps, ps[i].id, LIM);
        ps.forEach((p) => {
          expect(tops[p.id]).toBeGreaterThanOrEqual(LIM.minTop);
          expect(tops[p.id] + p.alto).toBeLessThanOrEqual(LIM.maxBottom);
        });
      })
    );
  });

  it('si caben todos, ninguno pisa a otro y entre dos queda el hueco', () => {
    fc.assert(
      fc.property(panelesQueCaben, ([ps, i]) => {
        const tops = separar(ps, ps[i].id, LIM);
        const ordenados = ps.map((p) => ({ top: tops[p.id], alto: p.alto })).sort((a, b) => a.top - b.top);
        for (let k = 1; k < ordenados.length; k++) {
          expect(ordenados[k].top).toBeGreaterThanOrEqual(ordenados[k - 1].top + ordenados[k - 1].alto + HUECO);
        }
      })
    );
  });
});

// --- Notación --------------------------------------------------------------

describe('propiedades: notación', () => {
  it('DO-RE-MI → C-D-E → DO-RE-MI deja el contenido como estaba', () => {
    fc.assert(
      fc.property(contenido, (c) => {
        expect(convertNotationSystem(convertNotationSystem(c, 'english'), 'latin')).toBe(c);
      })
    );
  });

  it('pasar a C-D-E no toca la letra ni las cabeceras', () => {
    fc.assert(
      fc.property(contenido, (c) => {
        const en = convertNotationSystem(c, 'english').split('\n');
        c.split('\n').forEach((linea, i) => {
          if (!NOTAS.includes(linea.split(' ')[0])) expect(en[i]).toBe(linea);
        });
      })
    );
  });
});

// --- Voces -----------------------------------------------------------------

// Los números de voz que tiene una canción (1 a 6, sin orden, con repetidos)
const vocesDisponibles = fc.array(fc.integer({ min: 1, max: 6 }), { minLength: 1, maxLength: 6 });
const miNumero = fc.integer({ min: 1, max: 6 });

describe('propiedades: qué voz lee cada músico', () => {
  it('siempre toca una de las voces que tiene la canción', () => {
    fc.assert(
      fc.property(vocesDisponibles, miNumero, (vs, n) => {
        expect(vs.map(String)).toContain(numeroDeVozAsignado(vs, n));
      })
    );
  });

  it('nunca una voz más alta que la tuya, si la canción tiene alguna igual o más baja', () => {
    fc.assert(
      fc.property(vocesDisponibles, miNumero, (vs, n) => {
        if (vs.some((v) => v <= n)) expect(Number(numeroDeVozAsignado(vs, n))).toBeLessThanOrEqual(n);
      })
    );
  });

  it('un número más alto nunca recibe una voz más baja', () => {
    fc.assert(
      fc.property(vocesDisponibles, miNumero, miNumero, (vs, a, b) => {
        const [bajo, alto] = a <= b ? [a, b] : [b, a];
        expect(Number(numeroDeVozAsignado(vs, alto))).toBeGreaterThanOrEqual(Number(numeroDeVozAsignado(vs, bajo)));
      })
    );
  });

  it('el orden en que estén guardadas las voces no cambia nada', () => {
    fc.assert(
      fc.property(vocesDisponibles, miNumero, (vs, n) => {
        expect(numeroDeVozAsignado([...vs].reverse(), n)).toBe(numeroDeVozAsignado(vs, n));
      })
    );
  });
});

// --- "Versión de" ----------------------------------------------------------

// Nombres con espacios de más, mayúsculas y tildes, pero sin comas (la coma es
// el separador del campo `version`)
const nombreVersion = fc
  .array(fc.constantFrom('Elim', 'elim', 'Honduras', 'Coalo', 'Zamorano', 'Ebenezer', 'José', 'Jose', 'Marcos', 'Witt'), { minLength: 1, maxLength: 3 })
  .chain((ps) => fc.constantFrom(ps.join(' '), ` ${ps.join('  ')} `));
const nombresVersion = fc.array(fc.oneof(nombreVersion, fc.constant(''), fc.constant('   ')), { maxLength: 5 });

describe('propiedades: "Versión de"', () => {
  it('limpiar dos veces es lo mismo que limpiar una', () => {
    fc.assert(
      fc.property(nombresVersion, (ns) => {
        expect(limpiarVersiones(limpiarVersiones(ns))).toEqual(limpiarVersiones(ns));
      })
    );
  });

  it('una canción vieja (solo `version`) lee los mismos nombres que se guardaron', () => {
    fc.assert(
      fc.property(nombresVersion, (ns) => {
        expect(leerVersiones({ version: unirVersiones(ns) })).toEqual(limpiarVersiones(ns));
      })
    );
  });

  it('no quedan dos nombres que solo se distingan por mayúsculas o tildes', () => {
    fc.assert(
      fc.property(nombresVersion, (ns) => {
        const claves = limpiarVersiones(ns).map(normalizarBusqueda);
        expect(new Set(claves).size).toBe(claves.length);
      })
    );
  });
});

// --- Nombres de los PDF ----------------------------------------------------

// Cómo nombra la banda cada parte, y qué instrumento es
const PARTES = [
  ['Bb_Trumpet', 'bb_trumpet'], ['Trompeta', 'bb_trumpet'], ['Trombone', 'bb_trombone'],
  ['Alto_Sax', 'eb_alto_sax'], ['Sax_Alto', 'eb_alto_sax'], ['Tenor_Sax', 'bb_tenor_sax'],
  ['Baritone_Sax', 'eb_baritone_sax'], ['Flute', 'c_flute'], ['Clarinet', 'bb_clarinet'],
  ['Horn_in_F', 'f_horn'], ['Piano', 'c_piano'], ['Bass', 'c_bass'],
];
const textoDeNombre = fc
  .array(fc.constantFrom('Alégrense', 'Cristo', 'vive', 'Coalo', 'Zamorano', 'Rey', 'de', 'gloria', 'Salmo', '3', 'Fiesta'), { minLength: 1, maxLength: 4 })
  .map((ps) => ps.join(' '));

describe('propiedades: nombres de los PDF', () => {
  it('se recupera todo lo que lleva el nombre del archivo', () => {
    fc.assert(
      fc.property(
        textoDeNombre, textoDeNombre, fc.constantFrom(...PARTES), fc.integer({ min: 1, max: 4 }),
        fc.boolean(), fc.boolean(), fc.constantFrom('.pdf', '.PDF'),
        (autor, titulo, [parte, instrumentId], voz, conNumero, conNotas, ext) => {
          const nombre = `${autor}--${titulo}--${parte}${conNumero ? `_${voz}` : ''}${conNotas ? '--NN' : ''}${ext}`;
          expect(interpretarNombrePdf(nombre)).toMatchObject({
            autor, titulo, instrumentId,
            voiceNumber: conNumero ? String(voz) : '1',
            variant: conNotas ? 'conNotas' : 'partitura',
            esScore: false,
          });
        }
      )
    );
  });
});

// --- Mensaje del director --------------------------------------------------

const mensaje = fc.record({
  texto: fc.oneof(fc.string({ maxLength: 60 }), fc.array(lineaDeLetra, { maxLength: 6 }).map((ls) => ls.join('\n'))),
  enlaces: fc.dictionary(fc.oneof(fc.integer({ min: -2, max: 9 }).map(String), fc.string({ maxLength: 3 })), fc.oneof(fc.string({ maxLength: 10 }), fc.integer())),
});

describe('propiedades: mensaje del director', () => {
  it('limpiarlo dos veces es lo mismo que una (se limpia al guardar y al abrir la sesión)', () => {
    fc.assert(
      fc.property(mensaje, (m) => {
        const una = limpiarMensajeDirector(m);
        expect(limpiarMensajeDirector(una)).toEqual(una);
      })
    );
  });

  it('solo quedan enlaces a líneas que existen', () => {
    fc.assert(
      fc.property(mensaje, (m) => {
        const limpio = limpiarMensajeDirector(m);
        if (!limpio) return;
        const lineas = limpio.texto.split('\n').length;
        Object.keys(limpio.enlaces).forEach((n) => {
          expect(Number(n)).toBeGreaterThanOrEqual(1);
          expect(Number(n)).toBeLessThanOrEqual(lineas);
        });
      })
    );
  });
});

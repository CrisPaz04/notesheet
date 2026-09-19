/**
 * Valida un JSON de canciones antes de importarlo a NoteSheet.
 *
 *   node scripts/validate-songs.mjs canciones.json
 *
 * Revisa lo que la app necesita de verdad, no lo que parece razonable. Las
 * cabeceras `## ` son opcionales: una canción sin ellas se muestra igual, como
 * una sección sin título.
 */

import { readFileSync } from 'node:fs';

const TIPOS = ['Júbilo', 'Adoración', 'Moderada'];
const TONALIDAD = /^(DO|RE|MI|FA|SOL|LA|SI)(#|b)?m?$/;

// Debe coincidir con la gramática de packages/core/src/music/chords.js:
// notas en MAYÚSCULAS o Capitalizadas, con `_` de nota larga y `//` de repetición.
const ACORDE = /^[([{|:/]*(DO|Do|RE|Re|MI|Mi|FA|Fa|SOL|Sol|LA|La|SI|Si|[A-G])(#|b)?(maj|min|dim|aug|M|m|°|\+)?(\d+)?((sus|add)\d*)?(\/(DO|Do|RE|Re|MI|Mi|FA|Fa|SOL|Sol|LA|La|SI|Si|[A-G])(#|b)?)?(\(\d+\)|[)\]}|:/,.;!?_])*$/;
const RELLENO = /^(?:[|:%\-–—()[\]/_]+|\(\d+\))$/;

const esLineaDeAcordes = (linea) => {
  const tokens = linea.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  const acordes = tokens.filter((t) => !RELLENO.test(t));
  return acordes.length > 0 && acordes.every((t) => ACORDE.test(t));
};

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node scripts/validate-songs.mjs canciones.json');
  process.exit(1);
}

let canciones;
try {
  canciones = JSON.parse(readFileSync(ruta, 'utf8'));
} catch (e) {
  console.error(`No se pudo leer el JSON: ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(canciones)) {
  console.error('El JSON debe ser un array de canciones.');
  process.exit(1);
}

const errores = [];
const avisos = [];
const titulosVistos = new Map();

canciones.forEach((c, i) => {
  const donde = `[${i}] ${c?.title || '(sin título)'}`;

  if (!c || typeof c !== 'object') {
    errores.push(`${donde}: no es un objeto`);
    return;
  }

  if (!c.title?.trim()) errores.push(`${donde}: falta el título`);

  const normalizado = (c.title || '').trim().toLowerCase();
  if (normalizado) {
    if (titulosVistos.has(normalizado)) {
      avisos.push(`${donde}: título repetido (ya está en [${titulosVistos.get(normalizado)}])`);
    } else {
      titulosVistos.set(normalizado, i);
    }
  }

  if (!c.key?.trim()) errores.push(`${donde}: falta la tonalidad`);
  else if (!TONALIDAD.test(c.key.trim())) {
    errores.push(`${donde}: tonalidad "${c.key}" no válida (ej. DO, LAm, FA#, SIb)`);
  }

  if (c.type && !TIPOS.includes(c.type)) {
    avisos.push(`${donde}: tipo "${c.type}" no es ${TIPOS.join(' / ')}; no lo filtrará el Dashboard`);
  }

  const contenido = c.content || '';
  if (!contenido.trim()) {
    errores.push(`${donde}: contenido vacío`);
    return;
  }

  const lineas = contenido.split('\n');

  // Las cabeceras `## ` son opcionales: una canción sin ellas se muestra igual,
  // como una sección sin título. No hay nada que validar aquí.

  const conAcordes = lineas.filter(esLineaDeAcordes).length;
  if (conAcordes === 0) {
    avisos.push(`${donde}: no se detectó ninguna línea de acordes; no se podrá transponer`);
  }

  // Los conteos hay que expandirlos al extraer, no dejarlos escritos:
  // "SI (4)" se importa como "SI SI SI SI".
  const conteos = contenido.match(/\(\s*\d+\s*\)/g);
  if (conteos) {
    avisos.push(`${donde}: ${conteos.length} conteo(s) sin expandir (${conteos.slice(0, 3).join(' ')}); cada nota debe repetirse esas veces`);
  }

  // Marcas que dejaste para revisar a mano
  const dudosas = lineas.filter((l) => l.includes('[?]')).length;
  if (dudosas > 0) avisos.push(`${donde}: ${dudosas} línea(s) marcadas [?] por revisar`);

  if (/^#\s*(Tonalidad|Key|Canción|Título|Title|Tipo|Type):/im.test(contenido)) {
    avisos.push(`${donde}: hay metadatos dentro del contenido; van en sus campos`);
  }

  // Voces extra: algunas partituras traen "1 Trp" y "2 Trp" en la misma hoja.
  // La voz principal tiene que ser la misma que `content`, que es lo que la app
  // muestra de entrada.
  if (c.voices !== undefined) {
    if (typeof c.voices !== 'object' || Array.isArray(c.voices) || c.voices === null) {
      errores.push(`${donde}: "voices" debe ser un mapa instrumento → nº de voz → contenido`);
    } else {
      const principal = c.voices.bb_trumpet?.['1'];
      if (principal === undefined) {
        errores.push(`${donde}: "voices" no trae la voz de trompeta 1, que es la referencia`);
      } else if (principal !== contenido) {
        errores.push(`${donde}: la voz de trompeta 1 no coincide con "content"`);
      }

      Object.entries(c.voices).forEach(([instrumento, porVoz]) => {
        Object.entries(porVoz || {}).forEach(([numero, texto]) => {
          if (!String(texto || '').trim()) {
            errores.push(`${donde}: la voz ${instrumento} ${numero} está vacía`);
            return;
          }
          const sinAcordes = String(texto).split('\n').filter(esLineaDeAcordes).length === 0;
          if (sinAcordes) {
            avisos.push(`${donde}: la voz ${instrumento} ${numero} no tiene líneas de acordes`);
          }
        });
      });
    }
  }
});

console.log(`Canciones en el archivo: ${canciones.length}\n`);

if (errores.length) {
  console.log(`ERRORES (${errores.length}) — hay que arreglarlos antes de importar:`);
  errores.forEach((e) => console.log(`  ✗ ${e}`));
  console.log('');
}

if (avisos.length) {
  console.log(`AVISOS (${avisos.length}) — revísalos, pero no impiden importar:`);
  avisos.forEach((a) => console.log(`  · ${a}`));
  console.log('');
}

if (!errores.length && !avisos.length) {
  console.log('Todo correcto.');
}

process.exit(errores.length ? 1 : 0);

/**
 * Valida un JSON de canciones antes de importarlo a NoteSheet.
 *
 *   node scripts/validate-songs.mjs canciones.json
 *
 * Revisa lo que la app necesita de verdad, no lo que parece razonable. El aviso
 * que importa es el de las cabeceras `## `: una canción sin ellas se guarda sin
 * error y luego se ve en blanco.
 */

import { readFileSync } from 'node:fs';

const TIPOS = ['Júbilo', 'Adoración', 'Moderada'];
const TONALIDAD = /^(DO|RE|MI|FA|SOL|LA|SI)(#|b)?m?$/;

// Un acorde: raíz + alteración + sufijo + bajo opcional. Permisivo a propósito.
const ACORDE = /^(DO|RE|MI|FA|SOL|LA|SI|[A-G])(#|b)?(maj|min|dim|aug|M|m|°|\+)?(\d+)?((sus|add)\d*)?(\/(DO|RE|MI|FA|SOL|LA|SI|[A-G])(#|b)?)?$/;
const RELLENO = /^[|:%\-–—()[\]]+$/;

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
  const cabeceras = lineas.filter((l) => /^##\s+.+/.test(l));

  // El fallo que se guarda sin quejarse y luego sale en blanco
  if (cabeceras.length === 0) {
    errores.push(`${donde}: sin cabeceras "## " — la canción se vería EN BLANCO`);
  }

  // Contenido antes de la primera cabecera: se descarta al renderizar
  const primeraCabecera = lineas.findIndex((l) => /^##\s+.+/.test(l));
  if (primeraCabecera > 0) {
    const huerfanas = lineas.slice(0, primeraCabecera).filter((l) => l.trim());
    if (huerfanas.length > 0) {
      avisos.push(`${donde}: ${huerfanas.length} línea(s) antes de la primera "## " se perderán`);
    }
  }

  const conAcordes = lineas.filter(esLineaDeAcordes).length;
  if (conAcordes === 0) {
    avisos.push(`${donde}: no se detectó ninguna línea de acordes; no se podrá transponer`);
  }

  // Marcas que dejaste para revisar a mano
  const dudosas = lineas.filter((l) => l.includes('[?]')).length;
  if (dudosas > 0) avisos.push(`${donde}: ${dudosas} línea(s) marcadas [?] por revisar`);

  if (/^#\s*(Tonalidad|Key|Canción|Título|Title|Tipo|Type):/im.test(contenido)) {
    avisos.push(`${donde}: hay metadatos dentro del contenido; van en sus campos`);
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

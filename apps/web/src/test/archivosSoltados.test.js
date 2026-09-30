import { describe, it, expect } from 'vitest';
import { archivosSoltados } from '../utils/archivosSoltados';

// Imitan las entradas de la API de archivos del navegador (FileSystemEntry)
const archivo = (nombre) => ({ isFile: true, isDirectory: false, file: (ok) => ok({ name: nombre }) });
// readEntries devuelve por tandas y termina con una vacía
const carpeta = (...tandas) => ({
  isFile: false,
  isDirectory: true,
  createReader: () => {
    const pendientes = [...tandas, []];
    return { readEntries: (ok) => ok(pendientes.shift()) };
  }
});
const soltado = (...entradas) => ({
  items: entradas.map((e) => ({ webkitGetAsEntry: () => e })),
  files: []
});
const nombres = (archivos) => archivos.map((a) => a.name).sort();

describe('archivosSoltados', () => {
  it('entra en las carpetas y subcarpetas', async () => {
    const partituras = carpeta([
      archivo('A--Uno--Flute.pdf'),
      carpeta([archivo('B--Dos--Bb_Trumpet_2.pdf')])
    ]);
    expect(nombres(await archivosSoltados(soltado(partituras)))).toEqual([
      'A--Uno--Flute.pdf',
      'B--Dos--Bb_Trumpet_2.pdf'
    ]);
  });

  // Chrome entrega las carpetas grandes de 100 en 100
  it('lee todas las tandas de una carpeta grande, no solo la primera', async () => {
    const grande = carpeta(
      [archivo('1.pdf'), archivo('2.pdf')],
      [archivo('3.pdf')]
    );
    expect(nombres(await archivosSoltados(soltado(grande)))).toEqual(['1.pdf', '2.pdf', '3.pdf']);
  });

  it('archivos sueltos junto a una carpeta', async () => {
    const r = await archivosSoltados(soltado(archivo('suelto.pdf'), carpeta([archivo('dentro.pdf')])));
    expect(nombres(r)).toEqual(['dentro.pdf', 'suelto.pdf']);
  });

  it('sin entradas (navegador sin soporte), lo de primer nivel', async () => {
    const files = [{ name: 'a.pdf' }, { name: 'b.pdf' }];
    expect(await archivosSoltados({ items: [], files })).toEqual(files);
  });

  // Las entradas caducan al acabar el evento: hay que pedirlas antes de esperar
  it('pide las entradas en el momento, sin esperar', () => {
    let pedidas = 0;
    const dt = { items: [{ webkitGetAsEntry: () => { pedidas++; return archivo('x.pdf'); } }], files: [] };
    archivosSoltados(dt);
    expect(pedidas).toBe(1);
  });
});

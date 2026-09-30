import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

// Toda vista tiene que tener por dónde llegar. "Entrar a una sesión" (/live)
// existía, pero solo se llegaba escribiendo la dirección a mano.
describe('ninguna vista queda sin acceso', () => {
  const src = join(cwd(), 'src');
  const app = readFileSync(join(src, 'App.jsx'), 'utf8');

  // Las rutas fijas; las de :id se llegan desde su lista (/songs/:id desde el
  // Dashboard...) y las cubren los tests de cada página
  const rutas = [...app.matchAll(/<Route path="([^"]+)"/g)]
    .map(([, r]) => r)
    .filter((r) => r !== '*' && !r.includes(':'));

  const codigo = [];
  (function recorrer(dir) {
    for (const f of readdirSync(dir)) {
      const ruta = join(dir, f);
      if (statSync(ruta).isDirectory()) { if (f !== 'test') recorrer(ruta); }
      else if (/\.jsx?$/.test(f) && ruta !== join(src, 'App.jsx')) codigo.push(readFileSync(ruta, 'utf8'));
    }
  })(src);
  const todo = codigo.join('\n');

  it('encuentra las rutas', () => {
    expect(rutas).toEqual(expect.arrayContaining(['/dashboard', '/live', '/tuner']));
  });

  it.each(rutas)('%s tiene un enlace desde alguna parte', (ruta) => {
    // "/" y "/home" son la portada: la marca del menú lleva ahí
    const escapada = ruta.replace(/[/.]/g, '\\$&');
    const enlace = new RegExp(`(to=|navigate\\(|href=)\\{?["'\`]${escapada}["'\`]`);
    expect(enlace.test(todo) || ruta === '/home').toBe(true);
  });
});

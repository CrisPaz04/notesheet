import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

// jsdom no aplica las hojas de estilo, así que el choque con Bootstrap no se
// ve en los tests de componentes: se comprueba la regla en el propio CSS.
describe('_modal.css', () => {
  it('devuelve los clics al cuadro de la ventana, que Bootstrap desactiva', () => {
    const ruta = ['src/styles/components/_modal.css', 'apps/web/src/styles/components/_modal.css']
      .map((r) => resolve(cwd(), r))
      .find((r) => existsSync(r));
    const css = readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const regla = /\.modal-dialog\s*\{([^}]*)\}/.exec(css);
    expect(regla).not.toBeNull();
    expect(regla[1]).toMatch(/pointer-events:\s*auto/);
  });
});

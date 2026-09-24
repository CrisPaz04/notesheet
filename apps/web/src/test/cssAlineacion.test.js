import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cwd } from 'node:process';
import { join } from 'node:path';

// `.song-section-modern` centra, y el texto de la canción lo hereda. Sin una
// regla propia para cada alineación, el botón correspondiente no hacía nada.
const css = readFileSync(join(cwd(), 'src/styles/components/_song-viewer.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

describe('CSS de la alineación del texto', () => {
  it.each([['left'], ['center'], ['right']])('%s tiene su propia regla', (valor) => {
    const regla = new RegExp(`\\.song-section-content\\.alinear-${valor}\\s*\\{\\s*text-align:\\s*${valor};`);
    expect(css).toMatch(regla);
  });
});

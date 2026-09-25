import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import Icono from '../components/Icono';
import { ICONOS } from '../components/iconos';
import { getInstrumentIcon } from '@notesheet/core';

describe('Icono', () => {
  it('pinta el SVG dentro de un <i> con sus clases, oculto a los lectores', () => {
    const { container } = render(<Icono nombre="metronome" className="me-2" />);
    const i = container.querySelector('i');
    expect(i).toHaveClass('icono', 'me-2');
    expect(i).toHaveAttribute('aria-hidden', 'true');
    expect(i.querySelector('svg')).not.toBeNull();
  });

  it('el peso cambia el dibujo', () => {
    const trazo = (peso) => render(<Icono nombre="play" peso={peso} />).container.innerHTML;
    expect(trazo('fill')).not.toBe(trazo('regular'));
  });

  it('un nombre que no está en el registro no pinta nada', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = render(<Icono nombre="no-existe" />);
    expect(container.innerHTML).toBe('');
    aviso.mockRestore();
  });
});

// Un nombre mal escrito deja el hueco en blanco sin romper nada, así que se
// comprueban todos los que aparecen en el código contra el registro.
describe('los íconos que usa la app', () => {
  const archivos = [];
  (function recorrer(dir) {
    for (const f of readdirSync(dir)) {
      const ruta = join(dir, f);
      if (statSync(ruta).isDirectory()) { if (f !== 'test') recorrer(ruta); }
      else if (/\.jsx?$/.test(f)) archivos.push(ruta);
    }
  })(join(cwd(), 'src'));

  const usados = new Set();
  for (const archivo of archivos) {
    const codigo = readFileSync(archivo, 'utf8');
    // nombre="x", y los resultados de nombre={cond ? "x" : "y"} o {a || "x"}
    // (no las cadenas de la condición: `theme === 'dark'`)
    for (const [, n] of codigo.matchAll(/<Icono\s+nombre="([^"]+)"/g)) usados.add(n);
    for (const [, expr] of codigo.matchAll(/<Icono\s+nombre=\{([^}]*)\}/g)) {
      for (const [, n] of expr.matchAll(/(?:[?:]|\|\|)\s*["']([a-z0-9-]+)["']/g)) usados.add(n);
    }
    // Los datos con el nombre dentro: { icono: "x" } / { icon: "x" }
    for (const [, n] of codigo.matchAll(/\bicono?:\s*["']([a-z0-9-]+)["']/g)) usados.add(n);
  }

  it('encuentra los del código (si baja de golpe, el patrón dejó de casar)', () => {
    expect(usados.size).toBeGreaterThan(80);
  });

  it('todos están en iconos.js', () => {
    expect([...usados].filter((n) => !ICONOS[n])).toEqual([]);
  });

  it('también los de los instrumentos de cuerda del afinador', () => {
    for (const inst of ['guitar', 'bass', 'violin', 'cello', 'otro']) {
      expect(ICONOS[getInstrumentIcon(inst)]).toBeDefined();
    }
  });
});

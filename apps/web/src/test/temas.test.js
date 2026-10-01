import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { cwd } from 'node:process';
import { join } from 'node:path';
import { AVAILABLE_THEMES, THEME_FAMILIES } from '../lib/temas';

// Un tema está entero cuando tiene sus variables, su miniatura en
// Preferencias y el título de su familia. Sin este test se podía añadir uno a
// la lista y que saliera con los colores de :root o con la miniatura en blanco.
const leer = (ruta) => readFileSync(join(cwd(), ruta), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const variables = leer('src/styles/base/_variables.css');
const preferencias = leer('src/styles/pages/_preferences.css');

// Las que define cada tema: sin una, se vería la del tema por defecto
const OBLIGATORIAS = [
  '--color-primary', '--color-primary-dark', '--color-primary-rgb', '--on-primary',
  '--bg-dark-primary', '--bg-dark-secondary', '--bg-dark-tertiary',
  '--text-light-primary', '--text-light-secondary', '--text-light-muted',
  '--border-light', '--border-strong', '--surface-raised', '--surface-hover',
  '--color-danger', '--color-success', '--overlay-rgb', '--accent-on-dark',
];

const bloqueDe = (id) => {
  const m = variables.match(new RegExp(`\\[data-bs-theme="${id}"\\]\\s*\\{([^}]*)\\}`));
  return m ? m[1] : null;
};

const temas = Object.keys(AVAILABLE_THEMES);

describe('temas', () => {
  it.each(temas)('%s define todas sus variables', (id) => {
    const bloque = bloqueDe(id);
    expect(bloque, `falta [data-bs-theme="${id}"] en _variables.css`).not.toBeNull();
    const faltan = OBLIGATORIAS.filter((v) => !new RegExp(`${v}\\s*:`).test(bloque));
    expect(faltan).toEqual([]);
  });

  it.each(temas)('%s tiene su miniatura en Preferencias', (id) => {
    expect(preferencias).toMatch(new RegExp(`\\.theme-preview-new\\.${id}\\s*\\{`));
    expect(preferencias).toMatch(new RegExp(`\\.theme-preview-new\\.${id} \\.theme-preview-header\\s*\\{`));
  });

  it('cada familia tiene su título', () => {
    const sinTitulo = [...new Set(Object.values(AVAILABLE_THEMES).map((t) => t.category))]
      .filter((c) => !THEME_FAMILIES[c]);
    expect(sinTitulo).toEqual([]);
  });

  // De que acaben en -light / -dark cuelgan las reglas comunes de los claros
  // ($="light") y el color-scheme
  it('cada id dice si es claro u oscuro', () => {
    const mal = temas.filter((id) => !/(^|-)(light|dark)$/.test(id));
    expect(mal).toEqual([]);
  });

  it('el id y la clave coinciden, y los nombres van en español normal', () => {
    Object.entries(AVAILABLE_THEMES).forEach(([clave, t]) => {
      expect(t.id).toBe(clave);
      // Mayúscula solo al principio: "Bosque claro", no "Bosque Claro"
      expect(t.name).not.toMatch(/ (Claro|Oscuro)$/);
    });
  });
});

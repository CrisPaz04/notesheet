import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../components/Footer';

describe('Footer', () => {
  // La API de GetSongBPM exige un enlace visible a su web; si falta,
  // suspenden la clave sin avisar y la app se queda sin tempo ni tonalidad.
  it('enlaza a getsongbpm.com, como exige su API', () => {
    render(<Footer />);
    const enlace = screen.getByRole('link', { name: 'GetSongBPM' });
    expect(enlace).toHaveAttribute('href', 'https://getsongbpm.com');
    expect(enlace.getAttribute('rel') || '').not.toMatch(/nofollow/);
  });
});

describe('index.html', () => {
  // El comprobador de GetSongBPM descarga el HTML sin ejecutar JavaScript,
  // así que el enlace del pie (que pinta React) no le llega: tiene que estar
  // también en el HTML estático.
  it('lleva el enlace a getsongbpm.com sin necesitar JavaScript', async () => {
    const { readFileSync, existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const { cwd } = await import('node:process');
    const ruta = ['index.html', 'apps/web/index.html']
      .map((r) => resolve(cwd(), r))
      .find((r) => existsSync(r));
    const html = readFileSync(ruta, 'utf8');
    expect(html).toMatch(/<a href="https:\/\/getsongbpm\.com">GetSongBPM<\/a>/);
  });
});

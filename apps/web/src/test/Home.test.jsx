import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';

const renderHome = () => render(<MemoryRouter><Home /></MemoryRouter>);

// La demo de la portada: un trozo real del repertorio pasado por el motor de
// la app. Lo que se comprueba es lo que vería cada músico, no una imagen.
const demo = () => screen.getByRole('region', { name: /pruébalo/i });
const notas = () => within(demo()).getByTestId('demo-notas').textContent;
const tonalidad = () => within(demo()).getByTestId('demo-tonalidad').textContent;

describe('Home (portada)', () => {
  it('dice qué resuelve: cada músico, su parte en su tonalidad', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cada músico, su parte en su tonalidad');
  });

  it('lleva a crear cuenta, iniciar sesión y entrar con un código', () => {
    renderHome();
    expect(screen.getByRole('link', { name: /crear cuenta/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /iniciar sesión/i })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: /entrar con el código/i })).toHaveAttribute('href', '/live');
  });

  it('la demo arranca en la trompeta, en la tonalidad escrita', () => {
    renderHome();
    expect(tonalidad()).toContain('SIm');
    expect(notas()).toMatch(/^FA# FA# MI MI FA# MI RE DO# SI/);
    expect(within(demo()).getByRole('button', { name: /trompeta/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([
    [/saxo alto/i, 'FA#m', /^DO# DO# SI SI DO# SI LA SOL# FA#/],
    [/corno/i, 'MIm', /^SI SI LA LA SI LA SOL FA# MI/],
    [/flauta/i, 'LAm', /^MI MI RE RE MI RE DO SI LA/],
  ])('al elegir %s, la misma melodía en su tonalidad (%s)', async (boton, tono, primeras) => {
    renderHome();
    const elegido = within(demo()).getByRole('button', { name: boton });
    await userEvent.click(elegido);
    expect(elegido).toHaveAttribute('aria-pressed', 'true');
    expect(within(demo()).getByRole('button', { name: /trompeta/i })).toHaveAttribute('aria-pressed', 'false');
    expect(tonalidad()).toContain(tono);
    expect(notas()).toMatch(primeras);
  });

  it('el domingo va en tres pasos, en orden', () => {
    renderHome();
    const pasos = within(screen.getByRole('region', { name: /así se usa un domingo/i })).getAllByRole('listitem');
    expect(pasos).toHaveLength(3);
    expect(pasos[0]).toHaveTextContent(/whatsapp/i);
    expect(pasos[1]).toHaveTextContent(/código/i);
  });

  it('sin el ejemplo en inglés ni las cifras de plantilla', () => {
    renderHome();
    expect(screen.queryByText(/amazing grace/i)).not.toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.queryByText(/definitiva/i)).not.toBeInTheDocument();
  });
});

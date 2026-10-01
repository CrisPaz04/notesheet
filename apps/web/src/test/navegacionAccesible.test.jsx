import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { SaltarAlContenido, FocoAlCambiarDePantalla } from '../components/NavegacionAccesible';

// Con teclado o lector de pantalla, al cambiar de pantalla el foco se quedaba
// en el enlace del menú que se pulsó, y había que recorrer la barra entera
// cada vez para llegar al contenido
const montar = () => render(
  <MemoryRouter initialEntries={['/a']}>
    <SaltarAlContenido />
    <nav><Link to="/b">Ir a B</Link></nav>
    <FocoAlCambiarDePantalla />
    <main id="contenido" tabIndex={-1}>
      <Routes>
        <Route path="/a" element={<h1>Pantalla A</h1>} />
        <Route path="/b" element={<h1>Pantalla B</h1>} />
      </Routes>
    </main>
  </MemoryRouter>
);

describe('navegación accesible', () => {
  it('el primer Tab lleva a "Saltar al contenido", que apunta al contenido', async () => {
    montar();
    await userEvent.tab();
    const salto = screen.getByRole('link', { name: 'Saltar al contenido' });
    expect(salto).toHaveFocus();
    expect(salto).toHaveAttribute('href', '#contenido');
  });

  it('al cargar no roba el foco', () => {
    montar();
    expect(document.getElementById('contenido')).not.toHaveFocus();
  });

  it('al cambiar de pantalla, el foco pasa al contenido', async () => {
    montar();
    await userEvent.click(screen.getByRole('link', { name: 'Ir a B' }));
    expect(await screen.findByText('Pantalla B')).toBeInTheDocument();
    expect(document.getElementById('contenido')).toHaveFocus();
  });
});

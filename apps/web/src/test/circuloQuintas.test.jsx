import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import CirculoQuintas from '../components/herramientas/CirculoQuintas';

// Cada armadura es un pentagrama con sus alteraciones dibujadas, en el orden
// del círculo (DO arriba y en el sentido del reloj)
const armaduras = (container) => [...container.querySelectorAll('.circulo-armadura')].map((g) => ({
  titulo: g.querySelector('title').textContent,
  sostenidos: g.querySelectorAll('.circulo-sostenido').length,
  bemoles: g.querySelectorAll('.circulo-bemol').length
}));

describe('Círculo de quintas: la armadura en pentagrama', () => {
  it('cada tonalidad con sus sostenidos o bemoles dibujados', () => {
    const { container } = render(<CirculoQuintas />);
    const a = armaduras(container);
    // Las tres de abajo llevan dos: la de sostenidos y la de bemoles
    expect(a.map((x) => x.sostenidos - x.bemoles)).toEqual([0, 1, 2, 3, 4, 5, -7, 6, -6, -5, 7, -4, -3, -2, -1]);
  });

  it('cada pentagrama dice lo que lleva', () => {
    const { container } = render(<CirculoQuintas />);
    const titulos = armaduras(container).map((x) => x.titulo);
    expect(titulos.slice(0, 2)).toEqual(['sin alteraciones', '1 sostenido']);
    expect(titulos.slice(5, 11)).toEqual([
      '5 sostenidos', '7 bemoles', '6 sostenidos', '6 bemoles', '5 bemoles', '7 sostenidos'
    ]);
    expect(titulos.at(-1)).toBe('1 bemol');
  });

  it('sin caracteres musicales para la clave: se dibuja', () => {
    const { container } = render(<CirculoQuintas />);
    expect(container.textContent).not.toMatch(/\u{1D11E}/u);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { leerVersiones, unirVersiones, limpiarVersiones } from '@notesheet/core';
import VersionesInput from '../components/VersionesInput';

describe('versiones (core)', () => {
  it('lee la lista cuando la canción la tiene', () => {
    expect(leerVersiones({ versiones: ['Ebenezer San Francisco', 'Jorge Jaenz'], version: 'x' }))
      .toEqual(['Ebenezer San Francisco', 'Jorge Jaenz']);
  });

  it('en una canción antigua la saca de `version`', () => {
    expect(leerVersiones({ version: 'Marcos Witt' })).toEqual(['Marcos Witt']);
  });

  it('dos nombres escritos con coma en el campo viejo son dos', () => {
    expect(leerVersiones({ version: 'Ebenezer San Francisco,  Jorge Jaenz ' }))
      .toEqual(['Ebenezer San Francisco', 'Jorge Jaenz']);
  });

  it('una lista vacía cae a `version`', () => {
    expect(leerVersiones({ versiones: [], version: 'Elim Honduras' })).toEqual(['Elim Honduras']);
  });

  it('sin nada, lista vacía', () => {
    expect(leerVersiones({})).toEqual([]);
    expect(leerVersiones(undefined)).toEqual([]);
    expect(leerVersiones({ version: '' })).toEqual([]);
  });

  it('limpia espacios, vacíos y repetidos sin mirar mayúsculas ni tildes', () => {
    expect(limpiarVersiones(['  Elim   Honduras ', '', 'elim honduras', 'Jesús Adrián', 'Jesus Adrian']))
      .toEqual(['Elim Honduras', 'Jesús Adrián']);
  });

  it('respeta el orden en que se escribieron', () => {
    expect(limpiarVersiones(['B', 'A'])).toEqual(['B', 'A']);
  });

  it('une con coma para el campo de siempre', () => {
    expect(unirVersiones(['Ebenezer San Francisco', 'Jorge Jaenz'])).toBe('Ebenezer San Francisco, Jorge Jaenz');
    expect(unirVersiones([])).toBe('');
  });
});

// El componente es controlado: se prueba dentro de un padre con estado
function Envoltorio({ inicial = [], alCambiar = () => {} }) {
  const [nombres, setNombres] = useState(inicial);
  return (
    <VersionesInput
      id="v"
      value={nombres}
      onChange={(n) => { setNombres(n); alCambiar(n); }}
    />
  );
}

const campo = () => screen.getByRole('textbox');
const etiquetas = () => [...document.querySelectorAll('.version-chip')].map((e) => e.textContent.trim());

describe('VersionesInput', () => {
  it('añade un nombre con Enter', async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);
    await user.type(campo(), 'Marcos Witt{Enter}');
    expect(etiquetas()).toEqual(['Marcos Witt']);
    expect(campo()).toHaveValue('');
  });

  it('añade con coma, y pegar "A, B" añade los dos', async () => {
    const user = userEvent.setup();
    render(<Envoltorio />);
    await user.type(campo(), 'Ebenezer San Francisco,');
    expect(etiquetas()).toEqual(['Ebenezer San Francisco']);

    await user.click(campo());
    await user.paste('Jorge Jaenz, Elim Honduras');
    expect(etiquetas()).toEqual(['Ebenezer San Francisco', 'Jorge Jaenz', 'Elim Honduras']);
  });

  it('lo que queda escrito se añade al salir del campo', async () => {
    const user = userEvent.setup();
    render(<><Envoltorio /><button>fuera</button></>);
    await user.type(campo(), 'Jorge Jaenz');
    await user.click(screen.getByRole('button', { name: 'fuera' }));
    expect(etiquetas()).toEqual(['Jorge Jaenz']);
  });

  it('quita un nombre con su botón', async () => {
    const user = userEvent.setup();
    render(<Envoltorio inicial={['A', 'B']} />);
    await user.click(screen.getByRole('button', { name: 'Quitar A' }));
    expect(etiquetas()).toEqual(['B']);
  });

  it('Retroceso con el campo vacío quita el último', async () => {
    const user = userEvent.setup();
    render(<Envoltorio inicial={['A', 'B']} />);
    await user.click(campo());
    await user.keyboard('{Backspace}');
    expect(etiquetas()).toEqual(['A']);
  });

  it('no añade vacíos ni repetidos', async () => {
    const user = userEvent.setup();
    const alCambiar = vi.fn();
    render(<Envoltorio inicial={['Elim Honduras']} alCambiar={alCambiar} />);
    await user.type(campo(), '   {Enter}');
    await user.type(campo(), 'elim honduras{Enter}');
    expect(etiquetas()).toEqual(['Elim Honduras']);
  });

  it('el placeholder cambia cuando ya hay alguno', () => {
    const { unmount } = render(<Envoltorio />);
    expect(campo()).toHaveAttribute('placeholder', 'Autor original o versión');
    unmount();
    render(<Envoltorio inicial={['A']} />);
    expect(campo()).toHaveAttribute('placeholder', 'Añadir otro…');
  });
});

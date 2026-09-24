import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Desplegable from '../components/Desplegable';
import { rellenoDeslizador } from '../utils/rellenoDeslizador';

// El sustituto del `<select>` nativo, cuya lista abierta pinta el sistema
// (en azul en Windows, en todos los temas).

const OPCIONES = [
  { value: 'latin', label: 'DO-RE-MI' },
  { value: 'english', label: 'C-D-E' }
];

const GRUPOS = [
  { label: 'Sib', opciones: [{ value: 'bb_trumpet', label: 'Trompeta en Sib' }, { value: 'bb_trombone', label: 'Trombón' }] },
  { label: 'Mib', opciones: [{ value: 'eb_alto_sax', label: 'Saxo alto' }] }
];

const montar = (props = {}) => {
  const onChange = vi.fn();
  render(
    <>
      <label htmlFor="d">Notación</label>
      <Desplegable id="d" value="latin" onChange={onChange} opciones={OPCIONES} {...props} />
      <button type="button">fuera</button>
    </>
  );
  return { onChange, boton: screen.getByRole('combobox', { name: 'Notación' }) };
};

describe('Desplegable', () => {
  it('enseña la opción elegida y se asocia a su <label>', () => {
    const { boton } = montar();
    expect(boton).toHaveTextContent('DO-RE-MI');
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('al abrir marca la elegida, y al pulsar otra la avisa y se cierra', async () => {
    const { boton, onChange } = montar();
    await userEvent.click(boton);

    expect(screen.getByRole('option', { name: 'DO-RE-MI' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(screen.getByRole('option', { name: 'C-D-E' }));

    expect(onChange).toHaveBeenCalledWith('english');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('elegir la que ya estaba no avisa', async () => {
    const { boton, onChange } = montar();
    await userEvent.click(boton);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'DO-RE-MI' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('con el teclado: flecha abre, flechas mueven, Enter elige', async () => {
    const { boton, onChange } = montar();
    boton.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('english');
  });

  it('Esc cierra sin elegir y devuelve el foco', async () => {
    const { boton, onChange } = montar();
    await userEvent.click(boton);
    await userEvent.keyboard('{ArrowDown}{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
    expect(boton).toHaveFocus();
  });

  it('tocar fuera lo cierra', async () => {
    const { boton } = montar();
    await userEvent.click(boton);
    await userEvent.click(screen.getByRole('button', { name: 'fuera' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('con grupos, como un <optgroup>', async () => {
    const { boton, onChange } = montar({ value: 'bb_trumpet', opciones: undefined, grupos: GRUPOS });
    expect(boton).toHaveTextContent('Trompeta en Sib');
    await userEvent.click(boton);

    expect(screen.getByRole('group', { name: 'Mib' })).toBeInTheDocument();
    // Las flechas pasan de un grupo a otro
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('eb_alto_sax');
  });

  it('desactivado no se abre', async () => {
    const { boton } = montar({ disabled: true });
    await userEvent.click(boton);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('rellenoDeslizador', () => {
  it('la parte recorrida en porcentaje, dentro de 0-100', () => {
    expect(rellenoDeslizador(440, 430, 450)).toEqual({ '--relleno': '50%' });
    expect(rellenoDeslizador(40, 40, 240)).toEqual({ '--relleno': '0%' });
    expect(rellenoDeslizador('240', 40, 240)).toEqual({ '--relleno': '100%' });
    expect(rellenoDeslizador(500, 40, 240)).toEqual({ '--relleno': '100%' });
    expect(rellenoDeslizador(5, 5, 5)).toEqual({ '--relleno': '0%' });
  });
});

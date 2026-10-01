import { describe, it, expect } from 'vitest';
import { insertarSeccion, insertarNota, insertarAlteracion, aplicarEdicion } from '../utils/insertarEnEditor';

// Las ediciones se describen como en CodeMirror (desde, hasta, texto nuevo y
// dónde queda el cursor); `aplicarEdicion` las aplica a un texto para probarlas.
const tras = (texto, cursor, edicion) => {
  const nuevo = aplicarEdicion(texto, edicion);
  return nuevo.slice(0, edicion.cursor) + '|' + nuevo.slice(edicion.cursor);
};

describe('insertarSeccion: la cabecera va siempre en una línea propia', () => {
  it('en un texto vacío', () => {
    expect(tras('', 0, insertarSeccion('', 0, 0, '## Coro'))).toBe('## Coro\n|');
  });

  it('a mitad de una línea, la parte en dos', () => {
    const texto = 'DO RE MI FA';
    expect(tras(texto, 6, insertarSeccion(texto, 6, 6, '## Coro'))).toBe('DO RE \n## Coro\n|MI FA');
  });

  it('al final de una línea, debajo', () => {
    const texto = 'DO RE\nMI';
    expect(tras(texto, 5, insertarSeccion(texto, 5, 5, '## Solo'))).toBe('DO RE\n## Solo\n|MI');
  });

  it('al principio de una línea, encima de ella', () => {
    const texto = 'DO RE\nMI';
    expect(tras(texto, 6, insertarSeccion(texto, 6, 6, '## Final'))).toBe('DO RE\n## Final\n|MI');
  });

  it('con texto seleccionado, lo sustituye', () => {
    const texto = 'DO XX RE';
    expect(tras(texto, 3, insertarSeccion(texto, 3, 5, '##'))).toBe('DO \n##\n| RE');
  });
});

describe('insertarNota: una nota y su espacio', () => {
  it('detrás de otra nota, separada por un espacio', () => {
    expect(tras('DO RE', 5, insertarNota('DO RE', 5, 5, 'MI'))).toBe('DO RE MI |');
  });

  it('si ya había un espacio, no pone otro', () => {
    expect(tras('DO ', 3, insertarNota('DO ', 3, 3, 'RE'))).toBe('DO RE |');
  });

  it('al principio de una línea, sin espacio delante', () => {
    expect(tras('DO\n', 3, insertarNota('DO\n', 3, 3, 'SOL'))).toBe('DO\nSOL |');
  });

  it('si detrás ya hay un espacio, el cursor salta por encima', () => {
    expect(tras('DO  RE', 3, insertarNota('DO  RE', 3, 3, 'MI'))).toBe('DO MI |RE');
  });
});

describe('insertarAlteracion: se pega a la nota de antes', () => {
  it('quita el espacio de la nota recién puesta', () => {
    expect(tras('DO RE ', 6, insertarAlteracion('DO RE ', 6, 6, '#'))).toBe('DO RE# |');
    expect(tras('SI ', 3, insertarAlteracion('SI ', 3, 3, 'b'))).toBe('SIb |');
  });

  it('pegada a una nota sin espacio', () => {
    expect(tras('FA', 2, insertarAlteracion('FA', 2, 2, '#'))).toBe('FA# |');
  });

  it('también en C-D-E', () => {
    expect(tras('C D ', 4, insertarAlteracion('C D ', 4, 4, 'b'))).toBe('C Db |');
  });

  it('una nota que ya lleva alteración no recibe otra', () => {
    expect(tras('FA# ', 4, insertarAlteracion('FA# ', 4, 4, '#'))).toBe('FA# #|');
  });

  it('sin nota delante, la escribe tal cual', () => {
    expect(tras('Hola ', 5, insertarAlteracion('Hola ', 5, 5, '#'))).toBe('Hola #|');
  });
});

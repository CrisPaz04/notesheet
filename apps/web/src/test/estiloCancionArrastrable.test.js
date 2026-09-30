import { describe, it, expect } from 'vitest';
import { estiloCancionArrastrable } from '../utils/estiloCancionArrastrable';

// Lo que pone @hello-pangea/dnd mientras se arrastra: fija, en su sitio de la
// pantalla, y la mueve con transform
const DURANTE = { position: 'fixed', top: 410, left: 397, zIndex: 5000, transform: 'translate(0px, -50px)' };

describe('estiloCancionArrastrable', () => {
  // Con `relative` encima, top/left se sumaban a su sitio y la canción saltaba
  // abajo a la derecha
  it('mientras se arrastra deja el estilo de la librería tal cual', () => {
    expect(estiloCancionArrastrable(DURANTE, true, 1)).toEqual(DURANTE);
  });

  it('en reposo, cada fila por encima de las de debajo (para su desplegable)', () => {
    const primera = estiloCancionArrastrable({ transform: null }, false, 0);
    const segunda = estiloCancionArrastrable({ transform: null }, false, 1);
    expect(primera).toMatchObject({ position: 'relative', transform: null });
    expect(primera.zIndex).toBeGreaterThan(segunda.zIndex);
  });
});

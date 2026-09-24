import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// Una lista con varios PDF no debe tenerlos todos abiertos: el visor solo
// existe mientras la canción está cerca de la pantalla.

vi.mock('../components/PdfScoreViewer', () => ({
  default: ({ path, zoomInicial, onZoom }) => (
    <div data-testid="visor-pdf" data-path={path} data-zoom={zoomInicial}>
      <button type="button" onClick={() => onZoom(1.15)}>ampliar</button>
    </div>
  )
}));

const { default: PdfEnLista } = await import('../components/PdfEnLista');

let observador;

class IntersectionObserverFalso {
  constructor(callback) {
    this.callback = callback;
    observador = this;
  }
  observe(nodo) { this.nodo = nodo; }
  disconnect() {}
  cambiar(isIntersecting) {
    this.callback([{ target: this.nodo, isIntersecting }]);
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PdfEnLista', () => {
  it('no abre el PDF hasta que la canción se acerca a la pantalla', () => {
    render(<PdfEnLista path="partituras/a.pdf" />);
    expect(screen.queryByTestId('visor-pdf')).toBeNull();

    act(() => observador.cambiar(true));
    expect(screen.getByTestId('visor-pdf')).toHaveAttribute('data-path', 'partituras/a.pdf');
  });

  it('lo cierra al alejarse, pero deja reservado su alto', () => {
    const { container } = render(<PdfEnLista path="partituras/a.pdf" />);
    act(() => observador.cambiar(true));

    const hueco = container.querySelector('.playlist-pdf');
    Object.defineProperty(hueco, 'offsetHeight', { configurable: true, value: 900 });

    act(() => observador.cambiar(false));
    expect(screen.queryByTestId('visor-pdf')).toBeNull();
    // Sin esto la lista se encogería por encima de lo que se está leyendo
    expect(hueco.style.minHeight).toBe('900px');
  });

  it('al volver, la partitura sigue con el zoom que tenía', () => {
    render(<PdfEnLista path="partituras/a.pdf" />);
    act(() => observador.cambiar(true));
    expect(screen.getByTestId('visor-pdf')).toHaveAttribute('data-zoom', '1');

    act(() => screen.getByRole('button', { name: 'ampliar' }).click());
    act(() => observador.cambiar(false));
    act(() => observador.cambiar(true));

    expect(screen.getByTestId('visor-pdf')).toHaveAttribute('data-zoom', '1.15');
  });

  it('sin IntersectionObserver lo abre directamente', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<PdfEnLista path="partituras/a.pdf" />);
    expect(screen.getByTestId('visor-pdf')).toBeInTheDocument();
  });
});

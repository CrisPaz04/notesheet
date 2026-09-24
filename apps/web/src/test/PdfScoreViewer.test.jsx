import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';

// El visor solo pinta las páginas cercanas a la vista, y eso lo decide un
// IntersectionObserver. Aquí va uno falso que apunta qué observa cada
// instancia, para poder "hacer visible" una página a mano.

const mockDoc = vi.hoisted(() => ({ estado: null }));

vi.mock('../hooks/usePdfDocument', () => ({
  default: () => mockDoc.estado
}));

// La página de verdad llamaría a pdf.js; aquí basta con saber si está activa
vi.mock('../components/PdfScorePage', async () => {
  const { useEffect, useRef } = await import('react');
  return {
    default: function PaginaFalsa({ indice, numero, activa, registrar, medida, escala }) {
      const ref = useRef(null);
      useEffect(() => registrar(ref.current, indice), [registrar, indice]);
      return (
        <div
          ref={ref}
          data-testid={`pagina-${numero}`}
          data-activa={String(activa)}
          data-ancho={Math.floor(medida.width * escala)}
        />
      );
    }
  };
});

const { default: PdfScoreViewer } = await import('../components/PdfScoreViewer');

let observadores = [];

class IntersectionObserverFalso {
  constructor(callback) {
    this.callback = callback;
    this.observados = new Set();
    this.desconectado = false;
    observadores.push(this);
  }
  observe(nodo) { this.observados.add(nodo); }
  unobserve(nodo) { this.observados.delete(nodo); }
  disconnect() { this.observados.clear(); this.desconectado = true; }
  mostrar(nodo) {
    this.callback([{ target: nodo, isIntersecting: true }]);
  }
}

const vivo = () => observadores.filter((o) => !o.desconectado).at(-1);

beforeEach(() => {
  observadores = [];
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFalso);
  mockDoc.estado = {
    doc: {},
    pages: [
      { width: 600, height: 800 },
      { width: 600, height: 800 },
      { width: 600, height: 800 }
    ],
    loading: false,
    error: ''
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PdfScoreViewer', () => {
  it('todas las páginas quedan apuntadas al observador que está vivo', () => {
    // El fallo real: las páginas se apuntaban al observador viejo, que se
    // desconectaba justo después, y solo se veía la página 1.
    render(<PdfScoreViewer path="partituras/x.pdf" />);

    const paginas = [1, 2, 3].map((n) => screen.getByTestId(`pagina-${n}`));
    expect([...vivo().observados]).toEqual(expect.arrayContaining(paginas));
    expect(vivo().observados.size).toBe(3);
  });

  it('una página que entra en la vista se pinta', () => {
    render(<PdfScoreViewer path="partituras/x.pdf" />);

    const tercera = screen.getByTestId('pagina-3');
    expect(tercera).toHaveAttribute('data-activa', 'false');

    act(() => vivo().mostrar(tercera));

    expect(tercera).toHaveAttribute('data-activa', 'true');
  });

  it('al cambiar de documento, las páginas nuevas también se observan', () => {
    const { rerender } = render(<PdfScoreViewer path="partituras/x.pdf" />);

    mockDoc.estado = {
      ...mockDoc.estado,
      doc: {},
      pages: [{ width: 600, height: 800 }, { width: 600, height: 800 }]
    };
    rerender(<PdfScoreViewer path="partituras/y.pdf" />);

    expect(vivo().observados.size).toBe(2);
  });

  describe('zoom desde el centro', () => {
    // jsdom no mide nada: el contenedor mide 600 de ancho y su contenido lo
    // que la página más ancha, que es lo que haría el navegador.
    const originales = {};
    const props = ['clientWidth', 'scrollWidth', 'scrollLeft'];

    beforeEach(() => {
      props.forEach((p) => {
        originales[p] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)
          || Object.getOwnPropertyDescriptor(Element.prototype, p);
      });
      const esVisor = (el) => el.classList.contains('pdf-score-pages');
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() { return esVisor(this) ? 600 : 0; }
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
        configurable: true,
        get() {
          if (!esVisor(this)) return 0;
          const ancho = parseFloat(this.querySelector('[data-testid="pagina-1"]')?.dataset.ancho);
          return Math.max(600, ancho || 600);
        }
      });
      Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
        configurable: true,
        get() { return this._scrollLeft || 0; },
        set(v) { this._scrollLeft = Math.max(0, v); }
      });
    });

    afterEach(() => {
      props.forEach((p) => {
        if (originales[p]) Object.defineProperty(HTMLElement.prototype, p, originales[p]);
        else delete HTMLElement.prototype[p];
      });
    });

    it('al acercar, el centro de lo que se veía sigue en el centro', () => {
      render(<PdfScoreViewer path="partituras/x.pdf" />);
      const visor = document.querySelector('.pdf-score-pages');

      fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));

      // 105%: la página pasa de 600 a 630. Para que el centro (300) siga
      // en el centro, hay que desplazar (630 - 600) / 2 = 15.
      expect(visor.scrollLeft).toBe(15);
    });

    it('si estaba mirando el borde derecho, sigue en el derecho', () => {
      render(<PdfScoreViewer path="partituras/x.pdf" />);
      const visor = document.querySelector('.pdf-score-pages');

      fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
      visor.scrollLeft = 30; // todo a la derecha: 630 - 600
      fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));

      // 110%: 660 de ancho. El centro estaba en 330/630 -> 345,7 - 300
      expect(visor.scrollLeft).toBeCloseTo(45.71, 1);
    });
  });

  it('cada clic acerca o aleja un 5%, sin arrastrar decimales', () => {
    render(<PdfScoreViewer path="partituras/x.pdf" />);
    const acercar = screen.getByRole('button', { name: 'Acercar' });
    const alejar = screen.getByRole('button', { name: 'Alejar' });

    fireEvent.click(acercar);
    expect(screen.getByTitle('Ajustar al ancho')).toHaveTextContent('105%');

    fireEvent.click(alejar);
    fireEvent.click(alejar);
    expect(screen.getByTitle('Ajustar al ancho')).toHaveTextContent('95%');

    // De 95% a 300% son 41 clics justos. Sumando 0,05 sin redondear se
    // queda en 2,9999999999999973: pone "300%" pero el botón sigue activo.
    for (let i = 0; i < 41; i += 1) fireEvent.click(acercar);
    expect(screen.getByTitle('Ajustar al ancho')).toHaveTextContent('300%');
    expect(acercar).toBeDisabled();
  });

  it('arranca con el zoom que le dan y avisa de cada cambio (PdfEnLista lo guarda)', () => {
    const onZoom = vi.fn();
    render(<PdfScoreViewer path="partituras/x.pdf" zoomInicial={1.2} onZoom={onZoom} />);
    expect(screen.getByTitle('Ajustar al ancho')).toHaveTextContent('120%');

    fireEvent.click(screen.getByRole('button', { name: 'Acercar' }));
    expect(onZoom).toHaveBeenLastCalledWith(1.25);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

// Los paneles flotantes de la lista, la sesión y la canción. El afinador y
// el metrónomo de verdad piden micrófono y audio: aquí se sustituyen.

vi.mock('../pages/Tuner', () => ({ default: () => <div data-testid="afinador">Afinador</div> }));
vi.mock('../pages/Metronome', () => ({
  default: ({ tempoInicial }) => <div data-testid="metronomo" data-tempo={tempoInicial ?? ''} />
}));

const { default: HerramientasFlotantes } = await import('../components/herramientas/HerramientasFlotantes');

const MENSAJE = {
  texto: '*Intro\nPor quién eres tú (Coalo)\n*Moderadas\nMi m\nTu fidelidad (Ingrid Rosario)\nUna que se quitó',
  enlaces: { 2: 'a', 5: 'b', 6: 'borrada' }
};

const CANCIONES = [
  { id: 'a', title: 'Por Quién Eres Tú', key: 'DO' },
  { id: 'b', title: 'Tu Fidelidad', key: 'MIm' }
];

const abrir = (nombre) => fireEvent.click(screen.getByRole('button', { name: nombre }));

let matchMedia;

beforeEach(() => {
  matchMedia = window.matchMedia;
  window.matchMedia = vi.fn(() => ({ matches: false }));
  localStorage.clear();
});

afterEach(() => {
  window.matchMedia = matchMedia;
});

describe('HerramientasFlotantes', () => {
  it('sin lista no ofrece el botón de lista', () => {
    render(<HerramientasFlotantes />);
    expect(screen.queryByRole('button', { name: 'Lista' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Afinador' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Metrónomo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Círculo de quintas' })).toBeInTheDocument();
  });

  it('abre y cierra un panel sin tapar la página (no es una modal)', async () => {
    render(<HerramientasFlotantes />);
    abrir('Afinador');

    expect(await screen.findByTestId('afinador')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Afinador' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar afinador' }));
    expect(screen.queryByTestId('afinador')).toBeNull();
  });

  it('la lista va a la derecha y el afinador a la izquierda, y caben a la vez', async () => {
    render(<HerramientasFlotantes lista={{ mensaje: null, canciones: CANCIONES, onIr: vi.fn() }} />);
    abrir('Lista');
    abrir('Afinador');

    await screen.findByTestId('afinador');
    expect(screen.getByLabelText('Lista')).toHaveAttribute('data-lado', 'derecha');
    expect(screen.getByTestId('afinador').closest('section')).toHaveAttribute('data-lado', 'izquierda');
  });

  it('en un móvil abrir un panel cierra el otro', async () => {
    window.matchMedia = vi.fn(() => ({ matches: true }));
    render(<HerramientasFlotantes lista={{ mensaje: null, canciones: CANCIONES, onIr: vi.fn() }} />);
    abrir('Lista');
    abrir('Afinador');

    await screen.findByTestId('afinador');
    expect(screen.queryByLabelText('Lista')).toBeNull();
    // Y sin arrastre: no hay botón de cambiar de lado
    expect(screen.queryByRole('button', { name: /Mover afinador/ })).toBeNull();
  });

  it('el metrónomo arranca con el tempo de la canción', async () => {
    render(<HerramientasFlotantes metronomo={{ tempoInicial: 72 }} />);
    abrir('Metrónomo');
    expect(await screen.findByTestId('metronomo')).toHaveAttribute('data-tempo', '72');
  });

  it('el círculo de quintas es una imagen de referencia en la notación del músico', () => {
    render(<HerramientasFlotantes notacion="english" />);
    abrir('Círculo de quintas');
    const circulo = screen.getByRole('img', { name: 'Círculo de quintas' });
    expect(within(circulo).getByText('G')).toBeInTheDocument();
    expect(within(circulo).getByText('Em')).toBeInTheDocument();
    expect(within(circulo).queryByRole('button')).toBeNull();
  });

  it('se pueden ocultar los botones que la vista ya tiene', () => {
    render(<HerramientasFlotantes ocultarBotones={['afinador', 'metronomo']} />);
    expect(screen.queryByRole('button', { name: 'Afinador' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Círculo de quintas' })).toBeInTheDocument();
  });
});

describe('Panel "Lista"', () => {
  it('enseña el mensaje del director tal cual, con sus bloques y tonalidades', () => {
    render(<HerramientasFlotantes lista={{ mensaje: MENSAJE, canciones: CANCIONES, onIr: vi.fn() }} />);
    abrir('Lista');

    const panel = screen.getByLabelText('Lista');
    expect(within(panel).getByText('Intro')).toHaveClass('panel-lista-seccion');
    expect(within(panel).getByText('Moderadas')).toHaveClass('panel-lista-seccion');
    expect(panel.querySelector('.panel-lista-tonalidad')).toHaveTextContent('MIm');
    expect(within(panel).getByText('Por quién eres tú (Coalo)')).toBeInTheDocument();
  });

  it('cada canción confirmada lleva a la suya', () => {
    const onIr = vi.fn();
    render(<HerramientasFlotantes lista={{ mensaje: MENSAJE, canciones: CANCIONES, onIr }} />);
    abrir('Lista');

    fireEvent.click(screen.getByRole('button', { name: /Tu fidelidad \(Ingrid Rosario\)/ }));
    expect(onIr).toHaveBeenCalledWith('b');
  });

  it('una canción que ya no está en la lista se lee pero no es un enlace', () => {
    render(<HerramientasFlotantes lista={{ mensaje: MENSAJE, canciones: CANCIONES, onIr: vi.fn() }} />);
    abrir('Lista');

    const linea = screen.getByText('Una que se quitó');
    expect(linea.closest('button')).toBeNull();
  });

  it('sin mensaje, la lista numerada con su tonalidad, y marca la que suena', () => {
    render(<HerramientasFlotantes lista={{ mensaje: null, canciones: CANCIONES, activaId: 'b', onIr: vi.fn() }} />);
    abrir('Lista');

    const panel = screen.getByLabelText('Lista');
    const botones = within(panel).getAllByRole('button').filter((b) => b.classList.contains('panel-lista-ir'));
    expect(botones.map((b) => b.textContent)).toEqual(['1Por Quién Eres TúDO', '2Tu FidelidadMIm']);
    expect(botones[1]).toHaveAttribute('aria-current', 'true');
  });
});

describe('Mover los paneles', () => {
  // jsdom no trae PointerEvent: sin él, React no recibe clientX/clientY
  class PointerEventFalso extends MouseEvent {
    constructor(tipo, init = {}) {
      super(tipo, init);
      this.pointerId = init.pointerId ?? 1;
    }
  }

  beforeEach(() => {
    vi.stubGlobal('PointerEvent', PointerEventFalso);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('el botón ⇄ lo pasa al otro lado y se recuerda', async () => {
    const { unmount } = render(<HerramientasFlotantes />);
    abrir('Afinador');
    await screen.findByTestId('afinador');

    fireEvent.click(screen.getByRole('button', { name: 'Mover afinador a la derecha' }));
    expect(screen.getByLabelText('Afinador')).toHaveAttribute('data-lado', 'derecha');
    unmount();

    render(<HerramientasFlotantes />);
    abrir('Afinador');
    await screen.findByTestId('afinador');
    expect(screen.getByLabelText('Afinador')).toHaveAttribute('data-lado', 'derecha');
  });

  it('arrastrado por la cabecera, se pega al lado donde se suelta y a esa altura', async () => {
    render(<HerramientasFlotantes />);
    abrir('Afinador');
    await screen.findByTestId('afinador');

    const panel = screen.getByLabelText('Afinador');
    const cabecera = panel.querySelector('.panel-flotante-cabecera');
    // Donde está ahora: a la izquierda, arriba
    panel.getBoundingClientRect = () => ({ left: 16, top: 100, width: 360, height: 0 });

    fireEvent.pointerDown(cabecera, { button: 0, clientX: 30, clientY: 110 });
    fireEvent.pointerMove(cabecera, { clientX: 1000, clientY: 310 });
    expect(panel).toHaveClass('arrastrando');
    fireEvent.pointerUp(cabecera, { clientX: 1000, clientY: 310 });

    expect(panel).not.toHaveClass('arrastrando');
    expect(panel).toHaveAttribute('data-lado', 'derecha');
    expect(panel.style.top).toBe('300px');
    expect(panel.style.right).toBe('1rem');
  });

  it('si la ventana encoge (girar la tablet), el panel vuelve a quedar dentro', async () => {
    localStorage.setItem('herramientas:posiciones', JSON.stringify({ afinador: { lado: 'izquierda', top: 600 } }));
    render(<HerramientasFlotantes />);
    abrir('Afinador');
    await screen.findByTestId('afinador');

    const panel = screen.getByLabelText('Afinador');
    Object.defineProperty(panel, 'offsetHeight', { configurable: true, value: 200 });
    expect(panel.style.top).toBe('600px');

    // De vertical a horizontal: 800 → 500 de alto
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 500 });
    fireEvent(window, new Event('resize'));

    // 500 - 76 (la barra) - 200 de alto
    expect(panel.style.top).toBe('224px');
  });

  it('pulsar los botones de la cabecera no empieza un arrastre', async () => {
    render(<HerramientasFlotantes />);
    abrir('Afinador');
    await screen.findByTestId('afinador');

    const cerrar = screen.getByRole('button', { name: 'Cerrar afinador' });
    fireEvent.pointerDown(cerrar, { button: 0, clientX: 5, clientY: 5 });
    expect(screen.getByLabelText('Afinador')).not.toHaveClass('arrastrando');
  });
});

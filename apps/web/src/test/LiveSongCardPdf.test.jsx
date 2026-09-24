import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Una partitura en PDF dentro de la sesión en vivo: se ve la partitura (no
// títulos de sección vacíos) y la tonalidad es un dato, no un selector.

vi.mock('../components/PdfScoreViewer', () => ({
  default: ({ path }) => <div data-testid="visor-pdf" data-path={path} />
}));

const { default: LiveSongCard } = await import('../components/live/LiveSongCard');

const base = {
  index: 0,
  total: 1,
  activa: true,
  fontSize: 18,
  onCambiarTonalidad: vi.fn(),
  onQuitar: vi.fn(),
  onMover: vi.fn(),
  onElegirVoz: vi.fn()
};

describe('LiveSongCard con una partitura en PDF', () => {
  it('muestra la partitura de su voz', () => {
    render(
      <LiveSongCard
        {...base}
        song={{ id: 's3', title: 'Prueba PDF', key: 'DO', rendered: null, pdf: { path: 'partituras/s3/a.pdf' }, voices: [], voiceKey: null }}
      />
    );
    // jsdom no tiene IntersectionObserver: PdfEnLista la abre directamente
    expect(screen.getByTestId('visor-pdf')).toHaveAttribute('data-path', 'partituras/s3/a.pdf');
    expect(screen.queryByText('Cargando…')).toBeNull();
  });

  it('la tonalidad de la banda es un dato: un PDF no se transpone', () => {
    render(
      <LiveSongCard
        {...base}
        song={{ id: 's3', title: 'Prueba PDF', key: 'DO', rendered: null, pdf: { path: 'x.pdf' }, voices: [], voiceKey: null }}
      />
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('DO')).toHaveClass('live-key-badge');
  });
});

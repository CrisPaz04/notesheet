import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// "Subir varios PDF" en el editor: se enseña el reparto y solo se sube al
// confirmarlo.

const mockSubir = vi.fn();
vi.mock('@notesheet/api', () => ({
  subirVariasPartituras: (...a) => mockSubir(...a)
}));

const { default: SubirVariosPdf } = await import('../components/partituras/SubirVariosPdf');

const pdf = (name) => new File(['%PDF'], name, { type: 'application/pdf' });
const SONG = { id: 's1', pdfs: {}, voices: {}, primaryInstrument: 'bb_trumpet', primaryVoiceNumber: '1' };

beforeEach(() => {
  vi.clearAllMocks();
  mockSubir.mockImplementation(async ({ asignados }) => ({
    subidos: asignados.length, errores: [], pdfs: { bb_trumpet: {} }, voices: { bb_trumpet: { 1: '' } }
  }));
});

const elegir = (onSubidos = vi.fn()) => {
  render(<SubirVariosPdf song={SONG} onSubidos={onSubidos} />);
  fireEvent.change(screen.getByTestId('subir-varios-input'), {
    target: { files: [pdf('A--B--Bb_Trumpet_2.pdf'), pdf('A--B--Kazoo.pdf')] }
  });
  return onSubidos;
};

describe('SubirVariosPdf', () => {
  it('enseña el reparto antes de subir', () => {
    elegir();
    expect(screen.getByText(/1 PDF en su voz, 1 sin subir/)).toBeInTheDocument();
    expect(screen.getByText('Trompeta en Sib 2')).toBeInTheDocument();
    expect(screen.getByText('No se reconoce el instrumento')).toBeInTheDocument();
    expect(mockSubir).not.toHaveBeenCalled();
  });

  it('al confirmar sube lo repartido y avisa al editor', async () => {
    const onSubidos = elegir();
    fireEvent.click(screen.getByRole('button', { name: /Subir 1/ }));

    await screen.findByText(/Subidos 1/);
    expect(mockSubir).toHaveBeenCalledWith(expect.objectContaining({ song: SONG }));
    // Sin esto, al guardar el editor pisaría lo subido con su estado viejo
    expect(onSubidos).toHaveBeenCalledWith({ pdfs: { bb_trumpet: {} }, voices: { bb_trumpet: { 1: '' } } });
  });

  it('cancelar no sube nada', async () => {
    elegir();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Subir varios PDF/ })).toBeInTheDocument());
    expect(mockSubir).not.toHaveBeenCalled();
  });
});

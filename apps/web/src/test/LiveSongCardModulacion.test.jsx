import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { elegirEnDesplegable, valorDe } from './utils/desplegable';
import { renderSongContent } from '@notesheet/core';

// Una canción que modula, en la sesión en vivo: un selector por modulación
// junto al de la tonalidad de la banda, y el "Tú" con las dos tonalidades.

const { default: LiveSongCard } = await import('../components/live/LiveSongCard');

const DOC = { id: 's1', title: 'Regocíjate Sión', key: 'LAm', content: 'LA SI DO\n## Ascenso [SIm]\nSI DO# RE' };

const tarjeta = (props = {}, entrada = {}, instrument = 'bb_trumpet') => {
  const song = { id: 's1', title: DOC.title, key: 'LAm', originalKey: 'LAm', ...entrada };
  const rendered = renderSongContent(DOC.content, { baseKey: 'LAm', targetKey: song.key, instrument, modulaciones: song.modulaciones });
  return render(
    <LiveSongCard
      index={0} total={1} activa fontSize={18}
      onCambiarTonalidad={vi.fn()} onQuitar={vi.fn()} onMover={vi.fn()} onElegirVoz={vi.fn()}
      song={{ ...song, cargada: DOC, rendered, vistas: { principal: rendered.formatted }, voices: [], voiceKey: null }}
      {...props}
    />
  );
};

describe('LiveSongCard con modulaciones', () => {
  it('tiene un selector por modulación, y elegir avisa a la sesión con el ajuste', async () => {
    const onCambiarModulacion = vi.fn();
    const user = userEvent.setup();
    tarjeta({ onCambiarModulacion });

    const selector = screen.getByRole('combobox', { name: 'Tonalidad de Ascenso' });
    expect(valorDe(selector)).toBe('0');
    await elegirEnDesplegable(user, selector, 'LAm · sin modulación');
    expect(onCambiarModulacion).toHaveBeenCalledWith('s1', 1, -2);
  });

  it('con el ajuste de la sesión, el selector lo marca', () => {
    tarjeta({ onCambiarModulacion: vi.fn() }, { modulaciones: { 1: -2 } });
    expect(valorDe(screen.getByRole('combobox', { name: 'Tonalidad de Ascenso' }))).toBe('-2');
  });

  it('el saxo ve en "Tú" sus dos tonalidades', () => {
    tarjeta({ onCambiarModulacion: vi.fn() }, {}, 'eb_alto_sax');
    expect(screen.getByText('MIm → FA#m')).toHaveClass('live-key-mine');
  });
});

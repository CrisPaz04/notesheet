import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// MetronomeEngine usa Web Audio, que no existe en jsdom
vi.mock('@notesheet/core/src/audio/metronomeEngine', () => {
  class FakeEngine {
    constructor() {
      this.setTempo = vi.fn();
      this.setTimeSignature = vi.fn();
      this.setSubdivision = vi.fn();
      this.setSoundPreset = vi.fn();
      this.setVolume = vi.fn();
      this.playTestSound = vi.fn().mockResolvedValue(undefined);
      this.start = vi.fn();
      this.stop = vi.fn();
      this.getIsPlaying = vi.fn(() => false);
      this.setOnMeasureComplete = vi.fn();
    }
  }
  return {
    default: FakeEngine,
    TIME_SIGNATURES: {
      '2/4': { beats: 2 }, '3/4': { beats: 3 }, '4/4': { beats: 4 }, '6/8': { beats: 6 }
    },
    SUBDIVISIONS: { quarter: { name: 'Negras' } },
    SOUND_PRESETS: { classic: { name: 'Clásico' } }
  };
});

const mockGetMetronomePreferences = vi.fn();
const mockSaveMetronomePreferences = vi.fn();
vi.mock('@notesheet/api', () => ({
  getMetronomePreferences: (...a) => mockGetMetronomePreferences(...a),
  saveMetronomePreferences: (...a) => mockSaveMetronomePreferences(...a)
}));

const mockAuth = { currentUser: { uid: 'u1' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: Metronome } = await import('../pages/Metronome');

// El número grande de la tarjeta principal (la clase la pone Metronome.jsx)
const bpmEnPantalla = async () => {
  await screen.findByRole('button', { name: /Iniciar/ });
  return document.querySelector('.bpm-value').textContent;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockAuth.currentUser = { uid: 'u1' };
  mockSaveMetronomePreferences.mockResolvedValue({});
});

describe('Metronome (página)', () => {
  it('arranca con el tempo guardado en las preferencias', async () => {
    mockGetMetronomePreferences.mockResolvedValue({ bpm: 90, timeSignature: '3/4' });
    render(<Metronome />);
    expect(await bpmEnPantalla()).toBe('90');
    expect(document.querySelector('.bpm-display').textContent).toMatch(/3\/4 •/);
  });

  it('el tempo de la canción manda sobre el guardado', async () => {
    mockGetMetronomePreferences.mockResolvedValue({ bpm: 90, timeSignature: '3/4' });
    render(<Metronome tempoInicial={72} compasInicial="6/8" />);
    expect(await bpmEnPantalla()).toBe('72');
    expect(document.querySelector('.bpm-display').textContent).toMatch(/6\/8 •/);
  });

  it('un compás que el metrónomo no conoce se ignora', async () => {
    mockGetMetronomePreferences.mockResolvedValue({ bpm: 90, timeSignature: '3/4' });
    render(<Metronome tempoInicial={72} compasInicial="11/16" />);
    expect(await bpmEnPantalla()).toBe('72');
    expect(document.querySelector('.bpm-display').textContent).toMatch(/3\/4 •/);
  });
});

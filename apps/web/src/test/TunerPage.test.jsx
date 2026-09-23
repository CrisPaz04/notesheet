import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

// TunerEngine necesita getUserMedia y AnalyserNode, que no existen en jsdom
vi.mock('@notesheet/core/src/audio/tunerEngine', () => {
  class FakeTunerEngine {
    constructor() {
      this.initialize = vi.fn(async () => {});
      this.setReferenceFrequency = vi.fn();
      this.start = vi.fn();
      this.stop = vi.fn();
      this.destroy = vi.fn();
      this.playReferenceTone = vi.fn();
      this.stopReferenceTone = vi.fn();
    }
  }
  return { default: FakeTunerEngine };
});

const mockGetTunerPreferences = vi.fn();
const mockSaveTunerPreferences = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();
vi.mock('@notesheet/api', () => ({
  getTunerPreferences: (...a) => mockGetTunerPreferences(...a),
  saveTunerPreferences: (...a) => mockSaveTunerPreferences(...a),
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: (...a) => mockUpdateUserPreferences(...a)
}));

const mockAuth = { currentUser: { uid: 'u1' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: Tuner } = await import('../pages/Tuner');

const PREFS = {
  referenceFrequency: 442,
  lastInstrument: 'eb_alto_sax',
  showConcertPitch: false,
  stringModeEnabled: true,
  selectedTuning: 'bass_standard'
};

// El LA de referencia que enseña la caja numérica de TunerControls
const diapasonEnPantalla = async () => {
  await screen.findByRole('button', { name: /Iniciar Afinación/ });
  return screen.getByRole('spinbutton').value;
};

// Deja pasar el debounce con que useTuner guarda en Firebase (500 ms). Hay que
// esperar y luego comprobar: un waitFor daría por buena la ausencia de
// llamadas nada más empezar.
const dejarPasarElGuardado = () =>
  act(() => new Promise((r) => setTimeout(r, 700)));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockAuth.currentUser = { uid: 'u1' };
  mockSaveTunerPreferences.mockResolvedValue({});
  mockGetUserPreferences.mockResolvedValue({});
  mockUpdateUserPreferences.mockResolvedValue({});
});

describe('Tuner (página)', () => {
  it('arranca con el diapasón guardado en las preferencias', async () => {
    mockGetTunerPreferences.mockResolvedValue(PREFS);
    render(<Tuner />);
    expect(await diapasonEnPantalla()).toBe('442');
  });

  it('también en el modal de SongView (compact)', async () => {
    mockGetTunerPreferences.mockResolvedValue(PREFS);
    render(<Tuner compact />);
    expect(await diapasonEnPantalla()).toBe('442');
  });

  it('no pisa las preferencias del usuario con las de por defecto', async () => {
    mockGetTunerPreferences.mockResolvedValue(PREFS);
    render(<Tuner />);
    await diapasonEnPantalla();
    await dejarPasarElGuardado();

    expect(JSON.parse(localStorage.getItem('tunerPreferences'))).toEqual(PREFS);
    // Si se guarda algo, que sea lo que ya tenía: nunca 440 ni la trompeta
    for (const [, guardadas] of mockSaveTunerPreferences.mock.calls) {
      expect(guardadas).toEqual(PREFS);
    }
  });

  it('sin sesión, arranca con las de localStorage', async () => {
    mockAuth.currentUser = null;
    localStorage.setItem('tunerPreferences', JSON.stringify(PREFS));
    render(<Tuner />);
    expect(await diapasonEnPantalla()).toBe('442');
    expect(mockGetTunerPreferences).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('tunerPreferences'))).toEqual(PREFS);
  });
});

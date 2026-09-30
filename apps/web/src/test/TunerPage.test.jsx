import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';

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
  verNotasComo: 'eb_alto_sax'
};

// El LA de referencia que enseña la caja numérica de TunerControls
const diapasonEnPantalla = async () => {
  await screen.findByRole('button', { name: /Iniciar afinación/ });
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
  it('ya no tiene modo cuerdas', async () => {
    mockGetTunerPreferences.mockResolvedValue(PREFS);
    render(<Tuner />);
    await diapasonEnPantalla();
    expect(screen.queryByText(/Modo Cuerdas/)).not.toBeInTheDocument();
  });

  it('pregunta en qué notas se ven, con el instrumento guardado', async () => {
    mockGetTunerPreferences.mockResolvedValue(PREFS);
    render(<Tuner />);
    await diapasonEnPantalla();
    expect(screen.getByRole('combobox', { name: 'Ver las notas como' })).toHaveTextContent('Saxofón Alto en Mib');
    // Y lo explica: el DO del saxo alto suena MIb
    expect(screen.getByText(/su DO suena MIb/)).toBeInTheDocument();
  });

  it('los tonos de referencia se pueden tocar sin haber iniciado el afinador', async () => {
    mockGetTunerPreferences.mockResolvedValue({ referenceFrequency: 440, verNotasComo: 'concierto' });
    render(<Tuner />);
    await diapasonEnPantalla();
    const la = screen.getByRole('button', { name: 'LA' });
    expect(la).toBeEnabled();
    fireEvent.click(la);
    expect(la).toHaveAttribute('aria-pressed', 'true');
  });

  // Las doce notas una vez, con las alteradas, y la octava aparte
  it('los tonos: doce notas y un selector de octava', async () => {
    mockGetTunerPreferences.mockResolvedValue({ referenceFrequency: 440, verNotasComo: 'concierto' });
    render(<Tuner />);
    await diapasonEnPantalla();
    const notas = [...document.querySelectorAll('.reference-note-btn')].map((b) => b.textContent);
    expect(notas).toEqual(['DO', 'DO#', 'RE', 'RE#', 'MI', 'FA', 'FA#', 'SOL', 'SOL#', 'LA', 'LA#', 'SI']);

    // El LA en la octava 4 es el del diapasón; en la 3, una octava abajo
    expect(screen.getByRole('button', { name: 'LA' })).toHaveAttribute('title', 'LA4 · 440.0 Hz');
    fireEvent.click(within(screen.getByRole('group', { name: 'Octava' })).getByRole('button', { name: '3' }));
    expect(screen.getByRole('button', { name: 'LA' })).toHaveAttribute('title', 'LA3 · 220.0 Hz');
  });

  it('en las notas de la trompeta, su LA4 suena SOL4', async () => {
    mockGetTunerPreferences.mockResolvedValue({ referenceFrequency: 440, verNotasComo: 'bb_trumpet' });
    render(<Tuner />);
    await diapasonEnPantalla();
    expect(screen.getByRole('button', { name: 'LA' })).toHaveAttribute('title', 'LA4 (suena SOL4) · 392.0 Hz');
  });

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

    // Abrirlo no es un cambio: no se guarda nada (y menos 440 o concierto)
    expect(localStorage.getItem('tunerPreferences')).toBeNull();
    expect(mockSaveTunerPreferences).not.toHaveBeenCalled();
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

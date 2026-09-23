import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();

vi.mock('@notesheet/api', () => ({
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: (...a) => mockUpdateUserPreferences(...a)
}));

const mockAuth = { currentUser: { uid: 'user-1' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

// El tema vive en su propio hook y cambiarlo relanza la carga de preferencias,
// que es justo donde está lo interesante.
const temaActual = { valor: 'light' };
const mockChangeTheme = vi.fn(async (t) => { temaActual.valor = t; });

vi.mock('../hooks/useThemeWithAuth', () => ({
  useThemeWithAuth: () => ({
    theme: temaActual.valor,
    changeTheme: mockChangeTheme,
    getThemesByCategory: () => ({
      Claros: [{ id: 'light', name: 'Claro', category: 'Claros' }],
      Oscuros: [{ id: 'dark', name: 'Oscuro', category: 'Oscuros' }]
    })
  })
}));

const { default: UserPreferences } = await import('../pages/UserPreferences');

const GUARDADAS = {
  defaultInstrument: 'bb_trumpet',
  defaultNotationSystem: 'latin',
  defaultFontSize: 18
};

beforeEach(() => {
  vi.clearAllMocks();
  temaActual.valor = 'light';
  mockAuth.currentUser = { uid: 'user-1' };
  mockGetUserPreferences.mockResolvedValue(GUARDADAS);
  mockUpdateUserPreferences.mockResolvedValue({});
});

const renderPrefs = async () => {
  render(<UserPreferences />);
  await screen.findByRole('button', { name: /Guardar Preferencias/i });
};

// Los radios y el slider se localizan por id: los textos llevan tildes y
// cambian, los id no.
const elegirNotacion = async (user, sistema) => {
  await user.click(document.getElementById(`pref-notation-${sistema}-only`));
};

const guardar = async (user) => {
  await user.click(screen.getByRole('button', { name: /Guardar Preferencias/i }));
  await waitFor(() => expect(mockUpdateUserPreferences).toHaveBeenCalled());
  return mockUpdateUserPreferences.mock.calls.at(-1)[1];
};

describe('UserPreferences', () => {
  it('carga las preferencias del usuario', async () => {
    await renderPrefs();
    expect(mockGetUserPreferences).toHaveBeenCalledWith('user-1');
  });

  it('no consulta nada sin usuario', async () => {
    mockAuth.currentUser = null;
    await renderPrefs();
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
  });

  it('muestra un error si la carga falla', async () => {
    mockGetUserPreferences.mockRejectedValue(new Error('sin permisos'));
    render(<UserPreferences />);
    expect(await screen.findByText(/Error al cargar preferencias/i)).toBeInTheDocument();
  });

  describe('cambiar y guardar', () => {
    it('guarda el sistema de notación elegido', async () => {
      const user = userEvent.setup();
      await renderPrefs();

      await elegirNotacion(user, 'english');
      const guardado = await guardar(user);

      expect(guardado.defaultNotationSystem).toBe('english');
    });

    it('al guardar la notación, la deja lista para la siguiente vista', async () => {
      // Las demás vistas arrancan con la copia del dispositivo mientras llega
      // el perfil: si no se actualiza aquí, enseñan un instante la vieja.
      localStorage.clear();
      const user = userEvent.setup();
      await renderPrefs();

      await elegirNotacion(user, 'english');
      await guardar(user);

      await waitFor(() => expect(localStorage.getItem('notacion')).toBe('english'));
    });

    it('guarda el tamaño de texto', async () => {
      const user = userEvent.setup();
      await renderPrefs();

      // React no escucha eventos nativos: hace falta fireEvent
      fireEvent.change(document.getElementById('pref-font-size-slider'), {
        target: { value: '22' }
      });

      const guardado = await guardar(user);
      expect(guardado.defaultFontSize).toBe(22);
    });

    it('guarda con el uid del usuario', async () => {
      const user = userEvent.setup();
      await renderPrefs();
      await guardar(user);

      expect(mockUpdateUserPreferences.mock.calls.at(-1)[0]).toBe('user-1');
    });

    it('avisa si falla el guardado', async () => {
      mockUpdateUserPreferences.mockRejectedValue(new Error('sin permisos'));
      const user = userEvent.setup();
      await renderPrefs();

      await user.click(screen.getByRole('button', { name: /Guardar Preferencias/i }));

      expect(await screen.findByText(/Error al guardar preferencias/i)).toBeInTheDocument();
    });
  });

  describe('tema', () => {
    it('aplica el tema en cuanto se elige, sin esperar a guardar', async () => {
      const user = userEvent.setup();
      await renderPrefs();

      await user.click(screen.getByLabelText('Oscuro'));

      expect(mockChangeTheme).toHaveBeenCalledWith('dark');
    });

    // El efecto de carga se relanza cuando cambia el tema y vuelve a leer de
    // Firestore. Si lo leído pisa lo que el usuario acaba de tocar, se pierden
    // los cambios sin avisar: eliges instrumento, cambias el tema y el
    // instrumento vuelve solo al anterior.
    it('cambiar el tema no descarta los cambios sin guardar', async () => {
      const user = userEvent.setup();
      await renderPrefs();

      // 1. Cambiar la notación, sin guardar
      await elegirNotacion(user, 'english');

      // 2. Cambiar el tema
      await user.click(screen.getByLabelText('Oscuro'));

      // 3. La notación elegida debe seguir ahí
      const guardado = await guardar(user);
      expect(guardado.defaultNotationSystem).toBe('english');
    });
  });
});

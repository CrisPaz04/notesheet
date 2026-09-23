import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();
vi.mock('@notesheet/api', () => ({
  getUserPreferences: (...a) => mockGetUserPreferences(...a),
  updateUserPreferences: (...a) => mockUpdateUserPreferences(...a)
}));

const { default: useNotacionPreferida, recordarNotacionEnDispositivo } =
  await import('../hooks/useNotacionPreferida');

const USUARIO = { uid: 'u1' };
const INVITADO = { uid: 'anon', isAnonymous: true };

// Deja pasar las promesas pendientes (la lectura del perfil)
const esperarPromesas = () => act(() => new Promise((r) => setTimeout(r, 0)));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockGetUserPreferences.mockResolvedValue({});
  mockUpdateUserPreferences.mockResolvedValue({});
});

describe('useNotacionPreferida', () => {
  it('sin nada guardado arranca en latina', () => {
    const { result } = renderHook(() => useNotacionPreferida(null));
    expect(result.current[0]).toBe('latin');
  });

  it('arranca con la copia del dispositivo, sin esperar al perfil', () => {
    localStorage.setItem('notacion', 'english');
    mockGetUserPreferences.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));
    expect(result.current[0]).toBe('english');
  });

  it('el perfil manda sobre la copia del dispositivo', async () => {
    localStorage.setItem('notacion', 'latin');
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'english' });
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));

    await waitFor(() => expect(result.current[0]).toBe('english'));
    expect(mockGetUserPreferences).toHaveBeenCalledWith('u1');
    // Y la copia queda al día para la próxima vista
    expect(localStorage.getItem('notacion')).toBe('english');
  });

  it('cambiarla la guarda en el perfil y en el dispositivo', async () => {
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));
    await esperarPromesas();

    act(() => result.current[1]('english'));

    expect(result.current[0]).toBe('english');
    expect(localStorage.getItem('notacion')).toBe('english');
    await waitFor(() =>
      expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u1', { defaultNotationSystem: 'english' })
    );
  });

  it('si el perfil llega después de cambiarla aquí, no la pisa', async () => {
    let responder;
    mockGetUserPreferences.mockReturnValue(new Promise((r) => { responder = r; }));
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));

    act(() => result.current[1]('english'));
    await act(async () => responder({ defaultNotationSystem: 'latin' }));
    await esperarPromesas();

    expect(result.current[0]).toBe('english');
  });

  it('un invitado no lee ni escribe el perfil, pero lo recuerda en el dispositivo', async () => {
    const { result } = renderHook(() => useNotacionPreferida(INVITADO, 'live:notacion'));
    await esperarPromesas();

    act(() => result.current[1]('english'));
    await esperarPromesas();

    expect(result.current[0]).toBe('english');
    expect(localStorage.getItem('live:notacion')).toBe('english');
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('sin usuario tampoco toca el perfil', async () => {
    const { result } = renderHook(() => useNotacionPreferida(null));
    act(() => result.current[1]('english'));
    await esperarPromesas();
    expect(mockGetUserPreferences).not.toHaveBeenCalled();
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('ignora un valor del perfil que no entiende', async () => {
    mockGetUserPreferences.mockResolvedValue({ defaultNotationSystem: 'solfeo' });
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));
    await esperarPromesas();
    expect(result.current[0]).toBe('latin');
  });

  it('ignora un cambio a un valor que no existe', async () => {
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));
    await esperarPromesas();
    act(() => result.current[1]('solfeo'));
    await esperarPromesas();
    expect(result.current[0]).toBe('latin');
    expect(mockUpdateUserPreferences).not.toHaveBeenCalled();
  });

  it('si el perfil no se puede leer, sigue con la copia del dispositivo', async () => {
    localStorage.setItem('notacion', 'english');
    mockGetUserPreferences.mockRejectedValue(new Error('sin red'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useNotacionPreferida(USUARIO));
    await esperarPromesas();
    expect(result.current[0]).toBe('english');
    error.mockRestore();
  });
});

describe('recordarNotacionEnDispositivo', () => {
  it('actualiza la copia que leerá la siguiente vista', () => {
    recordarNotacionEnDispositivo('english');
    expect(localStorage.getItem('notacion')).toBe('english');
  });

  it('no guarda valores que no existen', () => {
    recordarNotacionEnDispositivo('solfeo');
    expect(localStorage.getItem('notacion')).toBeNull();
  });
});

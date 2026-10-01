import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInit = vi.fn();
const mockSetUser = vi.fn();
const mockHandler = vi.fn(() => 'manejador');
vi.mock('@sentry/react', () => ({
  init: (...a) => mockInit(...a),
  setUser: (...a) => mockSetUser(...a),
  reactErrorHandler: (...a) => mockHandler(...a),
}));

const { iniciarSentry, opcionesDeRaiz, ponerUsuarioEnSentry } = await import('../lib/sentry');

beforeEach(() => vi.clearAllMocks());

describe('registro de errores (Sentry)', () => {
  it('sin DSN no se inicia nada: desarrollo, tests y antes de crear la cuenta', () => {
    expect(iniciarSentry({})).toBe(false);
    expect(mockInit).not.toHaveBeenCalled();
    expect(opcionesDeRaiz()).toEqual({});
  });

  it('con DSN se inicia, sin datos personales', () => {
    expect(iniciarSentry({ VITE_SENTRY_DSN: 'https://clave@o1.ingest.sentry.io/1', MODE: 'production' }, 'abc123')).toBe(true);
    expect(mockInit).toHaveBeenCalledTimes(1);
    const opciones = mockInit.mock.calls[0][0];
    expect(opciones).toMatchObject({
      dsn: 'https://clave@o1.ingest.sentry.io/1',
      environment: 'production',
      release: 'abc123',
      sendDefaultPii: false,
    });
  });

  it('con Sentry activo, React le pasa sus errores', () => {
    iniciarSentry({ VITE_SENTRY_DSN: 'https://clave@o1.ingest.sentry.io/1' });
    const opciones = opcionesDeRaiz();
    expect(Object.keys(opciones).sort()).toEqual(['onCaughtError', 'onRecoverableError', 'onUncaughtError']);
    expect(opciones.onUncaughtError).toBe('manejador');
  });

  it('del usuario solo manda el id, nunca el correo ni el nombre', () => {
    iniciarSentry({ VITE_SENTRY_DSN: 'https://clave@o1.ingest.sentry.io/1' });
    ponerUsuarioEnSentry({ uid: 'u1', email: 'lucia@iglesia.org', displayName: 'Lucía' });
    expect(mockSetUser).toHaveBeenLastCalledWith({ id: 'u1' });
    ponerUsuarioEnSentry(null);
    expect(mockSetUser).toHaveBeenLastCalledWith(null);
  });
});

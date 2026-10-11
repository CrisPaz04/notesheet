import { describe, it, expect, vi } from 'vitest';
import { registrarServiceWorker } from '../lib/registrarServiceWorker';

// Un navegador y una ventana de mentira: el registro espera al `load`
const entorno = (register) => {
  const oyentes = {};
  const ventana = { addEventListener: (tipo, fn) => { oyentes[tipo] = fn; } };
  const nav = register ? { serviceWorker: { register } } : {};
  return { ventana, nav, cargar: () => oyentes.load?.() };
};

describe('registrarServiceWorker', () => {
  it('al cargar la página registra /sw.js en la raíz, como el script del plugin', async () => {
    const register = vi.fn().mockResolvedValue({});
    const { ventana, nav, cargar } = entorno(register);
    registrarServiceWorker(nav, ventana);
    expect(register).not.toHaveBeenCalled();
    await cargar();
    expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
  });

  // El aviso de Sentry (JAVASCRIPT-REACT-3): un WebView de Android rechazó el
  // registro, y sin catch era un rechazo sin gestionar. La app funciona igual.
  it('si el navegador rechaza el registro, avisa y sigue: no queda un rechazo sin gestionar', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const register = vi.fn().mockRejectedValue(new Error('Rejected'));
    const { ventana, nav, cargar } = entorno(register);
    registrarServiceWorker(nav, ventana);
    await expect(cargar()).resolves.toBeUndefined();
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining('service worker'), expect.any(Error));
    aviso.mockRestore();
  });

  it('sin service worker en el navegador, no hace nada', () => {
    const { ventana, nav } = entorno(null);
    const espia = vi.spyOn(ventana, 'addEventListener');
    expect(() => registrarServiceWorker(nav, ventana)).not.toThrow();
    expect(espia).not.toHaveBeenCalled();
  });
});

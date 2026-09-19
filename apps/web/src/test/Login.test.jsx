import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const mockLogin = vi.fn();
const mockLoginWithGoogle = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, loginWithGoogle: mockLoginWithGoogle })
}));

const { default: Login } = await import('../pages/Login');

const campo = (id) => document.getElementById(id);

const entrar = async (user, email = 'lucia@iglesia.org', clave = 'secreta123') => {
  await user.type(campo('email'), email);
  await user.type(campo('password'), clave);
  await user.click(screen.getByRole('button', { name: /INICIAR SESIÓN/i }));
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue({ user: { uid: 'user-1' } });
  mockLoginWithGoogle.mockResolvedValue({ user: { uid: 'user-1' } });
});

describe('Login', () => {
  it('entra con email y contraseña y va al dashboard', async () => {
    const user = userEvent.setup();
    render(<Login />);

    await entrar(user);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('lucia@iglesia.org', 'secreta123');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('muestra el error si las credenciales fallan', async () => {
    mockLogin.mockRejectedValue(new Error('contraseña incorrecta'));
    const user = userEvent.setup();
    render(<Login />);

    await entrar(user);

    expect(await screen.findByText(/Error al iniciar sesión/i)).toBeInTheDocument();
    expect(screen.getByText(/contraseña incorrecta/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('deja volver a intentarlo tras un fallo', async () => {
    mockLogin.mockRejectedValueOnce(new Error('mal'));
    const user = userEvent.setup();
    render(<Login />);

    await entrar(user);
    await screen.findByText(/Error al iniciar sesión/i);

    // El botón no puede quedarse bloqueado
    expect(screen.getByRole('button', { name: /INICIAR SESIÓN/i })).not.toBeDisabled();
  });

  describe('entrar con Google', () => {
    const botonGoogle = () => screen.getByRole('button', { name: /Google/i });

    it('entra y va al dashboard', async () => {
      const user = userEvent.setup();
      render(<Login />);

      await user.click(botonGoogle());

      await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    // Cerrar la ventana de Google es una acción normal del usuario, no un
    // fallo: no debe dejar un error rojo en pantalla.
    it('no muestra error si el usuario cierra la ventana', async () => {
      const cerrada = new Error('cerrada');
      cerrada.code = 'auth/popup-closed-by-user';
      mockLoginWithGoogle.mockRejectedValue(cerrada);

      const user = userEvent.setup();
      render(<Login />);
      await user.click(botonGoogle());

      await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());
      expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('tampoco si se cancela la petición', async () => {
      const cancelada = new Error('cancelada');
      cancelada.code = 'auth/cancelled-popup-request';
      mockLoginWithGoogle.mockRejectedValue(cancelada);

      const user = userEvent.setup();
      render(<Login />);
      await user.click(botonGoogle());

      await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());
      expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
    });

    it('explica qué hacer si el navegador bloquea la ventana', async () => {
      const bloqueada = new Error('bloqueada');
      bloqueada.code = 'auth/popup-blocked';
      mockLoginWithGoogle.mockRejectedValue(bloqueada);

      const user = userEvent.setup();
      render(<Login />);
      await user.click(botonGoogle());

      expect(await screen.findByText(/bloqueó el popup/i)).toBeInTheDocument();
    });

    it('avisa de cualquier otro fallo', async () => {
      mockLoginWithGoogle.mockRejectedValue(new Error('red caída'));

      const user = userEvent.setup();
      render(<Login />);
      await user.click(botonGoogle());

      expect(await screen.findByText(/Error al iniciar sesión con Google/i)).toBeInTheDocument();
    });
  });

  it('enlaza al registro', () => {
    render(<Login />);
    expect(screen.getByRole('link', { name: /Regístrate aquí/i }))
      .toHaveAttribute('href', '/register');
  });
});

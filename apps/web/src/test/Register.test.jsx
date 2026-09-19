import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const mockRegister = vi.fn();
const mockLoginWithGoogle = vi.fn();
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister, loginWithGoogle: mockLoginWithGoogle })
}));

const { default: Register } = await import('../pages/Register');

const campo = (id) => document.getElementById(id);
const botonRegistro = () => screen.getByRole('button', { name: /CREAR CUENTA|REGISTRARSE/i });

const registrar = async (user, { email = 'lucia@iglesia.org', clave = 'secreta123', confirmar = 'secreta123' } = {}) => {
  await user.type(campo('email'), email);
  await user.type(campo('password'), clave);
  await user.type(campo('confirmPassword'), confirmar);
  await user.click(botonRegistro());
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRegister.mockResolvedValue({ user: { uid: 'user-1' } });
  mockLoginWithGoogle.mockResolvedValue({ user: { uid: 'user-1' } });
});

describe('Register', () => {
  it('crea la cuenta y va al dashboard', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await registrar(user);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('lucia@iglesia.org', 'secreta123');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  // La comprobación es local: no tiene sentido molestar a Firebase para saber
  // que el usuario se equivocó al repetir la contraseña.
  it('no llama a la API si las contraseñas no coinciden', async () => {
    const user = userEvent.setup();
    render(<Register />);

    await registrar(user, { clave: 'secreta123', confirmar: 'otracosa' });

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('muestra el error si el registro falla', async () => {
    mockRegister.mockRejectedValue(new Error('ese correo ya está en uso'));
    const user = userEvent.setup();
    render(<Register />);

    await registrar(user);

    expect(await screen.findByText(/Error al registrarse/i)).toBeInTheDocument();
    expect(screen.getByText(/ya está en uso/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('limpia el error al reintentar', async () => {
    mockRegister.mockRejectedValueOnce(new Error('fallo temporal'));
    const user = userEvent.setup();
    render(<Register />);

    await registrar(user);
    await screen.findByText(/Error al registrarse/i);

    await user.click(botonRegistro());

    await waitFor(() => {
      expect(screen.queryByText(/fallo temporal/i)).not.toBeInTheDocument();
    });
  });

  describe('registrarse con Google', () => {
    const botonGoogle = () => screen.getByRole('button', { name: /Google/i });

    it('crea la cuenta y va al dashboard', async () => {
      const user = userEvent.setup();
      render(<Register />);

      await user.click(botonGoogle());

      await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('no muestra error si el usuario cierra la ventana', async () => {
      const cerrada = new Error('cerrada');
      cerrada.code = 'auth/popup-closed-by-user';
      mockLoginWithGoogle.mockRejectedValue(cerrada);

      const user = userEvent.setup();
      render(<Register />);
      await user.click(botonGoogle());

      await waitFor(() => expect(mockLoginWithGoogle).toHaveBeenCalled());
      expect(screen.queryByText(/Error/i)).not.toBeInTheDocument();
    });

    it('explica qué hacer si el navegador bloquea la ventana', async () => {
      const bloqueada = new Error('bloqueada');
      bloqueada.code = 'auth/popup-blocked';
      mockLoginWithGoogle.mockRejectedValue(bloqueada);

      const user = userEvent.setup();
      render(<Register />);
      await user.click(botonGoogle());

      expect(await screen.findByText(/bloqueó el popup/i)).toBeInTheDocument();
    });
  });

  it('enlaza al inicio de sesión', () => {
    render(<Register />);
    expect(screen.getByRole('link', { name: /Inicia sesión aquí/i }))
      .toHaveAttribute('href', '/login');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks ---
// `Navigate` se sustituye por un marcador que deja ver a dónde se redirigió,
// que es justo lo que hay que comprobar aquí.
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }) => <div data-testid="redirigido" data-a={to}>redirigido a {to}</div>
}));

const mockAuth = { currentUser: null, canEditSongs: () => false, loading: false };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: ProtectedRoute, EditorRoute } = await import('../components/ProtectedRoute');

const Protegido = () => <div>contenido protegido</div>;

const destinoRedireccion = () =>
  screen.queryByTestId('redirigido')?.getAttribute('data-a') ?? null;

beforeEach(() => {
  mockAuth.currentUser = null;
  mockAuth.canEditSongs = () => false;
  mockAuth.loading = false;
});

describe('ProtectedRoute', () => {
  it('deja pasar a un usuario autenticado', () => {
    mockAuth.currentUser = { uid: 'user-1' };
    render(<ProtectedRoute><Protegido /></ProtectedRoute>);

    expect(screen.getByText('contenido protegido')).toBeInTheDocument();
    expect(destinoRedireccion()).toBeNull();
  });

  it('manda al login a quien no ha entrado', () => {
    render(<ProtectedRoute><Protegido /></ProtectedRoute>);

    expect(destinoRedireccion()).toBe('/login');
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
  });

  // Lo que importa de este caso: mientras se resuelve la sesión NO se puede
  // enseñar el contenido ni redirigir. Si se redirigiera, a un usuario con
  // sesión válida lo echaría al login en cada recarga.
  it('mientras carga no enseña nada ni redirige', () => {
    mockAuth.loading = true;
    render(<ProtectedRoute><Protegido /></ProtectedRoute>);

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(destinoRedireccion()).toBeNull();
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  it('sigue cargando aunque ya haya usuario', () => {
    mockAuth.loading = true;
    mockAuth.currentUser = { uid: 'user-1' };
    render(<ProtectedRoute><Protegido /></ProtectedRoute>);

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
  });
});

describe('EditorRoute', () => {
  it('deja pasar a un editor', () => {
    mockAuth.currentUser = { uid: 'user-1' };
    mockAuth.canEditSongs = () => true;
    render(<EditorRoute><Protegido /></EditorRoute>);

    expect(screen.getByText('contenido protegido')).toBeInTheDocument();
  });

  it('manda al login a quien no ha entrado', () => {
    mockAuth.canEditSongs = () => true;
    render(<EditorRoute><Protegido /></EditorRoute>);

    expect(destinoRedireccion()).toBe('/login');
  });

  // Un viewer sí tiene sesión: no se le manda al login sino al dashboard.
  it('manda al dashboard a un usuario sin permiso de edición', () => {
    mockAuth.currentUser = { uid: 'user-1' };
    mockAuth.canEditSongs = () => false;
    render(<EditorRoute><Protegido /></EditorRoute>);

    expect(destinoRedireccion()).toBe('/dashboard');
    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
  });

  it('comprueba la sesión antes que el permiso', () => {
    // Sin sesión y sin permiso, la redirección correcta es al login
    render(<EditorRoute><Protegido /></EditorRoute>);
    expect(destinoRedireccion()).toBe('/login');
  });

  it('mientras carga no enseña nada ni redirige', () => {
    mockAuth.loading = true;
    mockAuth.currentUser = { uid: 'user-1' };
    mockAuth.canEditSongs = () => true;
    render(<EditorRoute><Protegido /></EditorRoute>);

    expect(screen.queryByText('contenido protegido')).not.toBeInTheDocument();
    expect(destinoRedireccion()).toBeNull();
  });
});

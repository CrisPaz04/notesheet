// Las dos puertas de entrada a una sesión: abrirla desde una lista, y entrar
// tecleando el código cuando el enlace no llega entero.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockCreateSession = vi.fn();
const mockNavigate = vi.fn();

// Las reglas del alfabeto (que la O es un cero, que la U no existe) son del
// servicio y están probadas en `sessions.test.js`. Lo que le toca a la página
// es delegar en ellas, así que aquí se simulan con algo reconocible y se
// comprueba el cableado, no la gramática.
const mockNormalize = vi.fn((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, ''));
const mockIsValid = vi.fn((s) => s.length === 6);

vi.mock('@notesheet/api', () => ({
  normalizeSessionCode: (...a) => mockNormalize(...a),
  isValidSessionCode: (...a) => mockIsValid(...a),
  SESSION_CODE_LENGTH: 6,
  createSession: (...a) => mockCreateSession(...a)
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

const { default: StartLiveButton } = await import('../components/live/StartLiveButton');
const { default: JoinLive } = await import('../pages/JoinLive');

const USER = { uid: 'u1', displayName: 'Cristhian' };
const LISTA = {
  id: 'p1',
  name: 'Domingo',
  songs: [{ id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' }]
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSession.mockResolvedValue({ code: 'K7M2QX' });
});

describe('abrir una sesión desde una lista', () => {
  it('no se ofrece a quien no ha iniciado sesión', () => {
    const { container } = render(<StartLiveButton playlist={LISTA} user={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  // La sesión copia la lista: lo que se decida durante el servicio no
  // reescribe el repertorio guardado.
  it('crea la sesión con una copia de la lista y entra en ella', async () => {
    render(<StartLiveButton playlist={LISTA} user={USER} />);
    await userEvent.click(screen.getByRole('button'));

    expect(mockCreateSession).toHaveBeenCalledWith({ playlist: LISTA, host: USER });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/live/K7M2QX'));
  });

  it('no deja abrir una sesión sobre una lista vacía', () => {
    render(<StartLiveButton playlist={{ ...LISTA, songs: [] }} user={USER} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('avisa si no se pudo abrir y deja reintentar', async () => {
    mockCreateSession.mockRejectedValue(new Error('sin red'));
    render(<StartLiveButton playlist={LISTA} user={USER} />);

    await userEvent.click(screen.getByRole('button'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sin red/);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

describe('entrar por código', () => {
  const teclear = async (texto) => {
    render(<JoinLive />);
    const campo = screen.getByLabelText('Código de la sesión');
    await userEvent.type(campo, texto);
    return campo;
  };

  // Se normaliza mientras escribe y no al enviar: así ve en el momento que lo
  // que tecleó no era lo que creía, en vez de que se lo cambien de golpe al
  // pulsar el botón.
  it('normaliza cada tecla en vez de esperar al envío', async () => {
    const campo = await teclear('k7m');

    expect(mockNormalize).toHaveBeenCalled();
    expect(campo).toHaveValue('K7M');
  });

  it('pinta lo que devuelve la normalización, no lo tecleado', async () => {
    const campo = await teclear('k7-m*2');
    expect(campo).toHaveValue('K7M2');
  });

  it('no deja pasar de la longitud del código', async () => {
    const campo = await teclear('K7M2QXZZZZ');
    expect(campo).toHaveValue('K7M2QX');
  });

  it('el botón espera a que el código sea válido', async () => {
    await teclear('K7M2Q');

    expect(mockIsValid).toHaveBeenCalledWith('K7M2Q');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  it('entra en la sesión tecleada', async () => {
    await teclear('K7M2QX');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(mockNavigate).toHaveBeenCalledWith('/live/K7M2QX');
  });
});

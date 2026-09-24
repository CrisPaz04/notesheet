import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// El control de alineación (izquierda, centro, derecha) junto al tamaño de
// letra. Se prueba en la vista de la lista, con la canción de verdad pasando
// por el pipeline, y se comprueba que se recuerda en el dispositivo.

const mockGetPlaylistById = vi.fn();
const mockGetSongById = vi.fn();

vi.mock('@notesheet/api', () => ({
  getPlaylistById: (...a) => mockGetPlaylistById(...a),
  getSongById: (...a) => mockGetSongById(...a),
  createSession: vi.fn(),
  getUserPreferences: vi.fn().mockResolvedValue({}),
  updateUserPreferences: vi.fn().mockResolvedValue({})
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'p1' }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'u1' } }) }));

const { default: PlaylistView } = await import('../pages/PlaylistView');

const CANCION = { id: 's1', title: 'Cristo Vive', key: 'DO', content: '## Verso\nDO SOL LAm FA\nCristo vive hoy' };

beforeEach(() => {
  localStorage.clear();
  mockGetPlaylistById.mockResolvedValue({
    id: 'p1',
    name: 'Domingo',
    creatorId: 'u1',
    songs: [{ id: 's1', key: 'DO', originalKey: 'DO' }]
  });
  mockGetSongById.mockResolvedValue(CANCION);
});

const contenido = async () => (await screen.findByText(/Cristo vive hoy/)).closest('.song-section-content');

describe('Alineación del texto', () => {
  it('arranca centrado, como se veía siempre', async () => {
    render(<PlaylistView />);
    expect(await contenido()).toHaveClass('alinear-center');
    expect(screen.getByRole('button', { name: 'Centrar' }))
      .toHaveAttribute('aria-pressed', 'true');
  });

  it('alinea a la izquierda y a la derecha el texto de la canción', async () => {
    render(<PlaylistView />);
    const bloque = await contenido();

    fireEvent.click(screen.getByRole('button', { name: 'Alinear a la izquierda' }));
    expect(bloque).toHaveClass('alinear-left');
    expect(screen.getByRole('button', { name: 'Alinear a la izquierda' }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Centrar' }))
      .toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByRole('button', { name: 'Alinear a la derecha' }));
    expect(bloque).toHaveClass('alinear-right');
    expect(bloque).not.toHaveClass('alinear-left');
  });

  it('se recuerda entre visitas', async () => {
    const { unmount } = render(<PlaylistView />);
    await contenido();
    fireEvent.click(screen.getByRole('button', { name: 'Alinear a la derecha' }));
    unmount();

    render(<PlaylistView />);
    expect(await contenido()).toHaveClass('alinear-right');
  });

  it('un valor guardado que no existe se ignora', async () => {
    localStorage.setItem('alineacionTexto', 'justify');
    render(<PlaylistView />);
    expect(await contenido()).toHaveClass('alinear-center');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const mockGetAllPlaylists = vi.fn();
const mockGetPublicPlaylists = vi.fn();
vi.mock('@notesheet/api', () => ({
  getAllPlaylists: (...a) => mockGetAllPlaylists(...a),
  getPublicPlaylists: (...a) => mockGetPublicPlaylists(...a),
  deletePlaylist: vi.fn()
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, className }) => <a href={to} className={className}>{children}</a>
}));

const mockAuth = { currentUser: { uid: 'yo' } };
vi.mock('../context/AuthContext', () => ({ useAuth: () => mockAuth }));

const { default: PlaylistsList } = await import('../pages/PlaylistsList');

const fecha = { toDate: () => new Date('2026-09-20T00:00:00Z') };
const MIA = { id: 'm1', name: 'Domingo', date: fecha, public: true, creatorId: 'yo', songs: [] };
const DE_ANA = { id: 'a1', name: 'Jóvenes', date: fecha, public: true, creatorId: 'ana', creatorName: 'Ana', songs: [] };
const SIN_NOMBRE = { id: 'b1', name: 'Vigilia', date: fecha, public: true, creatorId: 'beto', songs: [] };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllPlaylists.mockResolvedValue([MIA]);
  // La consulta de públicas trae también las mías: no deben salir dos veces
  mockGetPublicPlaylists.mockResolvedValue([MIA, DE_ANA, SIN_NOMBRE]);
});

const banda = () => screen.queryByRole('region', { name: 'De la banda' });

describe('Mis listas', () => {
  it('las propias se editan y se borran', async () => {
    render(<PlaylistsList />);
    await screen.findByText('Domingo');
    expect(screen.getAllByText('Editar')).toHaveLength(1);
    expect(screen.getAllByText('Eliminar')).toHaveLength(1);
  });

  it('"De la banda": las públicas de otros, con quién la hizo, solo para abrir', async () => {
    render(<PlaylistsList />);
    await screen.findByText('Jóvenes');
    const seccion = banda();
    expect(within(seccion).getByText('Jóvenes')).toBeInTheDocument();
    expect(within(seccion).getByText('Vigilia')).toBeInTheDocument();
    expect(within(seccion).getByText('Ana')).toBeInTheDocument();
    // Las mías no se repiten ahí
    expect(within(seccion).queryByText('Domingo')).toBeNull();
    // Solo "Ver": editar y borrar son del creador
    expect(within(seccion).queryByText('Editar')).toBeNull();
    expect(within(seccion).queryByText('Eliminar')).toBeNull();
    expect(within(seccion).getAllByText('Ver').map((a) => a.closest('a').getAttribute('href')))
      .toEqual(['/playlists/a1', '/playlists/b1']);
  });

  it('sin listas de otros, no sale el apartado', async () => {
    mockGetPublicPlaylists.mockResolvedValue([MIA]);
    render(<PlaylistsList />);
    await screen.findByText('Domingo');
    expect(banda()).toBeNull();
  });

  it('si fallan las de la banda, las propias se ven igual', async () => {
    const aviso = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetPublicPlaylists.mockRejectedValue(new Error('índice'));
    render(<PlaylistsList />);
    expect(await screen.findByText('Domingo')).toBeInTheDocument();
    expect(banda()).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    aviso.mockRestore();
  });

  it('sin listas propias, la invitación a crear una y debajo las de la banda', async () => {
    mockGetAllPlaylists.mockResolvedValue([]);
    render(<PlaylistsList />);
    expect(await screen.findByText('Crear mi primera lista')).toBeInTheDocument();
    expect(within(banda()).getByText('Jóvenes')).toBeInTheDocument();
  });
});

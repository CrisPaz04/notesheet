import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// --- Mocks ---
// Lo que se prueba aquí es qué controles se pintan y qué archivo se elige,
// no pdf.js: el visor se sustituye por un doble que enseña la ruta que le
// llega, que es justo lo que hay que comprobar.

const mockGetSongById = vi.fn();
const mockGetAllSongs = vi.fn();
const mockGetUserPreferences = vi.fn();
const mockUpdateUserPreferences = vi.fn();
const mockGetScoreUrl = vi.fn();

vi.mock('@notesheet/api', () => ({
  getSongById: (...args) => mockGetSongById(...args),
  getAllSongs: (...args) => mockGetAllSongs(...args),
  getUserPreferences: (...args) => mockGetUserPreferences(...args),
  updateUserPreferences: (...args) => mockUpdateUserPreferences(...args),
  getScoreUrl: (...args) => mockGetScoreUrl(...args)
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'song-pdf' }),
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

const mockAuth = { currentUser: null, canEditSongs: () => false };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth
}));

vi.mock('../pages/Metronome', () => ({ default: () => <div>Metrónomo</div> }));
vi.mock('../pages/Tuner', () => ({ default: () => <div>Afinador</div> }));

vi.mock('../components/PdfScoreViewer', () => ({
  default: ({ path }) => <div data-testid="pdf-viewer" data-path={path || ''} />
}));

const { default: SongView } = await import('../pages/SongView');

const SONG_PDF = {
  id: 'song-pdf',
  title: 'Popurrí de Navidad',
  key: 'SIb',
  type: 'Júbilo',
  format: 'pdf',
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1',
  pdfs: {
    bb_trumpet: {
      1: {
        partitura: 'partituras/song-pdf/bb_trumpet-1-partitura.pdf',
        conNotas: 'partituras/song-pdf/bb_trumpet-1-conNotas.pdf'
      },
      2: { partitura: 'partituras/song-pdf/bb_trumpet-2-partitura.pdf' }
    },
    bb_trombone: {
      1: { partitura: 'partituras/song-pdf/bb_trombone-1-partitura.pdf' }
    }
  }
};

const SONG_ACORDES = {
  id: 'song-pdf',
  title: 'Cristo Vive',
  key: 'DO',
  type: 'Júbilo',
  voices: { bb_trumpet: { 1: '## Intro\nDO SOL LAm FA\n' } },
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1'
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.currentUser = null;
  mockAuth.canEditSongs = () => false;
  mockGetSongById.mockResolvedValue(SONG_PDF);
  mockGetAllSongs.mockResolvedValue([]);
  mockGetUserPreferences.mockResolvedValue({});
  mockUpdateUserPreferences.mockResolvedValue({});
  mockGetScoreUrl.mockResolvedValue('https://storage.example/firmada.pdf');
});

const renderView = async (titulo) => {
  const result = render(<SongView />);
  await screen.findByRole('heading', { name: titulo });
  return result;
};

const rutaMostrada = () => screen.getByTestId('pdf-viewer').getAttribute('data-path');

describe('SongView con una canción en PDF', () => {
  it('muestra el visor de PDF en vez del contenido de acordes', async () => {
    await renderView('Popurrí de Navidad');
    expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument();
  });

  it('NO pinta los controles de tonalidad, instrumento ni notación', async () => {
    // Un selector que no hace nada es peor que no tenerlo: en un PDF no hay
    // nada que transponer ni notación que convertir.
    await renderView('Popurrí de Navidad');

    expect(screen.queryByRole('button', { name: /Transponer:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tonalidad:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /DO-RE-MI/ })).not.toBeInTheDocument();
  });

  it('sí pinta esos controles en una canción de acordes', async () => {
    // El contrapunto del test anterior: si se ocultasen siempre, aquel
    // pasaría igual sin comprobar nada.
    mockGetSongById.mockResolvedValue(SONG_ACORDES);
    await renderView('Cristo Vive');

    expect(screen.getByRole('button', { name: /Transponer:/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tonalidad:/ })).toBeInTheDocument();
    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
  });

  it('una canción sin `format` se sigue comportando como de acordes', async () => {
    // Las 118 importadas no tienen el campo y no se van a migrar
    mockGetSongById.mockResolvedValue(SONG_ACORDES);
    await renderView('Cristo Vive');

    expect(screen.queryByTestId('pdf-viewer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transponer:/ })).toBeInTheDocument();
  });

  it('la tonalidad se muestra como dato, no como selector', async () => {
    await renderView('Popurrí de Navidad');
    expect(screen.getByText('SIb')).toBeInTheDocument();
  });

  it('`defaultInstrument` elige la voz del músico sin que busque nada', async () => {
    mockAuth.currentUser = { uid: 'u1' };
    mockGetUserPreferences.mockResolvedValue({ defaultInstrument: 'bb_trombone' });

    await renderView('Popurrí de Navidad');

    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trombone-1-partitura.pdf');
    });
  });

  it('sin preferencia usa la voz principal de la canción', async () => {
    await renderView('Popurrí de Navidad');
    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trumpet-1-partitura.pdf');
    });
  });

  it('la preferencia de variante elige el archivo con los nombres encima', async () => {
    mockAuth.currentUser = { uid: 'u1' };
    mockGetUserPreferences.mockResolvedValue({ defaultScoreVariant: 'conNotas' });

    await renderView('Popurrí de Navidad');

    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trumpet-1-conNotas.pdf');
    });
  });

  it('si falta la variante pedida, cae a la que hay Y lo avisa en pantalla', async () => {
    mockAuth.currentUser = { uid: 'u1' };
    mockGetUserPreferences.mockResolvedValue({
      defaultInstrument: 'bb_trombone',
      defaultScoreVariant: 'conNotas'
    });

    await renderView('Popurrí de Navidad');

    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trombone-1-partitura.pdf');
    });
    expect(screen.getByRole('status')).toHaveTextContent(/no tiene la versión/i);
  });

  it('cuando la variante pedida sí está, no avisa de nada', async () => {
    mockAuth.currentUser = { uid: 'u1' };
    mockGetUserPreferences.mockResolvedValue({ defaultScoreVariant: 'conNotas' });

    await renderView('Popurrí de Navidad');

    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trumpet-1-conNotas.pdf');
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('cambiar de voz cambia el archivo, no transpone nada', async () => {
    const user = userEvent.setup();
    await renderView('Popurrí de Navidad');

    await user.click(screen.getByRole('button', { name: /Trompeta en Sib 1/ }));
    await user.click(screen.getByText('Trompeta en Sib 2'));

    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trumpet-2-partitura.pdf');
    });
  });

  it('el selector de voz lista las voces que tienen PDF', async () => {
    const user = userEvent.setup();
    await renderView('Popurrí de Navidad');

    await user.click(screen.getByRole('button', { name: /Trompeta en Sib 1/ }));

    expect(screen.getByText('Trombón en Sib 1')).toBeInTheDocument();
    expect(screen.getByText('Trompeta en Sib 2')).toBeInTheDocument();
  });

  it('cambiar de variante guarda la preferencia: quien no lee partitura la quiere siempre', async () => {
    const user = userEvent.setup();
    mockAuth.currentUser = { uid: 'u1' };
    await renderView('Popurrí de Navidad');

    await user.click(screen.getByRole('button', { name: /^Partitura/ }));
    await user.click(screen.getByText('Con nombres de notas'));

    await waitFor(() => {
      expect(rutaMostrada()).toBe('partituras/song-pdf/bb_trumpet-1-conNotas.pdf');
    });
    expect(mockUpdateUserPreferences).toHaveBeenCalledWith('u1', {
      defaultScoreVariant: 'conNotas'
    });
  });

  it('ofrece abrir el PDF en vez de imprimir', async () => {
    // Imprimir canvas medio pintados sale mal; el visor del dispositivo lo
    // hace bien y además sabe imprimir.
    await renderView('Popurrí de Navidad');

    expect(screen.getByRole('button', { name: /Abrir PDF/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Imprimir/ })).not.toBeInTheDocument();
  });

  it('abrir el PDF pide la URL firmada en ese momento, no una guardada', async () => {
    const user = userEvent.setup();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);

    await renderView('Popurrí de Navidad');
    await user.click(screen.getByRole('button', { name: /Abrir PDF/ }));

    await waitFor(() => {
      expect(mockGetScoreUrl).toHaveBeenCalledWith(
        'partituras/song-pdf/bb_trumpet-1-partitura.pdf'
      );
    });
    expect(abrir).toHaveBeenCalledWith(
      'https://storage.example/firmada.pdf',
      '_blank',
      'noopener,noreferrer'
    );

    abrir.mockRestore();
  });

  it('sin letra no ofrece la segunda vista', async () => {
    await renderView('Popurrí de Navidad');
    expect(screen.queryByRole('button', { name: /Letra/ })).not.toBeInTheDocument();
  });

  it('con letra mantiene las dos vistas: partitura y letra', async () => {
    mockGetSongById.mockResolvedValue({
      ...SONG_PDF,
      lyricsOnly: '## Coro\nGloria a Dios en las alturas'
    });

    const { container } = await renderView('Popurrí de Navidad');

    // Hay dos botones que dicen "Partitura": el de la variante y el de la
    // vista. Aquí interesa el de la vista.
    const toggle = within(container.querySelector('.view-toggle-controls'));
    expect(toggle.getByRole('button', { name: /Partitura/ })).toBeInTheDocument();
    expect(toggle.getByRole('button', { name: /Letra/ })).toBeInTheDocument();
    expect(screen.getByText(/Gloria a Dios en las alturas/)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

// Importar la carpeta "Partituras" entera. La subida va simulada: aquí se
// comprueba el plan que se enseña y qué se pide subir a dónde.

const mockGetAllSongs = vi.fn();
const mockSubir = vi.fn();
const mockCrear = vi.fn();

vi.mock('@notesheet/api', () => ({
  getAllSongs: (...a) => mockGetAllSongs(...a),
  subirVariasPartituras: (...a) => mockSubir(...a),
  crearCancionPdf: (...a) => mockCrear(...a),
  getUserPreferences: vi.fn().mockResolvedValue({}),
  updateUserPreferences: vi.fn().mockResolvedValue({})
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>
}));

vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ currentUser: { uid: 'u1' } }) }));

const { default: ImportarPartituras } = await import('../pages/ImportarPartituras');

const pdf = (name) => new File(['%PDF'], name, { type: 'application/pdf' });

const CARPETA = [
  pdf('Coalo Zamorano--Alégrense--Bb_Trumpet_1.pdf'),
  pdf('Coalo Zamorano--Alégrense--Bb_Trumpet_1--NN.pdf'),
  pdf('Coalo Zamorano--Alégrense--Score.pdf'),
  pdf('Marcos Witt--Nueva--Flute.pdf'),
  pdf('Otro--Cristo Vive--Sax_Alto.pdf')
];

const REPERTORIO = [
  // Propia y en texto: se le añaden
  { id: 's-ale', title: 'Alégrense', versiones: ['Coalo Zamorano'], isOwn: true, voices: { bb_trumpet: { 1: 'DO' } } },
  // De otro músico: no se puede escribir, se crea una propia
  { id: 's-cv', title: 'Cristo Vive', isOwn: false }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAllSongs.mockResolvedValue(REPERTORIO);
  mockSubir.mockImplementation(async ({ asignados }) => ({ subidos: asignados.length, errores: [], pdfs: {}, voices: {} }));
  mockCrear.mockImplementation(async ({ datos }) => ({ id: `nueva-${datos.title}` }));
});

const elegir = async (archivos) => {
  render(<ImportarPartituras />);
  await waitFor(() => expect(mockGetAllSongs).toHaveBeenCalled());
  fireEvent.change(screen.getByTestId('importar-carpeta'), { target: { files: archivos } });
};

// El título de la fila, no el de la canción de destino (que puede llamarse igual)
const cancion = (titulo) => screen.getByText(titulo, { selector: '.importar-pdfs-check strong' }).closest('li');

describe('ImportarPartituras', () => {
  it('enseña una canción por título, con su destino y cuántos PDF', async () => {
    await elegir(CARPETA);

    expect(within(cancion('Alégrense')).getByText(/Se añaden a tu canción/)).toBeInTheDocument();
    expect(within(cancion('Alégrense')).getByRole('button', { name: /2 PDF · 1 sin subir/ })).toBeInTheDocument();
    expect(within(cancion('Nueva')).getByText('Se crea nueva')).toBeInTheDocument();
    expect(within(cancion('Cristo Vive')).getByText(/de otro músico/)).toBeInTheDocument();
  });

  it('avisa de que una canción en texto se abrirá en la partitura, con sus notas aparte', async () => {
    await elegir(CARPETA);
    expect(within(cancion('Alégrense')).getByText(/seguirán en la pestaña Notas/)).toBeInTheDocument();
  });

  it('el detalle enseña a qué voz va cada archivo', async () => {
    await elegir(CARPETA);
    fireEvent.click(within(cancion('Alégrense')).getByRole('button', { name: /2 PDF/ }));
    expect(within(cancion('Alégrense')).getByText('Partitura completa: no se sube')).toBeInTheDocument();
    expect(within(cancion('Alégrense')).getByText('Con nombres de notas')).toBeInTheDocument();
  });

  it('añade a la existente, crea las demás y dice cómo fue', async () => {
    await elegir(CARPETA);
    fireEvent.click(screen.getByRole('button', { name: /Importar 3 canciones \(4 PDF\)/ }));

    await screen.findByRole('list', { name: 'Resultado' });
    expect(mockCrear).toHaveBeenCalledTimes(2);
    expect(mockCrear).toHaveBeenCalledWith({
      datos: expect.objectContaining({ title: 'Nueva', versiones: ['Marcos Witt'], isPublic: true }),
      userId: 'u1'
    });

    const aLaExistente = mockSubir.mock.calls.find(([p]) => p.song.id === 's-ale')[0];
    expect(aLaExistente.asignados.map((a) => a.variant)).toEqual(['partitura', 'conNotas']);

    const resultado = screen.getByRole('list', { name: 'Resultado' });
    expect(within(resultado).getByRole('link', { name: 'Alégrense' })).toHaveAttribute('href', '/songs/s-ale');
    expect(within(resultado).getAllByText(/creada, 1 PDF/)).toHaveLength(2);
    expect(within(resultado).getByText(/— 2 PDF/)).toBeInTheDocument();
  });

  it('una canción desmarcada no se importa', async () => {
    await elegir(CARPETA);
    fireEvent.click(within(cancion('Nueva')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Importar 2 canciones \(3 PDF\)/ }));

    await screen.findByRole('list', { name: 'Resultado' });
    expect(mockCrear).toHaveBeenCalledTimes(1);
    expect(mockCrear.mock.calls.map(([p]) => p.datos.title)).toEqual(['Cristo Vive']);
  });

  // Los datos de cada canción nueva, abiertos: el mismo formulario del editor
  it('cada canción nueva trae sus datos abiertos; la que ya existe, no', async () => {
    await elegir(CARPETA);
    expect(within(cancion('Nueva')).getByLabelText('Título')).toHaveValue('Nueva');
    expect(within(cancion('Nueva')).getByLabelText('Tempo (BPM)')).toBeInTheDocument();
    expect(within(cancion('Alégrense')).queryByLabelText('Título')).toBeNull();
    expect(within(cancion('Alégrense')).getByText(/Se conservan los datos/)).toBeInTheDocument();
  });

  it('lo que se rellena llega a la canción creada', async () => {
    await elegir(CARPETA);
    const fila = cancion('Nueva');
    fireEvent.change(within(fila).getByLabelText('Tempo (BPM)'), { target: { value: '132' } });
    fireEvent.change(within(fila).getByLabelText('Álbum'), { target: { value: 'En vivo' } });
    fireEvent.click(within(fila).getByRole('button', { name: /Privada/ }));

    fireEvent.click(screen.getByRole('button', { name: /Importar 3 canciones/ }));
    await screen.findByRole('list', { name: 'Resultado' });

    const nueva = mockCrear.mock.calls.find(([p]) => p.datos.title === 'Nueva')[0];
    expect(nueva.datos).toMatchObject({ tempo: '132', album: 'En vivo', isPublic: false });
  });

  it('si se borra el título, se usa el del archivo', async () => {
    await elegir(CARPETA);
    fireEvent.change(within(cancion('Nueva')).getByLabelText('Título'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: /Importar 3 canciones/ }));
    await screen.findByRole('list', { name: 'Resultado' });
    expect(mockCrear.mock.calls.map(([p]) => p.datos.title)).toContain('Nueva');
  });
});

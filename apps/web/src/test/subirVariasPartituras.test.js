import { describe, it, expect, vi, beforeEach } from 'vitest';

// Subir muchas partituras de golpe: la subida y Firestore van simulados, lo
// que se comprueba es qué se guarda y en qué orden.

const mockUploadScore = vi.fn();
const mockUpdateSong = vi.fn();
const mockCreateSong = vi.fn();

vi.mock('../../../../packages/api/src/services/scores', () => ({
  uploadScore: (...a) => mockUploadScore(...a)
}));
vi.mock('../../../../packages/api/src/services/songs', () => ({
  updateSong: (...a) => mockUpdateSong(...a),
  createSong: (...a) => mockCreateSong(...a)
}));

const { subirVariasPartituras, crearCancionPdf } =
  await import('../../../../packages/api/src/services/importarPartituras');

const archivo = (name) => ({ name });
const ASIGNADOS = [
  { archivo: archivo('A--Bb_Trumpet_1.pdf'), instrumentId: 'bb_trumpet', voiceNumber: '1', variant: 'partitura' },
  { archivo: archivo('A--Bb_Trumpet_1--NN.pdf'), instrumentId: 'bb_trumpet', voiceNumber: '1', variant: 'conNotas' },
  { archivo: archivo('A--Flute.pdf'), instrumentId: 'c_flute', voiceNumber: '1', variant: 'partitura' }
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUploadScore.mockImplementation(async ({ instrumentId, voiceNumber, variant }) =>
    `partituras/s1/${instrumentId}-${voiceNumber}-${variant}.pdf`);
  mockUpdateSong.mockResolvedValue({});
});

describe('subirVariasPartituras', () => {
  it('sube cada uno a su casilla y guarda la canción tras cada archivo', async () => {
    const r = await subirVariasPartituras({ song: { id: 's1' }, asignados: ASIGNADOS });

    expect(mockUploadScore).toHaveBeenCalledTimes(3);
    // Tras cada archivo, no al final: si se cae la red a mitad, lo subido
    // queda apuntado
    expect(mockUpdateSong).toHaveBeenCalledTimes(3);
    expect(mockUpdateSong.mock.calls[0][1].pdfs).toEqual({
      bb_trumpet: { 1: { partitura: 'partituras/s1/bb_trumpet-1-partitura.pdf' } }
    });

    const ultimo = mockUpdateSong.mock.calls.at(-1)[1];
    expect(ultimo.format).toBe('pdf');
    expect(ultimo.pdfs.bb_trumpet['1']).toEqual({
      partitura: 'partituras/s1/bb_trumpet-1-partitura.pdf',
      conNotas: 'partituras/s1/bb_trumpet-1-conNotas.pdf'
    });
    // Cada voz con su casilla en `voices`: de ahí salen las pestañas del editor
    expect(ultimo.voices).toEqual({ bb_trumpet: { 1: '' }, c_flute: { 1: '' } });
    // Sin voz principal, la primera que se subió
    expect(ultimo).toMatchObject({ primaryInstrument: 'bb_trumpet', primaryVoiceNumber: '1' });
    expect(r).toMatchObject({ subidos: 3, errores: [] });
  });

  it('en una canción de texto no toca sus voces ni su voz principal', async () => {
    const song = {
      id: 's1',
      voices: { bb_trumpet: { 1: 'DO SOL' } },
      primaryInstrument: 'bb_trumpet',
      primaryVoiceNumber: '1'
    };
    await subirVariasPartituras({ song, asignados: ASIGNADOS });

    const ultimo = mockUpdateSong.mock.calls.at(-1)[1];
    expect(ultimo.voices.bb_trumpet['1']).toBe('DO SOL');
    expect(ultimo.voices.c_flute['1']).toBe('');
  });

  it('un archivo que falla no para los demás, y se dice cuál', async () => {
    mockUploadScore.mockRejectedValueOnce(new Error('El PDF no puede pasar de 20 MB'));
    const r = await subirVariasPartituras({ song: { id: 's1' }, asignados: ASIGNADOS });

    expect(r.subidos).toBe(2);
    expect(r.errores).toEqual([{ archivo: ASIGNADOS[0].archivo, mensaje: 'El PDF no puede pasar de 20 MB' }]);
    expect(mockUpdateSong.mock.calls.at(-1)[1].pdfs.bb_trumpet['1']).toEqual({
      conNotas: 'partituras/s1/bb_trumpet-1-conNotas.pdf'
    });
  });

  it('avisa del progreso', async () => {
    const onProgreso = vi.fn();
    await subirVariasPartituras({ song: { id: 's1' }, asignados: ASIGNADOS, onProgreso });
    expect(onProgreso).toHaveBeenNthCalledWith(1, { hechos: 0, total: 3, actual: 'A--Bb_Trumpet_1.pdf' });
    expect(onProgreso).toHaveBeenLastCalledWith({ hechos: 3, total: 3 });
  });
});

describe('crearCancionPdf', () => {
  it('con los datos del formulario, en PDF', async () => {
    mockCreateSong.mockResolvedValue({ id: 'nueva' });
    await crearCancionPdf({
      datos: {
        title: ' Alégrense ',
        versiones: ['Coalo Zamorano'],
        album: 'En vivo',
        type: 'Júbilo',
        key: 'RE',
        tempo: '132',
        compas: '4/4',
        isPublic: true,
        grabacion: null
      },
      userId: 'u1'
    });
    expect(mockCreateSong).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Alégrense',
      versiones: ['Coalo Zamorano'],
      version: 'Coalo Zamorano',
      album: 'En vivo',
      type: 'Júbilo',
      key: 'RE',
      tempo: 132,
      compas: '4/4',
      format: 'pdf',
      public: true,
      userId: 'u1'
    }));
  });

  it('un tempo vacío o disparatado no se guarda, y privada es privada', async () => {
    mockCreateSong.mockResolvedValue({ id: 'nueva' });
    await crearCancionPdf({ datos: { title: 'X', tempo: '', isPublic: false }, userId: 'u1' });
    expect(mockCreateSong.mock.calls[0][0]).toMatchObject({ tempo: null, compas: null, public: false });
    await crearCancionPdf({ datos: { title: 'X', tempo: '9000' }, userId: 'u1' });
    expect(mockCreateSong.mock.calls[1][0].tempo).toBeNull();
  });
});

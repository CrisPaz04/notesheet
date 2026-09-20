import { describe, it, expect, vi, beforeEach } from 'vitest';

// Borrar una canción en PDF toca dos sistemas, y el orden entre ellos no es
// un detalle de implementación: la regla de `storage.rules` consulta la
// canción en Firestore para decidir si deja borrar el archivo. Si el
// documento se fuera primero, los PDF quedarían en Storage para siempre,
// ilegibles pero ocupando sitio y sin forma de borrarlos desde la app.

const mockDeleteDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockDeleteScores = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn((_db, _col, id) => ({ id })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: (...a) => mockDeleteDoc(...a),
  getDoc: (...a) => mockGetDoc(...a),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn()
}));

vi.mock('@notesheet/api/src/firebase/config', () => ({ db: {} }));
vi.mock('../../../../packages/api/src/firebase/config', () => ({ db: {} }));
vi.mock('../../../../packages/api/src/services/scores', () => ({
  deleteScores: (...a) => mockDeleteScores(...a)
}));

const { deleteSong } = await import('../../../../packages/api/src/services/songs');

const conPdfs = (pdfs) => ({
  exists: () => true,
  data: () => ({ userId: 'u1', pdfs })
});

beforeEach(() => {
  vi.clearAllMocks();
  mockDeleteDoc.mockResolvedValue(undefined);
  mockDeleteScores.mockResolvedValue(undefined);
});

describe('deleteSong', () => {
  it('borra los PDF ANTES que el documento', async () => {
    const orden = [];
    mockDeleteScores.mockImplementation(async () => { orden.push('storage'); });
    mockDeleteDoc.mockImplementation(async () => { orden.push('firestore'); });

    mockGetDoc.mockResolvedValue(conPdfs({
      bb_trumpet: { 1: { partitura: 'a.pdf', conNotas: 'b.pdf' } }
    }));

    await deleteSong('song-1');

    expect(orden).toEqual(['storage', 'firestore']);
  });

  it('le pasa todas las rutas de la matriz, no solo la primera', async () => {
    mockGetDoc.mockResolvedValue(conPdfs({
      bb_trumpet: { 1: { partitura: 'a.pdf', conNotas: 'b.pdf' } },
      bb_trombone: { 2: { partitura: 'c.pdf' } }
    }));

    await deleteSong('song-1');

    const rutas = mockDeleteScores.mock.calls[0][0];
    expect([...rutas].sort()).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('una canción de acordes no toca Storage para nada', async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ userId: 'u1', content: '## Intro\nDO SOL' })
    });

    await deleteSong('song-1');

    expect(mockDeleteScores).not.toHaveBeenCalled();
    expect(mockDeleteDoc).toHaveBeenCalled();
  });

  it('si la canción ya no está, se borra igual sin reventar', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false, data: () => undefined });

    await expect(deleteSong('song-1')).resolves.toBe('song-1');
    expect(mockDeleteScores).not.toHaveBeenCalled();
  });
});

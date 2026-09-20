// Publicar las canciones al compartir.
//
// La regla de lectura de `songs` solo deja ver lo propio o lo publicado, así
// que compartir algo que contiene canciones sin publicar las canciones deja a
// la banda entera mirando errores. Esto se descubrió con una sesión de verdad:
// las tres canciones daban `permission-denied` para todos menos el dueño.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetDoc = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (...segmentos) => ({ path: segmentos.slice(1).join('/') }),
  addDoc: vi.fn(),
  updateDoc: (...a) => mockUpdateDoc(...a),
  deleteDoc: vi.fn(),
  getDoc: (...a) => mockGetDoc(...a),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn()
}));

vi.mock('../../../../packages/api/src/firebase/config', () => ({ db: {} }));

const { publishOwnSongs } = await import('../../../../packages/api/src/services/songs');

const YO = 'u1';

/** Un repertorio simulado: el id decide qué devuelve `getDoc`. */
const repertorio = (canciones) => {
  mockGetDoc.mockImplementation(async (ref) => {
    const id = ref.path.split('/').pop();
    const data = canciones[id];

    if (data === 'denegada') {
      throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    }

    return { exists: () => Boolean(data), data: () => data };
  });
};

const publicadas = () =>
  mockUpdateDoc.mock.calls.map(([ref]) => ref.path.split('/').pop());

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDoc.mockResolvedValue(undefined);
});

describe('publishOwnSongs', () => {
  it('publica las propias que estaban privadas', async () => {
    repertorio({ s1: { userId: YO }, s2: { userId: YO } });

    const hechas = await publishOwnSongs(['s1', 's2'], YO);

    expect(hechas).toEqual(['s1', 's2']);
    expect(publicadas()).toEqual(['s1', 's2']);
    expect(mockUpdateDoc.mock.calls[0][1]).toMatchObject({ public: true });
  });

  it('no toca las que ya estaban publicadas', async () => {
    repertorio({ s1: { userId: YO, public: true } });

    expect(await publishOwnSongs(['s1'], YO)).toEqual([]);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // Las ajenas ya estaban publicadas (es la única forma de haberlas podido
  // añadir), y además las reglas no dejarían cambiarlas.
  it('no intenta publicar canciones de otro', async () => {
    repertorio({ s1: { userId: 'otro' } });

    expect(await publishOwnSongs(['s1'], YO)).toEqual([]);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  // El caso que apareció en la prueba real: una lista que todavía referencia
  // una canción borrada del repertorio.
  it('se salta una canción que ya no existe', async () => {
    repertorio({ s2: { userId: YO } });

    expect(await publishOwnSongs(['borrada', 's2'], YO)).toEqual(['s2']);
    expect(publicadas()).toEqual(['s2']);
  });

  it('se salta una canción ajena que ni siquiera puede leer', async () => {
    repertorio({ s1: 'denegada', s2: { userId: YO } });

    expect(await publishOwnSongs(['s1', 's2'], YO)).toEqual(['s2']);
  });

  // Tragarse cualquier error convertiría un fallo de red en "no hacía falta
  // publicarla", y se repartiría el código de una sesión ilegible.
  it('propaga un error que no sea de permisos', async () => {
    mockGetDoc.mockRejectedValue(new Error('sin red'));

    await expect(publishOwnSongs(['s1'], YO)).rejects.toThrow('sin red');
  });

  it('no repite una canción que aparece dos veces', async () => {
    repertorio({ s1: { userId: YO } });

    await publishOwnSongs(['s1', 's1'], YO);
    expect(publicadas()).toEqual(['s1']);
  });

  it('no hace nada sin canciones ni sin usuario', async () => {
    expect(await publishOwnSongs([], YO)).toEqual([]);
    expect(await publishOwnSongs(['s1'], null)).toEqual([]);
    expect(await publishOwnSongs(null, YO)).toEqual([]);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});

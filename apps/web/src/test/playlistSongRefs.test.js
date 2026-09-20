import { describe, it, expect, vi, beforeEach } from 'vitest';

// Importar el servicio arrastra ../firebase/config, que arrancaría una app de
// Firebase de verdad. Se sustituye por un `db` de mentira, y del SDK solo se
// dejan en pie las funciones que el servicio usa.
vi.mock('../../../../packages/api/src/firebase/config', () => ({ db: {} }));

const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...a) => ({ tipo: 'collection', args: a }),
  doc: (...a) => ({ tipo: 'doc', args: a }),
  query: (...a) => ({ tipo: 'query', args: a }),
  where: (campo, op, valor) => ({ tipo: 'where', campo, op, valor }),
  orderBy: (...a) => ({ tipo: 'orderBy', args: a }),
  getDocs: (...a) => mockGetDocs(...a),
  getDoc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: (...a) => mockUpdateDoc(...a),
  deleteDoc: vi.fn()
}));

const {
  playlistReferencesSong,
  playlistWithoutSong,
  getPlaylistsWithSong,
  removeSongFromPlaylists
} = await import('../../../../packages/api/src/services/playlists');

// getAllPlaylists / getPublicPlaylists construyen `{ id, ...data }` a partir
// del snapshot; aquí se fabrica ese snapshot.
const snapshot = (listas) => ({
  docs: listas.map(({ id, ...data }) => ({ id, data: () => data }))
});

const entrada = (id, key = 'DO') => ({
  id,
  title: `Canción ${id}`,
  key,
  originalKey: 'DO'
});

const LISTA_VIERNES = {
  id: 'viernes',
  name: 'Lista de Viernes',
  creatorId: 'director',
  public: true,
  songs: [entrada('a'), entrada('borrada'), entrada('b')]
};

const LISTA_DOMINGO = {
  id: 'domingo',
  name: 'Lista de Domingo',
  creatorId: 'director',
  public: false,
  songs: [entrada('b')]
};

// Lista pública de otro músico: se puede leer, pero las reglas no dejan
// escribirla.
const LISTA_AJENA = {
  id: 'ajena',
  name: 'Ensayo de vientos',
  creatorId: 'trompetista',
  public: true,
  songs: [entrada('borrada'), entrada('c')]
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDoc.mockResolvedValue(undefined);
});

// Encola las respuestas de las dos consultas de getPlaylistsWithSong: primero
// las propias (getAllPlaylists), después las públicas.
const conListas = ({ propias, publicas }) => {
  mockGetDocs
    .mockResolvedValueOnce(snapshot(propias))
    .mockResolvedValueOnce(snapshot(publicas));
};

describe('playlistReferencesSong', () => {
  it('encuentra la canción por id', () => {
    expect(playlistReferencesSong(LISTA_VIERNES, 'borrada')).toBe(true);
  });

  it('dice que no cuando no está', () => {
    expect(playlistReferencesSong(LISTA_VIERNES, 'z')).toBe(false);
  });

  // Solo cuenta el id. El resto de campos de la entrada son una foto del
  // momento en que se añadió y pueden estar desfasados.
  it('no se deja engañar por el título', () => {
    const lista = { songs: [{ id: 'otra', title: 'Canción borrada' }] };
    expect(playlistReferencesSong(lista, 'borrada')).toBe(false);
  });

  it('aguanta una lista sin canciones', () => {
    expect(playlistReferencesSong({ songs: [] }, 'a')).toBe(false);
    expect(playlistReferencesSong({}, 'a')).toBe(false);
    expect(playlistReferencesSong(null, 'a')).toBe(false);
  });
});

describe('playlistWithoutSong', () => {
  it('quita la entrada y conserva las demás en orden', () => {
    expect(playlistWithoutSong(LISTA_VIERNES, 'borrada').map((e) => e.id))
      .toEqual(['a', 'b']);
  });

  // Nada impide repetir una canción dentro de un mismo ensayo. Si solo se
  // quitara la primera quedaría una referencia muerta igualmente.
  it('quita todas las apariciones, no solo la primera', () => {
    const repetida = {
      songs: [entrada('x'), entrada('borrada', 'RE'), entrada('borrada', 'MI'), entrada('y')]
    };
    expect(playlistWithoutSong(repetida, 'borrada').map((e) => e.id)).toEqual(['x', 'y']);
  });

  it('devuelve la lista entera si la canción no está', () => {
    expect(playlistWithoutSong(LISTA_VIERNES, 'z')).toHaveLength(3);
  });

  // Cada entrada lleva su propia tonalidad para esa ocasión. Si se perdiera
  // al limpiar, la lista sonaría en otro tono el domingo siguiente.
  it('no toca la tonalidad de las entradas que se quedan', () => {
    const lista = { songs: [entrada('a', 'FA'), entrada('borrada')] };
    expect(playlistWithoutSong(lista, 'borrada')[0].key).toBe('FA');
  });

  it('no muta el array original', () => {
    const lista = { songs: [entrada('a'), entrada('borrada')] };
    playlistWithoutSong(lista, 'borrada');
    expect(lista.songs).toHaveLength(2);
  });
});

describe('getPlaylistsWithSong', () => {
  it('devuelve solo las listas que contienen la canción', async () => {
    conListas({ propias: [LISTA_VIERNES, LISTA_DOMINGO], publicas: [LISTA_VIERNES] });

    const listas = await getPlaylistsWithSong('borrada', 'director');

    expect(listas.map((l) => l.id)).toEqual(['viernes']);
  });

  it('consulta las propias del usuario y las públicas', async () => {
    conListas({ propias: [], publicas: [] });

    await getPlaylistsWithSong('borrada', 'director');

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
    const filtros = mockGetDocs.mock.calls.flatMap(
      ([q]) => q.args.filter((a) => a?.tipo === 'where')
    );
    expect(filtros).toContainEqual({
      tipo: 'where', campo: 'creatorId', op: '==', valor: 'director'
    });
    expect(filtros).toContainEqual({
      tipo: 'where', campo: 'public', op: '==', valor: true
    });
  });

  // Una lista pública propia sale en las dos consultas. Sin deduplicar, el
  // aviso diría "está en 2 listas" enseñando dos veces la misma.
  it('no repite una lista pública propia', async () => {
    conListas({ propias: [LISTA_VIERNES], publicas: [LISTA_VIERNES] });

    const listas = await getPlaylistsWithSong('borrada', 'director');

    expect(listas).toHaveLength(1);
  });

  // isOwn es lo que decide si una lista se puede limpiar o solo avisar.
  it('marca isOwn según quién creó cada lista', async () => {
    conListas({ propias: [LISTA_VIERNES], publicas: [LISTA_VIERNES, LISTA_AJENA] });

    const listas = await getPlaylistsWithSong('borrada', 'director');

    expect(listas.find((l) => l.id === 'viernes').isOwn).toBe(true);
    expect(listas.find((l) => l.id === 'ajena').isOwn).toBe(false);
  });

  it('conserva el nombre de la lista, que es lo que enseña el aviso', async () => {
    conListas({ propias: [LISTA_VIERNES], publicas: [] });

    const [lista] = await getPlaylistsWithSong('borrada', 'director');

    expect(lista.name).toBe('Lista de Viernes');
  });
});

describe('removeSongFromPlaylists', () => {
  it('quita la canción de cada lista propia', async () => {
    const { limpiadas, fallidas } = await removeSongFromPlaylists(
      'borrada', [{ ...LISTA_VIERNES, isOwn: true }], 'director'
    );

    expect(limpiadas).toBe(1);
    expect(fallidas).toBe(0);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const [, datos] = mockUpdateDoc.mock.calls[0];
    expect(datos.songs.map((e) => e.id)).toEqual(['a', 'b']);
  });

  // updateDoc fusiona campos: solo debe viajar `songs`. Mandar la lista
  // entera pisaría name, date y public con lo que hubiera en memoria.
  it('escribe solo songs y updatedAt, no el resto de la lista', async () => {
    await removeSongFromPlaylists('borrada', [LISTA_VIERNES], 'director');

    const [, datos] = mockUpdateDoc.mock.calls[0];
    expect(Object.keys(datos).sort()).toEqual(['songs', 'updatedAt']);
  });

  // Las reglas exigen ser el creador para escribir en una lista: intentarlo
  // con la de otro músico es un permission-denied seguro.
  it('no intenta escribir en listas de otro músico', async () => {
    const { limpiadas, ajenas } = await removeSongFromPlaylists(
      'borrada', [LISTA_VIERNES, LISTA_AJENA], 'director'
    );

    expect(limpiadas).toBe(1);
    expect(ajenas).toBe(1);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(mockUpdateDoc.mock.calls[0][0].args).toContain('viernes');
  });

  // La canción ya está borrada cuando esto corre: lanzar no desharía nada y
  // dejaría sin limpiar las listas que sí se podían.
  it('sigue con las demás si una falla, y las cuenta', async () => {
    mockUpdateDoc
      .mockRejectedValueOnce(new Error('sin conexión'))
      .mockResolvedValueOnce(undefined);

    const { limpiadas, fallidas } = await removeSongFromPlaylists(
      'borrada',
      [LISTA_VIERNES, { ...LISTA_DOMINGO, songs: [entrada('borrada')] }],
      'director'
    );

    expect(limpiadas).toBe(1);
    expect(fallidas).toBe(1);
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('no escribe nada si no hay listas', async () => {
    const resultado = await removeSongFromPlaylists('borrada', [], 'director');

    expect(resultado).toEqual({ limpiadas: 0, fallidas: 0, ajenas: 0 });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

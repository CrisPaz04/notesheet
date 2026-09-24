// Sesiones en vivo: capa de datos.
//
// Se prueba contra `firebase/firestore` simulado, así que lo que se comprueba
// aquí es la forma exacta de lo que se escribe. Eso importa más de lo normal
// en este módulo: el documento lo leen doce clientes a la vez y el contador de
// versión es lo único que impide que una escritura encolada sin red pise el
// estado actual.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockGetDoc = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock('firebase/firestore', () => ({
  // Las refs se representan por su ruta: así las aserciones pueden comprobar
  // en qué documento se escribió sin depender de objetos opacos.
  doc: (...segmentos) => ({ path: segmentos.slice(1).join('/') }),
  collection: (...segmentos) => ({ path: segmentos.slice(1).join('/') }),
  setDoc: (...a) => mockSetDoc(...a),
  updateDoc: (...a) => mockUpdateDoc(...a),
  deleteDoc: (...a) => mockDeleteDoc(...a),
  getDoc: (...a) => mockGetDoc(...a),
  onSnapshot: (...a) => mockOnSnapshot(...a),
  serverTimestamp: () => '<server>',
  Timestamp: {
    fromMillis: (ms) => ({ millis: ms, toMillis: () => ms })
  }
}));

vi.mock('../../../../packages/api/src/firebase/config', () => ({ db: {} }));

// Publicar las canciones tiene sus propios tests (`publishOwnSongs.test.js`).
// Aquí solo interesa que abrir una sesión lo haga, y cuándo.
const mockPublishOwnSongs = vi.fn();
vi.mock('../../../../packages/api/src/services/songs', () => ({
  publishOwnSongs: (...a) => mockPublishOwnSongs(...a)
}));

const {
  generateSessionCode,
  normalizeSessionCode,
  isValidSessionCode,
  createSession,
  setActiveSong,
  setSongKey,
  setSessionSongs,
  endSession,
  joinSession,
  leaveSession,
  isParticipantOnline,
  subscribeToSession,
  SessionConflictError,
  SESSION_CODE_ALPHABET,
  SESSION_MAX_TTL_MS,
  PRESENCE_TIMEOUT_MS
} = await import('../../../../packages/api/src/services/sessions');

const HOST = { uid: 'u1', displayName: 'Cristhian' };

const LISTA = {
  id: 'p1',
  name: 'Domingo',
  songs: [
    { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' },
    { id: 's2', title: 'Sublime Gracia', key: 'SOL', originalKey: 'SOL' }
  ]
};

/** Los datos del último `setDoc`/`updateDoc`. */
const ultimaEscritura = (mock) => mock.mock.calls.at(-1)[1];
const ultimaRuta = (mock) => mock.mock.calls.at(-1)[0].path;

const denegado = () => Object.assign(new Error('denied'), { code: 'permission-denied' });

beforeEach(() => {
  vi.clearAllMocks();
  mockPublishOwnSongs.mockResolvedValue([]);
  mockSetDoc.mockResolvedValue(undefined);
  mockUpdateDoc.mockResolvedValue(undefined);
  mockDeleteDoc.mockResolvedValue(undefined);
});

describe('código de sesión', () => {
  it('tiene seis caracteres del alfabeto', () => {
    const codigo = generateSessionCode();
    expect(codigo).toHaveLength(6);
    for (const c of codigo) expect(SESSION_CODE_ALPHABET).toContain(c);
  });

  it('acepta otra longitud', () => {
    expect(generateSessionCode(10)).toHaveLength(10);
  });

  // Si alguien mete I, L, O o U en el alfabeto, el código deja de poder
  // dictarse por teléfono sin que el otro se equivoque.
  it('nunca usa caracteres que se confunden al dictarlo', () => {
    const todos = Array.from({ length: 200 }, () => generateSessionCode()).join('');
    expect(todos).not.toMatch(/[ILOU]/);
  });

  it('no repite el mismo código', () => {
    const codigos = new Set(Array.from({ length: 100 }, () => generateSessionCode()));
    expect(codigos.size).toBe(100);
  });

  describe('normalizar lo que se teclea', () => {
    it('pasa a mayúsculas', () => {
      expect(normalizeSessionCode('k7m2qx')).toBe('K7M2QX');
    });

    it('quita espacios y guiones', () => {
      expect(normalizeSessionCode(' K7M-2QX ')).toBe('K7M2QX');
    });

    // Mapeo de Crockford: quien copia el código de una pantalla confunde
    // estas letras con números, y el alfabeto no las contiene.
    it('entiende la O como cero y la I y la L como uno', () => {
      expect(normalizeSessionCode('OIL')).toBe('011');
    });

    it('descarta lo que no está en el alfabeto', () => {
      expect(normalizeSessionCode('K7U*M2')).toBe('K7M2');
    });

    it('devuelve vacío si no es texto', () => {
      expect(normalizeSessionCode(null)).toBe('');
      expect(normalizeSessionCode(undefined)).toBe('');
      expect(normalizeSessionCode(42)).toBe('');
    });
  });

  describe('validar', () => {
    it('acepta seis caracteres válidos', () => {
      expect(isValidSessionCode('k7m2qx')).toBe(true);
    });

    it('rechaza códigos cortos o largos', () => {
      expect(isValidSessionCode('K7M2Q')).toBe(false);
      expect(isValidSessionCode('K7M2QXZ')).toBe(false);
    });

    it('rechaza un código que se queda corto al limpiarlo', () => {
      expect(isValidSessionCode('K7M2Q**')).toBe(false);
    });
  });
});

describe('createSession', () => {
  it('exige un usuario', async () => {
    await expect(createSession({ playlist: LISTA, host: null }))
      .rejects.toThrow('Hace falta un usuario');
  });

  it('copia las canciones de la lista y arranca por la primera', async () => {
    const sesion = await createSession({ playlist: LISTA, host: HOST });

    const datos = mockSetDoc.mock.calls[0][1];
    expect(datos.songs).toEqual(LISTA.songs);
    expect(datos.activeSongId).toBe('s1');
    expect(datos.playlistId).toBe('p1');
    expect(datos.name).toBe('Domingo');
    expect(datos.hostId).toBe('u1');
    expect(sesion.id).toBe(sesion.code);
  });

  it('copia el mensaje del director, para el panel "Lista"', async () => {
    const mensajeDirector = { texto: '*Intro\nTe alabare', enlaces: { 2: 's1', 9: 'fuera' } };
    await createSession({ playlist: { ...LISTA, mensajeDirector }, host: HOST });

    // La línea 9 no existe: ese enlace no viaja
    expect(mockSetDoc.mock.calls[0][1].mensajeDirector).toEqual({
      texto: '*Intro\nTe alabare',
      enlaces: { 2: 's1' }
    });
  });

  it('una lista sin mensaje abre la sesión sin él', async () => {
    await createSession({ playlist: LISTA, host: HOST });
    expect(mockSetDoc.mock.calls[0][1].mensajeDirector).toBeNull();
  });

  // La regla de `create` exige las dos cosas; si el cliente dejara de
  // mandarlas, crear una sesión fallaría en producción y no en los tests.
  it('nace en la versión cero y en estado live', async () => {
    await createSession({ playlist: LISTA, host: HOST });

    const datos = mockSetDoc.mock.calls[0][1];
    expect(datos.version).toBe(0);
    expect(datos.status).toBe('live');
  });

  it('guarda quién la abrió', async () => {
    await createSession({ playlist: LISTA, host: HOST });
    expect(mockSetDoc.mock.calls[0][1].updatedBy).toEqual({
      uid: 'u1',
      name: 'Cristhian'
    });
  });

  it('limita la caducidad al máximo que aceptan las reglas', async () => {
    const antes = Date.now();
    await createSession({ playlist: LISTA, host: HOST, ttlMs: 999 * 60 * 60 * 1000 });

    const { expiresAt } = mockSetDoc.mock.calls[0][1];
    expect(expiresAt.millis).toBeLessThanOrEqual(antes + SESSION_MAX_TTL_MS + 1000);
    expect(expiresAt.millis).toBeGreaterThan(antes);
  });

  it('normaliza canciones incompletas y descarta las que no tienen id', async () => {
    await createSession({
      playlist: { songs: [{ id: 's1', title: 'Sin tonalidad' }, { title: 'Sin id' }] },
      host: HOST
    });

    expect(mockSetDoc.mock.calls[0][1].songs).toEqual([
      { id: 's1', title: 'Sin tonalidad', key: '', originalKey: '' }
    ]);
  });

  // Descubierto con una sesión de verdad: sin esto la banda entera ve "no se
  // pudo cargar" en todas las canciones, porque la regla de lectura solo deja
  // ver lo propio o lo publicado.
  it('publica las canciones de la lista al abrir la sesión', async () => {
    await createSession({ playlist: LISTA, host: HOST });

    expect(mockPublishOwnSongs).toHaveBeenCalledWith(['s1', 's2'], 'u1');
  });

  // Si publicar falla, repartir el código llevaría a una sesión que nadie
  // puede leer.
  it('no crea la sesión si no se pudieron publicar', async () => {
    mockPublishOwnSongs.mockRejectedValue(new Error('sin red'));

    await expect(createSession({ playlist: LISTA, host: HOST }))
      .rejects.toThrow('sin red');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  // Es lo que deja a los invitados leer estas canciones y ninguna más
  it('guarda los ids de las canciones aparte, para las reglas', async () => {
    const sesion = await createSession({ playlist: LISTA, host: HOST });
    expect(sesion.songIds).toEqual(['s1', 's2']);
  });

  it('entra como participante al crearla', async () => {
    const sesion = await createSession({ playlist: LISTA, host: HOST });

    expect(ultimaRuta(mockSetDoc)).toBe(`sessions/${sesion.code}/participants/u1`);
    expect(ultimaEscritura(mockSetDoc).uid).toBe('u1');
  });

  it('reintenta con otro código si el primero estaba ocupado', async () => {
    mockSetDoc.mockRejectedValueOnce(denegado());

    await createSession({ playlist: LISTA, host: HOST });

    const primero = mockSetDoc.mock.calls[0][0].path;
    const segundo = mockSetDoc.mock.calls[1][0].path;
    expect(primero).not.toBe(segundo);
  });

  // Reintentar aquí crearía una segunda sesión y dejaría la primera colgada,
  // con su código ya repartido por WhatsApp.
  it('no reintenta si lo que falla es entrar', async () => {
    mockSetDoc
      .mockResolvedValueOnce(undefined)  // la sesión se crea
      .mockRejectedValueOnce(denegado()); // entrar falla

    await expect(createSession({ playlist: LISTA, host: HOST })).rejects.toThrow();
    expect(mockSetDoc).toHaveBeenCalledTimes(2);
  });

  it('propaga un error que no sea de permisos', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('sin red'));
    await expect(createSession({ playlist: LISTA, host: HOST })).rejects.toThrow('sin red');
  });
});

describe('cambios sobre el estado compartido', () => {
  // El guardia contra la escritura encolada sin red. Si esto deja de sumar
  // exactamente uno, la regla de Firestore rechaza todos los cambios.
  it('sube la versión exactamente en uno', async () => {
    await setActiveSong('ABC123', { songId: 's2', expectedVersion: 7, user: HOST });
    expect(ultimaEscritura(mockUpdateDoc).version).toBe(8);
  });

  it('exige saber la versión actual', async () => {
    await expect(setActiveSong('ABC123', { songId: 's2', user: HOST }))
      .rejects.toThrow('Hace falta la versión');
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('rechaza una versión que no sea entera', async () => {
    await expect(
      setActiveSong('ABC123', { songId: 's2', expectedVersion: '7', user: HOST })
    ).rejects.toThrow('Hace falta la versión');
  });

  it('anota quién hizo el cambio', async () => {
    await setActiveSong('ABC123', { songId: 's2', expectedVersion: 1, user: HOST });
    expect(ultimaEscritura(mockUpdateDoc).updatedBy).toEqual({
      uid: 'u1',
      name: 'Cristhian'
    });
  });

  it('un rechazo de permisos se traduce en conflicto', async () => {
    mockUpdateDoc.mockRejectedValueOnce(denegado());

    await expect(setActiveSong('ABC123', { songId: 's2', expectedVersion: 1, user: HOST }))
      .rejects.toBeInstanceOf(SessionConflictError);
  });

  it('cualquier otro error pasa tal cual', async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error('sin red'));

    await expect(setActiveSong('ABC123', { songId: 's2', expectedVersion: 1, user: HOST }))
      .rejects.toThrow('sin red');
  });

  it('permite quedarse sin canción activa', async () => {
    await setActiveSong('ABC123', { songId: null, expectedVersion: 1, user: HOST });
    expect(ultimaEscritura(mockUpdateDoc).activeSongId).toBeNull();
  });

  describe('tonalidad', () => {
    it('cambia solo la canción indicada', async () => {
      await setSongKey('ABC123', {
        songs: LISTA.songs,
        songId: 's2',
        key: 'RE',
        expectedVersion: 3,
        user: HOST
      });

      expect(ultimaEscritura(mockUpdateDoc).songs).toEqual([
        { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' },
        { id: 's2', title: 'Sublime Gracia', key: 'RE', originalKey: 'SOL' }
      ]);
    });

    // Volver a la tonalidad de partida depende de que `originalKey` sobreviva
    // a cada transposición de la sesión.
    it('conserva la tonalidad original', async () => {
      await setSongKey('ABC123', {
        songs: LISTA.songs,
        songId: 's1',
        key: 'FA',
        expectedVersion: 1,
        user: HOST
      });

      expect(ultimaEscritura(mockUpdateDoc).songs[0].originalKey).toBe('DO');
    });
  });

  describe('lista de canciones', () => {
    it('mantiene la canción activa si sigue en la lista', async () => {
      await setSessionSongs('ABC123', {
        songs: [LISTA.songs[1], LISTA.songs[0]],
        activeSongId: 's2',
        expectedVersion: 2,
        user: HOST
      });

      const datos = ultimaEscritura(mockUpdateDoc);
      expect(datos.songs.map((s) => s.id)).toEqual(['s2', 's1']);
      // Los ids sueltos van siempre a la par: las reglas miran estos
      expect(datos.songIds).toEqual(['s2', 's1']);
      expect(datos.activeSongId).toBe('s2');
    });

    // Quitar la canción que se está tocando no puede dejar a la banda mirando
    // una pantalla vacía.
    it('pasa a la primera si se quita la activa', async () => {
      await setSessionSongs('ABC123', {
        songs: [LISTA.songs[0]],
        activeSongId: 's2',
        expectedVersion: 2,
        user: HOST
      });

      expect(ultimaEscritura(mockUpdateDoc).activeSongId).toBe('s1');
    });

    it('deja la sesión sin canción activa si se vacía', async () => {
      await setSessionSongs('ABC123', {
        songs: [],
        activeSongId: 's1',
        expectedVersion: 2,
        user: HOST
      });

      expect(ultimaEscritura(mockUpdateDoc).activeSongId).toBeNull();
    });
  });

  it('cerrar marca la sesión como terminada, no la borra', async () => {
    await endSession('ABC123', { expectedVersion: 9, user: HOST });

    expect(ultimaEscritura(mockUpdateDoc).status).toBe('ended');
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });
});

describe('participantes', () => {
  it('escribe el participante en la subcolección de la sesión', async () => {
    await joinSession('ABC123', { user: HOST, instrumentId: 'bb_trumpet', voiceNumber: '2' });

    expect(ultimaRuta(mockSetDoc)).toBe('sessions/ABC123/participants/u1');
    expect(ultimaEscritura(mockSetDoc)).toMatchObject({
      uid: 'u1',
      name: 'Cristhian',
      instrumentId: 'bb_trumpet',
      voiceNumber: '2'
    });
  });

  it('exige un usuario', async () => {
    await expect(joinSession('ABC123', { user: {} })).rejects.toThrow('Hace falta un usuario');
  });

  it('pone nombre por defecto a quien no lo tiene', async () => {
    await joinSession('ABC123', { user: { uid: 'u9' } });
    expect(ultimaEscritura(mockSetDoc).name).toBe('Músico');
  });

  // La TTL del documento padre no alcanza a la subcolección: sin su propio
  // `expiresAt`, estos documentos quedarían para siempre.
  it('caduca por su cuenta', async () => {
    const antes = Date.now();
    await joinSession('ABC123', { user: HOST });

    const { expiresAt } = ultimaEscritura(mockSetDoc);
    expect(expiresAt.millis).toBeGreaterThan(antes);
    expect(expiresAt.millis).toBeLessThanOrEqual(antes + SESSION_MAX_TTL_MS + 1000);
  });

  // Un invitado solo lee las canciones de la sesión que apunta aquí
  // (`firestore.rules`, `invitadoLaTiene`).
  it('un invitado apunta en qué sesión está, antes que su presencia', async () => {
    await joinSession('ABC123', { user: { uid: 'g1', isAnonymous: true } });

    expect(mockSetDoc.mock.calls[0][0].path).toBe('invitados/g1');
    expect(mockSetDoc.mock.calls[0][1]).toMatchObject({ sesion: 'ABC123' });
    expect(ultimaRuta(mockSetDoc)).toBe('sessions/ABC123/participants/g1');
  });

  it('con cuenta no apunta nada', async () => {
    await joinSession('ABC123', { user: HOST });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('si no se puede apuntar, entra igual (reglas aún sin desplegar)', async () => {
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetDoc.mockRejectedValueOnce(denegado());
    await joinSession('ABC123', { user: { uid: 'g1', isAnonymous: true } });
    expect(ultimaRuta(mockSetDoc)).toBe('sessions/ABC123/participants/g1');
    silencio.mockRestore();
  });

  it('salir borra solo tu presencia', async () => {
    await leaveSession('ABC123', 'u1');
    expect(mockDeleteDoc.mock.calls[0][0].path).toBe('sessions/ABC123/participants/u1');
  });

  describe('presencia', () => {
    const conLatido = (msAtras) => ({
      lastSeen: { toMillis: () => Date.now() - msAtras }
    });

    it('está en línea si latió hace poco', () => {
      expect(isParticipantOnline(conLatido(5000))).toBe(true);
    });

    it('no está en línea si pasó el margen', () => {
      expect(isParticipantOnline(conLatido(PRESENCE_TIMEOUT_MS + 1000))).toBe(false);
    });

    it('acepta una fecha normal además de un Timestamp', () => {
      expect(isParticipantOnline({ lastSeen: new Date().toISOString() })).toBe(true);
    });

    it('no está en línea sin latido', () => {
      expect(isParticipantOnline({})).toBe(false);
      expect(isParticipantOnline(null)).toBe(false);
    });

    it('no está en línea con una fecha ilegible', () => {
      expect(isParticipantOnline({ lastSeen: 'cualquier cosa' })).toBe(false);
    });
  });
});

describe('subscribeToSession', () => {
  // Sin `includeMetadataChanges` no llega el snapshot que solo cambia
  // `fromCache`, y la pantalla diría que todo va bien mientras el músico está
  // desconectado.
  it('pide los cambios de metadatos para poder avisar de que no hay red', () => {
    subscribeToSession('ABC123', { onChange: () => {} });
    expect(mockOnSnapshot.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
  });

  it('entrega los datos con el código como id y el origen del snapshot', () => {
    const onChange = vi.fn();
    subscribeToSession('ABC123', { onChange });

    const callback = mockOnSnapshot.mock.calls[0][2];
    callback({
      exists: () => true,
      id: 'ABC123',
      data: () => ({ version: 3 }),
      metadata: { fromCache: true, hasPendingWrites: false }
    });

    expect(onChange).toHaveBeenCalledWith(
      { id: 'ABC123', version: 3 },
      { fromCache: true, hasPendingWrites: false }
    );
  });

  it('avisa con null si la sesión no existe', () => {
    const onChange = vi.fn();
    subscribeToSession('ABC123', { onChange });

    const callback = mockOnSnapshot.mock.calls[0][2];
    callback({ exists: () => false, metadata: { fromCache: false } });

    expect(onChange).toHaveBeenCalledWith(null, { fromCache: false });
  });
});

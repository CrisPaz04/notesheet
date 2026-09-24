// Carga y renderiza TODAS las canciones de la sesión.
//
// El pipeline (`renderSongContent`) es el de verdad, no está simulado: lo que
// se comprueba aquí es que se le pasan los argumentos correctos, porque
// equivocarse en cuál es la tonalidad base es exactamente el bug que hace que
// media banda toque en otro tono.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mockGetSongById = vi.fn();
vi.mock('@notesheet/api', () => ({
  getSongById: (...a) => mockGetSongById(...a)
}));

const { default: useLiveSetlistContent } = await import('../hooks/useLiveSetlistContent');

const REPERTORIO = {
  s1: {
    id: 's1',
    title: 'Cristo Vive',
    key: 'DO',
    primaryInstrument: 'bb_trumpet',
    primaryVoiceNumber: '1',
    voices: {
      bb_trumpet: {
        '1': '## Verso\nDO SOL\nVoz de trompeta 1',
        '2': '## Verso\nMIm FA\nVoz de trompeta 2'
      },
      eb_alto_sax: { '1': '## Verso\nDO SOL\nVoz de saxo alto' }
    }
  },
  s2: {
    id: 's2',
    title: 'Sublime Gracia',
    key: 'SOL',
    content: '## Coro\nSOL RE\nSublime gracia'
  }
};

// Igual que lo que guarda la sesión: `sanitizeSong` se queda el título, así
// que la lista se puede pintar antes de que cargue ninguna canción.
const LISTA = [
  { id: 's1', title: 'Cristo Vive', key: 'DO', originalKey: 'DO' },
  { id: 's2', title: 'Sublime Gracia', key: 'SOL', originalKey: 'SOL' }
];

const montar = (props) => renderHook(
  (p) => useLiveSetlistContent(p),
  { initialProps: { songs: LISTA, instrument: 'bb_trumpet', notationSystem: 'latin', ...props } }
);

/** Todo el texto renderizado de una canción. */
const texto = (cancion) =>
  (cancion?.rendered?.formatted?.sections || []).map((s) => s.content).join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSongById.mockImplementation(async (id) => {
    if (!REPERTORIO[id]) throw new Error('permission-denied');
    return REPERTORIO[id];
  });
});

describe('carga de la lista entera', () => {
  // Es el cambio de fondo: en los enlaces rápidos hace falta ver el final de
  // una canción y el principio de la siguiente a la vez.
  it('carga todas las canciones, no solo la activa', async () => {
    const { result } = montar();

    await waitFor(() => expect(result.current.canciones[1].rendered).toBeTruthy());

    expect(mockGetSongById).toHaveBeenCalledTimes(2);
    expect(result.current.canciones.map((c) => c.title))
      .toEqual(['Cristo Vive', 'Sublime Gracia']);
  });

  it('mantiene el orden de la sesión', async () => {
    const { result } = montar({ songs: [LISTA[1], LISTA[0]] });

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(result.current.canciones.map((c) => c.id)).toEqual(['s2', 's1']);
  });

  it('no pide nada con la sesión vacía', () => {
    const { result } = montar({ songs: [] });

    expect(mockGetSongById).not.toHaveBeenCalled();
    expect(result.current.canciones).toEqual([]);
  });

  // El array de la sesión es nuevo en cada snapshot aunque las canciones sean
  // las mismas: sin comparar por ids, cada latido de presencia de cualquiera
  // relanzaría la carga de todo.
  it('no recarga cuando llega el mismo contenido en otro array', async () => {
    const { result, rerender } = montar();
    await waitFor(() => expect(result.current.canciones[1].rendered).toBeTruthy());

    rerender({
      songs: LISTA.map((s) => ({ ...s })),
      instrument: 'bb_trumpet',
      notationSystem: 'latin'
    });

    expect(mockGetSongById).toHaveBeenCalledTimes(2);
  });

  it('solo pide la nueva cuando se añade una canción', async () => {
    const { result, rerender } = montar({ songs: [LISTA[0]] });
    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());

    rerender({ songs: LISTA, instrument: 'bb_trumpet', notationSystem: 'latin' });
    await waitFor(() => expect(result.current.canciones[1].rendered).toBeTruthy());

    expect(mockGetSongById).toHaveBeenCalledTimes(2);
    expect(mockGetSongById).toHaveBeenLastCalledWith('s2');
  });

  // Una canción rota no puede llevarse por delante a las demás: la banda
  // tiene que poder seguir leyendo el resto del servicio.
  it('una canción que falla no impide ver las otras', async () => {
    const { result } = montar({
      songs: [{ id: 'borrada', key: 'DO' }, LISTA[1]]
    });

    await waitFor(() => expect(result.current.canciones[1].rendered).toBeTruthy());
    expect(result.current.canciones[0].error).toBeTruthy();
    expect(result.current.canciones[0].rendered).toBeNull();
  });

  // Desde el cliente `permission-denied` no distingue entre borrada y no
  // compartida, así que el mensaje no puede afirmar una de las dos.
  it('el aviso no afirma cuál de las dos causas es', async () => {
    const { result } = montar({ songs: [{ id: 'borrada', key: 'DO' }] });

    await waitFor(() => expect(result.current.canciones[0].error).toBeTruthy());
    expect(result.current.canciones[0].error).toMatch(/borrado/);
    expect(result.current.canciones[0].error).toMatch(/compartida/);
  });
});

describe('cada quien con lo suyo', () => {
  it('toma la voz escrita para el instrumento del músico', async () => {
    const { result } = montar({ instrument: 'eb_alto_sax' });

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(result.current.canciones[0].voiceKey).toBe('eb_alto_sax-1');
    expect(texto(result.current.canciones[0])).toContain('saxo alto');
  });

  it('respeta la voz elegida a mano para esa canción', async () => {
    const { result } = montar({ voiceKeys: { s1: 'bb_trumpet-2' } });

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(texto(result.current.canciones[0])).toContain('trompeta 2');
  });

  // La voz se elige por canción: cambiarla en una no puede cambiarla en otra.
  it('la voz elegida en una canción no afecta a las demás', async () => {
    const { result } = montar({ voiceKeys: { s1: 'bb_trumpet-2' } });

    await waitFor(() => expect(result.current.canciones[1].rendered).toBeTruthy());
    expect(result.current.canciones[1].voiceKey).toBeNull();
    expect(texto(result.current.canciones[1])).toContain('Sublime gracia');
  });

  it('cae en la voz principal si su instrumento no tiene voz propia', async () => {
    const { result } = montar({ instrument: 'f_horn' });

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(result.current.canciones[0].voiceKey).toBe('bb_trumpet-1');
  });

  it('lista las voces disponibles de cada canción', async () => {
    const { result } = montar();

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(result.current.canciones[0].voices.map((v) => v.id))
      .toEqual(['bb_trumpet-1', 'bb_trumpet-2', 'eb_alto_sax-1']);
    expect(result.current.canciones[1].voices).toEqual([]);
  });
});

describe('tonalidad', () => {
  // Lo compartido manda sobre lo escrito. Si `baseKey` y `targetKey` se
  // cruzaran, la transposición iría al revés y nadie se daría cuenta hasta
  // tener el instrumento en la boca.
  it('transpone desde la tonalidad de la canción a la de la sesión', async () => {
    const { result } = montar({ songs: [{ id: 's1', key: 'RE', originalKey: 'DO' }] });

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(texto(result.current.canciones[0])).toContain('RE LA');
  });

  it('no transpone si la sesión dejó la original', async () => {
    const { result } = montar();

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(texto(result.current.canciones[0])).toContain('DO SOL');
  });

  // Lo que hace que "cada quien con su instrumento" funcione: la sesión dice
  // DO y el saxo alto lee SOL, sin que el director tenga que pensarlo.
  it('el instrumento transpositor ve su propia tonalidad', async () => {
    const { result } = montar({ instrument: 'eb_alto_sax' });

    await waitFor(() => expect(result.current.canciones[0].rendered).toBeTruthy());
    expect(result.current.canciones[0].rendered.displayKey).toBe('SOL');
  });

  it('cambia la notación en todas a la vez', async () => {
    const { result } = montar({ notationSystem: 'english' });

    await waitFor(() => expect(result.current.canciones[1].rendered).toBeTruthy());
    expect(texto(result.current.canciones[0])).toContain('C G');
    expect(texto(result.current.canciones[1])).toContain('G D');
  });
});

describe('partituras en PDF', () => {
  const PDF = {
    id: 's3',
    title: 'Prueba PDF',
    key: 'DO',
    format: 'pdf',
    content: '',
    primaryInstrument: 'bb_trumpet',
    primaryVoiceNumber: '1',
    pdfs: {
      bb_trumpet: { 1: { partitura: 'partituras/s3/bb_trumpet-1-partitura.pdf' } },
      bb_trombone: { 1: { partitura: 'partituras/s3/bb_trombone-1-partitura.pdf' } }
    }
  };
  const CON_PDF = [...LISTA, { id: 's3', title: 'Prueba PDF', key: 'DO', originalKey: 'DO' }];

  beforeEach(() => {
    mockGetSongById.mockImplementation(async (id) => (id === 's3' ? PDF : REPERTORIO[id]));
  });

  it('no pasa por el pipeline de texto: da la partitura de su instrumento', async () => {
    // El fallo real: salían los títulos de sección vacíos y ninguna partitura
    const { result } = montar({ songs: CON_PDF, instrument: 'bb_trombone' });

    await waitFor(() => expect(result.current.canciones[2].pdf).toBeTruthy());
    const cancion = result.current.canciones[2];
    expect(cancion.rendered).toBeNull();
    expect(cancion.pdf.path).toBe('partituras/s3/bb_trombone-1-partitura.pdf');
    expect(cancion.voiceKey).toBe('bb_trombone-1');
  });

  it('la voz elegida a mano manda, y ofrece las voces que tienen PDF', async () => {
    const { result } = montar({ songs: CON_PDF, voiceKeys: { s3: 'bb_trombone-1' } });

    await waitFor(() => expect(result.current.canciones[2].pdf).toBeTruthy());
    expect(result.current.canciones[2].pdf.path).toBe('partituras/s3/bb_trombone-1-partitura.pdf');
    expect(result.current.canciones[2].voices.map((v) => v.id))
      .toEqual(['bb_trombone-1', 'bb_trumpet-1']);
  });

  it('sin voz para su instrumento, la principal', async () => {
    const { result } = montar({ songs: CON_PDF, instrument: 'eb_alto_sax' });

    await waitFor(() => expect(result.current.canciones[2].pdf).toBeTruthy());
    expect(result.current.canciones[2].pdf.path).toBe('partituras/s3/bb_trumpet-1-partitura.pdf');
  });
});

describe('letra y acordes de cada canción', () => {
  const textoDe = (formatted) => (formatted?.sections || []).map((s) => s.content).join('\n');

  it('prepara la letra y los acordes con el instrumento del músico', async () => {
    mockGetSongById.mockImplementation(async (id) => (
      id === 's2' ? { ...REPERTORIO.s2, acordes: 'FA DO' } : REPERTORIO[id]
    ));
    const { result } = montar({ instrument: 'c_guitar' });

    await waitFor(() => expect(result.current.canciones[1].vistas).toBeTruthy());
    const s2 = result.current.canciones[1];
    expect(textoDe(s2.vistas.letra)).toMatch(/Sublime gracia/);
    expect(textoDe(s2.vistas.letra)).not.toMatch(/SOL RE/);
    // En concierto, como los escribió el guitarrista
    expect(textoDe(s2.vistas.acordes)).toBe('FA DO');
    // Sin acordes, nada que enseñar
    expect(result.current.canciones[0].vistas.acordes).toBeNull();
  });

  it('para la trompeta, los acordes suben un tono', async () => {
    mockGetSongById.mockImplementation(async (id) => (
      id === 's2' ? { ...REPERTORIO.s2, acordes: 'FA DO' } : REPERTORIO[id]
    ));
    const { result } = montar();
    await waitFor(() => expect(result.current.canciones[1].vistas).toBeTruthy());
    expect(textoDe(result.current.canciones[1].vistas.acordes)).toBe('SOL RE');
  });
});

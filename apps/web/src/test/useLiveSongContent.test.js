// La pieza que junta lo compartido con lo de cada quien: la tonalidad viene
// de la sesión y el instrumento, la voz y la notación son de este dispositivo.
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

const { default: useLiveSongContent } = await import('../hooks/useLiveSongContent');

const CANCION = {
  id: 's1',
  title: 'Cristo Vive',
  key: 'DO',
  primaryInstrument: 'bb_trumpet',
  primaryVoiceNumber: '1',
  content: '## Verso\nDO SOL\nCristo vive',
  voices: {
    bb_trumpet: {
      '1': '## Verso\nDO SOL\nVoz de trompeta 1',
      '2': '## Verso\nMIm FA\nVoz de trompeta 2'
    },
    eb_alto_sax: {
      '1': '## Verso\nDO SOL\nVoz de saxo alto'
    }
  }
};

const montar = (props) => renderHook(
  (p) => useLiveSongContent(p),
  { initialProps: { instrument: 'bb_trumpet', notationSystem: 'latin', ...props } }
);

/** Todo el texto renderizado, para buscar dentro sin pelearse con secciones. */
const texto = (result) =>
  (result.current.rendered?.formatted?.sections || [])
    .map((s) => s.content)
    .join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSongById.mockResolvedValue(CANCION);
});

describe('carga', () => {
  it('no pide nada sin canción activa', () => {
    const { result } = montar({ song: null });

    expect(mockGetSongById).not.toHaveBeenCalled();
    expect(result.current.rendered).toBeNull();
  });

  it('carga la canción activa', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' } });

    await waitFor(() => expect(result.current.song).toEqual(CANCION));
    expect(mockGetSongById).toHaveBeenCalledWith('s1');
  });

  // En el servicio se va y se vuelve entre canciones todo el rato: volver
  // atrás no debería mostrar un spinner ni gastar otra lectura.
  it('no vuelve a pedir una canción que ya cargó', async () => {
    const { result, rerender } = montar({ song: { id: 's1', key: 'DO' } });
    await waitFor(() => expect(result.current.song).toBeTruthy());

    rerender({ song: { id: 's2', key: 'SOL' }, instrument: 'bb_trumpet' });
    await waitFor(() => expect(mockGetSongById).toHaveBeenCalledTimes(2));

    rerender({ song: { id: 's1', key: 'DO' }, instrument: 'bb_trumpet' });
    await waitFor(() => expect(result.current.song?.id).toBe('s1'));

    expect(mockGetSongById).toHaveBeenCalledTimes(2);
  });

  // Firestore da `permission-denied` tanto si la canción no está compartida
  // como si ya no existe, y desde el cliente son indistinguibles. El mensaje
  // no puede afirmar una de las dos: decir "no está publicada" de una canción
  // borrada manda al músico a buscar un botón que no existe.
  it('avisa sin afirmar cuál de las dos causas es', async () => {
    mockGetSongById.mockRejectedValue(new Error('permission-denied'));
    const { result } = montar({ song: { id: 's1', key: 'DO' } });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error).toMatch(/borrado/);
    expect(result.current.error).toMatch(/compartida/);
    expect(result.current.rendered).toBeNull();
  });

  it('deja de cargar cuando termina', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.song).toBeTruthy();
  });
});

describe('elección de voz', () => {
  it('toma la voz del instrumento del músico si existe', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' }, instrument: 'eb_alto_sax' });

    await waitFor(() => expect(result.current.voiceKey).toBe('eb_alto_sax-1'));
    expect(texto(result)).toContain('saxo alto');
  });

  it('respeta la voz elegida a mano', async () => {
    const { result } = montar({
      song: { id: 's1', key: 'DO' },
      instrument: 'bb_trumpet',
      voiceKey: 'bb_trumpet-2'
    });

    await waitFor(() => expect(result.current.voiceKey).toBe('bb_trumpet-2'));
    expect(texto(result)).toContain('trompeta 2');
  });

  // Un corno no tiene voz escrita en esta canción: lee la principal, y el
  // pipeline se la transpone desde la referencia.
  it('cae en la voz principal si su instrumento no tiene voz propia', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' }, instrument: 'f_horn' });

    await waitFor(() => expect(result.current.voiceKey).toBe('bb_trumpet-1'));
    expect(texto(result)).toContain('trompeta 1');
  });

  it('lista las voces disponibles', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' } });

    await waitFor(() => expect(result.current.voices).toHaveLength(3));
    expect(result.current.voices.map((v) => v.id)).toEqual([
      'bb_trumpet-1', 'bb_trumpet-2', 'eb_alto_sax-1'
    ]);
  });
});

describe('tonalidad', () => {
  // Lo compartido manda sobre lo escrito: la canción está en DO y la sesión
  // decidió RE, así que se transpone. Si `baseKey` y `targetKey` se cruzaran,
  // la transposición iría al revés y nadie se daría cuenta hasta tocar.
  it('transpone desde la tonalidad de la canción a la de la sesión', async () => {
    const { result } = montar({ song: { id: 's1', key: 'RE' }, instrument: 'bb_trumpet' });

    await waitFor(() => expect(result.current.rendered).toBeTruthy());
    expect(texto(result)).toContain('RE LA');
  });

  it('no transpone si la sesión dejó la tonalidad original', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' }, instrument: 'bb_trumpet' });

    await waitFor(() => expect(result.current.rendered).toBeTruthy());
    expect(texto(result)).toContain('DO SOL');
  });

  // Lo que hace que "cada quien con su instrumento" funcione: la sesión dice
  // DO y el saxo alto lee SOL, sin que el director tenga que pensarlo.
  it('el instrumento transpositor ve su propia tonalidad', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' }, instrument: 'eb_alto_sax' });

    await waitFor(() => expect(result.current.rendered).toBeTruthy());
    expect(result.current.rendered.displayKey).toBe('SOL');
  });

  it('un instrumento en la referencia lee la tonalidad de la sesión', async () => {
    const { result } = montar({ song: { id: 's1', key: 'DO' }, instrument: 'bb_trumpet' });

    await waitFor(() => expect(result.current.rendered).toBeTruthy());
    expect(result.current.rendered.displayKey).toBe('DO');
  });

  it('cambia la notación sin tocar lo compartido', async () => {
    const { result } = montar({
      song: { id: 's1', key: 'DO' },
      instrument: 'bb_trumpet',
      notationSystem: 'english'
    });

    await waitFor(() => expect(result.current.rendered).toBeTruthy());
    expect(texto(result)).toContain('C G');
  });
});

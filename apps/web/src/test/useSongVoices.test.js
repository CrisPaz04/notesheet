import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockAddVoiceToSong = vi.fn();
const mockRemoveVoiceFromSong = vi.fn();

vi.mock('@notesheet/api', () => ({
  addVoiceToSong: (...args) => mockAddVoiceToSong(...args),
  removeVoiceFromSong: (...args) => mockRemoveVoiceFromSong(...args)
}));

const { default: useSongVoices, LYRICS_TAB, ACORDES_TAB } = await import('../hooks/useSongVoices');

let onError;

const setup = (options = {}) => {
  onError = vi.fn();
  return renderHook(() =>
    useSongVoices({ songId: 'song-1', isNewSong: false, onError, ...options })
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAddVoiceToSong.mockResolvedValue({});
  mockRemoveVoiceFromSong.mockResolvedValue({});
});

describe('useSongVoices', () => {
  it('arranca con una trompeta 1 vacía como voz principal', () => {
    const { result } = setup();
    expect(result.current.voices).toEqual({ bb_trumpet: { '1': '' } });
    expect(result.current.currentTab).toBe('bb_trumpet-1');
    expect(result.current.primaryInstrument).toBe('bb_trumpet');
  });

  it('añade una voz y la deja activa', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.addVoice('f_horn', '1', 'contenido corno');
    });

    expect(result.current.voices.f_horn).toEqual({ '1': 'contenido corno' });
    expect(result.current.currentTab).toBe('f_horn-1');
    expect(mockAddVoiceToSong).toHaveBeenCalledWith('song-1', 'f_horn', '1', 'contenido corno');
  });

  it('rechaza una voz duplicada', async () => {
    const { result } = setup();

    let added;
    await act(async () => {
      added = await result.current.addVoice('bb_trumpet', '1', 'otra cosa');
    });

    expect(added).toBe(false);
    expect(onError).toHaveBeenCalledWith('Esta voz ya existe');
    expect(result.current.voices.bb_trumpet['1']).toBe('');
    expect(mockAddVoiceToSong).not.toHaveBeenCalled();
  });

  it('no persiste en una canción nueva', async () => {
    const { result } = setup({ isNewSong: true, songId: undefined });

    await act(async () => {
      await result.current.addVoice('f_horn', '1', 'x');
    });

    expect(result.current.voices.f_horn).toEqual({ '1': 'x' });
    expect(mockAddVoiceToSong).not.toHaveBeenCalled();
  });

  it('avisa si falla el guardado pero mantiene la voz en memoria', async () => {
    mockAddVoiceToSong.mockRejectedValue(new Error('sin permisos'));
    const { result } = setup();

    await act(async () => {
      await result.current.addVoice('f_horn', '1', 'x');
    });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('sin permisos'));
    expect(result.current.voices.f_horn).toEqual({ '1': 'x' });
  });

  it('elimina una voz secundaria', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.addVoice('f_horn', '1', 'x');
    });
    await act(async () => {
      await result.current.removeVoice('f_horn', '1');
    });

    expect(result.current.voices.f_horn).toBeUndefined();
    expect(mockRemoveVoiceFromSong).toHaveBeenCalledWith('song-1', 'f_horn', '1');
  });

  it('no permite eliminar la voz principal', async () => {
    const { result } = setup();

    let removed;
    await act(async () => {
      removed = await result.current.removeVoice('bb_trumpet', '1');
    });

    expect(removed).toBe(false);
    expect(onError).toHaveBeenCalledWith('No puedes eliminar la voz principal');
    expect(result.current.voices.bb_trumpet['1']).toBe('');
  });

  it('vuelve a la voz principal si se elimina la pestaña activa', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.addVoice('f_horn', '1', 'x');
    });
    expect(result.current.currentTab).toBe('f_horn-1');

    await act(async () => {
      await result.current.removeVoice('f_horn', '1');
    });
    expect(result.current.currentTab).toBe('bb_trumpet-1');
  });

  it('conserva las demás voces del mismo instrumento', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.addVoice('bb_trumpet', '2', 'segunda');
    });
    await act(async () => {
      await result.current.removeVoice('bb_trumpet', '2');
    });

    expect(result.current.voices.bb_trumpet).toEqual({ '1': '' });
  });

  it('lee y escribe el contenido de la pestaña activa', async () => {
    const { result } = setup();

    act(() => {
      result.current.updateCurrentTabContent('acordes nuevos');
    });

    expect(result.current.getCurrentTabContent()).toBe('acordes nuevos');
    expect(result.current.voices.bb_trumpet['1']).toBe('acordes nuevos');
  });

  it('delega la pestaña de letra al componente', () => {
    const onChange = vi.fn();
    const { result } = setup({ lyrics: { value: 'la letra', onChange } });

    act(() => {
      result.current.setCurrentTab(LYRICS_TAB);
    });

    expect(result.current.getCurrentTabContent()).toBe('la letra');

    act(() => {
      result.current.updateCurrentTabContent('letra editada');
    });

    expect(onChange).toHaveBeenCalledWith('letra editada');
    // La letra no se guarda como si fuera una voz
    expect(result.current.voices).toEqual({ bb_trumpet: { '1': '' } });
  });

  it('delega la pestaña de acordes al componente, sin tocar las voces ni la letra', () => {
    const acordes = { value: 'DO SOL', onChange: vi.fn() };
    const lyrics = { value: 'la letra', onChange: vi.fn() };
    const { result } = setup({ lyrics, acordes });

    act(() => {
      result.current.setCurrentTab(ACORDES_TAB);
    });
    expect(result.current.getCurrentTabContent()).toBe('DO SOL');

    act(() => {
      result.current.updateCurrentTabContent('DO SOL LAm FA');
    });
    expect(acordes.onChange).toHaveBeenCalledWith('DO SOL LAm FA');
    expect(lyrics.onChange).not.toHaveBeenCalled();
    expect(result.current.voices).toEqual({ bb_trumpet: { '1': '' } });
  });

  it('maneja ids de instrumento con guion bajo', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.addVoice('eb_alto_sax', '2', 'sax');
    });

    expect(result.current.currentTab).toBe('eb_alto_sax-2');
    expect(result.current.getCurrentTabContent()).toBe('sax');
  });
});

import { describe, it, expect } from 'vitest';
import {
  convertNotationSystem,
  extractSongMetadata,
  parseSongSections,
  extractLyricsOnly,
  formatSong,
} from '@notesheet/core';

describe('convertNotationSystem', () => {
  it('converts Latin to English notation', () => {
    expect(convertNotationSystem('DO RE MI FA SOL LA SI', 'english'))
      .toBe('C D E F G A B');
  });

  it('converts English to Latin notation', () => {
    expect(convertNotationSystem('C D E F G A B', 'latin'))
      .toBe('DO RE MI FA SOL LA SI');
  });

  it('handles sharps', () => {
    expect(convertNotationSystem('DO# RE# FA# SOL# LA#', 'english'))
      .toBe('C# D# F# G# A#');
  });

  it('handles flats', () => {
    expect(convertNotationSystem('REb MIb SOLb LAb SIb', 'english'))
      .toBe('Db Eb Gb Ab Bb');
  });

  it('preserves non-note text', () => {
    expect(convertNotationSystem('Verso: DO SOL LA FA', 'english'))
      .toBe('Verso: C G A F');
  });

  it('handles mixed content with lyrics', () => {
    const input = 'DO          SOL\nAmazing grace';
    const result = convertNotationSystem(input, 'english');
    expect(result).toContain('C');
    expect(result).toContain('G');
    expect(result).toContain('Amazing grace');
  });
});

describe('extractSongMetadata', () => {
  it('extracts title in Spanish format', () => {
    const content = '# Título: Amazing Grace\nDO SOL';
    const metadata = extractSongMetadata(content);
    expect(metadata.title).toBe('Amazing Grace');
  });

  it('extracts title in English format', () => {
    const content = '# Title: Amazing Grace\nC G';
    const metadata = extractSongMetadata(content);
    expect(metadata.title).toBe('Amazing Grace');
  });

  it('extracts key/tonalidad', () => {
    const content = '# Tonalidad: DO\n# Key: G';
    const metadata = extractSongMetadata(content);
    expect(metadata.key).toBeTruthy();
  });

  it('extracts multiple metadata fields', () => {
    const content = `# Título: Test Song
# Tonalidad: DO
# Autor: John Doe
# Tempo: 120`;
    const metadata = extractSongMetadata(content);
    expect(metadata.title).toBe('Test Song');
    expect(metadata.key).toBe('DO');
    expect(metadata.author).toBe('John Doe');
    expect(metadata.tempo).toBe('120');
  });

  it('returns empty strings for missing metadata', () => {
    const metadata = extractSongMetadata('Just some lyrics');
    expect(metadata.title).toBe('');
    expect(metadata.key).toBe('');
  });
});

describe('parseSongSections', () => {
  it('parses sections marked with ##', () => {
    const content = `## Intro
DO SOL

## Verso 1
LA FA DO`;
    const sections = parseSongSections(content);
    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('Intro');
    expect(sections[1].title).toBe('Verso 1');
  });

  it('includes section content', () => {
    const content = `## Coro
DO SOL LA FA
Letra del coro`;
    const sections = parseSongSections(content);
    expect(sections[0].content).toContain('DO SOL LA FA');
    expect(sections[0].content).toContain('Letra del coro');
  });

  it('excludes metadata lines from sections', () => {
    const content = `# Título: Test
# Tonalidad: DO

## Verso
DO SOL`;
    const sections = parseSongSections(content);
    expect(sections[0].content).not.toContain('Título');
    expect(sections[0].content).not.toContain('Tonalidad');
  });

  it('returns empty array for content without sections', () => {
    const sections = parseSongSections('Just plain text');
    expect(sections).toHaveLength(0);
  });
});

describe('extractLyricsOnly', () => {
  it('removes chord names from content', () => {
    const content = 'DO SOL LA FA\nAmazing grace how sweet';
    const lyrics = extractLyricsOnly(content);
    expect(lyrics).not.toContain('DO');
    expect(lyrics).not.toContain('SOL');
    expect(lyrics).toContain('Amazing grace how sweet');
  });

  it('removes English chord names', () => {
    const content = 'C G Am F\nAmazing grace';
    const lyrics = extractLyricsOnly(content);
    expect(lyrics).not.toMatch(/\bC\b/);
    expect(lyrics).not.toMatch(/\bG\b/);
    expect(lyrics).toContain('Amazing grace');
  });

  it('removes minor chords', () => {
    const content = 'LAm REm\nSome lyrics';
    const lyrics = extractLyricsOnly(content);
    expect(lyrics).not.toContain('LAm');
    expect(lyrics).not.toContain('REm');
  });

  it('preserves section headers', () => {
    const content = '## Verso\nDO SOL\nLyrics here';
    const lyrics = extractLyricsOnly(content);
    expect(lyrics).toContain('## Verso');
  });

  it('handles empty input', () => {
    expect(extractLyricsOnly('')).toBe('');
    expect(extractLyricsOnly(null)).toBe('');
  });

  it('collapses multiple spaces', () => {
    const content = 'DO    SOL    LA\nLyrics';
    const lyrics = extractLyricsOnly(content);
    expect(lyrics).not.toContain('    ');
  });
});

describe('formatSong', () => {
  it('returns metadata and sections', () => {
    const content = `# Título: Test
## Verso
DO SOL`;
    const result = formatSong(content);
    expect(result.metadata.title).toBe('Test');
    expect(result.sections).toHaveLength(1);
    expect(result.rawContent).toBeTruthy();
  });

  it('converts notation when specified', () => {
    const content = '## Verso\nDO SOL LA';
    const result = formatSong(content, { notationSystem: 'english' });
    expect(result.rawContent).toContain('C');
    expect(result.rawContent).toContain('G');
  });
});

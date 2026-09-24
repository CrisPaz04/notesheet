import { describe, it, expect } from 'vitest';
import {
  normalizarTexto,
  parsearTonalidad,
  parsearSetlist,
  puntuarCoincidencia,
  buscarCandidatos,
  emparejarSetlist,
  parsearCabecera,
  estructurarMensaje,
  UMBRAL_SEGURO
} from '@notesheet/core';

// Repertorio de prueba. Los títulos van como se guardan de verdad —con
// tildes y mayúsculas— porque el director escribirá otra cosa.
const REPERTORIO = [
  {
    id: '1',
    title: 'Te Alabaré',
    lyricsOnly: 'Te alabaré mi buen Jesús\ncon todo el corazón'
  },
  {
    id: '2',
    title: 'En Mi Corazón',
    lyricsOnly: 'En mi corazón hay una melodía\nque canta de tu amor'
  },
  {
    id: '3',
    title: 'Jesús Mi Fiel Amigo',
    lyricsOnly: 'Jesús mi fiel amigo, siempre está conmigo'
  },
  {
    id: '4',
    title: 'Perder La Compostura',
    lyricsOnly: 'Voy a perder la compostura por ti\nno me importa lo que digan'
  },
  {
    id: '5',
    title: 'Sin Vergüenza',
    lyricsOnly: 'No me avergüenzo del evangelio de Cristo'
  },
  {
    id: '6',
    title: 'Sublime Gracia',
    lyricsOnly: 'Sublime gracia del Señor que a un infeliz salvó'
  }
];

const porTitulo = (resultado) => resultado.elegida?.title ?? null;

describe('normalizarTexto', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizarTexto('Te Alabaré')).toBe('te alabare');
  });

  it('quita puntuación y colapsa espacios', () => {
    expect(normalizarTexto('  ¡Jesús,  mi   fiel amigo!  ')).toBe('jesus mi fiel amigo');
  });

  it('tolera valores vacíos', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
  });
});

describe('parsearTonalidad', () => {
  it('reconoce las menores como las escribe el director', () => {
    expect(parsearTonalidad('Mi m')).toBe('MIm');
    expect(parsearTonalidad('La m')).toBe('LAm');
    expect(parsearTonalidad('Lam')).toBe('LAm');
    expect(parsearTonalidad('RE menor')).toBe('REm');
  });

  it('reconoce las mayores', () => {
    expect(parsearTonalidad('Do')).toBe('DO');
    expect(parsearTonalidad('SOL')).toBe('SOL');
  });

  it('reconoce alteraciones', () => {
    expect(parsearTonalidad('Fa#')).toBe('FA#');
    expect(parsearTonalidad('Sib')).toBe('SIb');
    expect(parsearTonalidad('fa# m')).toBe('FA#m');
  });

  it('acepta también el cifrado anglosajón', () => {
    expect(parsearTonalidad('Am')).toBe('LAm');
    expect(parsearTonalidad('C')).toBe('DO');
    expect(parsearTonalidad('F#m')).toBe('FA#m');
  });

  it('no confunde un título con una tonalidad', () => {
    expect(parsearTonalidad('Te alabare')).toBeNull();
    expect(parsearTonalidad('Mi Dios es fiel')).toBeNull();
    expect(parsearTonalidad('En mi corazon')).toBeNull();
  });
});

describe('parsearSetlist', () => {
  // El mensaje tal cual llega al grupo
  const MENSAJE = `Mi m
Te alabare
En mi corazon
Jesus mi fiel amigo

La m
Voy a perder la compostura
No me averguenzo`;

  it('separa las canciones de las tonalidades', () => {
    const entradas = parsearSetlist(MENSAJE);
    expect(entradas.map((e) => e.consulta)).toEqual([
      'Te alabare',
      'En mi corazon',
      'Jesus mi fiel amigo',
      'Voy a perder la compostura',
      'No me averguenzo'
    ]);
  });

  it('arrastra la tonalidad a las canciones que vienen debajo', () => {
    const entradas = parsearSetlist(MENSAJE);
    expect(entradas.map((e) => e.key)).toEqual(['MIm', 'MIm', 'MIm', 'LAm', 'LAm']);
  });

  it('deja sin tonalidad lo que va antes de la primera', () => {
    const entradas = parsearSetlist('Te alabare\nDo\nSublime gracia');
    expect(entradas[0].key).toBeNull();
    expect(entradas[1].key).toBe('DO');
  });

  it('ignora líneas en blanco', () => {
    expect(parsearSetlist('\n\n  \n')).toEqual([]);
  });

  it('guarda el número de línea para poder señalar los problemas', () => {
    const entradas = parsearSetlist('Mi m\nTe alabare');
    expect(entradas[0].linea).toBe(2);
  });
});

describe('puntuarCoincidencia', () => {
  const cancion = REPERTORIO[0]; // Te Alabaré

  it('el título exacto puntúa al máximo', () => {
    expect(puntuarCoincidencia('Te Alabaré', cancion).score).toBe(1);
  });

  it('el título sin tildes también', () => {
    expect(puntuarCoincidencia('te alabare', cancion).score).toBe(1);
  });

  it('un verso literal puntúa alto', () => {
    const r = puntuarCoincidencia('mi buen Jesus', cancion);
    expect(r.score).toBeGreaterThanOrEqual(UMBRAL_SEGURO);
  });

  it('algo que no tiene que ver puntúa bajo', () => {
    expect(puntuarCoincidencia('himno nacional', cancion).score).toBeLessThan(0.34);
  });

  it('no revienta con una canción sin letra', () => {
    expect(() => puntuarCoincidencia('algo', { title: 'X' })).not.toThrow();
  });

  it('no revienta con una consulta vacía', () => {
    expect(puntuarCoincidencia('', cancion).score).toBe(0);
  });
});

describe('buscarCandidatos', () => {
  it('encuentra por título correcto', () => {
    expect(porTitulo(buscarCandidatos('Sublime Gracia', REPERTORIO))).toBe('Sublime Gracia');
  });

  it('encuentra por título sin tildes ni mayúsculas', () => {
    expect(porTitulo(buscarCandidatos('jesus mi fiel amigo', REPERTORIO)))
      .toBe('Jesús Mi Fiel Amigo');
  });

  // El caso que de verdad importa: el director escribe un verso, no el título
  it('encuentra por un verso aunque el título sea otro', () => {
    const r = buscarCandidatos('Voy a perder la compostura', REPERTORIO);
    expect(porTitulo(r)).toBe('Perder La Compostura');
    expect(r.seguro).toBe(true);
  });

  it('encuentra otra canción cuyo título no se parece al verso', () => {
    const r = buscarCandidatos('No me averguenzo', REPERTORIO);
    expect(porTitulo(r)).toBe('Sin Vergüenza');
    expect(r.seguro).toBe(true);
  });

  it('tolera una errata dentro de una frase', () => {
    expect(porTitulo(buscarCandidatos('voy a perder la compostora', REPERTORIO)))
      .toBe('Perder La Compostura');
  });

  // Con una sola palabra no hay otras que salven la coincidencia: esto
  // depende únicamente de la tolerancia a erratas.
  it('tolera una errata cuando es la única palabra', () => {
    const r = buscarCandidatos('compostora', REPERTORIO);
    expect(porTitulo(r)).toBe('Perder La Compostura');
    expect(r.seguro).toBe(true);
  });

  it('tolera que el director acorte', () => {
    expect(porTitulo(buscarCandidatos('perder la compostura', REPERTORIO)))
      .toBe('Perder La Compostura');
  });

  it('no inventa una coincidencia cuando no la hay', () => {
    const r = buscarCandidatos('Cumpleaños feliz', REPERTORIO);
    expect(r.elegida).toBeNull();
    expect(r.seguro).toBe(false);
    expect(r.candidatos).toEqual([]);
  });

  it('devuelve alternativas ordenadas por confianza', () => {
    const r = buscarCandidatos('corazon', REPERTORIO);
    expect(r.candidatos.length).toBeGreaterThan(1);
    const scores = r.candidatos.map((c) => c.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('no ofrece más de cinco alternativas', () => {
    expect(buscarCandidatos('a', REPERTORIO).candidatos.length).toBeLessThanOrEqual(5);
  });

  it('funciona con un repertorio vacío', () => {
    const r = buscarCandidatos('Te alabare', []);
    expect(r.elegida).toBeNull();
    expect(r.candidatos).toEqual([]);
  });
});

describe('emparejarSetlist', () => {
  const MENSAJE = `Mi m
Te alabare
En mi corazon
Jesus mi fiel amigo

La m
Voy a perder la compostura
No me averguenzo`;

  it('resuelve el mensaje completo del director', () => {
    const resultado = emparejarSetlist(MENSAJE, REPERTORIO);

    expect(resultado.map(porTitulo)).toEqual([
      'Te Alabaré',
      'En Mi Corazón',
      'Jesús Mi Fiel Amigo',
      'Perder La Compostura',
      'Sin Vergüenza'
    ]);
  });

  it('aplica a cada canción la tonalidad de su bloque', () => {
    const resultado = emparejarSetlist(MENSAJE, REPERTORIO);
    expect(resultado.map((e) => e.key)).toEqual(['MIm', 'MIm', 'MIm', 'LAm', 'LAm']);
  });

  it('las da todas por seguras en este mensaje', () => {
    const resultado = emparejarSetlist(MENSAJE, REPERTORIO);
    expect(resultado.every((e) => e.seguro)).toBe(true);
  });

  it('marca la que no encuentra sin descartar el resto', () => {
    const resultado = emparejarSetlist('Do\nTe alabare\nCancion que no existe', REPERTORIO);

    expect(porTitulo(resultado[0])).toBe('Te Alabaré');
    expect(resultado[1].elegida).toBeNull();
    expect(resultado[1].consulta).toBe('Cancion que no existe');
  });

  it('devuelve lista vacía si no hay nada que interpretar', () => {
    expect(emparejarSetlist('', REPERTORIO)).toEqual([]);
  });
});

// Un mensaje real del director (2026-09): bloques marcados con asterisco,
// notas entre paréntesis y puntos al final de algunas líneas.
const MENSAJE_BLOQUES = `*Intro
Por quién eres tú (Coalo)
*Moderadas
in Jesus name
Tu fidelidad (Ingrid Rosario)
*Rápidas
Camino al Cielo yo voy.(yo tengo gozo)
La voz de mi amado(versión nueva)
*Lentas
Mi corazón entona.`;

const REPERTORIO_BLOQUES = [
  { id: 'a', title: 'Por Quién Eres Tú', lyricsOnly: 'Por quién eres tú te alabo' },
  { id: 'b', title: 'In Jesus Name', lyricsOnly: 'In Jesus name we pray' },
  { id: 'c', title: 'Tu Fidelidad', lyricsOnly: 'Tu fidelidad es grande' },
  { id: 'd', title: 'Yo Tengo Gozo', lyricsOnly: 'Yo tengo gozo en mi alma, camino al cielo yo voy' },
  { id: 'e', title: 'La Voz De Mi Amado', lyricsOnly: 'La voz de mi amado me llama' },
  { id: 'f', title: 'Mi Corazón Entona', lyricsOnly: 'Mi corazón entona la canción' },
  { id: 'g', title: 'Intro Instrumental', lyricsOnly: '' }
];

describe('parsearCabecera', () => {
  it('reconoce los bloques marcados con asterisco (la negrita de WhatsApp)', () => {
    expect(parsearCabecera('*Intro')).toBe('Intro');
    expect(parsearCabecera('*Rápidas ')).toBe('Rápidas');
    expect(parsearCabecera('*Lentas*')).toBe('Lentas');
    expect(parsearCabecera('** Moderadas **')).toBe('Moderadas');
  });

  it('una canción normal no es un bloque', () => {
    expect(parsearCabecera('Tu fidelidad')).toBeNull();
    expect(parsearCabecera('Hoy *es* el día')).toBeNull();
    expect(parsearCabecera('*')).toBeNull();
    expect(parsearCabecera('')).toBeNull();
  });
});

describe('emparejarSetlist con bloques y paréntesis', () => {
  it('los bloques no se buscan como canciones', () => {
    // "*Intro" encajaba con "Intro Instrumental" y se colaba en la lista
    const consultas = emparejarSetlist(MENSAJE_BLOQUES, REPERTORIO_BLOQUES).map((e) => e.consulta);
    expect(consultas).not.toContain('*Intro');
    expect(consultas).toHaveLength(6);
  });

  it('empareja cada línea con su canción aunque lleve notas entre paréntesis', () => {
    const r = emparejarSetlist(MENSAJE_BLOQUES, REPERTORIO_BLOQUES);
    expect(r.map((e) => e.elegida?.id)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('el artista entre paréntesis no le resta a un título exacto', () => {
    const sin = puntuarCoincidencia('Tu fidelidad', REPERTORIO_BLOQUES[2]).score;
    const con = puntuarCoincidencia('Tu fidelidad (Ingrid Rosario)', REPERTORIO_BLOQUES[2]).score;
    expect(con).toBe(sin);
    expect(con).toBe(1);
  });

  it('el autor entre paréntesis desempata entre dos versiones con el mismo título', () => {
    const repertorio = [
      { id: 'otra', title: 'Tu Fidelidad', version: 'Marcos Witt' },
      { id: 'ingrid', title: 'Tu Fidelidad', versiones: ['Ingrid Rosario'], version: 'Ingrid Rosario' }
    ];
    expect(buscarCandidatos('Tu fidelidad (Ingrid Rosario)', repertorio).elegida.id).toBe('ingrid');
    // Con el nombre a medias también: "Coalo" es Coalo Zamorano
    const coalo = [
      { id: 'x', title: 'Por Quién Eres Tú' },
      { id: 'coalo', title: 'Por Quién Eres Tú', version: 'Barak, Coalo Zamorano' }
    ];
    expect(buscarCandidatos('Por quién eres tú (Coalo)', coalo).elegida.id).toBe('coalo');
    // Y sin paréntesis manda el orden del repertorio, sin inventar preferencias
    expect(buscarCandidatos('Tu fidelidad', repertorio).elegida.id).toBe('otra');
  });

  it('lo que va entre paréntesis también puede ser la pista buena', () => {
    // El título real es el del paréntesis
    const r = puntuarCoincidencia('Otra cosa (yo tengo gozo)', REPERTORIO_BLOQUES[3]);
    expect(r.score).toBe(1);
  });
});

describe('estructurarMensaje', () => {
  it('devuelve el mensaje línea a línea: bloques, tonalidades y canciones', () => {
    const r = estructurarMensaje('*Intro\nMi m\nTe alabare\n\nOtra', { 3: 's1' });
    expect(r).toEqual([
      { tipo: 'seccion', texto: 'Intro', linea: 1 },
      { tipo: 'tonalidad', texto: 'Mi m', key: 'MIm', linea: 2 },
      { tipo: 'cancion', texto: 'Te alabare', linea: 3, songId: 's1' },
      { tipo: 'cancion', texto: 'Otra', linea: 5, songId: null }
    ]);
  });

  it('las claves de los enlaces pueden llegar como texto (así vuelven de Firestore)', () => {
    // Ojo: "A" o "B" solas serían tonalidades (LA, SI), no canciones
    expect(estructurarMensaje('Uno\nDos', { 2: 'x' })[1].songId).toBe('x');
    expect(estructurarMensaje('Uno\nDos', { '2': 'x' })[1].songId).toBe('x');
  });

  it('sin texto, nada', () => {
    expect(estructurarMensaje('')).toEqual([]);
    expect(estructurarMensaje(undefined)).toEqual([]);
  });
});

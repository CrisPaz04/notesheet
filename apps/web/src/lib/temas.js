// La lista de temas y sus familias, sin nada más: datos puros. Va aparte del
// hook (useThemeWithAuth) para que se pueda leer sin cargar Firebase; antes
// temas.test.js inicializaba Firebase solo por importar la lista, y en CI, sin
// .env, fallaba con auth/invalid-api-key.

// Los temas. Cada uno tiene sus variables en styles/base/_variables.css y su
// miniatura en styles/pages/_preferences.css (lo vigila temas.test.js). El id
// acaba en -light o -dark, salvo los dos primeros: de eso cuelgan las reglas
// comunes de los temas claros y el color-scheme.
export const AVAILABLE_THEMES = {
  'light': {
    id: 'light',
    name: 'Clásico claro',
    category: 'classic',
    description: 'Tema clásico con fondo claro'
  },
  'dark': {
    id: 'dark',
    name: 'Clásico oscuro',
    category: 'classic',
    description: 'Tema clásico con fondo oscuro'
  },
  'rainforest-light': {
    id: 'rainforest-light',
    name: 'Bosque claro',
    category: 'rainforest',
    description: 'Inspirado en la naturaleza, versión clara'
  },
  'rainforest-dark': {
    id: 'rainforest-dark',
    name: 'Bosque oscuro',
    category: 'rainforest',
    description: 'Inspirado en la naturaleza, versión oscura'
  },
  'newspaper-light': {
    id: 'newspaper-light',
    name: 'Periódico claro',
    category: 'newspaper',
    description: 'Estilo clásico de periódico, versión clara'
  },
  'newspaper-dark': {
    id: 'newspaper-dark',
    name: 'Periódico oscuro',
    category: 'newspaper',
    description: 'Estilo clásico de periódico, versión oscura'
  },
  'contraste-light': {
    id: 'contraste-light',
    name: 'Alto contraste claro',
    category: 'contraste',
    description: 'Negro sobre blanco: para el sol en la pantalla o poca vista'
  },
  'contraste-dark': {
    id: 'contraste-dark',
    name: 'Alto contraste oscuro',
    category: 'contraste',
    description: 'Blanco y amarillo sobre negro, todo a 7:1'
  },
  'escenario-light': {
    id: 'escenario-light',
    name: 'Escenario claro',
    category: 'escenario',
    description: 'Blanco cálido y tinta oscura, sin deslumbrar de día'
  },
  'escenario-dark': {
    id: 'escenario-dark',
    name: 'Escenario oscuro',
    category: 'escenario',
    description: 'Negro puro y notas en ámbar, para cultos con poca luz'
  },
  'laton-light': {
    id: 'laton-light',
    name: 'Latón claro',
    category: 'laton',
    description: 'Marfil con tinta azul marino y oro viejo'
  },
  'laton-dark': {
    id: 'laton-dark',
    name: 'Latón oscuro',
    category: 'laton',
    description: 'Azul marino profundo con dorado de trompeta'
  },
  'madera-light': {
    id: 'madera-light',
    name: 'Madera claro',
    category: 'madera',
    description: 'Crema y madera clara con acento cobre'
  },
  'madera-dark': {
    id: 'madera-dark',
    name: 'Madera oscuro',
    category: 'madera',
    description: 'Madera oscura con cobre'
  },
  'purpura-light': {
    id: 'purpura-light',
    name: 'Púrpura claro',
    category: 'purpura',
    description: 'Lavanda clara con morado de adoración'
  },
  'purpura-dark': {
    id: 'purpura-dark',
    name: 'Púrpura oscuro',
    category: 'purpura',
    description: 'Morado profundo con lila'
  },
  'vino-light': {
    id: 'vino-light',
    name: 'Vino claro',
    category: 'vino',
    description: 'Rosado pálido con granate'
  },
  'vino-dark': {
    id: 'vino-dark',
    name: 'Vino oscuro',
    category: 'vino',
    description: 'Granate oscuro con dorado'
  },
  'oceano-light': {
    id: 'oceano-light',
    name: 'Océano claro',
    category: 'oceano',
    description: 'Azul agua con petróleo'
  },
  'oceano-dark': {
    id: 'oceano-dark',
    name: 'Océano oscuro',
    category: 'oceano',
    description: 'Azul petróleo profundo con coral'
  }
};

// El título de cada familia en Preferencias, en el orden en que salen
export const THEME_FAMILIES = {
  classic: 'Clásicos',
  rainforest: 'Bosque',
  newspaper: 'Periódico',
  contraste: 'Alto contraste',
  escenario: 'Escenario',
  laton: 'Latón',
  madera: 'Madera',
  purpura: 'Púrpura',
  vino: 'Vino',
  oceano: 'Océano'
};

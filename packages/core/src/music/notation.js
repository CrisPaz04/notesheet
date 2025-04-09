// packages/core/src/music/notation.js

/**
 * Convierte la notación de una canción entre sistemas latinos y anglosajones
 * @param {string} content - Contenido de la canción con notación musical
 * @param {string} targetSystem - Sistema objetivo ('latin' o 'english')
 * @returns {string} Contenido con la notación convertida
 */
export const convertNotationSystem = (content, targetSystem) => {
  const latinToEnglish = {
    'DO': 'C', 'DO#': 'C#', 'DOb': 'Cb',
    'RE': 'D', 'RE#': 'D#', 'REb': 'Db',
    'MI': 'E', 'MIb': 'Eb',
    'FA': 'F', 'FA#': 'F#', 'FAb': 'Fb',
    'SOL': 'G', 'SOL#': 'G#', 'SOLb': 'Gb',
    'LA': 'A', 'LA#': 'A#', 'LAb': 'Ab',
    'SI': 'B', 'SIb': 'Bb'
  };

  const englishToLatin = {
    'C': 'DO', 'C#': 'DO#', 'Cb': 'DOb',
    'D': 'RE', 'D#': 'RE#', 'Db': 'REb',
    'E': 'MI', 'Eb': 'MIb',
    'F': 'FA', 'F#': 'FA#', 'Fb': 'FAb',
    'G': 'SOL', 'G#': 'SOL#', 'Gb': 'SOLb',
    'A': 'LA', 'A#': 'LA#', 'Ab': 'LAb',
    'B': 'SI', 'Bb': 'SIb'
  };

  const conversionMap = targetSystem === 'latin' ? englishToLatin : latinToEnglish;
  
  // Expresión regular para detectar notas musicales en ambos sistemas
  const noteRegex = /\b(DO|RE|MI|FA|SOL|LA|SI|C|D|E|F|G|A|B)(?:#|b)?\b/g;
  
  return content.replace(noteRegex, (match) => {
    return conversionMap[match] || match;
  });
};

/**
 * Extrae metadatos de una canción en formato Markdown
 * @param {string} content - Contenido de la canción en formato Markdown
 * @returns {Object} Objeto con los metadatos extraídos
 */
export const extractSongMetadata = (content) => {
  const metadata = {
    title: '',
    key: '',
    type: '',
    author: '',
    tempo: ''
  };
  
  // Patrones para buscar metadatos
  const patterns = {
    title: /^#\s*(?:Canción|Título|Title):\s*(.+)$/im,
    key: /^#\s*(?:Tonalidad|Key):\s*(.+)$/im,
    type: /^#\s*(?:Tipo|Type):\s*(.+)$/im,
    author: /^#\s*(?:Autor|Author):\s*(.+)$/im,
    tempo: /^#\s*(?:Tempo|Velocidad):\s*(.+)$/im
  };
  
  // Extraer cada metadato usando los patrones
  Object.keys(patterns).forEach(key => {
    const match = content.match(patterns[key]);
    if (match && match[1]) {
      metadata[key] = match[1].trim();
    }
  });
  
  return metadata;
};

/**
 * Divide el contenido de la canción en secciones
 * @param {string} content - Contenido de la canción en formato Markdown
 * @returns {Array} Array de objetos con título y contenido de cada sección
 */
export const parseSongSections = (content) => {
  // Dividir por líneas y eliminar las de metadatos
  const lines = content.split('\n');
  const contentLines = lines.filter(line => !line.match(/^#\s*(?:Canción|Título|Title|Tonalidad|Key|Tipo|Type|Autor|Author|Tempo|Velocidad):/i));
  
  const sections = [];
  let currentSection = null;
  
  contentLines.forEach(line => {
    // Detectar una nueva sección (## Título)
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      // Si ya hay una sección activa, guardarla
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        title: sectionMatch[1].trim(),
        content: []
      };
    } else if (currentSection) {
      // Agregar línea a la sección actual
      currentSection.content.push(line);
    }
  });
  
  // Agregar la última sección si existe
  if (currentSection) {
    sections.push(currentSection);
  }
  
  // Limpiar el contenido de cada sección
  sections.forEach(section => {
    section.content = section.content.join('\n').trim();
  });
  
  return sections;
};

/**
 * Formatea una canción en notación musical para visualización
 * @param {string} content - Contenido de la canción en formato Markdown
 * @param {Object} options - Opciones de formato (notationSystem, etc.)
 * @returns {Object} Objeto con la canción formateada y sus metadatos
 */
export const formatSong = (content, options = {}) => {
  const { notationSystem = null } = options;
  
  // Extraer metadatos
  const metadata = extractSongMetadata(content);
  
  // Convertir notación si es necesario
  let processedContent = content;
  if (notationSystem) {
    processedContent = convertNotationSystem(content, notationSystem);
  }
  
  // Dividir en secciones
  const sections = parseSongSections(processedContent);
  
  return {
    metadata,
    sections,
    rawContent: processedContent
  };
};
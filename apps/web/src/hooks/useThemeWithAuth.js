// apps/web/src/hooks/useThemeWithAuth.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPreferences, updateUserPreferences } from '@notesheet/api';

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

export function useThemeWithAuth() {
  const [theme, setTheme] = useState(() => {
    // Obtener tema del localStorage primero
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme && AVAILABLE_THEMES[storedTheme]) {
      // Aplicar el tema inmediatamente
      document.documentElement.setAttribute('data-bs-theme', storedTheme);
      return storedTheme;
    }
    // Por defecto usar light
    document.documentElement.setAttribute('data-bs-theme', 'light');
    return 'light';
  });
  
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const loadTheme = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const prefs = await getUserPreferences(currentUser.uid);
        if (prefs.defaultTheme && AVAILABLE_THEMES[prefs.defaultTheme]) {
          setTheme(prefs.defaultTheme);
          localStorage.setItem('theme', prefs.defaultTheme);
          document.documentElement.setAttribute('data-bs-theme', prefs.defaultTheme);
        }
      } catch (error) {
        console.error("Error loading theme:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [currentUser]);

  const changeTheme = async (newTheme) => {
    // Verificar que el tema existe
    if (!AVAILABLE_THEMES[newTheme]) {
      console.error(`Theme ${newTheme} not found`);
      return;
    }

    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-bs-theme', newTheme);

    // Si hay usuario, guardar en preferencias
    if (currentUser) {
      try {
        await updateUserPreferences(currentUser.uid, {
          defaultTheme: newTheme
        });
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    }
  };

  // Función helper para obtener información del tema actual
  const getCurrentThemeInfo = () => {
    return AVAILABLE_THEMES[theme] || AVAILABLE_THEMES['light'];
  };

  // Función helper para obtener temas por categoría
  const getThemesByCategory = () => {
    const categories = {};
    Object.values(AVAILABLE_THEMES).forEach(themeInfo => {
      if (!categories[themeInfo.category]) {
        categories[themeInfo.category] = [];
      }
      categories[themeInfo.category].push(themeInfo);
    });
    return categories;
  };

  return { 
    theme, 
    changeTheme, 
    loading, 
    availableThemes: AVAILABLE_THEMES,
    getCurrentThemeInfo,
    getThemesByCategory
  };
}
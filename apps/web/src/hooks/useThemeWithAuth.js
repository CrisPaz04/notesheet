// apps/web/src/hooks/useThemeWithAuth.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPreferences, updateUserPreferences } from '@notesheet/api';

// Definir los temas disponibles
export const AVAILABLE_THEMES = {
  'light': {
    id: 'light',
    name: 'Clásico Claro',
    category: 'classic',
    description: 'Tema clásico con fondo claro'
  },
  'dark': {
    id: 'dark',
    name: 'Clásico Oscuro',
    category: 'classic',
    description: 'Tema clásico con fondo oscuro'
  },
  'rainforest-light': {
    id: 'rainforest-light',
    name: 'Bosque Claro',
    category: 'rainforest',
    description: 'Inspirado en la naturaleza, versión clara'
  },
  'rainforest-dark': {
    id: 'rainforest-dark',
    name: 'Bosque Oscuro',
    category: 'rainforest',
    description: 'Inspirado en la naturaleza, versión oscura'
  },
  'newspaper-light': {
    id: 'newspaper-light',
    name: 'Periódico Claro',
    category: 'newspaper',
    description: 'Estilo clásico de periódico, versión clara'
  },
  'newspaper-dark': {
    id: 'newspaper-dark',
    name: 'Periódico Oscuro',
    category: 'newspaper',
    description: 'Estilo clásico de periódico, versión oscura'
  }
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
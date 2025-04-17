// apps/web/src/hooks/useTheme.js
import { useState, useEffect } from 'react';

const useTheme = () => {
  // Definimos el tema inicial desde localStorage o 'light' por defecto
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });
  
  // No hay loading ya que cargamos desde localStorage directamente
  const [loading, setLoading] = useState(false);

  const changeTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    // Aplicar el tema al elemento html o body
    document.documentElement.setAttribute('data-bs-theme', newTheme);
  };

  // Aplicar el tema actual al montar el componente
  useEffect(() => {
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);

  return { theme, changeTheme, loading };
};

export { useTheme };
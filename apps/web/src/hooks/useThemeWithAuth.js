// apps/web/src/hooks/useThemeWithAuth.js
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUserPreferences, updateUserPreferences } from '@notesheet/api';

export function useThemeWithAuth() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
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
        if (prefs.defaultTheme) {
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

  return { theme, changeTheme, loading };
}
// apps/web/src/components/ThemeToggle.jsx
import { useThemeWithAuth } from "../hooks/useThemeWithAuth";
import Icono from "./Icono";

function ThemeToggle() {
  const { theme, changeTheme, loading } = useThemeWithAuth();

  if (loading) return null;

  const handleToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    changeTheme(newTheme);
  };

  return (
    <button
      className="theme-toggle"
      onClick={handleToggle}
      title={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
      aria-label={`Cambiar a tema ${theme === 'dark' ? 'claro' : 'oscuro'}`}
    >
      <Icono nombre={theme === 'dark' ? "sun" : "moon"} peso="fill" />
    </button>
  );
}

export default ThemeToggle;
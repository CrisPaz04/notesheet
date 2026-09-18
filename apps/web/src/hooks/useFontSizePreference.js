import { useState } from "react";
import { updateUserPreferences } from "@notesheet/api";

export const FONT_SIZE_MIN = 14;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 18;
const FONT_SIZE_STEP = 2;

/**
 * Tamaño de texto de la partitura, persistido en las preferencias del usuario.
 * El guardado es best-effort: si Firestore falla, el tamaño sigue aplicándose
 * en la sesión actual.
 *
 * @param {Object|null} currentUser - Usuario autenticado, o null
 */
export default function useFontSizePreference(currentUser) {
  const [fontSize, setFontSize] = useState(FONT_SIZE_DEFAULT);

  const applySize = (newSize) => {
    setFontSize(newSize);

    if (!currentUser) return;
    updateUserPreferences(currentUser.uid, { defaultFontSize: newSize })
      .catch((error) => {
        console.error("Error saving font size preference:", error);
      });
  };

  const increaseFontSize = () => {
    if (fontSize < FONT_SIZE_MAX) applySize(fontSize + FONT_SIZE_STEP);
  };

  const decreaseFontSize = () => {
    if (fontSize > FONT_SIZE_MIN) applySize(fontSize - FONT_SIZE_STEP);
  };

  const resetFontSize = () => applySize(FONT_SIZE_DEFAULT);

  return {
    fontSize,
    // `setFontSize` se usa al cargar las preferencias, sin volver a guardarlas
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize
  };
}

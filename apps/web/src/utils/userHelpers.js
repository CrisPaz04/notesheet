export const getUserDisplayName = (user) => {
  if (!user) return "Usuario";
  
  // Si tiene displayName (de Google/Facebook/etc)
  if (user.displayName && user.displayName.trim()) {
    return user.displayName.trim();
  }
  
  // Si no, usar la parte del email antes del @
  if (user.email) {
    const emailName = user.email.split('@')[0];
    // Capitalizar primera letra y reemplazar puntos/guiones con espacios
    return emailName
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
  
  return "Usuario";
};

/**
 * Obtiene las iniciales del usuario para avatares
 */
export const getUserInitials = (user) => {
  const displayName = getUserDisplayName(user);
  const words = displayName.split(' ');
  
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  } else {
    return displayName.substring(0, 2).toUpperCase();
  }
};
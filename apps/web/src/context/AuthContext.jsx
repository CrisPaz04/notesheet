import { createContext, useState, useEffect, useContext } from 'react';
import { signIn, signOut, registerUser, authStateListener, signInWithGoogle, getUserRole } from '@notesheet/api';

// Crear el contexto
const AuthContext = createContext(null);

// Proveedor del contexto
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios en el estado de autenticación
    const unsubscribe = authStateListener(async (user) => {
      setCurrentUser(user);
      if (user) {
        // Cargar el rol del usuario
        const role = await getUserRole(user.uid);
        setUserRole(role);
      } else {
        setUserRole('viewer');
      }
      setLoading(false);
    });

    // Limpiar suscripción al desmontar
    return unsubscribe;
  }, []);

  // Funciones de autenticación
  const login = async (email, password) => {
    return await signIn(email, password);
  };

  const logout = async () => {
    await signOut();
    return true;
  };

  const register = async (email, password) => {
    return await registerUser(email, password);
  };

  const loginWithGoogle = async () => {
    return await signInWithGoogle();
  };

  // Función para verificar si el usuario puede editar canciones
  const canEditSongs = () => {
    return userRole === 'editor';
  };

  const value = {
    currentUser,
    userRole,
    canEditSongs,
    login,
    logout,
    register,
    loginWithGoogle,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// Hook personalizado para usar el contexto
export function useAuth() {
  return useContext(AuthContext);
}

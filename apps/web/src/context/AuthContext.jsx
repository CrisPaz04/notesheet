import { createContext, useState, useEffect, useContext } from 'react';
import { auth, signIn, signOut, registerUser, authStateListener, signInWithGoogle, getUserRole } from '@notesheet/api';

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
    try {
      return await signIn(email, password);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut();
      return true;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password) => {
    try {
      return await registerUser(email, password);
    } catch (error) {
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      return await signInWithGoogle();
    } catch (error) {
      throw error;
    }
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

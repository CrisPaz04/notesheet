import { createContext, useState, useEffect, useContext } from 'react';
import { auth, signIn, signOut, registerUser, authStateListener } from '@notesheet/api';

// Crear el contexto
const AuthContext = createContext(null);

// Proveedor del contexto
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar cambios en el estado de autenticación
    const unsubscribe = authStateListener((user) => {
      setCurrentUser(user);
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

  const value = {
    currentUser,
    login,
    logout,
    register,
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

/**
 * Auth Context for Blendlink Mobile
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import { authAPI, getToken, getStoredUser, removeToken } from '../services/api';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await getToken();
      if (token) {
        const storedUser = await getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);
          // Refresh user data in background
          refreshUser();
        } else {
          await refreshUser();
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await logout();
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authAPI.getMe();
      setUser(userData);
      setIsAuthenticated(true);
      return userData;
    } catch (error) {
      console.error('Failed to refresh user:', error);
      if (error.response?.status === 401) {
        await logout();
      }
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const data = await authAPI.login(email, password);
      setUser(data.user);
      setIsAuthenticated(true);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const data = await authAPI.register(userData);
      // After registration, fetch full user data
      await refreshUser();
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    await removeToken();
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (userData) => {
    setUser(prev => ({ ...prev, ...userData }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

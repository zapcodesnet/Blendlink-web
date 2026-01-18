/**
 * Theme Context for Blendlink Mobile
 * Supports light/dark theme switching
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const THEME_KEY = 'blendlink_theme';

// Theme colors
export const THEMES = {
  light: {
    name: 'light',
    background: '#F8FAFC',
    card: '#FFFFFF',
    cardSecondary: '#F1F5F9',
    primary: '#8B5CF6',
    primaryGradientStart: '#8B5CF6',
    primaryGradientEnd: '#EC4899',
    text: '#0F172A',
    textMuted: '#64748B',
    textSecondary: '#475569',
    border: '#E2E8F0',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    gold: '#F59E0B',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    inputBackground: '#F1F5F9',
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadow: '#000000',
    // Game specific
    staminaBar: '#EAB308',
    winStreak: '#F97316',
    rock: '#64748B',
    paper: '#3B82F6',
    scissors: '#DC2626',
    victory: '#22C55E',
    defeat: '#EF4444',
  },
  dark: {
    name: 'dark',
    background: '#0F172A',
    card: '#1E293B',
    cardSecondary: '#334155',
    primary: '#8B5CF6',
    primaryGradientStart: '#8B5CF6',
    primaryGradientEnd: '#EC4899',
    text: '#FFFFFF',
    textMuted: '#9CA3AF',
    textSecondary: '#94A3B8',
    border: '#334155',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    gold: '#F59E0B',
    tabBar: '#1E293B',
    tabBarBorder: '#334155',
    inputBackground: '#334155',
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadow: '#000000',
    // Game specific
    staminaBar: '#EAB308',
    winStreak: '#F97316',
    rock: '#64748B',
    paper: '#3B82F6',
    scissors: '#DC2626',
    victory: '#22C55E',
    defeat: '#EF4444',
  },
};

export const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState('light');
  const [colors, setColors] = useState(THEMES.light);

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await SecureStore.getItemAsync(THEME_KEY);
      if (savedTheme && THEMES[savedTheme]) {
        setTheme(savedTheme);
        setColors(THEMES[savedTheme]);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    try {
      await SecureStore.setItemAsync(THEME_KEY, newTheme);
      setTheme(newTheme);
      setColors(THEMES[newTheme]);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const setThemeMode = async (mode) => {
    if (THEMES[mode]) {
      try {
        await SecureStore.setItemAsync(THEME_KEY, mode);
        setTheme(mode);
        setColors(THEMES[mode]);
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        colors,
        isDark: theme === 'dark',
        toggleTheme,
        setThemeMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

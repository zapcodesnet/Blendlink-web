/**
 * Blendlink Mobile Theme Service
 * Syncs themes from backend for consistent styling across web and mobile
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@blendlink_theme';
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

/**
 * Default theme colors (Ocean Blue - matches web default)
 */
export const defaultTheme = {
  theme_id: 'theme_ocean_blue',
  name: 'Ocean Blue',
  colors: {
    primary: '#0ea5e9',
    primary_foreground: '#ffffff',
    secondary: '#64748b',
    secondary_foreground: '#ffffff',
    background: '#ffffff',
    foreground: '#0f172a',
    card: '#ffffff',
    card_foreground: '#0f172a',
    muted: '#f0f9ff',
    muted_foreground: '#64748b',
    accent: '#e0f2fe',
    accent_foreground: '#0f172a',
    border: '#e2e8f0',
    input: '#e2e8f0',
    ring: '#0ea5e9',
    destructive: '#ef4444',
    destructive_foreground: '#ffffff',
    success: '#22c55e',
    warning: '#f59e0b',
  },
  fonts: {
    heading: 'System',
    body: 'System',
    mono: 'Courier',
  },
};

/**
 * Fetch active theme from backend
 */
export const fetchActiveTheme = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/themes/active`);
    if (!response.ok) {
      throw new Error('Failed to fetch theme');
    }
    const theme = await response.json();
    
    // Save to local storage for offline access
    await AsyncStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    
    return theme;
  } catch (error) {
    console.error('Error fetching theme:', error);
    
    // Try to load from local storage
    const cachedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (cachedTheme) {
      return JSON.parse(cachedTheme);
    }
    
    return defaultTheme;
  }
};

/**
 * Get current theme (from cache or default)
 */
export const getCurrentTheme = async () => {
  try {
    const cachedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (cachedTheme) {
      return JSON.parse(cachedTheme);
    }
    return defaultTheme;
  } catch (error) {
    return defaultTheme;
  }
};

/**
 * Convert theme colors to React Native styles
 */
export const getThemeStyles = (theme) => {
  const colors = theme?.colors || defaultTheme.colors;
  
  return {
    colors: {
      primary: colors.primary,
      primaryForeground: colors.primary_foreground,
      secondary: colors.secondary,
      secondaryForeground: colors.secondary_foreground,
      background: colors.background,
      foreground: colors.foreground,
      card: colors.card,
      cardForeground: colors.card_foreground,
      muted: colors.muted,
      mutedForeground: colors.muted_foreground,
      accent: colors.accent,
      accentForeground: colors.accent_foreground,
      border: colors.border,
      input: colors.input,
      ring: colors.ring,
      destructive: colors.destructive,
      destructiveForeground: colors.destructive_foreground,
      success: colors.success,
      warning: colors.warning,
    },
    // Common style helpers
    styles: {
      primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
      },
      primaryButtonText: {
        color: colors.primary_foreground,
        fontWeight: '600',
        fontSize: 16,
      },
      card: {
        backgroundColor: colors.card,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: colors.border,
      },
      input: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.input,
        borderRadius: 8,
        padding: 12,
        color: colors.foreground,
        fontSize: 16,
      },
      text: {
        color: colors.foreground,
      },
      textMuted: {
        color: colors.muted_foreground,
      },
      textPrimary: {
        color: colors.primary,
      },
    },
  };
};

/**
 * Fetch all available pages from backend
 */
export const fetchPages = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/page-manager/pages/public`);
    if (!response.ok) {
      throw new Error('Failed to fetch pages');
    }
    const data = await response.json();
    return data.pages || [];
  } catch (error) {
    console.error('Error fetching pages:', error);
    return [];
  }
};

/**
 * Get visible mobile pages for navigation
 */
export const getMobileNavPages = async () => {
  const pages = await fetchPages();
  return pages
    .filter(page => page.is_visible && page.is_enabled && page.show_in_mobile_nav)
    .sort((a, b) => a.order - b.order);
};

export default {
  fetchActiveTheme,
  getCurrentTheme,
  getThemeStyles,
  defaultTheme,
  fetchPages,
  getMobileNavPages,
};

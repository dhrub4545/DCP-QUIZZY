import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@app_theme_mode';

const ThemeContext = createContext({
  theme: 'dark',
  isGlass: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    // Load persisted theme mode on startup
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved === 'glass' || saved === 'dark') {
          setThemeState(saved);
        }
      } catch (err) {
        console.warn('Failed to load theme preference:', err.message);
      }
    };
    loadTheme();
  }, []);

  const setTheme = async (newTheme) => {
    if (newTheme === 'dark' || newTheme === 'glass') {
      setThemeState(newTheme);
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch (err) {
        console.warn('Failed to save theme preference:', err.message);
      }
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'glass' : 'dark';
    setTheme(nextTheme);
  };

  const isGlass = theme === 'glass';

  return (
    <ThemeContext.Provider value={{ theme, isGlass, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;

import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const lightTheme = {
  bg: '#fff',
  text: '#111',
  textSecondary: '#666',
  border: '#eee',
  icon: '#111',
  header: '#fff',
  card: '#fff',
  badge: 'red',
  buttonBg: '#111',
  buttonText: '#fff',
  placeholder: '#f2f2f2',
};

export const darkTheme = {
  bg: '#111',
  text: '#fff',
  textSecondary: '#aaa',
  border: '#333',
  icon: '#fff',
  header: '#1a1a1a',
  card: '#1a1a1a',
  badge: 'red',
  buttonBg: '#fff',
  buttonText: '#111',
  placeholder: '#2a2a2a',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Load theme preference from AsyncStorage
    const loadTheme = async () => {
      try {
        const saved = await AsyncStorage.getItem('theme');
        if (saved === 'dark') setIsDark(true);
      } catch (e) {
        console.log('Theme load error', e);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      await AsyncStorage.setItem('theme', newTheme ? 'dark' : 'light');
    } catch (e) {
      console.log('Theme save error', e);
    }
  };

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

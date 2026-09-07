import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { readString, STORAGE_KEYS, writeString } from './lib/storage';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

/** Couleur de la barre système, doit suivre --color-zinc-950 de index.css. */
const THEME_COLORS: Record<Theme, string> = {
  dark: '#09090b',
  light: '#f8fafc',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readStoredTheme(): Theme | null {
  const value = readString(STORAGE_KEYS.theme);
  return value === 'dark' || value === 'light' ? value : null;
}

function getPreferredTheme(): Theme {
  const stored = readStoredTheme();
  if (stored) return stored;
  // Aucun choix enregistré : on suit la préférence du système.
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    writeString(STORAGE_KEYS.theme, theme);

    document.documentElement.classList.toggle('theme-light', theme === 'light');
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';

    // Sans cette mise à jour, la barre de statut restait noire en thème clair.
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[theme];
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/* eslint-disable no-unused-vars */
/* eslint-disable no-empty */
/* eslint-disable react-refresh/only-export-components */
// File: frontend/src/context/ThemeContext.jsx
// Global theme system — users pick background color + accent color
// Saved to localStorage so it persists across sessions

import React, { createContext, useContext, useEffect, useState } from 'react';

export const ThemeContext = createContext(null);

// All preset themes extracted from existing pages
export const THEME_PRESETS = [
  { id: 'crimson',  label: 'Crimson',    bg: '#030303', accent: '#8b0000',  accentLight: '#cc0000'  },
  { id: 'cyan',     label: 'Cyber Cyan', bg: '#030303', accent: '#00ffff',  accentLight: '#00cccc'  },
  { id: 'orange',   label: 'Ember',      bg: '#030303', accent: '#cc5500',  accentLight: '#ff7733'  },
  { id: 'forest',   label: 'Forest',     bg: '#030303', accent: '#2d6a2d',  accentLight: '#4ade80'  },
  { id: 'shadow',   label: 'Shadow',     bg: '#030303', accent: '#56029b',  accentLight: '#8b5cf6'  },
  { id: 'cobalt',   label: 'Cobalt',     bg: '#030303', accent: '#043ede',  accentLight: '#3b82f6'  },
  { id: 'indigo',   label: 'Indigo',     bg: '#030303', accent: '#818cf8',  accentLight: '#a5b4fc'  },
  { id: 'ghost',    label: 'Ghost',      bg: '#030303', accent: '#ffffff',  accentLight: '#cccccc'  },
  { id: 'lime',     label: 'Toxic Lime', bg: '#030303', accent: '#d2ff00',  accentLight: '#eeff55'  },
  { id: 'blood',    label: 'Blood Moon', bg: '#0a0000', accent: '#cc0000',  accentLight: '#ff3333'  },
  { id: 'void',     label: 'Deep Void',  bg: '#000000', accent: '#6600cc',  accentLight: '#9933ff'  },
  { id: 'gold',     label: 'Gold',       bg: '#030303', accent: '#cc8800',  accentLight: '#ffbb33'  },
  { id: 'rose',     label: 'Rose',       bg: '#030303', accent: '#cc0066',  accentLight: '#ff3399'  },
  { id: 'teal',     label: 'Teal',       bg: '#030303', accent: '#008888',  accentLight: '#00cccc'  },
  { id: 'custom',   label: 'Custom',     bg: '#030303', accent: '#8b0000',  accentLight: '#cc0000'  },
];

const STORAGE_KEY = 'narra_theme_v1';

const DEFAULT_THEME = THEME_PRESETS[0]; // crimson

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '139, 0, 0';
}

// Derive a lighter shade for the accent
function lightenHex(hex, amount = 0.3) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const newR = Math.min(255, Math.round(r + (255 - r) * amount));
  const newG = Math.min(255, Math.round(g + (255 - g) * amount));
  const newB = Math.min(255, Math.round(b + (255 - b) * amount));
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_THEME;
  });

  // Apply CSS variables to :root whenever theme changes
  useEffect(() => {
    const root = document.documentElement;
    const accentLight = theme.accentLight || lightenHex(theme.accent, 0.3);

    root.style.setProperty('--theme-bg', theme.bg);
    root.style.setProperty('--theme-accent', theme.accent);
    root.style.setProperty('--theme-accent-light', accentLight);
    root.style.setProperty('--theme-accent-rgb', hexToRgb(theme.accent));
    root.style.setProperty('--theme-bg-rgb', hexToRgb(theme.bg));

    // Also update body background
    document.body.style.background = theme.bg;
  }, [theme]);

  const setTheme = (newTheme) => {
    const accentLight = newTheme.accentLight || lightenHex(newTheme.accent, 0.3);
    const full = { ...newTheme, accentLight };
    setThemeState(full);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
    } catch {}
  };

  const setCustomTheme = (bg, accent) => {
    const accentLight = lightenHex(accent, 0.3);
    const custom = { id: 'custom', label: 'Custom', bg, accent, accentLight };
    setTheme(custom);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, setCustomTheme, presets: THEME_PRESETS }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
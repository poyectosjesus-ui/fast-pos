import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeColor = 'zinc' | 'rose' | 'blue' | 'emerald' | 'orange' | 'crimson' | 'violet' | 'cyan' | 'amber' | 'fuchsia';
type ThemeMode = 'light' | 'dark';

interface ThemeState {
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeColor: 'emerald',
      setThemeColor: (color) => set({ themeColor: color }),
      themeMode: 'dark', // Por defecto dark como era originalmente
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: 'fast-pos-theme',
      version: 3, // Actualizado para soportar 10 colores
      migrate: () => ({ themeColor: 'emerald', themeMode: 'dark' }),
    }
  )
);

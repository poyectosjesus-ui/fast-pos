import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeColor = 'zinc' | 'rose' | 'blue' | 'emerald' | 'orange';
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
      themeColor: 'zinc',
      setThemeColor: (color) => set({ themeColor: color }),
      themeMode: 'dark', // Por defecto dark como era originalmente
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: 'fast-pos-theme',
    }
  )
);

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
      themeColor: 'emerald',
      setThemeColor: (color) => set({ themeColor: color }),
      themeMode: 'dark', // Por defecto dark como era originalmente
      setThemeMode: (mode) => set({ themeMode: mode }),
    }),
    {
      name: 'fast-pos-theme',
      version: 2, // Al incrementar, el cache viejo se descarta y toma el nuevo default
      migrate: () => ({ themeColor: 'emerald', themeMode: 'dark' }),
    }
  )
);

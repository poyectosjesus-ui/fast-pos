import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'ADMIN' | 'CASHIER';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  isActive: number;
}

interface SessionState {
  user: User | null;
  isAuthenticated: boolean;
  login: (userId: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (userId: string, pin: string) => {
        try {
          // Llama al IPC Main para interactuar con SQLite y bcrypt
          const winApi = (window as any).electronAPI;
          if (!winApi || !winApi.login) {
             console.warn("electronAPI no disponible, modo debug o web.");
             return { success: false, error: "IPC offline" };
          }

          const response = await winApi.login(userId, pin);
          
          if (response.success && response.user) {
            set({ user: response.user, isAuthenticated: true });
            return { success: true };
          } else {
            return { success: false, error: response.error || "PIN incorrecto" };
          }
        } catch (error: any) {
          return { success: false, error: error.message };
        }
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'fast-pos-session', // Llave en localStorage
    }
  )
);

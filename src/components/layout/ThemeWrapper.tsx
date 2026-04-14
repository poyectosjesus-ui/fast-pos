"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/useThemeStore";
import { toast } from "sonner";

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
  const themeColor = useThemeStore((state) => state.themeColor);
  const themeMode = useThemeStore((state) => state.themeMode);

  useEffect(() => {
    const root = window.document.documentElement;

    // 1. Manejo del Modo Claro / Oscuro
    if (themeMode === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    
    // 2. Manejo de Variantes de Color
    root.classList.remove(
      "theme-zinc",
      "theme-rose",
      "theme-blue",
      "theme-emerald",
      "theme-orange",
      "theme-crimson",
      "theme-violet",
      "theme-cyan",
      "theme-amber",
      "theme-fuchsia"
    );

    // Si es zinc (monocromo / default del Shadcn), no agregamos clase
    if (themeColor !== "zinc") {
      root.classList.add(`theme-${themeColor}`);
    }
  }, [themeColor, themeMode]);

  // 3. Listener Global para Actualizaciones OTA
  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.onUpdaterEvent) {
      (window as any).electronAPI.onUpdaterEvent((type: string, data: any) => {
        if (type === "available") {
          toast.info("Actualización Encontrada", {
            description: "Descargando nueva versión en segundo plano...",
          });
        }
        if (type === "downloaded") {
          toast.success("¡Nueva versión lista!", {
            description: "La aplicación se actualizará sola al cerrarla, o puedes forzarlo ahora.",
            duration: 900000, // 15 minutos visible
            action: {
              label: "Reiniciar y Aplicar",
              onClick: () => {
                (window as any).electronAPI.applyUpdate();
              },
            },
          });
        }
      });
    }
  }, []);

  // Se renderizan los children directamente. El useEffect se encarga de clases
  return <>{children}</>;
}

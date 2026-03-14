"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/store/useThemeStore";

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
      "theme-orange"
    );

    // Si es zinc (monocromo / default del Shadcn), no agregamos clase
    if (themeColor !== "zinc") {
      root.classList.add(`theme-${themeColor}`);
    }
  }, [themeColor, themeMode]);

  // Se renderizan los children directamente. El useEffect se encarga de clases
  return <>{children}</>;
}

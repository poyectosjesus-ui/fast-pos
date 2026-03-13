"use client";

/**
 * GridDensitySelector — Control de Densidad del Catálogo de Ventas
 *
 * Permite al cajero elegir cuántas columnas mostrar en el grid de productos.
 * La preferencia se guarda en localStorage para que persista entre sesiones.
 *
 * Presets: 2 (grande/accesibilidad), 3, 4, 5, 6 (ultra-denso)
 */

import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export type GridDensity = "2" | "3" | "4" | "5" | "6";

interface GridDensitySelectorProps {
  value: GridDensity;
  onChange: (density: GridDensity) => void;
  className?: string;
}

const DENSITY_OPTIONS: { value: GridDensity; title: string }[] = [
  { value: "2", title: "Grande — 2 columnas (mejor accesibilidad)" },
  { value: "3", title: "Normal — 3 columnas" },
  { value: "4", title: "Compacto — 4 columnas" },
  { value: "5", title: "Denso — 5 columnas" },
  { value: "6", title: "Ultra — 6 columnas (pantallas anchas)" },
];

export const GRID_COLS_MAP: Record<GridDensity, string> = {
  "2": "grid-cols-2",
  "3": "grid-cols-3",
  "4": "grid-cols-4",
  "5": "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5",
  "6": "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6",
};

export const GRID_DENSITY_KEY = "fast-pos-grid-density";

export function GridDensitySelector({ value, onChange, className }: GridDensitySelectorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 p-1 rounded-lg border bg-muted/30",
        className
      )}
      role="group"
      aria-label="Densidad del catálogo de productos"
    >
      <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground mx-1 shrink-0" aria-hidden="true" />
      {DENSITY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          title={opt.title}
          aria-label={opt.title}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "h-6 w-6 rounded-md text-xs font-bold transition-all",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {opt.value}
        </button>
      ))}
    </div>
  );
}

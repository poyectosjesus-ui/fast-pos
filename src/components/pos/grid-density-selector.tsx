"use client";

/**
 * GridDensitySelector — Control de Densidad del Catálogo de Ventas
 *
 * Permite al cajero elegir cuántas columnas mostrar en el grid de productos.
 * La preferencia se guarda en localStorage para que persista entre sesiones.
 *
 * Presets: 2 (grande/accesibilidad), 3, 4, 5, 6 (ultra-denso)
 */

import { useState, useRef, useEffect } from "react";
import { LayoutGrid, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type GridDensity = "2" | "3" | "4" | "5" | "6";

interface GridDensitySelectorProps {
  value: GridDensity;
  onChange: (density: GridDensity) => void;
  className?: string;
}

const DENSITY_OPTIONS: { value: GridDensity; title: string, hint: string }[] = [
  { value: "2", title: "Vista Grande", hint: "(2 columnas)" },
  { value: "3", title: "Vista Normal", hint: "(3 columnas)" },
  { value: "4", title: "Vista Compacta", hint: "(4 columnas)" },
  { value: "5", title: "Vista Densa", hint: "(5 columnas)" },
  { value: "6", title: "Vista Ultra", hint: "(6 columnas)" },
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Cerrar dropup si hace click fuera
  useEffect(() => {
    if (!isOpen) return;
    const clickHandler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", clickHandler);
    return () => document.removeEventListener("mousedown", clickHandler);
  }, [isOpen]);

  const toggle = () => setIsOpen(!isOpen);

  return (
    <div className={cn("relative", className)} ref={containerRef}>
      {/* El Drop-Up Menu */}
      <div 
        className={cn(
          "absolute p-2 bottom-[120%] left-0 w-[220px] bg-background border rounded-2xl shadow-xl transition-all duration-200 z-50 flex flex-col gap-1",
          isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"
        )}
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2 py-1 mb-1 border-b">
          Densidad de Cuadrícula
        </p>
        
        {DENSITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              onChange(opt.value);
              setIsOpen(false);
            }}
            className={cn(
              "flex flex-col items-start px-3 py-2 rounded-xl text-left transition-all",
              value === opt.value
                ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                : "text-foreground hover:bg-muted"
            )}
          >
            <span className={cn("text-xs font-bold leading-none", value === opt.value && "font-black")}>{opt.title}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{opt.hint}</span>
          </button>
        ))}
      </div>

      {/* Botón Flotante */}
      <Button 
         variant="outline"
         size="icon-lg"
         onClick={toggle}
         className="h-12 w-12 rounded-full shadow-md border-2 hover:bg-muted/50 transition-all hover:scale-105 active:scale-95 group bg-background"
         aria-label="Abrir opciones de grid"
      >
        <LayoutGrid className="h-5 w-5 text-foreground group-hover:text-primary transition-colors" />
        <div className="absolute -top-1 -right-1 h-5 w-5 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-[10px] font-black border-2 border-background">
          {value}
        </div>
      </Button>
    </div>
  );
}

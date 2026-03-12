"use client";

import { Input } from "@/components/ui/input";
import { Search, ScanBarcode } from "lucide-react";
import { useRef, useState, useCallback, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  /** Valor del campo de búsqueda (controlled) */
  value: string;
  /** Callback al cambiar el texto de búsqueda */
  onChange: (value: string) => void;
  /** Callback especial llamado cuando se detecta un escaneo de código de barras (Enter rápido) */
  onBarcodeScanned?: (code: string) => void;
  placeholder?: string;
  className?: string;
  /** Si true, el campo mantiene el foco al perderlo (útil para modo caja activa) */
  keepFocus?: boolean;
}

/**
 * Componente de búsqueda universal reutilizable.
 * 
 * MODO SCANNER: Los lectores físicos de código de barras envían caracteres muy rápido 
 * seguidos de un 'Enter'. Detectamos esto midiendo el tiempo entre el último evento de
 * tecla y el Enter. Si es <= 100ms, asumimos que fue un scanner y llamamos onBarcodeScanned.
 *
 * Este componente puede usarse en Inventario, Punto de Venta, Reportes, etc.
 */
export function SearchInput({
  value,
  onChange,
  onBarcodeScanned,
  placeholder = "Buscar...",
  className,
  keepFocus = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeyTime = useRef<number>(0);
  const [isScannerMode, setIsScannerMode] = useState(false);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime.current;
      lastKeyTime.current = now;

      if (e.key === "Enter") {
        // Si el tiempo entre la última tecla y el Enter fue muy corto => Scanner
        const isScanner = timeSinceLastKey < 100 && value.length > 0;

        if (isScanner && onBarcodeScanned) {
          onBarcodeScanned(value);
          // Limpiamos el campo para que el scanner esté listo para el siguiente código
          onChange("");
          setIsScannerMode(true);
          setTimeout(() => setIsScannerMode(false), 800);
        }
      }
    },
    [value, onChange, onBarcodeScanned]
  );

  const handleBlur = useCallback(() => {
    // Si keepFocus está activo (modo caja), reenfocamos inmediatamente (útil en POS)
    if (keepFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [keepFocus]);

  return (
    <div className={cn("relative", className)}>
      {/* Ícono dinámico: lupa normal o ícono de código de barras al detectar scanner */}
      {isScannerMode ? (
        <ScanBarcode className="absolute left-2.5 top-2.5 h-4 w-4 text-primary animate-pulse" />
      ) : (
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      )}
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={isScannerMode ? "¡Código detectado!" : placeholder}
        className={cn(
          "pl-9 h-10 bg-muted/30 focus-visible:bg-background transition-colors",
          isScannerMode && "border-primary ring-1 ring-primary"
        )}
      />
    </div>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Search, ScanBarcode } from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { BarcodeHandler } from "@/components/shared/barcode-handler";

interface SearchInputProps {
  id?: string; // Added id prop
  /** Valor del campo de búsqueda (controlled) */
  value: string;
  /** Callback al cambiar el texto de búsqueda */
  onChange: (value: string) => void;
  /** Callback especial llamado cuando se detecta un escaneo de código de barras */
  onBarcodeScanned?: (code: string) => void;
  placeholder?: string;
  className?: string;
  /** Si true, el campo mantiene el foco al perderlo (útil para modo caja activa) */
  keepFocus?: boolean;
  /** Si true, el input recibe foco al montar */
  autoFocus?: boolean;
}

/**
 * Componente de búsqueda universal reutilizable con soporte para escáner.
 */
export function SearchInput({
  id, // Destructure id prop
  value,
  onChange,
  onBarcodeScanned,
  placeholder = "Buscar...",
  className,
  keepFocus = false,
  autoFocus = false,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isScannerMode, setIsScannerMode] = useState(false);

  const handleBlur = useCallback(() => {
    if (keepFocus && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [keepFocus]);

  const internalOnScan = (code: string) => {
    if (onBarcodeScanned) {
      onBarcodeScanned(code);
      setIsScannerMode(true);
      setTimeout(() => setIsScannerMode(false), 800);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {onBarcodeScanned && (
        <BarcodeHandler 
          onScan={internalOnScan} 
          profile="catalog" // Permitimos escaneo aunque el input esté enfocado
        />
      )}

      {isScannerMode ? (
        <ScanBarcode className="absolute left-2.5 top-2.5 h-4 w-4 text-primary animate-pulse" />
      ) : (
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      )}
      <Input
        id={id} // Pass id to the Input component
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={isScannerMode ? "¡Código detectado!" : placeholder}
        autoFocus={autoFocus}
        className={cn(
          "pl-9 h-10 bg-muted/30 focus-visible:bg-background transition-colors",
          isScannerMode && "border-primary ring-1 ring-primary"
        )}
      />
    </div>
  );
}

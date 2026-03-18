"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Aquí puedes enlazar telemetría nativa, o solo loguear a la consola
    console.error("Critical System Crash:", error);
  }, [error]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Patrón de Fondo Suave */}
      <div className="absolute inset-0 bg-muted/50 mesh-pattern opacity-50 pointer-events-none" />
      
      <div className="relative z-10 max-w-md w-full px-6 flex flex-col items-center text-center space-y-6">
        <div className="h-24 w-24 bg-destructive/10 text-destructive rounded-full flex items-center justify-center border-4 border-destructive/20 animate-pulse">
          <AlertCircle className="h-12 w-12" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-4xl font-black tracking-tighter uppercase text-destructive">
            Error Crítico 500
          </h1>
          <p className="text-muted-foreground font-bold tracking-widest text-sm uppercase">
            El engranaje interno del sistema acaba de colapsar.
          </p>
        </div>

        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 w-full">
          <p className="font-mono text-xs text-destructive/80 break-words text-left">
            {error.message || "Fallo irrecuperable de Renderizado."}
            {error.digest && <span className="block mt-2 opacity-50">Digest: {error.digest}</span>}
          </p>
        </div>

        <div className="w-full flex gap-4 pt-4">
          <Button 
            variant="outline" 
            className="flex-1 h-12 uppercase font-black text-xs tracking-widest rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-colors"
            onClick={() => reset()}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
          <Button 
            className="flex-1 h-12 uppercase font-black text-xs tracking-widest rounded-xl"
            onClick={() => router.push("/")}
          >
            <Home className="w-4 h-4 mr-2" />
            Caja Principal
          </Button>
        </div>
      </div>
    </div>
  );
}

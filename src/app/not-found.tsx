import Link from "next/link";
import { PackageX, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background text-foreground relative overflow-hidden">
      {/* Patrón de Fondo Suave */}
      <div className="absolute inset-0 bg-muted/40 mesh-pattern opacity-50 pointer-events-none" />
      
      <div className="relative z-10 max-w-md w-full px-6 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="h-24 w-24 bg-muted text-muted-foreground rounded-full flex items-center justify-center border-4 border-muted/50 mb-4">
          <PackageX className="h-12 w-12" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-6xl font-black tracking-tighter uppercase text-primary">
            404
          </h1>
          <p className="text-muted-foreground font-bold tracking-widest text-sm uppercase">
            Ruta no encontrada
          </p>
        </div>

        <div className="bg-muted/50 border border-border rounded-xl p-4 w-full">
          <p className="text-xs text-muted-foreground break-words text-center font-semibold">
            El archivo o dirección de memoria a la que intentas acceder no existe en la Base de Datos o ha sido removida del Sistema.
          </p>
        </div>

        <div className="w-full flex gap-4 pt-4">
          <Button 
            asChild
            variant="outline" 
            className="flex-1 h-12 uppercase font-black text-xs tracking-widest rounded-xl hover:bg-muted/50 transition-colors"
          >
            <Link href="/history">
              <Search className="w-4 h-4 mr-2" />
              Buscar Ticket
            </Link>
          </Button>
          <Button 
            asChild
            className="flex-1 h-12 uppercase font-black text-xs tracking-widest rounded-xl shadow-lg"
          >
            <Link href="/">
              <Home className="w-4 h-4 mr-2" />
              Tpv Caja
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

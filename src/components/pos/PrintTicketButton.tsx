"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PrintTicketButtonProps {
  orderId: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
  className?: string;
  asIcon?: boolean;
}

export function PrintTicketButton({ orderId, variant = "outline", className, asIcon = false }: PrintTicketButtonProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPdfing, setIsPdfing] = useState(false);

  // Helper local para window.electronAPI
  const api = typeof window !== "undefined" ? (window as unknown as { electronAPI?: any }).electronAPI : null;

  const handlePrint = async () => {
    if (!api) {
      toast.error("Impresión no disponible en la web");
      return;
    }

    setIsPrinting(true);
    const toastId = toast.loading("Imprimiendo recibo...");
    
    try {
      // Necesitamos leer de Settings cuál es la impresora por defecto "receiptPrinter"
      // o pasar null para la Default del OS.
      // Aquí delegamos en Settings.
      const settings = await api.getAllSettings();
      const sMap = settings.success ? (settings.config || {}) : {};
      
      const printerName = sMap["receiptPrinter"] || null;
      
      const res = await api.printTicket(orderId, printerName, true); // true = silent
      
      if (res.success) {
        toast.success("Recibo impreso con éxito", { id: toastId });
      } else {
        toast.error("Error al imprimir", { description: res.error, id: toastId });
      }
    } catch (err: any) {
      toast.error("Fallo la impresión térmica", { description: err.message || "", id: toastId });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePdf = async () => {
    if (!api) {
      toast.error("Descarga no disponible en la web");
      return;
    }

    setIsPdfing(true);
    const toastId = toast.loading("Generando ticket PDF...");
    
    try {
      const res = await api.printTicketToPdf(orderId);
      
      if (res.canceled) {
        toast.dismiss(toastId);
        return;
      }

      if (res.success) {
        toast.success("Recibo guardado en Documentos", { id: toastId });
      } else {
        toast.error("Error al guardar PDF", { description: res.error, id: toastId });
      }
    } catch (err: any) {
      toast.error("Falla al generar PDF", { description: err.message || "", id: toastId });
    } finally {
      setIsPdfing(false);
    }
  };

  if (asIcon) {
    return (
      <div className="flex gap-2">
        <Button 
          variant={variant} 
          size="icon"
          onClick={handlePrint} 
          disabled={isPrinting || isPdfing}
          className={className}
          title="Imprimir Térmico"
        >
          {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        </Button>
        <Button 
          variant={variant} 
          size="icon"
          onClick={handlePdf} 
          disabled={isPrinting || isPdfing}
          className={className}
          title="Descargar PDF"
        >
          {isPdfing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 w-full my-2">
      <button 
        onClick={handlePrint} 
        disabled={isPrinting || isPdfing}
        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all hover:border-primary/50 hover:bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed group ${className || ''}`}
      >
        <div className="p-3 bg-muted group-hover:bg-background rounded-full transition-colors">
          {isPrinting ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Printer className="h-6 w-6 text-foreground/80 group-hover:text-primary transition-colors" />}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">Imprimir</span>
      </button>
      
      <button 
        onClick={handlePdf} 
        disabled={isPrinting || isPdfing}
        className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm ${className || ''}`}
      >
        <div className="p-3 bg-background rounded-full shadow-sm text-primary transition-transform group-hover:scale-110">
          {isPdfing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FileDown className="h-6 w-6" />}
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-primary">Descargar PDF</span>
      </button>
    </div>
  );
}

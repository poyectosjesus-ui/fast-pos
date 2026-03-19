"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OrderService } from "@/lib/services/orders";
import { Order } from "@/lib/schema";
import { ThermalTicket } from "@/components/receipts/ThermalTicket";
import { InvoicePDF } from "@/components/receipts/InvoicePDF";
import { Button } from "@/components/ui/button";
import { Printer, FileText, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

function TicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const format = searchParams.get("format"); // "thermal" | "pdf" | null

  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTicketData() {
      if (!orderId) {
        setError("Falta el ID del ticket.");
        return;
      }
      try {
        const fetchedOrder = await OrderService.getById(orderId);
        if (!fetchedOrder) {
          setError("Ticket no encontrado.");
          return;
        }
        setOrder(fetchedOrder);

        const winApi = (window as unknown as { electronAPI?: Record<string, Function> }).electronAPI;
        if (typeof window !== "undefined" && winApi) {
          const apiSettings = (await winApi.getAllSettings!()) as {
            success: boolean;
            config?: Record<string, string>;
          };
          const settingsMap = apiSettings.success ? (apiSettings.config || {}) : {};
          setSettings(settingsMap);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError("Error al cargar ticket: " + msg);
      }
    }
    fetchTicketData();
  }, [orderId]);

  const handlePrintThermal = async () => {
    if (!orderId) return;
    const api = (window as any).electronAPI;
    const printerName = settings["receiptPrinter"] || null;
    await api.printTicket(orderId, printerName, true); // Silent
  };

  const handlePrintPDF = async () => {
    if (!order) return;
    const api = (window as any).electronAPI;
    if (!api) {
      window.print();
      return;
    }
    const filename = `Factura_${order.id.split('-')[0]}.pdf`;
    toast.loading("Exportando Documento...");
    const result = await api.exportCurrentViewToPdf(filename);
    if (result.success && !result.canceled) {
      toast.success("Guardado en Documentos");
    } else if (result.canceled) {
      toast.dismiss();
    } else {
      toast.error("Cancelado: " + result.error);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-center font-mono">
        <p className="text-destructive font-bold">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center p-8 text-center font-mono text-muted-foreground">
        Cargando recibo de venta...
      </div>
    );
  }

  // 1. MODO ORDEN STRICTA (SILENT/BACKEND o EXPLICITO)
  if (format === "thermal") {
    return (
      <div className="h-screen overflow-y-auto w-full bg-muted/20 p-8 flex flex-col items-center">
        <div className="print:hidden w-full flex justify-center mb-8">
          <div className="w-full" style={{ maxWidth: settings["receiptPaperSize"] || "80mm" }}>
            <Button variant="outline" className="bg-white shadow-sm h-8 px-3 text-xs w-full" onClick={() => router.back()}>
              <ArrowLeft className="w-3 h-3 mr-2" />
              Volver a Selección
            </Button>
          </div>
        </div>
        <div className="shadow-2xl print:shadow-none w-max bg-white">
          <ThermalTicket order={order} settings={settings} />
        </div>
      </div>
    );
  }
  if (format === "pdf") {
    // Para ver solo el PDF limpio e imprimir con CMD+P o Window.Print
    return (
      <div className="h-screen overflow-y-auto w-full bg-muted/20 p-8 flex flex-col items-center">
        <div className="print:hidden w-full max-w-[210mm] flex justify-between items-center mb-8">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <Button className="shadow-md bg-primary hover:bg-primary/90" onClick={handlePrintPDF}>
            <Download className="w-4 h-4 mr-2" />
            Exportar como PDF
          </Button>
        </div>
        <InvoicePDF order={order} settings={settings} />
      </div>
    );
  }

  // 2. MODO UI (Selector Frontal para Operador)
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Mesh Background */}
      <div className="absolute inset-0 bg-muted/30 mesh-pattern -z-10" />

      <div className="w-full max-w-lg space-y-8 bg-card border shadow-2xl p-8 rounded-3xl animate-in fade-in slide-in-from-bottom-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tight text-primary">Recibo Listo</h1>
          <p className="text-muted-foreground text-sm">
            La operación <span className="font-mono font-bold">#{order.id.split("-")[0]}</span> ha concluido exitosamente. Elige el formato de salida deseado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button 
            className="flex-col h-auto py-6 gap-3 rounded-2xl shadow-xl hover:scale-[1.02] transition-transform active:scale-95" 
            variant="default"
            onClick={handlePrintThermal}
          >
            <Printer className="w-10 h-10 mb-1" />
            <div className="space-y-1">
              <span className="block font-bold uppercase text-xs tracking-widest">Ticket Rápido</span>
              <span className="block text-[10px] opacity-70 normal-case font-medium">80mm para Local</span>
            </div>
          </Button>

          <Button 
            className="flex-col h-auto py-6 gap-3 rounded-2xl bg-white text-slate-800 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:scale-[1.02] transition-transform active:scale-95" 
            variant="outline"
            onClick={() => router.push(`/ticket?orderId=${order.id}&format=pdf`)}
          >
            <FileText className="w-10 h-10 mb-1 text-red-500" />
            <div className="space-y-1">
              <span className="block font-bold uppercase text-xs tracking-widest">Nota de Venta</span>
              <span className="block text-[10px] opacity-70 normal-case font-medium">Formato PDF A4</span>
            </div>
          </Button>
        </div>

        <div className="flex justify-center pt-4">
          <Button variant="ghost" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Continuar sin imprimir
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="flex justify-center border-t pt-4">
            <Button variant="ghost" className="text-xs text-orange-500 hover:text-orange-600 font-mono font-bold" onClick={() => router.push(`/ticket?orderId=${order.id}&format=thermal`)}>
              [DEV] PREVIEW TÉRMICO EN PANTALLA
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={<div className="font-mono text-center p-10 text-xs text-muted-foreground animate-pulse">Cargando motor de impresión...</div>}>
      <TicketContent />
    </Suspense>
  );
}

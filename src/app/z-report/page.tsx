"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { OrderService } from "@/lib/services/orders";
import { ThermalZReport } from "@/components/receipts/ThermalZReport";
import { InvoiceZReport } from "@/components/receipts/InvoiceZReport";
import { Button } from "@/components/ui/button";
import { Printer, FileText, ArrowLeft, Download } from "lucide-react";
import { toast } from "sonner";

function ZReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");
  const titleParam = searchParams.get("title") || "CORTE Z";
  const format = searchParams.get("format"); // "thermal" | "pdf" | null

  const [stats, setStats] = useState<any>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchZReportData() {
      if (!dateParam) {
        setError("Falta la fecha del reporte.");
        return;
      }
      try {
        const targetDate = new Date(dateParam + "T12:00:00");
        const startMs = new Date(targetDate).setHours(0,0,0,0);
        const endMs = new Date(targetDate).setHours(23,59,59,999);

        const [fetchedStats, profitRes] = await Promise.all([
          OrderService.getStatsForDay(targetDate),
          OrderService.getProfitStats(startMs, endMs)
        ]);

        setStats({
          ...fetchedStats,
          profitData: profitRes.success ? profitRes.summary : null
        });

        const winApi = typeof window !== 'undefined' ? (window as any).electronAPI : null;
        if (winApi) {
          const apiSettings = await winApi.getAllSettings();
          const settingsMap = apiSettings.success ? (apiSettings.config || {}) : {};
          setSettings(settingsMap);
        }
      } catch (err: any) {
        setError("Error al cargar reporte Z: " + err.message);
      }
    }
    fetchZReportData();
  }, [dateParam]);

  const handlePrintPDF = async () => {
    const api = (window as any).electronAPI;
    if (!api) {
      window.print();
      return;
    }
    const cleanDate = dateParam ? dateParam.replace(/[^0-9-]/g, '') : "Reporte_Diario";
    const filename = `Corte_${cleanDate}.pdf`;
    toast.loading("Exportando Documento A4...");
    const result = await api.exportCurrentViewToPdf(filename);
    if (result.success && !result.canceled) {
      toast.success("Guardado Exitoso en Documentos");
    } else if (result.canceled) {
      toast.dismiss();
    } else {
      toast.error("Cancelado: " + result.error);
    }
  };

  const handlePrintThermal = async () => {
    const api = (window as any).electronAPI;
    if (!api) {
      toast.error("Impresión no soportada en Web");
      return;
    }
    const printerName = settings["receiptPrinter"] || null;
    toast.loading("Imprimiendo en Caja...");
    await api.printZReport(dateParam, titleParam, printerName, true);
  };

  if (error) {
    return <div className="p-8 text-center font-mono text-xs">{error}</div>;
  }

  if (!stats) {
    return <div className="p-8 text-center font-mono text-xs text-muted-foreground animate-pulse">Calculando métricas del turno...</div>;
  }

  // 1. MODO IMPRESORA (SILENT/BACKEND)
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
          <ThermalZReport stats={stats} dateParam={dateParam!} titleParam={titleParam!} settings={settings} />
        </div>
      </div>
    );
  }

  // 2. MODO VISOR PDF A4
  if (format === "pdf") {
    return (
      <div className="h-screen overflow-y-auto w-full bg-muted/20 p-8 flex flex-col items-center">
        <div className="print:hidden w-full max-w-[210mm] flex justify-between items-center mb-8">
          <Button variant="outline" className="bg-white shadow-sm" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Cortes
          </Button>
          <Button className="shadow-md bg-primary hover:bg-primary/90" onClick={handlePrintPDF}>
            <Download className="w-4 h-4 mr-2" />
            Exportar como PDF
          </Button>
        </div>
        <InvoiceZReport stats={stats} dateParam={dateParam!} titleParam={titleParam!} settings={settings} />
      </div>
    );
  }

  // 3. MODO UI (Selector Frontal para Operador)
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-muted/30 mesh-pattern -z-10" />

      <div className="w-full max-w-lg space-y-8 bg-card border shadow-2xl p-8 rounded-3xl animate-in fade-in slide-in-from-bottom-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black uppercase tracking-tight text-primary">Corte Finalizado</h1>
          <p className="text-muted-foreground text-sm">
            Se ha calculado exitosamente el cierre del <span className="font-mono font-bold">{dateParam}</span>. Elige el formato de auditoría deseado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button 
            className="flex-col h-auto py-6 gap-3 rounded-2xl shadow-xl hover:scale-[1.02] transition-transform active:scale-95 bg-primary" 
            variant="default"
            onClick={handlePrintThermal}
          >
            <Printer className="w-10 h-10 mb-1" />
            <div className="space-y-1">
              <span className="block font-bold uppercase text-xs tracking-widest text-primary-foreground">Boucher Local</span>
              <span className="block text-[10px] opacity-80 normal-case font-medium text-primary-foreground">Para guardar en caja (80mm)</span>
            </div>
          </Button>

          <Button 
            className="flex-col h-auto py-6 gap-3 rounded-2xl bg-white text-slate-800 border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm hover:scale-[1.02] transition-transform active:scale-95" 
            variant="outline"
            onClick={() => router.push(`/z-report?date=${dateParam}&title=${titleParam}&format=pdf`)}
          >
            <FileText className="w-10 h-10 mb-1 text-slate-600" />
            <div className="space-y-1">
              <span className="block font-bold uppercase text-xs tracking-widest text-slate-700">Reporte Ejecutivo</span>
              <span className="block text-[10px] text-slate-500 normal-case font-medium">Exportar Analítica A4</span>
            </div>
          </Button>
        </div>

        <div className="flex justify-center pt-4">
          <Button variant="ghost" onClick={() => router.push("/cash-registers")} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Cajas
          </Button>
        </div>

        {process.env.NODE_ENV === "development" && (
          <div className="flex justify-center border-t pt-4">
            <Button variant="ghost" className="text-xs text-orange-500 hover:text-orange-600 font-mono font-bold" onClick={() => router.push(`/z-report?date=${dateParam}&title=${titleParam}&format=thermal`)}>
              [DEV] PREVIEW TÉRMICO EN PANTALLA
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ZReportPage() {
  return (
    <Suspense fallback={<div className="font-mono text-center p-10 text-xs text-muted-foreground animate-pulse">Inicializando motor contable...</div>}>
      <ZReportContent />
    </Suspense>
  );
}

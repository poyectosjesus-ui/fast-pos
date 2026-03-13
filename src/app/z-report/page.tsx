"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrderService } from "@/lib/services/orders";
import { formatCurrency } from "@/lib/constants";

function ZReportContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

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
        // Al usar T12 nos aseguramos de no caer en offset de timezone y capturar el día correcto localmente
        const targetDate = new Date(dateParam + "T12:00:00");
        const fetchedStats = await OrderService.getStatsForDay(targetDate);
        setStats(fetchedStats);

        const winApi = typeof window !== 'undefined' ? window.electronAPI : null;
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

  if (error) {
    return <div className="p-8 text-center font-mono text-xs">{error}</div>;
  }

  if (!stats) {
    return <div className="p-8 text-center font-mono text-xs text-muted-foreground">Calculando cierre...</div>;
  }

  const businessName = settings["store_name"] || "MI NEGOCIO";
  
  return (
    <div className="ticket-container w-[80mm] mx-auto bg-white text-black p-4 font-mono text-[12px] leading-tight print:p-0">
      <div className="text-center mb-4">
        <h1 className="text-lg font-black uppercase tracking-widest">{businessName}</h1>
        <p className="mt-2 font-bold border-b border-black border-dashed pb-2 mb-2 text-[14px]">CORTE Z - CIERRE DE CAJA</p>
        <p className="text-[10px] mt-1">FECHA DE CORTE: {dateParam}</p>
        <p className="text-[10px]">IMPRESIÓN: {new Date().toLocaleString("es-MX")}</p>
      </div>

      <div className="border-b border-dashed border-black/50 pb-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
          <span>VENTAS TOTALES:</span>
          <span>{stats.orderCount}</span>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-bold mb-1 border-b border-black/30">DESGLOSE DE PAGOS</h2>
        <div className="flex justify-between mt-1">
          <span>Efectivo:</span>
          <span>{formatCurrency(stats.cashTotal)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Tarjeta/Otro:</span>
          <span>{formatCurrency(stats.cardTotal)}</span>
        </div>
      </div>

      <div className="border-t border-dashed border-black/50 pt-3 mb-4 mt-8">
        <div className="flex justify-between text-[11px] mb-1">
          <span>SUBTOTAL (Neto):</span>
          <span>{formatCurrency(stats.totalNet)}</span>
        </div>
        <div className="flex justify-between text-[11px] mb-1">
          <span>IMPUESTOS TOTALES:</span>
          <span>{formatCurrency(stats.totalWithTax - stats.totalNet)}</span>
        </div>
        <div className="flex justify-between text-[16px] font-black mt-3 pt-2 border-t border-black/80">
          <span>TOTAL EN CAJA:</span>
          <span>{formatCurrency(stats.totalWithTax)}</span>
        </div>
      </div>

      <div className="text-center text-[10px] mt-10 mb-4">--- FIN DE CORTE Z ---</div>

      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: 80mm auto; margin: 0; }
        @media print {
          html, body {
            width: 80mm; margin: 0 !important; padding: 0 !important; background: white !important;
          }
          .ticket-container {
            width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 4mm !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}} />
    </div>
  );
}

export default function ZReportPage() {
  return (
    <Suspense fallback={<div className="font-mono text-center p-10 text-xs">Preparando...</div>}>
      <ZReportContent />
    </Suspense>
  );
}

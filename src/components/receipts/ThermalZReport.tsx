"use client";

import { formatCurrency } from "@/lib/constants";

interface ThermalZReportProps {
  stats: any;
  dateParam: string;
  titleParam: string;
  settings: Record<string, string>;
}

export function ThermalZReport({ stats, dateParam, titleParam, settings }: ThermalZReportProps) {
  const paperSize    = settings["receiptPaperSize"] || "80mm";
  const format       = settings["receiptFormat"]    || "graphic";
  const is58         = paperSize === "58mm";
  const WIDTH_MM     = is58 ? "58mm" : "80mm";
  const MAX_CHARS    = is58 ? 32 : 48;
  const businessName = settings["store_name"] || "MI NEGOCIO";

  // ─────────────────────────────────────────────────────────
  // MOTOR FORMATO TEXTO PURO (ASCII / ESC-POS Compliant)
  // ─────────────────────────────────────────────────────────
  if (format === "text") {
    const lines: string[] = [];
    const addCenter = (txt: string) => lines.push(txt.substring(0, MAX_CHARS).padStart(Math.floor((MAX_CHARS + txt.length) / 2)).padEnd(MAX_CHARS));
    const addLeft = (txt: string) => lines.push(txt.substring(0, MAX_CHARS).padEnd(MAX_CHARS));
    const addSep = () => lines.push("-".repeat(MAX_CHARS));
    const addSplit = (l: string, r: string) => {
      if (l.length + r.length + 1 > MAX_CHARS) return addLeft(l.substring(0, MAX_CHARS));
      lines.push(l + " ".repeat(MAX_CHARS - l.length - r.length) + r);
    };

    addCenter(businessName.toUpperCase());
    addCenter(titleParam.toUpperCase());
    addCenter(`FECHA DE CORTE: ${dateParam}`);
    addCenter(`IMPRESIÓN: ${new Date().toLocaleString("es-MX")}`);
    addLeft("");

    addSep();
    addSplit("VENTAS TOTALES:", String(stats.orderCount));
    addSep();
    addLeft("");

    addCenter("DESGLOSE DE PAGOS");
    addSplit("Efectivo:", formatCurrency(stats.cashTotal));
    addSplit("Tarjeta/Otro:", formatCurrency(stats.cardTotal));
    addLeft("");

    if (stats.profitData && stats.profitData.revenue) {
      addSep();
      addCenter("RENTABILIDAD");
      addSplit("Ingreso Neto:", formatCurrency(stats.profitData.revenue));
      addSplit("Costo Mercancía:", formatCurrency(stats.profitData.cost));
      addLeft("");
      addSplit("UTILIDAD BRUTA:", formatCurrency(stats.profitData.profit));
      addSplit("Margen Estimado:", `${Math.round((stats.profitData.profit / stats.profitData.revenue) * 100)}%`);
      addLeft("");
    }

    addSep();
    addSplit("SUBTOTAL (Neto):", formatCurrency(stats.totalNet || 0));
    addSplit("IMPUESTOS:", formatCurrency((stats.totalWithTax || 0) - (stats.totalNet || 0)));
    addLeft("");
    addSplit("TOTAL CAJA:", formatCurrency(stats.totalWithTax || 0));
    addSep();

    addLeft("");
    addCenter("--- FIN DE CORTE Z ---");
    addLeft("");

    return (
      <div className={`ticket-container mx-auto bg-white text-black p-4 print:p-0`} style={{ width: WIDTH_MM }}>
        <pre className={`font-mono leading-tight whitespace-pre-wrap ${is58 ? "text-[12px]" : "text-[14px]"} tracking-tighter m-0`}>
          {lines.join("\n")}
        </pre>
        <style dangerouslySetInnerHTML={{ __html: `
          @page { size: ${WIDTH_MM} auto; margin: 0; }
          @media print {
            html, body { width: ${WIDTH_MM}; margin: 0 !important; padding: 0 !important; background: white !important; }
            .ticket-container { width: 100% !important; max-width: ${WIDTH_MM} !important; margin: 0 !important; padding: 4mm !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
            pre { font-family: 'Courier New', Courier, monospace !important; }
          }
        `}} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MOTOR FORMATO GRÁFICO HTML
  // ─────────────────────────────────────────────────────────
  return (
    <div className={`ticket-container mx-auto bg-white text-black p-4 font-mono text-[12px] leading-tight print:p-0`} style={{ width: WIDTH_MM }}>
      <div className="text-center mb-4">
        <h1 className="text-lg font-black uppercase tracking-widest leading-none">{businessName}</h1>
        <p className="mt-2 font-bold border-b border-black border-dashed pb-2 mb-2 text-[14px] uppercase">{titleParam}</p>
        <p className="text-[10px] mt-1">FECHA DE CORTE: {dateParam}</p>
        <p className="text-[10px]">IMPRESIÓN: {new Date().toLocaleString("es-MX")}</p>
      </div>

      <div className="border-b border-dashed border-black pb-2 mb-4">
        <div className="flex justify-between font-bold text-sm">
          <span>VENTAS TOTALES:</span>
          <span>{stats.orderCount}</span>
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-bold mb-1 border-b border-black text-xs">DESGLOSE DE PAGOS</h2>
        <div className="flex justify-between mt-1">
          <span>Efectivo:</span>
          <span>{formatCurrency(stats.cashTotal)}</span>
        </div>
        <div className="flex justify-between mt-1">
          <span>Tarjeta/Otro:</span>
          <span>{formatCurrency(stats.cardTotal)}</span>
        </div>
      </div>

      {stats.profitData && (
        <div className="mb-4 bg-gray-100 p-2 border border-black/80">
          <h2 className="font-bold mb-1 border-b border-black/80 text-xs text-center">RENTABILIDAD</h2>
          <div className="flex justify-between mt-1 text-[11px]">
            <span>Ingreso Neto:</span>
            <span>{formatCurrency(stats.profitData.revenue)}</span>
          </div>
          <div className="flex justify-between mt-1 text-[11px]">
            <span>Costo Mercancía:</span>
            <span>{formatCurrency(stats.profitData.cost)}</span>
          </div>
          <div className="flex justify-between mt-2 pt-1 border-t border-black/80 font-black">
            <span>UTILIDAD BRUTA:</span>
            <span>{formatCurrency(stats.profitData.profit)}</span>
          </div>
          <div className="text-[9px] mt-1 italic text-right">
            Margen: {Math.round((stats.profitData.profit / (stats.profitData.revenue || 1)) * 100)}%
          </div>
        </div>
      )}

      <div className="border-y border-dashed border-black py-3 mb-4 mt-8">
        <div className="flex justify-between text-[11px] mb-1">
          <span>SUBTOTAL (Neto):</span>
          <span>{formatCurrency(stats.totalNet || 0)}</span>
        </div>
        <div className="flex justify-between text-[11px] mb-1">
          <span>IMPUESTOS:</span>
          <span>{formatCurrency((stats.totalWithTax || 0) - (stats.totalNet || 0))}</span>
        </div>
        <div className="flex justify-between text-[16px] font-black mt-3 pt-2 border-t border-black">
          <span>TOTAL CAJA:</span>
          <span>{formatCurrency(stats.totalWithTax || 0)}</span>
        </div>
      </div>

      <div className="text-center text-[10px] mt-10 mb-4 font-bold">--- FIN DE CORTE Z ---</div>

      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: ${WIDTH_MM} auto; margin: 0; }
        @media print {
          html, body { width: ${WIDTH_MM}; margin: 0 !important; padding: 0 !important; background: white !important; }
          .ticket-container { width: 100% !important; max-width: ${WIDTH_MM} !important; margin: 0 !important; padding: 4mm !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
        }
      `}} />
    </div>
  );
}

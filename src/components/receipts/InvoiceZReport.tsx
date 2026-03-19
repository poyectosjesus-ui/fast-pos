"use client";

import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface InvoiceZReportProps {
  stats: any;
  dateParam: string;
  titleParam: string;
  settings: Record<string, string>;
}

export function InvoiceZReport({ stats, dateParam, titleParam, settings }: InvoiceZReportProps) {
  const businessName = settings["store_name"] || "Empresa S.A de C.V.";
  const taxId        = settings["store_tax_id"] || "RFC GENÉRICO";
  const address      = settings["store_address"] || "Sin Dirección";

  const printDateStr = format(new Date(), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });
  
  // Tax calculus
  const realNet = stats.totalNet || 0;
  const realTotal = stats.totalWithTax || 0;
  const taxAmount = realTotal - realNet;

  return (
    <div className="pdf-container mx-auto bg-card text-card-foreground p-12 text-sm leading-relaxed shadow-2xl border print:border-none print:shadow-none min-h-[297mm]">
      {/* HEADER Z-REPORT */}
      <header className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-primary/20 pb-8 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">
            {businessName}
          </h1>
          <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest mt-1">
            RFC: {taxId}
          </p>
          <div className="text-sm mt-3 text-card-foreground/80 max-w-sm">
            <p className="whitespace-pre-line">{address}</p>
          </div>
        </div>

        <div className="mt-6 sm:mt-0 text-left sm:text-right">
          <h2 className="text-3xl font-black text-muted/30 uppercase tracking-tighter mix-blend-multiply dark:mix-blend-screen flex flex-col">
            <span>REPORTE</span>
            <span>{titleParam === "CORTE Z" ? "FIN DE TURNO" : titleParam}</span>
          </h2>
          <div className="mt-4 bg-muted border border-border p-4 rounded-xl inline-block text-left relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-bl-full -mr-4 -mt-4"></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Fecha Operativa</p>
            <p className="text-xl font-mono font-bold text-card-foreground">{dateParam}</p>
            <p className="text-[10px] text-muted-foreground mt-2 font-medium">Impreso: {printDateStr}</p>
          </div>
        </div>
      </header>

      {/* METRICAS PRINCIPALES */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-primary p-6 rounded-2xl text-primary-foreground shadow-lg shadow-primary/20 border border-primary/20">
          <p className="text-xs uppercase font-bold tracking-widest text-primary-foreground/80 mb-2">Total en Caja</p>
          <p className="text-4xl font-black tracking-tight">{formatCurrency(realTotal)}</p>
        </div>
        <div className="bg-muted p-6 rounded-2xl border border-border flex flex-col justify-center">
          <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">Ventas Completadas</p>
          <p className="text-4xl font-black tracking-tight text-card-foreground">{stats.orderCount}</p>
        </div>
        <div className="bg-muted p-6 rounded-2xl border border-border flex flex-col justify-center">
          <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">Promedio por Venta</p>
          <p className="text-4xl font-black tracking-tight text-card-foreground">
            {stats.orderCount > 0 ? formatCurrency(realTotal / stats.orderCount) : "$0.00"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* DESGLOSE DE PAGOS */}
        <section>
          <h3 className="text-lg font-black text-card-foreground uppercase tracking-wider border-b-2 border-primary/20 pb-2 mb-4">
            Composición de Ingresos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-muted rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
               <span className="font-semibold text-muted-foreground">💵 Efectivo Físico</span>
               <span className="font-bold tabular-nums text-card-foreground">{formatCurrency(stats.cashTotal || 0)}</span>
            </div>
            <div className="flex justify-between p-3 bg-muted rounded-lg border border-border/50 hover:border-primary/50 transition-colors">
               <span className="font-semibold text-muted-foreground">💳 Tarjetas / Transferencias</span>
               <span className="font-bold tabular-nums text-card-foreground">{formatCurrency(stats.cardTotal || 0)}</span>
            </div>
            {/* Si existen otros métodos, irían agregados a este bloque */}
          </div>
        </section>

        {/* RENDIMIENTO Y FISCAL */}
        <section>
          <h3 className="text-lg font-black text-card-foreground uppercase tracking-wider border-b-2 border-primary/20 pb-2 mb-4">
            Resumen Fiscal y Utilidad
          </h3>
          <div className="space-y-1 bg-card border-2 border-border/50 rounded-xl p-4 shadow-sm">
             <div className="flex justify-between py-2 border-b border-border/50">
               <span className="text-muted-foreground font-medium">Subtotal Base</span>
               <span className="tabular-nums font-semibold text-card-foreground">{formatCurrency(realNet)}</span>
             </div>
             <div className="flex justify-between py-2 border-b border-border/50">
               <span className="text-muted-foreground font-medium">IVA Trasladado</span>
               <span className="tabular-nums font-semibold text-card-foreground">{formatCurrency(taxAmount)}</span>
             </div>
             
             {stats.profitData && (
               <>
                 <div className="flex justify-between py-2 border-b border-border/50 mt-2">
                   <span className="text-muted-foreground font-medium">Costo Estimado de Mercancías</span>
                   <span className="tabular-nums font-semibold text-destructive/80">-{formatCurrency(stats.profitData.cost)}</span>
                 </div>
                 <div className="flex justify-between py-3 mt-1 bg-primary/10 rounded-lg px-2 border border-primary/20">
                   <span className="font-black text-primary">Utilidad Bruta</span>
                   <span className="tabular-nums font-black text-primary">{formatCurrency(stats.profitData.profit)}</span>
                 </div>
                 <div className="text-right text-[10px] font-bold text-muted-foreground mt-1 pr-2 uppercase tracking-widest">
                   MARGEN BRUTO: {Math.round((stats.profitData.profit / (stats.profitData.revenue || 1)) * 100)}%
                 </div>
               </>
             )}
          </div>
        </section>
      </div>

      <footer className="mt-16 pt-8 border-t border-border text-center">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
           Documento Interno de Auditoría
        </p>
        <p className="text-[10px] text-muted-foreground/50 mt-2">
           Generado automáticamente por el módulo de cierres de Fast-POS.
        </p>
      </footer>

      {/* Estilos A4 Exclusivos */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          html, body {
            width: 210mm;
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .pdf-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            color: black !important;
          }
          .pdf-container * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Forzar estilos de Tailwind a modo claro duro durante impresión */
          .bg-muted, .bg-card {
            background-color: #f8fafc !important;
            border-color: #cbd5e1 !important;
          }
          .text-muted-foreground {
            color: #64748b !important;
          }
          .text-card-foreground, .text-primary-foreground {
            color: #0f172a !important;
          }
          .border-border, .border-primary\\/20 {
            border-color: #cbd5e1 !important;
          }
          .text-primary {
             color: #0f172a !important;
          }
        }
      `}} />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { HandCoins, CreditCard, Printer, FileText, Wallet } from "lucide-react";
import { toast } from "sonner";
import { OrderService } from "@/lib/services/orders";
import { formatCurrency } from "@/lib/constants";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/useSessionStore";

export default function CashRegistersPage() {
  const { user } = useSessionStore();
  const [stats, setStats] = useState({
    totalNet: 0,
    totalWithTax: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderCount: 0,
    avgTicket: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentStats = await OrderService.getStatsForDay();
      setStats(currentStats);
    } catch (error) {
      console.error("Error cargando caja:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60_000); // 1 min update
    return () => clearInterval(interval);
  }, [loadStats]);

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight uppercase">Gestión de Cajas</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-70">
              Control de Efectivo y Reportes Físicos
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
          
          {/* Fila 1: Resumen de Dinero */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-primary/5 hover:bg-primary/10 transition-colors border-2 border-primary/20 rounded-3xl p-6 lg:p-8 space-y-4">
              <div className="flex justify-between items-center bg-background/50 rounded-2xl p-4">
                <span className="text-xs font-black uppercase tracking-widest text-primary">Efectivo Físico en Caja</span>
                <HandCoins className="h-6 w-6 text-primary" />
              </div>
              <div className="pt-2">
                <p className="text-5xl lg:text-7xl font-black text-primary tracking-tighter">
                  {formatCurrency(stats.cashTotal)}
                </p>
                <p className="text-xs font-bold text-muted-foreground uppercase mt-3 tracking-widest">
                  Monedas y billetes cobrados en mostrador hoy
                </p>
              </div>
            </div>

            <div className="bg-card hover:bg-muted/50 transition-colors border-2 rounded-3xl p-6 lg:p-8 space-y-4">
              <div className="flex justify-between items-center bg-muted/60 rounded-2xl p-4">
                <span className="text-xs font-black uppercase tracking-widest text-foreground">Vouchers / Tarjeta</span>
                <CreditCard className="h-6 w-6 text-blue-500" />
              </div>
              <div className="pt-2">
                <p className="text-5xl lg:text-7xl font-black tracking-tighter text-foreground">
                  {formatCurrency(stats.cardTotal)}
                </p>
                <p className="text-xs font-bold text-muted-foreground uppercase mt-3 tracking-widest">
                  Dinero digital en cuenta bancaria y recargas
                </p>
              </div>
            </div>
          </div>

          {/* Fila 2: Mix Operativo */}
          <div className="border rounded-3xl bg-card p-6 lg:p-8 shadow-sm">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6">Eficiencia Operativa</p>
            <div className="flex items-end gap-3 mb-6">
              <span className="text-5xl font-black tracking-tighter">{stats.orderCount}</span>
              <span className="text-xs pb-2 font-black uppercase text-muted-foreground/70 tracking-widest">Ventas realizadas hoy</span>
            </div>
            
            {stats.orderCount > 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase tracking-tighter">
                    <span>Proporción de Cobro</span>
                    <span className="text-primary">{Math.round((stats.cashTotal / (stats.totalWithTax || 1)) * 100)}% Efectivo</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-primary" 
                      style={{ width: `${Math.round((stats.cashTotal / (stats.totalWithTax || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-2 w-full bg-muted rounded-full" />
            )}
          </div>

          {/* Fila 3: Botones de Corte amigables */}
          <div className="pt-6">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Printer className="h-5 w-5" /> Impresión de Reportes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* CORTE X -> Reporte de Turno */}
              <div className="bg-card border rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Reporte de Turno (X)
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mb-4">
                    Imprime un ticket con el total de ventas hasta este momento. 
                    <b> No borra ni cierra la caja.</b> Úsalo para cuadrar cajeros a mitad del día.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl border-dashed hover:border-primary hover:text-primary font-bold text-[11px] uppercase tracking-wider"
                  onClick={async () => {
                     const today = new Date().toISOString().split("T")[0];
                     const res = await window.electronAPI?.generateZReportPdf({ 
                       dateString: today, 
                       title: "REPORTE DE TURNO (CORTE X)",
                       userId: user?.id 
                     });
                     if (res?.success && !res.canceled) {
                       toast.success("Reporte Generado", { description: res.filePath });
                     }
                  }}
                >
                  Imprimir Turno
                </Button>
              </div>

              {/* CORTE Z -> Cierre de Día */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2 text-primary">
                    <Wallet className="h-4 w-4" /> Cierre del Día (Z)
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mb-4">
                    Imprime el cálculo final de todo el día. 
                    Declara el total cobrado oficialmente. Úsalo al finalizar las ventas frente a mostrador.
                  </p>
                </div>
                <Button
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[11px] uppercase tracking-wider shadow-lg shadow-primary/20"
                  onClick={async () => {
                     const today = new Date().toISOString().split("T")[0];
                     const res = await window.electronAPI?.generateZReportPdf({ 
                       dateString: today, 
                       title: "CIERRE DEL DÍA (CORTE Z)",
                       userId: user?.id 
                     });
                     if (res?.success && !res.canceled) {
                       toast.success("Cierre Generado", { description: res.filePath });
                     }
                  }}
                >
                  Imprimir Cierre
                </Button>
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

"use client";

/**
 * Dashboard de Analítica Reales
 *
 * FUENTE DE VERDAD: analitica_plan.md — Fase 4.1, 4.2 y 4.3
 *
 * Tablero maestro de la aplicación para que el jefe y el cajero monitoreen el pulso del día.
 * Rendimiento extremo garantizado por IndexedDB.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Coins, HandCoins, ReceiptText, Users, CreditCard, Printer, TrendingUp, Calendar, Wallet, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { OrderService } from "@/lib/services/orders";
import { formatCurrency } from "@/lib/constants";
import { Sidebar } from "@/components/layout/sidebar";
import { MetricCard } from "./_components/metric-card";
import { TopProducts } from "./_components/top-products";
import { CashierChart, SourceList, PaymentList, ProgressChart } from "./_components/advanced-charts";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { cn } from "@/lib/utils";

import { useSessionStore } from "@/store/useSessionStore";

export default function AnalyticsPage() {
  const { user } = useSessionStore();
  const [filterDate, setFilterDate] = useState<'WEEK' | 'MONTH' | 'YEAR'>('MONTH');
  
  const [stats, setStats] = useState({
    totalNet: 0,
    totalWithTax: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderCount: 0,
    avgTicket: 0,
    todayOrders: [] as any[]
  });

  const [profitStats, setProfitStats] = useState<{
    summary: { revenue: number; cost: number; profit: number; orderCount: number };
    dailyData: { date: string; revenue: number; cost: number }[];
  } | null>(null);

  const [advancedStats, setAdvancedStats] = useState<{
    byCashier: any[];
    bySource: any[];
    byPayment: any[];
  } | null>(null);

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Stats estándar de hoy (Caja)
      const currentStats = await OrderService.getStatsForDay();
      setStats(currentStats);
      
      // 2. Stats de rentabilidad según rango (Gráfica y periodos largos)
      let start = 0;
      let end = Date.now();
      const now = new Date();
      
      if (filterDate === 'WEEK') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
        start = d.getTime();
      } else if (filterDate === 'MONTH') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        start = d.getTime();
      } else if (filterDate === 'YEAR') {
        const d = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        start = d.getTime();
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime(); // Fuerza 365 días completos
      }

      const [profitRes, top, advancedRes] = await Promise.all([
        OrderService.getProfitStats(start, end),
        OrderService.getTopProducts(start, end, 5),
        OrderService.getAdvancedAnalytics({ startDate: start, endDate: end })
      ]);

      if (profitRes.success) {
        setProfitStats({
          summary: profitRes.summary,
          dailyData: profitRes.dailyData
        });
      }
      
      if (advancedRes.success) {
        setAdvancedStats({
          byCashier: advancedRes.byCashier || [],
          bySource: advancedRes.bySource || [],
          byPayment: advancedRes.byPayment || []
        });
      }

      setTopProducts(top);
    } catch (error) {
      console.error("Error cargando analíticas:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60_000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const marginPct = useMemo(() => {
    if (!profitStats || profitStats.summary.revenue === 0) return 0;
    return Math.round((profitStats.summary.profit / profitStats.summary.revenue) * 100);
  }, [profitStats]);

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight uppercase">Inteligencia de Negocio</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-70">Métricas, márgenes y reportes</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            
            <div className="flex bg-muted p-1 rounded-xl border items-center overflow-x-auto">
              <Button 
                variant={filterDate === 'WEEK' ? 'secondary' : 'ghost'} 
                size="sm" className={cn("h-8 text-[11px] uppercase font-bold rounded-lg px-4 transition-all", filterDate === 'WEEK' && "bg-background text-primary shadow-sm")}
                onClick={() => { setFilterDate('WEEK'); }}
              >7 Días</Button>
              <Button 
                variant={filterDate === 'MONTH' ? 'secondary' : 'ghost'} 
                size="sm" className={cn("h-8 text-[11px] uppercase font-bold rounded-lg px-4 transition-all", filterDate === 'MONTH' && "bg-background text-primary shadow-sm")}
                onClick={() => { setFilterDate('MONTH'); }}
              >Mes</Button>
              <Button 
                variant={filterDate === 'YEAR' ? 'secondary' : 'ghost'} 
                size="sm" className={cn("h-8 text-[11px] uppercase font-bold rounded-lg px-4 transition-all", filterDate === 'YEAR' && "bg-background text-primary shadow-sm")}
                onClick={() => { setFilterDate('YEAR'); }}
              >Año</Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Fila 1: Rentabilidad (Premium) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Ganancia Libre"
              value={formatCurrency(profitStats?.summary.profit ?? 0)}
              description="Lo que te queda en la bolsa después de pagar la mercancía."
              icon={Wallet}
              variant="emerald"
            />
            <MetricCard
              title="Rentabilidad"
              value={`${marginPct}%`}
              description="Tu desempeño para el periodo seleccionado."
              icon={TrendingUp}
              variant="violet"
              trend="Dinámico"
              trendPositive={true}
            />
            <MetricCard
              title="Costo de Mercancía"
              value={formatCurrency(profitStats?.summary.cost ?? 0)}
              description="El dinero que invertiste en los productos que ya vendiste."
              icon={ShoppingBag}
              variant="amber"
            />
            <MetricCard
              title="Total Cobrado"
              value={formatCurrency(profitStats?.summary.revenue ?? 0)}
              description="Todo el dinero que entró por las ventas."
              icon={ReceiptText}
              variant="blue"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfica de Rentabilidad (Principal) */}
            <div className="lg:col-span-3 flex flex-col gap-4 border rounded-2xl bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Ventas vs Costos</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Visualización del flujo de margen</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Venta</span>
                   </div>
                   <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-indigo-500" />
                      <span className="text-[10px] font-bold uppercase tracking-tighter">Costo</span>
                   </div>
                </div>
              </div>
              
              {profitStats && profitStats.dailyData.length > 0 ? (
                <ProgressChart data={profitStats.dailyData} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed italic text-sm">
                  No hay datos suficientes para graficar este período
                </div>
              )}
            </div>

            {/* Fila 3: Gráficas de Desglose Avanzado */}
            <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="border rounded-2xl bg-card p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Rendimiento Cajeros</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Volumen procesado por usuario</p>
                </div>
                {advancedStats ? <CashierChart data={advancedStats.byCashier} /> : <div className="h-[250px] animate-pulse bg-muted/20 rounded-xl" />}
              </div>

              <div className="border rounded-2xl bg-card p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Canal de Venta</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Origen de los pedidos</p>
                </div>
                {advancedStats ? <SourceList data={advancedStats.bySource} /> : <div className="h-[250px] animate-pulse bg-muted/20 rounded-xl" />}
              </div>

              <div className="border rounded-2xl bg-card p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Métodos de Cobro</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Preferencia de pago</p>
                </div>
                {advancedStats ? <PaymentList data={advancedStats.byPayment} /> : <div className="h-[250px] animate-pulse bg-muted/20 rounded-xl" />}
              </div>

            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
             <TopProducts products={topProducts} />
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper Card simple
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-4", className)}>{children}</div>;
}

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

  const [prevProfitStats, setPrevProfitStats] = useState<{
    summary: { revenue: number; cost: number; profit: number; orderCount: number };
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
      let prevStart = 0;
      let prevEnd = 0;
      const now = new Date();
      
      if (filterDate === 'WEEK') {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
        start = d.getTime();
        const pd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 0, 0, 0);
        prevStart = pd.getTime();
        prevEnd = start - 1;
      } else if (filterDate === 'MONTH') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        start = d.getTime();
        const pd = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        prevStart = pd.getTime();
        prevEnd = start - 1;
      } else if (filterDate === 'YEAR') {
        const d = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
        start = d.getTime();
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime(); // Fuerza 365 días completos
        
        const pd = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0);
        prevStart = pd.getTime();
        prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999).getTime();
      }

      const [profitRes, prevProfitRes, top, advancedRes] = await Promise.all([
        OrderService.getProfitStats(start, end),
        OrderService.getProfitStats(prevStart, prevEnd),
        OrderService.getTopProducts(start, end, 5),
        OrderService.getAdvancedAnalytics({ startDate: start, endDate: end })
      ]);

      if (profitRes.success) {
        setProfitStats({
          summary: profitRes.summary,
          dailyData: profitRes.dailyData
        });
      }

      if (prevProfitRes.success) {
        setPrevProfitStats({
          summary: prevProfitRes.summary
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

  const revenueTrend = useMemo(() => {
    if (!profitStats || !prevProfitStats) return undefined;
    const diff = profitStats.summary.revenue - prevProfitStats.summary.revenue;
    const prev = prevProfitStats.summary.revenue;
    const period = filterDate === 'WEEK' ? 'la semana pasada' : filterDate === 'MONTH' ? 'el mes pasado' : 'el año pasado';
    
    if (prev === 0 && profitStats.summary.revenue > 0) return { text: `🚀 ¡Primeras ventas vs cero!`, pos: true };
    if (prev === 0) return undefined;

    const pct = (diff / prev) * 100;
    if (diff > 0) return { text: `↑ Tú superaste por ${formatCurrency(Math.abs(diff))} (+${pct.toFixed(0)}%) a ${period}`, pos: true };
    if (diff < 0) return { text: `⚠️ Bajaste ${formatCurrency(Math.abs(diff))} (${pct.toFixed(0)}%) contra ${period}`, pos: false };
    return { text: `➖ Exactamente igual que ${period}`, pos: true };
  }, [profitStats, prevProfitStats, filterDate]);

  const profitTrend = useMemo(() => {
    if (!profitStats || !prevProfitStats) return undefined;
    const diff = profitStats.summary.profit - prevProfitStats.summary.profit;
    const prev = prevProfitStats.summary.profit;
    if (prev === 0) return undefined;
    if (diff > 0) return { text: `🚀 Te sobraron ${formatCurrency(Math.abs(diff))} extra libres`, pos: true };
    if (diff < 0) return { text: `📉 Te sobraron ${formatCurrency(Math.abs(diff))} menos libres`, pos: false };
    return undefined;
  }, [profitStats, prevProfitStats]);

  const countTrend = useMemo(() => {
    if (!profitStats || !prevProfitStats) return undefined;
    const diff = profitStats.summary.orderCount - prevProfitStats.summary.orderCount;
    if (prevProfitStats.summary.orderCount === 0) return undefined;
    if (diff > 0) return { text: `↑ Atendiste a ${diff} clientes extra`, pos: true };
    if (diff < 0) return { text: `↓ Atendiste a ${Math.abs(diff)} clientes menos`, pos: false };
    return undefined;
  }, [profitStats, prevProfitStats]);

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight uppercase">Mi Cuaderno de Ventas</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-70">Cuentas claras, negocio próspero</p>
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
          
          {/* Fila 1: Hero Cards del Libro DiarIo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <MetricCard
              title="Vendimos a la fecha"
              value={formatCurrency(profitStats?.summary.revenue ?? 0)}
              description="Todo el dinero que ha entrado a tu caja."
              icon={Coins}
              variant="emerald"
              trend={revenueTrend?.text}
              trendPositive={revenueTrend?.pos}
            />
            <MetricCard
              title="Despachos"
              value={profitStats?.summary.orderCount?.toString() ?? "0"}
              description="El total de los tickets de venta exitosos emitidos."
              icon={ReceiptText}
              variant="violet"
              trend={countTrend?.text}
              trendPositive={countTrend?.pos}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfica de Progreso Semanal/Mensual */}
            <div className="lg:col-span-3 flex flex-col gap-4 border rounded-2xl bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">El pulso de tus ingresos</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Dinero que entra en caja día tras día</p>
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
                  <h3 className="text-lg font-black uppercase tracking-tight">¿Quién cobró más?</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Ventas por cada cajero</p>
                </div>
                {advancedStats ? <CashierChart data={advancedStats.byCashier} /> : <div className="h-[250px] animate-pulse bg-muted/20 rounded-xl" />}
              </div>

              <div className="border rounded-2xl bg-card p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">De dónde vienen</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">Mostrador frente a Redes Web</p>
                </div>
                {advancedStats ? <SourceList data={advancedStats.bySource} /> : <div className="h-[250px] animate-pulse bg-muted/20 rounded-xl" />}
              </div>

              <div className="border rounded-2xl bg-card p-6 shadow-sm flex flex-col gap-4">
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Efectivo vs Bancos</h3>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest opacity-60">El origen de la moneda</p>
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

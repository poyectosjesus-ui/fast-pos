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
import { ProfitChart } from "./_components/profit-chart";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { cn } from "@/lib/utils";

import { useSessionStore } from "@/store/useSessionStore";

export default function AnalyticsPage() {
  const { user } = useSessionStore();
  const [range, setRange] = useState<'today' | '7d' | '30d'>('today');
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

  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Stats estándar de hoy (Caja)
      const currentStats = await OrderService.getStatsForDay();
      setStats(currentStats);
      
      // 2. Resumen rápido de KPIs del día (KPIs Real-Time Épica 2.2)
      if (range === 'today') {
        const summaryRes = await OrderService.getDaySummary();
        if (summaryRes.success && summaryRes.data) {
          setProfitStats({
            summary: {
              revenue: summaryRes.data.totalRevenue,
              cost: summaryRes.data.totalRevenue - summaryRes.data.netProfit,
              profit: summaryRes.data.netProfit,
              orderCount: summaryRes.data.ticketCount
            },
            dailyData: [] // Se cargará con getProfitStats abajo para la gráfica
          });
        }
      }

      // 3. Stats de rentabilidad según rango (Gráfica y períodos largos)
      let start = 0;
      const end = Date.now();
      const now = new Date();
      
      if (range === 'today') {
        const d = new Date(now); d.setHours(0,0,0,0); start = d.getTime();
      } else if (range === '7d') {
        const d = new Date(now); d.setDate(d.getDate() - 7); start = d.getTime();
      } else if (range === '30d') {
        const d = new Date(now); d.setDate(d.getDate() - 30); start = d.getTime();
      }

      const [profitRes, top] = await Promise.all([
        OrderService.getProfitStats(start, end),
        OrderService.getTopProducts(currentStats.todayOrders, 5)
      ]);

      if (profitRes.success) {
        setProfitStats(prev => ({
          summary: range === 'today' ? (prev?.summary || profitRes.summary) : profitRes.summary,
          dailyData: profitRes.dailyData
        }));
      }
      setTopProducts(top);
    } catch (error) {
      console.error("Error cargando analíticas:", error);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

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
            <h1 className="text-2xl font-black tracking-tight uppercase">Dashboard Premium</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-70">Inteligencia de Negocio y Rentabilidad</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            {/* Sector de Rango */}
            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border">
              {(['today', '7d', '30d'] as const).map((r) => (
                <Button
                  key={r}
                  variant={range === r ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-7 text-[9px] font-black uppercase tracking-tighter px-3 rounded-lg transition-all",
                    range === r && "bg-background shadow-xs text-primary"
                  )}
                  onClick={() => setRange(r)}
                >
                  {r === 'today' ? 'Hoy' : r === '7d' ? '7 Días' : '30 Días'}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-dashed hover:border-primary hover:text-primary font-bold text-[10px] uppercase tracking-wider"
                onClick={async () => {
                   const today = new Date().toISOString().split("T")[0];
                   const res = await window.electronAPI?.generateZReportPdf({ 
                     dateString: today, 
                     title: "CORTE X - ARQUEO PARCIAL",
                     userId: user?.id 
                   });
                   if (res?.success && !res.canceled) {
                     toast.success("Arqueo Generado", { description: res.filePath });
                   }
                }}
              >
                Corte X
              </Button>

              <Button
                size="sm"
                className="h-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[10px] uppercase tracking-wider shadow-lg shadow-primary/10"
                onClick={async () => {
                   const today = new Date().toISOString().split("T")[0];
                   const res = await window.electronAPI?.generateZReportPdf({ 
                     dateString: today, 
                     title: "CORTE Z - CIERRE DE CAJA",
                     userId: user?.id 
                   });
                   if (res?.success && !res.canceled) {
                     toast.success("Cierre Generado", { description: res.filePath });
                   }
                }}
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Corte Z
              </Button>
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
              description="El porcentaje de cada venta que es pura ganancia."
              icon={TrendingUp}
              variant="violet"
              trend={range !== 'today' ? "Analítica de período" : "Basado en ventas de hoy"}
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
            <div className="lg:col-span-2 flex flex-col gap-4 border rounded-2xl bg-card p-6 shadow-sm">
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
                <ProfitChart data={profitStats.dailyData} />
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl border border-dashed italic text-sm">
                  No hay datos suficientes para graficar este período
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
                {/* Resumen de Caja Hoy (Solo si range es hoy) */}
                <Card className="border-none shadow-none bg-transparent space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground/80">Flujo de Caja (Cierre)</h2>
                  
                  <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-primary/70">Efectivo en Caja</span>
                      <HandCoins className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-3xl font-black text-primary tracking-tighter">{formatCurrency(stats.cashTotal)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mt-1">Suma total de billetes y monedas</p>
                    </div>
                  </div>

                  <div className="bg-card border rounded-2xl p-5 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold uppercase text-muted-foreground">Vouchers Tarjeta</span>
                      <CreditCard className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-2xl font-black tracking-tighter">{formatCurrency(stats.cardTotal)}</p>
                      <p className="text-[10px] font-bold text-muted-foreground/60 uppercase mt-1">Dinero en cuenta bancaria</p>
                    </div>
                  </div>
                </Card>

                {/* Arqueo de Tickets (Fase 12.2) */}
                <div className="border rounded-2xl bg-card p-5 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">Eficiencia Operativa</p>
                  <div className="flex items-end gap-2 mb-4">
                    <span className="text-4xl font-black tracking-tighter">{stats.orderCount}</span>
                    <span className="text-[10px] pb-1.5 font-black uppercase text-muted-foreground/70">ventas hoy</span>
                  </div>
                  
                  {stats.orderCount > 0 ? (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                          <span>Mix de Cobro</span>
                          <span>{Math.round((stats.cashTotal / (stats.totalWithTax || 1)) * 100)}% Efectivo</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${Math.round((stats.cashTotal / (stats.totalWithTax || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-1.5 w-full bg-muted rounded-full" />
                  )}
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

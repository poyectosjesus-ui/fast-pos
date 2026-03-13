"use client";

/**
 * Dashboard de Analítica Reales
 *
 * FUENTE DE VERDAD: analitica_plan.md — Fase 4.1, 4.2 y 4.3
 *
 * Tablero maestro de la aplicación para que el jefe y el cajero monitoreen el pulso del día.
 * Rendimiento extremo garantizado por IndexedDB.
 */

import { useState, useEffect, useCallback } from "react";
import { Coins, HandCoins, ReceiptText, Users, CreditCard } from "lucide-react";


import { OrderService } from "@/lib/services/orders";
import { formatCurrency } from "@/lib/constants";
import { Sidebar } from "@/components/layout/sidebar";
import { MetricCard } from "./_components/metric-card";
import { TopProducts } from "./_components/top-products";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalNet: 0,
    totalWithTax: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderCount: 0,
    avgTicket: 0,
    todayOrders: [] as Array<{ items: Array<{ productId: string; name: string; quantity: number; subtotal: number }> }>
  });

  const [topProducts, setTopProducts] = useState<Array<{ productId: string; name: string; unitsSold: number; revenue: number; currentStock: number }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const currentStats = await OrderService.getStatsForDay();
      setStats(currentStats);
      const top = await OrderService.getTopProducts(currentStats.todayOrders, 5);
      setTopProducts(top);
    } catch (error) {
      console.error("Error cargando analíticas:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Carga inicial + refresco automático cada 30s
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, [loadStats]);

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">El pulso de hoy</h1>
            <p className="text-sm text-muted-foreground">Resumen en tiempo real del desempeño de tus ventas</p>
          </div>
          {isLoading && (
            <span className="text-xs font-semibold text-primary animate-pulse">Calculando...</span>
          )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Fila 1: Métricas maestras (CA-4.1.1, CA-4.1.2) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MetricCard
              title="Venta Bruta"
              value={formatCurrency(stats.totalWithTax)}
              description="Todo el dinero que ha entrado, incluyendo el IVA. Es tu ingreso total."
              icon={Coins}
              variant="emerald"
            />
            <MetricCard
              title="Lo facturado (Sin IVA)"
              value={formatCurrency(stats.totalNet)}
              description="Lo que realmente te quedas después de descontar el 16% de impuestos."
              icon={ReceiptText}
              variant="blue"
            />
            <MetricCard
              title="Gasto por cliente"
              value={formatCurrency(stats.avgTicket)}
              description="En promedio, esto es lo que la gente gasta por cada ticket."
              icon={Users}
              variant="violet"
            />
          </div>

          {/* Fila 2: Arqueo de caja y Rankings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Columna Izquierda: Caja y Medios de pago */}
            <div className="flex flex-col gap-4">
              <h2 className="text-lg font-bold">Resumen de Caja</h2>
              
              <MetricCard
                title="Efectivo a entregar"
                value={formatCurrency(stats.cashTotal)}
                description="Billetes y monedas físicas que deberían estar físicamente en el cajón."
                icon={HandCoins}
                variant="amber"
              />
              
              <MetricCard
                title="Pagos con Tarjeta"
                value={formatCurrency(stats.cardTotal)}
                description="Dinero procesado por terminal bancaria (no está en la caja física)."
                icon={CreditCard}
                variant="blue"
              />

              {/* CA-4.1.4: Método de pago (mini gráfico visual) */}
              <div className="border rounded-xl bg-card p-5 mt-2 shadow-sm">
                <p className="text-sm font-medium text-muted-foreground mb-4">Flujo de clientes hoy</p>
                <div className="flex items-end gap-4 mb-2">
                  <span className="text-3xl font-black">{stats.orderCount}</span>
                  <span className="text-sm pb-1 font-medium text-muted-foreground">tickets generados</span>
                </div>
                
                {stats.orderCount > 0 ? (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-amber-600">Efectivo ({Math.round((stats.cashTotal / stats.totalWithTax) * 100)}%)</span>
                      <span className="text-blue-600">Tarjeta ({Math.round((stats.cardTotal / stats.totalWithTax) * 100)}%)</span>
                    </div>
                    <div className="h-3 w-full bg-blue-500 rounded-full overflow-hidden flex">
                      <div 
                        className="h-full bg-amber-500" 
                        style={{ width: `${Math.round((stats.cashTotal / stats.totalWithTax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="h-3 w-full bg-muted rounded-full mt-4" />
                )}
              </div>
            </div>

            {/* Columna Derecha: Top 5 */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <TopProducts products={topProducts} />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

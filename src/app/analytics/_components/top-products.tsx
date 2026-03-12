"use client";

/**
 * TopProducts — Componente Visual de Ranking
 *
 * FUENTE DE VERDAD: analitica_plan.md — Sección 4.2
 *
 * Cumple: CA-4.2.1 (Ranking visual), CA-4.2.3 (Alerta visual si stock es bajo)
 */

import { formatCurrency, LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopProductData {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  currentStock: number;
}

interface TopProductsProps {
  products: TopProductData[];
}

export function TopProducts({ products }: TopProductsProps) {
  if (!products || products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground border rounded-xl bg-card border-dashed">
        <TrendingUp className="h-10 w-10 mb-3 opacity-20" />
        <p className="text-sm font-medium">Aún no hay datos suficientes</p>
        <p className="text-xs mt-1 max-w-[200px]">Cobra algunas ventas para descubrir cuáles son tus artículos estrella.</p>
      </div>
    );
  }

  // Encontramos el máximo generado para calcular los porcentajes de la barra visual
  const maxRevenue = Math.max(...products.map((p) => p.revenue));

  return (
    <div className="flex flex-col gap-4 border rounded-xl bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold">El Rey de la tienda 👑</h3>
        <p className="text-sm text-muted-foreground">Tus 5 artículos más vendidos (por dinero generado)</p>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        {products.map((product, index) => {
          const percentage = Math.round((product.revenue / maxRevenue) * 100);
          const isLowStock = product.currentStock <= LOW_STOCK_THRESHOLD;
          const isOutOfStock = product.currentStock === 0;

          return (
            <div key={product.productId} className="flex flex-col gap-2">
              <div className="flex justify-between items-end gap-2 text-sm">
                <div className="flex items-center gap-2 truncate">
                  <span className="font-bold text-muted-foreground w-4">{index + 1}.</span>
                  <span className="font-semibold truncate">{product.name}</span>
                  
                  {/* CA-4.2.3: Alerta preventiva de stock bajo en el best-seller */}
                  {isOutOfStock ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      <AlertCircle className="h-3 w-3" /> ¡Agotado!
                    </span>
                  ) : isLowStock ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      Súrteme (Quedan {product.currentStock})
                    </span>
                  ) : null}
                </div>
                
                <div className="flex flex-col items-end shrink-0">
                  <span className="font-bold">{formatCurrency(product.revenue)}</span>
                  <span className="text-[10px] text-muted-foreground">{product.unitsSold} u. vendidas</span>
                </div>
              </div>

              {/* Barra de progreso visual (relativa al mejor vendido) */}
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    index === 0 ? "bg-amber-400 dark:bg-amber-500" : "bg-primary"
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

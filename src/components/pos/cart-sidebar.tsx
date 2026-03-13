/**
 * CART SIDEBAR — Fast-POS 2.0
 *
 * Responsabilidad: Panel lateral del carrito activo con desglose de IVA.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, EPIC-002 (desglose IVA)
 *
 * CA-3.2.4: Totales en tiempo real con IVA desglosado
 * CA-3.2.5: Botón Cobrar bloqueado si carrito vacío
 * CA-3.1.4: Quitar ítem o reducir cantidad
 * CA-3.3.1: Botón deshabilitado al procesar
 */

"use client";

import { useCartStore } from "@/store/useCartStore";
import { formatCents } from "@/lib/services/tax";
import { Minus, Plus, Trash2, ShoppingBag, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/constants";

interface CartSidebarProps {
  onCheckout: () => void;
  isProcessing: boolean;
}

export function CartSidebar({ onCheckout, isProcessing }: CartSidebarProps) {
  const { items, setQuantity, removeItem, getCartTotals } = useCartStore();
  const { subtotal, tax, total } = getCartTotals();

  // El +999 es el cap permisivo para el sidebar — la validación real de stock
  // ocurre atómicamente en el Main Process al confirmar el cobro.
  const getMaxStock = (_productId: string) => 999;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-sm font-medium text-muted-foreground">La cuenta está vacía</p>
        <p className="text-xs text-muted-foreground/70">
          Selecciona artículos del catálogo para agregarlos aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Lista de ítems */}
      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {items.map((item) => {
          const maxStock = getMaxStock(item.productId);
          return (
            <div key={item.productId} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/5 transition-colors">
              {/* Nombre y precio unitario */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.price)} c/u</p>
                {/* Badge mini de IVA */}
                {item.taxRate > 0 && (
                  <span className="inline-flex items-center gap-0.5 mt-1 text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                    <Receipt className="h-2.5 w-2.5" />
                    IVA {item.taxRate / 100}%{item.taxIncluded ? " incl." : " +"}
                  </span>
                )}
              </div>

              {/* Controles de cantidad */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setQuantity(item.productId, item.quantity - 1, maxStock)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold w-5 text-center">{item.quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary"
                  onClick={() => setQuantity(item.productId, item.quantity + 1, maxStock)}
                  disabled={item.quantity >= maxStock}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Subtotal del ítem + botón eliminar */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-bold text-primary">{formatCurrency(item.subtotal)}</span>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen de totales con desglose de IVA (EPIC-002) */}
      <div className="border-t bg-card/50 p-4 space-y-3">
        <div className="space-y-1.5 text-sm">
          {/* Subtotal sin IVA */}
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal (sin IVA)</span>
            <span className="font-mono">{formatCents(subtotal)}</span>
          </div>
          {/* IVA — solo mostrar si hay impuesto */}
          {tax > 0 && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>IVA</span>
              <span className="font-mono font-bold">+{formatCents(tax)}</span>
            </div>
          )}
          <Separator className="my-1" />
          {/* Total final */}
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-primary font-mono">{formatCents(total)}</span>
          </div>
        </div>

        {/* Botón Cobrar — CA-3.2.5 y CA-3.3.1 */}
        <Button
          className="w-full h-12 text-base font-bold"
          onClick={onCheckout}
          disabled={items.length === 0 || isProcessing}
        >
          {isProcessing ? "Procesando..." : `Cobrar ${formatCents(total)}`}
        </Button>
      </div>
    </div>
  );
}

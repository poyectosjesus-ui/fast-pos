"use client";

/**
 * CartSidebar — Panel Lateral del Carrito Activo
 *
 * FUENTE DE VERDAD: motor_ventas_plan.md — Sección 3.2 y 3.1
 *
 * Cumple: CA-3.2.4 (totales en tiempo real), CA-3.2.5 (botón Cobrar bloqueado si vacío),
 * CA-3.1.4 (quitar ítem o reducir cantidad), CA-3.3.1 (botón deshabilitado al procesar).
 */

import { useCartStore } from "@/store/useCartStore";
import { formatCurrency, calcTax } from "@/lib/constants";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

interface CartSidebarProps {
  onCheckout: () => void;
  isProcessing: boolean;
}

export function CartSidebar({ onCheckout, isProcessing }: CartSidebarProps) {
  const { items, setQuantity, removeItem } = useCartStore();

  // Obtenemos el stock actual de la DB para validar sobre-venta en tiempo real (CA-3.1.3)
  const products = useLiveQuery(() => db.products.toArray(), []);
  const getStock = (productId: string) =>
    products?.find(p => p.id === productId)?.stock ?? 0;

  // Totales calculados en centavos usando las funciones centralizadas (constants.ts)
  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
  const tax = calcTax(subtotal);
  const total = subtotal + tax;

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
          const maxStock = getStock(item.productId);
          return (
            <div key={item.productId} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/5 transition-colors">
              {/* Nombre y precio unitario */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.price)} c/u</p>
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

      {/* Resumen de totales y botón de cobro */}
      <div className="border-t bg-card/50 p-4 space-y-3">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>IVA (16%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* CA-3.2.5: Botón bloqueado si carrito vacío. CA-3.3.1: Bloqueado si procesando */}
        <Button
          className="w-full h-12 text-base font-bold"
          onClick={onCheckout}
          disabled={items.length === 0 || isProcessing}
        >
          {isProcessing ? "Procesando..." : `Cobrar ${formatCurrency(total)}`}
        </Button>
      </div>
    </div>
  );
}

/**
 * CART SIDEBAR — Fast-POS 2.0
 *
 * Responsabilidad: Panel lateral del carrito activo con desglose de IVA.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, EPIC-002 (desglose IVA)
 *
 * Sprint-1 — Motor de Descuentos:
 *   - E1.UI: Reemplaza prompt() nativo con inline discount panel premium.
 *   - Modos: porcentaje (%), monto fijo ($), precio final personalizado.
 *   - Descuento sobre total del carrito (setCartDiscount).
 *
 * CA-3.2.4: Totales en tiempo real con IVA desglosado
 * CA-3.2.5: Botón Cobrar bloqueado si carrito vacío
 * CA-3.1.4: Quitar ítem o reducir cantidad
 * CA-3.3.1: Botón deshabilitado al procesar
 */

"use client";

import { useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import { formatCents } from "@/lib/services/tax";
import {
  Minus, Plus, Trash2, ShoppingBag, Receipt, Scale, Tag, X, Check,
  Percent, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CartSidebarProps {
  onCheckout: () => void;
  isProcessing: boolean;
  allowNegativeStock?: boolean;
}

/** Tipo de modo de descuento por ítem */
type DiscountMode = "percent" | "amount" | "final";

/** Panel inline de descuento que aparece al presionar el Tag en un ítem */
function ItemDiscountPanel({
  item,
  onClose,
}: {
  item: { productId: string; price: number; quantity: number; discountAmount: number };
  onClose: () => void;
}) {
  const { setItemDiscount } = useCartStore();
  const [mode, setMode] = useState<DiscountMode>("percent");
  const [inputVal, setInputVal] = useState("");

  const originalTotal = item.price * item.quantity; // centavos

  const handleApply = () => {
    const num = parseFloat(inputVal);
    if (isNaN(num) || num < 0) { onClose(); return; }

    let discCents = 0;
    if (mode === "percent") {
      discCents = Math.round(originalTotal * (Math.min(num, 100) / 100));
    } else if (mode === "amount") {
      discCents = Math.min(Math.round(num * 100), originalTotal);
    } else {
      // precio final -> discount = original - finalPrice
      const finalCents = Math.round(num * 100);
      discCents = Math.max(0, originalTotal - finalCents);
    }

    setItemDiscount(item.productId, discCents);
    onClose();
  };

  const handleClear = () => {
    setItemDiscount(item.productId, 0);
    onClose();
  };

  const placeholder =
    mode === "percent" ? "ej: 10" :
    mode === "amount"  ? `ej: ${formatCurrency(originalTotal * 0.1)}` :
                          `ej: ${formatCurrency(originalTotal * 0.9)}`;

  return (
    <div className="mt-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
      {/* Selector de modo */}
      <div className="flex gap-1">
        {([
          { id: "percent" as DiscountMode, label: "%",     Icon: Percent   },
          { id: "amount"  as DiscountMode, label: "$",     Icon: DollarSign },
          { id: "final"   as DiscountMode, label: "Precio", Icon: Tag       },
        ] as const).map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => { setMode(id); setInputVal(""); }}
            className={cn(
              "flex-1 flex items-center justify-center gap-0.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-all",
              mode === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-2.5 w-2.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex gap-1">
        <Input
          type="number"
          min="0"
          step="any"
          autoFocus
          placeholder={placeholder}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleApply(); if (e.key === "Escape") onClose(); }}
          className="h-7 text-sm"
        />
        <button
          onClick={handleApply}
          className="h-7 w-7 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={handleClear}
          className="h-7 w-7 flex items-center justify-center rounded bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Hint del modo actual */}
      <p className="text-[10px] text-muted-foreground">
        {mode === "percent" && "Porcentaje de descuento (0–100%)"}
        {mode === "amount"  && "Monto fijo a descontar"}
        {mode === "final"   && "Precio final para este ítem"}
      </p>
    </div>
  );
}

export function CartSidebar({ onCheckout, isProcessing, allowNegativeStock = false }: CartSidebarProps) {
  const { items, setQuantity, setItemDiscount, removeItem, getCartTotals, setCartDiscount, cartDiscountAmount } = useCartStore();
  const { subtotal, tax, total } = getCartTotals();
  const [openDiscountFor, setOpenDiscountFor] = useState<string | null>(null);
  const [cartDiscountInput, setCartDiscountInput] = useState("");
  const [cartDiscountMode, setCartDiscountMode] = useState<DiscountMode>("percent");
  const [showCartDiscount, setShowCartDiscount] = useState(false);

  // El +999 es el cap permisivo para el sidebar — la validación real de stock
  // ocurre atómicamente en el Main Process al confirmar el cobro.
  const getMaxStock = (_productId: string) => 999;

  const totalItemDiscounts = items.reduce((acc, i) => acc + (i.discountAmount || 0), 0);

  const applyCartDiscount = () => {
    const num = parseFloat(cartDiscountInput);
    if (isNaN(num) || num < 0) { setShowCartDiscount(false); return; }
    const rawTotal = total + (cartDiscountAmount ?? 0); // total antes del descuento global
    let discCents = 0;
    if (cartDiscountMode === "percent") {
      discCents = Math.round(rawTotal * (Math.min(num, 100) / 100));
    } else if (cartDiscountMode === "amount") {
      discCents = Math.min(Math.round(num * 100), rawTotal);
    } else {
      discCents = Math.max(0, rawTotal - Math.round(num * 100));
    }
    setCartDiscount(discCents);
    setShowCartDiscount(false);
    setCartDiscountInput("");
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
        <ShoppingBag className="h-12 w-12 text-muted-foreground/20" />
        <p className="text-sm font-medium text-muted-foreground">Aún no hay artículos</p>
        <p className="text-xs text-muted-foreground/70">
          Busca un producto y agrégalo para cobrar.
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
          const isDiscountOpen = openDiscountFor === item.productId;
          return (
            <div key={item.productId} className="p-3 rounded-lg border bg-card hover:bg-muted/5 transition-colors">
              <div className="flex items-start gap-3">
                {/* Nombre, precio y badges */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(item.price)} c/u</p>
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    {/* Badge de IVA */}
                    {item.taxRate > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        <Receipt className="h-2.5 w-2.5" />
                        IVA {item.taxRate / 100}%{item.taxIncluded ? " incl." : " +"}
                      </span>
                    )}
                    {/* Badge de unidad (fraccionable) */}
                    {item.allowFractions && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                        <Scale className="h-2.5 w-2.5" />
                        {item.unitType}
                      </span>
                    )}
                    {/* Badge de descuento aplicado */}
                    {item.discountAmount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                        <Tag className="h-2.5 w-2.5" />
                        -{formatCurrency(item.discountAmount)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Controles de cantidad */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.allowFractions ? (
                    // Selector libre para venta a granel (decimales)
                    <div className="flex items-center">
                      <div className="relative w-24 border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary">
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          className="h-8 pr-1 text-center font-bold border-0 shadow-none focus-visible:ring-0 px-1 py-0 text-sm"
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) setQuantity(item.productId, val, maxStock, allowNegativeStock);
                          }}
                          onBlur={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setQuantity(item.productId, val, maxStock, allowNegativeStock);
                          }}
                        />
                        <div className="absolute right-1 top-0 h-full flex items-center justify-center text-[10px] text-muted-foreground mr-1">
                          <Scale className="h-3 w-3" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Botonera de incrementos +1 -1 para ítems unitarios (piezas)
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0"
                        onClick={() => setQuantity(item.productId, item.quantity - 1, maxStock, allowNegativeStock)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="text-sm font-bold w-5 text-center shrink-0">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary shrink-0"
                        onClick={() => setQuantity(item.productId, item.quantity + 1, maxStock, allowNegativeStock)}
                        disabled={!allowNegativeStock && item.quantity >= maxStock}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Subtotal del ítem + botones */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {item.discountAmount > 0 ? (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-bold text-muted-foreground line-through decoration-1">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-primary">{formatCurrency(item.subtotal)}</span>
                  )}

                  <div className="flex gap-1">
                    {/* Botón descuento — abre panel inline */}
                    <button
                      onClick={() => setOpenDiscountFor(isDiscountOpen ? null : item.productId)}
                      className={cn(
                        "p-1 rounded-sm hover:bg-muted transition-colors",
                        item.discountAmount > 0 || isDiscountOpen
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground"
                      )}
                      title="Aplicar Descuento (%, $, precio)"
                    >
                      <Tag className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => { removeItem(item.productId); if (isDiscountOpen) setOpenDiscountFor(null); }}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel inline de descuento — se expande bajo el ítem */}
              {isDiscountOpen && (
                <ItemDiscountPanel
                  item={item}
                  onClose={() => setOpenDiscountFor(null)}
                />
              )}
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
          {/* Descuentos por ítem */}
          {totalItemDiscounts > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Descuentos por ítem</span>
              <span className="font-mono font-bold">-{formatCents(totalItemDiscounts)}</span>
            </div>
          )}
          {/* Descuento global del carrito */}
          {(cartDiscountAmount ?? 0) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Descuento total</span>
              <span className="font-mono font-bold">-{formatCents(cartDiscountAmount ?? 0)}</span>
            </div>
          )}
          {/* IVA — solo mostrar si hay impuesto */}
          {tax > 0 && (
            <div className="flex justify-between text-muted-foreground">
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

        {/* Descuento global sobre el carrito */}
        {showCartDiscount ? (
          <div className="space-y-2 p-2.5 rounded-lg border border-primary/30 bg-primary/5 animate-in fade-in duration-150">
            <div className="flex gap-1">
              {([
                { id: "percent" as DiscountMode, label: "%" },
                { id: "amount"  as DiscountMode, label: "$" },
                { id: "final"   as DiscountMode, label: "Total final" },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => { setCartDiscountMode(id); setCartDiscountInput(""); }}
                  className={cn(
                    "flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide",
                    cartDiscountMode === id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >{label}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <Input
                type="number"
                min="0"
                step="any"
                autoFocus
                placeholder={cartDiscountMode === "percent" ? "Ej: 5" : cartDiscountMode === "amount" ? "Ej: 50" : "Total final"}
                value={cartDiscountInput}
                onChange={(e) => setCartDiscountInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") applyCartDiscount(); if (e.key === "Escape") setShowCartDiscount(false); }}
                className="h-7 text-sm"
              />
              <button onClick={applyCartDiscount} className="h-7 w-7 flex items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { setCartDiscount(0); setShowCartDiscount(false); }} className="h-7 w-7 flex items-center justify-center rounded bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCartDiscount(true)}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-primary py-1 rounded-md hover:bg-primary/5 transition-colors"
          >
            <Tag className="h-3 w-3" />
            Descuento sobre el total del carrito
          </button>
        )}

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

/**
 * CHECKOUT DIALOG — Fast-POS 2.0
 *
 * Responsabilidad: Modal de cobro con desglose de IVA, campo de efectivo y ticket de venta.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, EPIC-002 (desglose IVA)
 *
 * CA-3.3.1: Deshabilitar al procesar (evitar doble envío)
 * CA-3.3.3: Selector de método de pago (Efectivo / Tarjeta)
 * CA-3.3.4: Cálculo de cambio en efectivo
 * CA-3.4.1–3.4.3: Ticket digital con opción de impresión y nueva venta
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Banknote, CreditCard, Printer, RotateCcw } from "lucide-react";

import { OrderService } from "@/lib/services/orders";
import { Order } from "@/lib/schema";
import { useCartStore } from "@/store/useCartStore";
import { formatCents } from "@/lib/services/tax";
import { BUSINESS_NAME } from "@/lib/constants";
import { PrintTicketButton } from "@/components/pos/PrintTicketButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
}

type PaymentMethod = "CASH" | "CARD";
type Step = "payment" | "ticket";

export function CheckoutDialog({ open, onClose }: CheckoutDialogProps) {
  const { items, clearCart, getCartTotals } = useCartStore();
  const { subtotal, tax, total } = getCartTotals();

  const [step, setStep] = useState<Step>("payment");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountPaidStr, setAmountPaidStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // CA-3.3.4: Calcular cambio solo aplica en efectivo
  const amountPaidCents = Math.round(parseFloat(amountPaidStr || "0") * 100);
  const changeCents = amountPaidCents - total;
  const isCashValid = paymentMethod === "CARD" || amountPaidCents >= total;

  const handleConfirmPayment = async () => {
    if (!isCashValid) {
      toast.error("Monto insuficiente", {
        description: `El cliente debe dar al menos ${formatCents(total)}. Recibiste ${formatCents(amountPaidCents)}.`,
      });
      return;
    }

    // CA-3.3.1: Deshabilitar para evitar doble envío
    setIsProcessing(true);
    try {
      const result = await OrderService.checkout({ items, paymentMethod });

      if (!result.success || !result.order) {
        toast.error("No pudimos procesar el cobro", { description: result.error, duration: 6000 });
        return;
      }

      // CA-3.1.5: Limpiar el carrito tras éxito
      clearCart();
      setCompletedOrder(result.order);
      setStep("ticket");

      // Auto-imprimir ticket
      const api = typeof window !== "undefined" ? (window as unknown as { electronAPI?: any }).electronAPI : null;
      if (api) {
        try {
          const settings = await api.getAllSettings();
          const sMap = settings.success ? (settings.config || {}) : {};
          const printerName = sMap["receiptPrinter"] || null;
          await api.printTicket(result.order.id, printerName, true);
        } catch (err) {
          console.error("Fallo auto-impresión:", err);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewSale = () => {
    // CA-3.4.3: Nueva venta — resetear estado interno del modal
    setStep("payment");
    setPaymentMethod("CASH");
    setAmountPaidStr("");
    setCompletedOrder(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { 
      // Si estamos en la pantalla del ticket, NO permitir que clics fuera del modal o ESC lo cierren.
      // Así forzamos a que lean el ticket y le den a "Nueva Venta".
      if (!o && step === "payment") {
        onClose(); 
      }
    }}>
      <DialogContent className="sm:max-w-md">
        {step === "payment" ? (
          <>
            <DialogHeader>
              <DialogTitle>Cobrar venta</DialogTitle>
              <DialogDescription>
                Confirma el método y el monto recibido para cerrar esta cuenta.
              </DialogDescription>
            </DialogHeader>

            {/* Selección de método de pago (CA-3.3.3) */}
            <div className="grid grid-cols-2 gap-3 my-2">
              <button
                onClick={() => setPaymentMethod("CASH")}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  paymentMethod === "CASH"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <Banknote className="h-6 w-6" />
                <span className="text-sm font-semibold">Efectivo</span>
              </button>
              <button
                onClick={() => { setPaymentMethod("CARD"); setAmountPaidStr(""); }}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                  paymentMethod === "CARD"
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <CreditCard className="h-6 w-6" />
                <span className="text-sm font-semibold">Tarjeta</span>
              </button>
            </div>

            {/* Campo de monto pagado (solo en efectivo) — CA-3.3.4 */}
            {paymentMethod === "CASH" && (
              <div className="space-y-2">
                <Label htmlFor="amount">¿Cuánto te dio el cliente?</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-medium">$</span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min={total / 100}
                    placeholder={(total / 100).toFixed(2)}
                    className="pl-7"
                    value={amountPaidStr}
                    onChange={(e) => setAmountPaidStr(e.target.value)}
                  />
                </div>
                {amountPaidCents >= total && amountPaidCents > 0 && (
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    Cambio: {formatCents(changeCents)}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Resumen de totales con desglose de IVA — EPIC-002 */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (sin IVA)</span>
                <span className="font-mono">{formatCents(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>IVA</span>
                  <span className="font-mono font-bold">+{formatCents(tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total a cobrar</span>
                <span className="text-primary font-mono">{formatCents(total)}</span>
              </div>
            </div>

            <Button
              className="w-full h-11 mt-2"
              onClick={handleConfirmPayment}
              disabled={isProcessing || !isCashValid}
            >
              <Check className="h-4 w-4 mr-2" />
              {isProcessing ? "Procesando de forma segura..." : "Confirmar Cobro"}
            </Button>
          </>
        ) : (
          /* TICKET — CA-3.4.1, CA-3.4.2, CA-3.4.3 */
          <div className="space-y-4" id="print-ticket">
            <DialogHeader>
              <DialogTitle className="text-center text-lg">{BUSINESS_NAME}</DialogTitle>
              <DialogDescription className="text-center">
                {new Date(completedOrder!.createdAt).toLocaleString("es-MX")}
              </DialogDescription>
            </DialogHeader>

            <Separator />

            <div className="space-y-2 text-sm">
              {completedOrder!.items.map((item, i) => (
                <div key={i} className="flex justify-between">
                  <span className="flex-1 truncate pr-2">{item.name} × {item.quantity}</span>
                  <span className="font-medium">{formatCents(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <Separator />

            {/* Totales del ticket con IVA */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (sin IVA)</span>
                <span className="font-mono">{formatCents(completedOrder!.subtotal)}</span>
              </div>
              {completedOrder!.tax > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>IVA</span>
                  <span className="font-mono">+{formatCents(completedOrder!.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary font-mono">{formatCents(completedOrder!.total)}</span>
              </div>
              {paymentMethod === "CASH" && changeCents > 0 && (
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Cambio entregado</span>
                  <span className="font-mono">{formatCents(changeCents)}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <PrintTicketButton orderId={completedOrder!.id} />
              
              <Button className="w-full h-11" onClick={handleNewSale}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Nueva Venta
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

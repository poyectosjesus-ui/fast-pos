"use client";

/**
 * CheckoutDialog — Modal de Cobro y Ticket de Venta
 *
 * FUENTE DE VERDAD: motor_ventas_plan.md — Secciones 3.3 y 3.4
 *
 * Cumple: CA-3.3.1 a CA-3.3.5, CA-3.4.1 a CA-3.4.3
 */

import { useState } from "react";
import { toast } from "sonner";
import { Check, Banknote, CreditCard, Printer, RotateCcw } from "lucide-react";

import { OrderService } from "@/lib/services/orders";
import { Order } from "@/lib/schema";
import { useCartStore } from "@/store/useCartStore";
import { formatCurrency, calcTax, BUSINESS_NAME } from "@/lib/constants";

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
  const { items, clearCart } = useCartStore();

  // Totales calculados centralizados (constants.ts)
  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
  const tax = calcTax(subtotal);
  const total = subtotal + tax;

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
        description: `El cliente debe dar al menos ${formatCurrency(total)}. Recibiste ${formatCurrency(amountPaidCents)}.`,
      });
      return;
    }

    // CA-3.3.1: Deshabilitar para evitar doble envío
    setIsProcessing(true);
    try {
      const result = await OrderService.checkout({ items, paymentMethod });

      if (!result.success || !result.order) {
        // CA-3.3.2: Mostrar el error semántico del servicio directamente al cajero
        toast.error("No pudimos procesar el cobro", { description: result.error, duration: 6000 });
        return;
      }

      // CA-3.1.5: Limpiar el carrito tras éxito
      clearCart();
      setCompletedOrder(result.order);
      setStep("ticket");
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && step === "payment") onClose(); }}>
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
                {amountPaidCents >= total && (
                  <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    Cambio: {formatCurrency(changeCents)}
                  </p>
                )}
              </div>
            )}

            <Separator />

            {/* Resumen de totales */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA (16%)</span><span>{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total a cobrar</span>
                <span className="text-primary">{formatCurrency(total)}</span>
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
                  <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(completedOrder!.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>IVA</span><span>{formatCurrency(completedOrder!.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(completedOrder!.total)}</span>
              </div>
              {paymentMethod === "CASH" && changeCents > 0 && (
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Cambio entregado</span>
                  <span>{formatCurrency(changeCents)}</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
              <Button className="flex-1" onClick={handleNewSale}>
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

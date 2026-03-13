/**
 * CHECKOUT DIALOG — Fast-POS 2.0
 *
 * Responsabilidad: Modal de cobro con desglose de IVA, campo de efectivo,
 *   selector de método de pago multicanal y ticket de venta.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, EPIC-002 (IVA), EPIC-008 (Flexibilidad)
 *
 * CA-3.3.1: Deshabilitar al procesar (evitar doble envío)
 * CA-3.3.3: Selector de método de pago (Efectivo / Tarjeta / Transferencia / WhatsApp / Otro)
 * CA-3.3.4: Cálculo de cambio en efectivo
 * CA-3.3.5: Campo de origen de venta (LOCAL / ONLINE)
 * CA-3.4.1–3.4.3: Ticket digital con opción de impresión y nueva venta
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Check, Banknote, CreditCard, Printer, RotateCcw,
  ArrowLeftRight, MessageCircle, Globe, HelpCircle,
  Store, Wifi
} from "lucide-react";

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
import { cn } from "@/lib/utils";

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
}

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "WHATSAPP" | "ONLINE" | "OTHER";
type SaleSource = "LOCAL" | "ONLINE";
type Step = "payment" | "ticket";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ReactNode; requiresAmount: boolean; color: string }[] = [
  {
    id: "CASH",
    label: "Efectivo",
    icon: <Banknote className="h-5 w-5" />,
    requiresAmount: true,
    color: "emerald",
  },
  {
    id: "CARD",
    label: "Tarjeta",
    icon: <CreditCard className="h-5 w-5" />,
    requiresAmount: false,
    color: "blue",
  },
  {
    id: "TRANSFER",
    label: "Transferencia",
    icon: <ArrowLeftRight className="h-5 w-5" />,
    requiresAmount: false,
    color: "violet",
  },
  {
    id: "WHATSAPP",
    label: "WhatsApp",
    icon: <MessageCircle className="h-5 w-5" />,
    requiresAmount: false,
    color: "green",
  },
  {
    id: "ONLINE",
    label: "En Línea",
    icon: <Globe className="h-5 w-5" />,
    requiresAmount: false,
    color: "sky",
  },
  {
    id: "OTHER",
    label: "Otro",
    icon: <HelpCircle className="h-5 w-5" />,
    requiresAmount: false,
    color: "orange",
  },
];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia Bancaria",
  WHATSAPP: "Pago WhatsApp",
  ONLINE: "Pago en Línea",
  OTHER: "Otro método",
};

export function CheckoutDialog({ open, onClose }: CheckoutDialogProps) {
  const { items, clearCart, getCartTotals } = useCartStore();
  const { subtotal, tax, total } = getCartTotals();

  const [step, setStep] = useState<Step>("payment");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [saleSource, setSaleSource] = useState<SaleSource>("LOCAL");
  const [amountPaidStr, setAmountPaidStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  const currentMethodDef = PAYMENT_METHODS.find(m => m.id === paymentMethod)!;
  const requiresAmount = currentMethodDef.requiresAmount;

  // CA-3.3.4: Calcular cambio solo aplica en efectivo
  const amountPaidCents = Math.round(parseFloat(amountPaidStr || "0") * 100);
  const changeCents = amountPaidCents - total;
  const isCashValid = !requiresAmount || amountPaidCents >= total;

  const handleConfirmPayment = async () => {
    if (!isCashValid) {
      toast.error("Monto insuficiente", {
        description: `El cliente debe dar al menos ${formatCents(total)}. Recibiste ${formatCents(amountPaidCents)}.`,
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await OrderService.checkout({ items, paymentMethod, source: saleSource });

      if (!result.success || !result.order) {
        toast.error("No pudimos procesar el cobro", { description: result.error, duration: 6000 });
        return;
      }

      clearCart();
      setCompletedOrder(result.order);
      setStep("ticket");

      // Auto-imprimir ticket (solo ventas locales, no en línea)
      if (saleSource === "LOCAL") {
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
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewSale = () => {
    setStep("payment");
    setPaymentMethod("CASH");
    setSaleSource("LOCAL");
    setAmountPaidStr("");
    setCompletedOrder(null);
    onClose();
  };

  const billDenominations = [50, 100, 200, 500, 1000];
  const suggestedBills = billDenominations.filter(b => b > total / 100).slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o && step === "payment") onClose();
    }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {step === "payment" ? (
          <>
            <DialogHeader>
              <DialogTitle>Cobrar venta</DialogTitle>
              <DialogDescription>
                Elige el método de cobro y confirma la cantidad recibida.
              </DialogDescription>
            </DialogHeader>

            {/* Origen de la Venta — LOCAL o ONLINE */}
            <div className="flex items-center gap-2 p-1 rounded-lg border bg-muted/30">
              <button
                onClick={() => setSaleSource("LOCAL")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-all",
                  saleSource === "LOCAL"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Store className="h-4 w-4" />
                Mostrador
              </button>
              <button
                onClick={() => setSaleSource("ONLINE")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-semibold transition-all",
                  saleSource === "ONLINE"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Wifi className="h-4 w-4" />
                En Línea
              </button>
            </div>

            {/* Selector de Método de Pago (CA-3.3.3) */}
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => {
                    setPaymentMethod(method.id);
                    if (!method.requiresAmount) setAmountPaidStr("");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
                    paymentMethod === method.id
                      ? "border-primary bg-primary/8 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/30 hover:border-muted-foreground/30"
                  )}
                >
                  {method.icon}
                  <span className="text-[11px] font-bold leading-tight">{method.label}</span>
                </button>
              ))}
            </div>

            {/* Campo de monto pagado (solo en efectivo) — CA-3.3.4 */}
            {requiresAmount && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="font-bold text-muted-foreground uppercase text-xs tracking-wider">
                    ¿Cuánto te dio el cliente?
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-muted-foreground font-bold text-lg">$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min={total / 100}
                      placeholder={(total / 100).toFixed(2)}
                      className="pl-8 h-14 text-2xl font-black bg-muted/30 focus:bg-background"
                      value={amountPaidStr}
                      onChange={(e) => setAmountPaidStr(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Atajos Rápidos */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-muted/40 font-bold"
                    onClick={() => setAmountPaidStr((total / 100).toString())}
                  >
                    Monto Exacto
                  </Button>
                  {suggestedBills.map((bill) => (
                    <Button
                      key={bill}
                      variant="outline"
                      size="sm"
                      className="flex-1 font-bold text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-400 hover:bg-emerald-100"
                      onClick={() => setAmountPaidStr(bill.toString())}
                    >
                      ${bill}
                    </Button>
                  ))}
                </div>

                {/* Banner de Cambio / Faltante */}
                <div className={cn(
                  "p-4 rounded-xl border-2 flex items-center justify-between transition-colors",
                  amountPaidStr === ""
                    ? "bg-muted/30 border-dashed border-border"
                    : amountPaidCents >= total
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive text-destructive"
                )}>
                  <span className="font-black tracking-widest uppercase text-sm">
                    {amountPaidStr === ""
                      ? "Esperando pago..."
                      : amountPaidCents >= total
                      ? "Su Cambio"
                      : "Falta dinero"}
                  </span>
                  <span className="font-mono text-xl font-black">
                    {amountPaidStr === ""
                      ? "$ 0.00"
                      : amountPaidCents >= total
                      ? formatCents(changeCents)
                      : formatCents(total - amountPaidCents)}
                  </span>
                </div>
              </div>
            )}

            {/* Aviso para métodos sin efectivo */}
            {!requiresAmount && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-dashed">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {currentMethodDef.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold">{PAYMENT_METHOD_LABELS[paymentMethod]}</p>
                  <p className="text-xs text-muted-foreground">
                    {saleSource === "ONLINE"
                      ? "Venta registrada como pedido en línea."
                      : "El pago se realizará directamente, sin necesidad de calcular cambio."}
                  </p>
                </div>
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

            {/* Método de pago */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-2">
              {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.icon}
              <span>{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
              {saleSource === "ONLINE" && (
                <span className="ml-auto flex items-center gap-1 text-sky-600 dark:text-sky-400 font-semibold">
                  <Wifi className="h-3 w-3" /> En Línea
                </span>
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

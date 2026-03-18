/**
 * CHECKOUT DIALOG — Fast-POS 2.0
 *
 * Responsabilidad: Modal de cobro con desglose de IVA, campo de efectivo,
 *   selector de método de pago y selector de canal de venta.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, EPIC-002 (IVA)
 *
 * Sprint-1 E1: Descuentos por ítem y global se calculan en CartStore/getCartTotals
 * Sprint-1 E2: Selector de canal — COUNTER|WHATSAPP|INSTAGRAM|OTHER
 *
 * CA-3.3.1: Deshabilitar al procesar (evitar doble envío)
 * CA-3.3.3: Selector de método de pago (Efectivo / Tarjeta / Transferencia / Otro)
 * CA-3.3.4: Cálculo de cambio en efectivo
 * CA-3.4.1–3.4.3: Ticket digital con opción de impresión y nueva venta
 */

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Check, Banknote, CreditCard, Printer, RotateCcw,
  ArrowLeftRight, HelpCircle, UserRoundCheck, PlusCircle
} from "lucide-react";

import { OrderService } from "@/lib/services/orders";
import { Order } from "@/lib/schema";
import { useCartStore } from "@/store/useCartStore";
import { useSessionStore } from "@/store/useSessionStore";
import { formatCents } from "@/lib/services/tax";
import { BUSINESS_NAME } from "@/lib/constants";
import { PrintTicketButton } from "@/components/pos/PrintTicketButton";
import { useSaleChannels, type SaleSource } from "@/hooks/useSaleChannels";
import { CustomerService, type Customer } from "@/lib/services/customers";

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
import { KbdBadge } from "@/components/ui/kbd-badge";

interface CheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT" | "OTHER";
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
    label: "Transfer",
    icon: <ArrowLeftRight className="h-5 w-5" />,
    requiresAmount: false,
    color: "violet",
  },
  {
    id: "CREDIT",
    label: "Fiado",
    icon: <UserRoundCheck className="h-5 w-5" />,
    requiresAmount: false,
    color: "amber",
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
  CREDIT: "Fiado a Cliente",
  OTHER: "Otro método",
};

export function CheckoutDialog({ open, onClose, onSuccess }: CheckoutDialogProps) {
  const { items, clearCart, getCartTotals } = useCartStore();
  const { user } = useSessionStore();
  const { subtotal, tax, total } = getCartTotals();
  // Sprint-1 E2: Canales configurables desde Settings
  const { channels: saleChannels, defaultChannel } = useSaleChannels();

  const [step, setStep] = useState<Step>("payment");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [saleSource, setSaleSource] = useState<SaleSource>("COUNTER");
  const [amountPaidStr, setAmountPaidStr] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // Módulo de clientes fiados
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  // Sincronizar canal por defecto cuando se cargan las settings
  useEffect(() => {
    setSaleSource(defaultChannel);
  }, [defaultChannel]);

  useEffect(() => {
    if (paymentMethod === "CREDIT") {
      CustomerService.getAll().then(setCustomers);
    }
  }, [paymentMethod]);

  // Escuchar evento mágico del Master Listener (Fast-Key)
  useEffect(() => {
    const handleShortcutConfirm = () => {
      // Solo actuar si estamos en la pestaña de cobro e input listo
      if (step === "payment" && open && canConfirm && !isProcessing) {
        handleConfirmPayment();
      }
    };
    window.addEventListener("CONFIRM_PAYMENT", handleShortcutConfirm);
    return () => window.removeEventListener("CONFIRM_PAYMENT", handleShortcutConfirm);
  }); // Sin array para atrapar el closure más fresco cada render


  const currentMethodDef = PAYMENT_METHODS.find(m => m.id === paymentMethod)!;
  const requiresAmount = currentMethodDef.requiresAmount;

  // CA-3.3.4: Calcular cambio solo aplica en efectivo
  const amountPaidCents = Math.round(parseFloat(amountPaidStr || "0") * 100);
  const changeCents = amountPaidCents - total;
  
  // Validaciones
  const isCashValid = !requiresAmount || amountPaidCents >= total;
  const isCreditValid = paymentMethod !== "CREDIT" || selectedCustomerId !== "";
  const canConfirm = isCashValid && isCreditValid;

  const handleConfirmPayment = async () => {
    if (!isCashValid) {
      toast.error("Monto insuficiente", {
        description: `El cliente debe dar al menos ${formatCents(total)}. Recibiste ${formatCents(amountPaidCents)}.`,
      });
      return;
    }
    if (!isCreditValid) {
      toast.error("Cliente no seleccionado", {
        description: "Al vender por fiado, debes asignar la cuenta a un cliente.",
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await OrderService.checkout({ 
        items, 
        paymentMethod, 
        source: saleSource,
        userId: user?.id,
        customerId: paymentMethod === "CREDIT" ? selectedCustomerId : undefined
      });

      if (!result.success || !result.order) {
        toast.error("No pudimos procesar el cobro", { description: result.error, duration: 6000 });
        return;
      }

      clearCart();
      setCompletedOrder(result.order);
      setStep("ticket");

      // Auto-imprimir ticket (solo ventas locales, no en línea)
      if (true) { // Siempre LOCAL
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
    setAmountPaidStr("");
    setCompletedOrder(null);
    onClose();
    if (onSuccess) onSuccess();
  };

  const billDenominations = [50, 100, 200, 500, 1000];
  const suggestedBills = billDenominations.filter(b => b > total / 100).slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={(o) => {
      // Evitar el cierre accidental si procesa o está en el ticket
      if (step === "ticket" || isProcessing) return;
      if (!o && step === "payment") onClose();
    }}>
      <DialogContent 
        className="sm:max-w-2xl max-h-[95vh] overflow-y-auto"
        showCloseButton={step !== "ticket"}
      >
        {step === "payment" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black">Cobrar venta</DialogTitle>
              <DialogDescription className="text-base">
                Elige el método de cobro y confirma la operación.
              </DialogDescription>
            </DialogHeader>

            {/* Selector de Método de Pago (CA-3.3.3) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => {
                    setPaymentMethod(method.id);
                    if (!method.requiresAmount) setAmountPaidStr("");
                    setIsCreatingCustomer(false);
                    setNewCustomerName("");
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center",
                    paymentMethod === method.id
                      ? "border-primary bg-primary/10 text-primary scale-[1.02] shadow-sm font-bold"
                      : "border-border text-muted-foreground hover:bg-muted/40 hover:border-muted-foreground/40"
                  )}
                >
                  {method.icon}
                  <span className="text-xs font-bold leading-tight">{method.label}</span>
                </button>
              ))}
            </div>

            {/* Sprint-1 E2: Selector de Canal de Venta — solo visible si hay >1 canal habilitado */}
            {saleChannels.length > 1 && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">¿Desde dónde viene la venta?</p>
                <div className={`grid grid-cols-${Math.min(saleChannels.length, 4)} gap-1.5`}>
                  {saleChannels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => setSaleSource(ch.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border transition-all text-center",
                        saleSource === ch.id
                          ? "border-primary bg-primary/8 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:bg-muted/20"
                      )}
                    >
                      {ch.icon}
                      <span className="text-[10px] leading-tight">{ch.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contenedor Fijo Dinámico (Evita que la UI salte y destruya el diseño) */}
            <div className="min-h-[160px] flex flex-col justify-center">

              {/* Campo de monto pagado (solo en efectivo) — CA-3.3.4 */}
              {requiresAmount && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="font-bold text-muted-foreground uppercase text-xs tracking-wider">
                      ¿Cuánto te dio el cliente?
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-3.5 text-muted-foreground font-bold text-xl">$</span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min={total / 100}
                        placeholder={(total / 100).toFixed(2)}
                        className="pl-9 h-16 text-3xl font-black bg-muted/30 focus:bg-background rounded-2xl"
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
                      size="lg"
                      className="flex-1 bg-muted/40 font-bold"
                      onClick={() => setAmountPaidStr((total / 100).toString())}
                    >
                      Monto Exacto
                    </Button>
                    {suggestedBills.map((bill) => (
                      <Button
                        key={bill}
                        variant="outline"
                        size="lg"
                        className="flex-1 font-bold bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
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
                      ? "bg-primary/10 border-primary text-primary"
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

              {/* Selector de Cliente si es Fiado */}
              {paymentMethod === "CREDIT" && (
                <div className="space-y-4 p-5 border-2 rounded-2xl bg-amber-500/5 border-amber-500/20">
                  <Label className="font-black text-amber-600 dark:text-amber-500 uppercase text-sm tracking-wider flex items-center gap-2">
                    <UserRoundCheck className="h-5 w-5" />
                    Selecciona la cuenta por cobrar
                  </Label>
                  {isCreatingCustomer ? (
                    <div className="flex gap-3">
                      <Input 
                        placeholder="Escribe el nombre del cliente..." 
                        value={newCustomerName} 
                        onChange={e => setNewCustomerName(e.target.value)} 
                        className="bg-background border-amber-500/40 h-14 text-lg font-medium"
                        autoFocus 
                      />
                      <Button 
                        variant="default"
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold h-14 px-6 text-lg"
                        onClick={async () => {
                          if (!newCustomerName) return;
                          try {
                            const id = await CustomerService.create({ name: newCustomerName, userId: user?.id || "" });
                            setCustomers([{ id, name: newCustomerName } as any, ...customers]);
                            setSelectedCustomerId(id);
                            setIsCreatingCustomer(false);
                            setNewCustomerName("");
                          } catch(e: any) {
                            toast.error(e.message);
                          }
                        }}
                      >
                        Guardar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <select 
                        className="flex-1 rounded-xl border-2 bg-background px-4 py-2 h-14 text-lg focus:outline-none border-amber-500/40 font-semibold text-foreground cursor-pointer appearance-none"
                        value={selectedCustomerId}
                        onChange={e => setSelectedCustomerId(e.target.value)}
                      >
                        <option value="">-- Buscar o Seleccionar Cliente --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.currentDebt ? `(Adeuda ${formatCents(c.currentDebt)})` : ""}</option>)}
                      </select>
                      <Button variant="outline" className="border-2 border-amber-500/40 text-amber-600 hover:bg-amber-500/10 font-bold h-14 px-6 text-lg" onClick={() => setIsCreatingCustomer(true)}>
                        <PlusCircle className="mr-2 h-5 w-5" /> Nuevo
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Aviso para otros métodos rápidos */}
              {!requiresAmount && paymentMethod !== "CREDIT" && (
                <div className="flex items-center gap-4 p-5 rounded-2xl bg-muted/40 border-2 border-dashed">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {currentMethodDef.icon}
                  </div>
                  <div>
                    <p className="text-xl font-black text-foreground">{PAYMENT_METHOD_LABELS[paymentMethod]}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-1">
                      El pago se considerará saldado instantáneamente al confirmar la venta.
                    </p>
                  </div>
                </div>
              )}

            </div>

            <Separator />

            {/* Resumen de totales con desglose de IVA — EPIC-002 */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal (sin IVA)</span>
                <span className="font-mono">{formatCents(subtotal)}</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-muted-foreground">
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
              className="w-full h-12 mt-2 font-bold text-base relative"
              onClick={handleConfirmPayment}
              disabled={isProcessing || !canConfirm}
            >
              <Check className="h-5 w-5 mr-2" />
              {isProcessing ? "Procesando de forma segura..." : "Confirmar Cobro"}
              {canConfirm && !isProcessing && (
                <div className="absolute -top-3 -right-2 scale-100 pointer-events-none drop-shadow-md z-10">
                  <KbdBadge action="PAY_ORDER" variant="solid" className="bg-background shadow-md border-primary text-primary" />
                </div>
              )}
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
                <div className="flex justify-between text-muted-foreground">
                  <span>IVA</span>
                  <span className="font-mono">+{formatCents(completedOrder!.tax)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span className="text-primary font-mono">{formatCents(completedOrder!.total)}</span>
              </div>
              {paymentMethod === "CASH" && changeCents > 0 && (
                <div className="flex justify-between font-bold text-primary">
                  <span>Cambio entregado</span>
                  <span className="font-mono">{formatCents(changeCents)}</span>
                </div>
              )}
            </div>

            {/* Método de pago */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-lg px-3 py-2">
              {PAYMENT_METHODS.find(m => m.id === paymentMethod)?.icon}
              <span>{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
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

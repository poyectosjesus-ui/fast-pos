"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CashService } from "@/lib/services/cash";
import { useSessionStore } from "@/store/useSessionStore";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface CashMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CashMovementDialog({ open, onOpenChange }: CashMovementDialogProps) {
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [amountStr, setAmountStr] = useState("");
  const [concept, setConcept] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useSessionStore((s) => s.user);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Error", { description: "No hay sesión activa." });
      return;
    }

    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Monto inválido", { description: "El monto debe ser mayor a cero." });
      return;
    }

    if (concept.trim().length < 3) {
      toast.error("Concepto requerido", { description: "Escribe un concepto descriptivo (ej. Pago proveedor)." });
      return;
    }

    setIsSubmitting(true);
    try {
      await CashService.registerMovement({
        type,
        amount: Math.round(amountNum * 100),
        concept: concept.trim(),
        userId: user.id
      });

      toast.success(type === "IN" ? "Ingreso Registrado" : "Retiro Registrado", {
        description: `Monto: ${formatCurrency(amountNum)}\nPor: ${concept.trim()}`
      });
      
      // Reset form
      setAmountStr("");
      setConcept("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Error al registrar movimiento", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Movimiento de Caja</DialogTitle>
          <DialogDescription>
            Registra una entrada o salida manual de efectivo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setType("IN")}
              className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-all ${
                type === "IN" 
                  ? "bg-primary/10 border-primary text-primary" 
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <ArrowDownToLine className="h-6 w-6 mb-2" />
              <span className="font-semibold">Entrada (+)</span>
            </button>
            <button
              type="button"
              onClick={() => setType("OUT")}
              className={`flex flex-col items-center justify-center p-4 border rounded-lg transition-all ${
                type === "OUT" 
                  ? "bg-destructive/10 border-destructive text-destructive" 
                  : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <ArrowUpFromLine className="h-6 w-6 mb-2" />
              <span className="font-semibold">Salida (-)</span>
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-amount">Monto de Efectivo</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="movement-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
                className="pl-8"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="movement-concept">Concepto / Motivo</Label>
            <Input
              id="movement-concept"
              placeholder="Ej: Pago de garrafón, Cambio prov..."
              required
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !amountStr || concept.length < 3}>
              {isSubmitting ? "Guardando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

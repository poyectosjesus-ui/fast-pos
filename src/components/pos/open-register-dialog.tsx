"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CashService } from "@/lib/services/cash";
import { useSessionStore } from "@/store/useSessionStore";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

/**
 * OpenRegisterDialog (Apertura de Turno/Caja)
 *
 * Bloquea la interfaz de ventas principal si la caja no ha sido abierta
 * el día de hoy. Obliga a ingresar el fondo inicial.
 */
export function OpenRegisterDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useSessionStore((s) => s.user);

  useEffect(() => {
    // Verificar si la caja ya está abierta al cargar
    let mounted = true;
    const checkStatus = async () => {
      try {
        const isOpenToday = await CashService.isRegisterOpen();
        if (!isOpenToday && mounted) {
          setIsOpen(true);
        }
      } catch (err) {
        console.error("Error al validar estado de caja:", err);
      }
    };
    checkStatus();
    return () => { mounted = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Error", { description: "No hay sesión activa." });
      return;
    }

    const amountNum = parseFloat(amountStr);
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error("Monto inválido", { description: "Ingresa un monto válido." });
      return;
    }

    setIsSubmitting(true);
    try {
      await CashService.registerMovement({
        type: "OPENING",
        amount: Math.round(amountNum * 100),
        concept: "Apertura de Caja",
        userId: user.id
      });

      toast.success("Caja Abierta", {
        description: `Fondo inicial registrado: ${formatCurrency(amountNum)}`,
        icon: "💳"
      });
      setIsOpen(false);
    } catch (err: any) {
      toast.error("Error al abrir caja", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      {/* No poner onOpenChange permite que sea in-cerrable (dismissable=false) */}
      <DialogContent className="sm:max-w-[425px] [&>button]:hidden">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Wallet className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Apertura de Caja</DialogTitle>
          <DialogDescription className="text-center">
            Para iniciar tu turno, por favor ingresa el monto de efectivo (Fondo de Caja) con el que inicias.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-3">
            <Label htmlFor="opening-amount" className="text-center block">
              Fondo Inicial (Efectivo)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="opening-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
                className="pl-8 text-lg font-bold text-center h-12"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-center">
            <Button 
              type="submit" 
              className="w-full sm:w-auto min-w-[200px]" 
              disabled={isSubmitting || !amountStr}
            >
              {isSubmitting ? "Registrando..." : "Abrir Turno"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

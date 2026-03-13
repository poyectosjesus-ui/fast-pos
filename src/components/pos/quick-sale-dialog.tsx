"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCartStore } from "@/store/useCartStore";
import { PackageOpen } from "lucide-react";
import { toast } from "sonner";

interface QuickSaleDialogProps {
  open: boolean;
  onClose: () => void;
}

export function QuickSaleDialog({ open, onClose }: QuickSaleDialogProps) {
  const [name, setName] = useState("Varios");
  const [priceStr, setPriceStr] = useState("");
  const addItem = useCartStore((s) => s.addItem);

  const handleAdd = () => {
    const priceNum = parseFloat(priceStr);
    if (!name.trim()) {
      return toast.warning("Debes ingresar un concepto.");
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      return toast.warning("Ingresa un precio válido mayor a cero.");
    }

    // Convertimos precio en flotante a Centavos (Punto fijo)
    const priceCents = Math.round(priceNum * 100);

    const result = addItem({
      id: `VGEN-${window.crypto.randomUUID()}`,
      name: name.trim().toUpperCase(),
      sku: "VGEN-LIBRE", 
      price: priceCents,
      stock: 999999,
      taxRate: 0, 
      taxIncluded: true,
    });

    if (result.success) {
      toast.success(`"${name.trim()}" añadido por $${priceNum.toFixed(2)}`);
      setPriceStr("");
      setName("Varios");
      onClose();
    } else {
      toast.error(result.message || "Error al añadir venta genérica");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[360px] rounded-2xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <PackageOpen className="w-5 h-5 text-amber-500" />
            Pase Libre
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">Venta de artículos fuera del catálogo general.</p>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Concepto Rápido</Label>
            <Input
              placeholder="Ej. Copias, Desechable..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-muted/50 focus:border-amber-500 text-sm"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Importe Total ($)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={priceStr}
              onChange={(e) => setPriceStr(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-14 bg-muted/50 focus:border-amber-500 text-lg font-mono text-center"
            />
          </div>

          <Button 
            className="w-full h-12 text-sm font-bold uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-amber-950 border-none shadow-lg shadow-amber-500/20" 
            onClick={handleAdd}
          >
            Añadir Total al Ticket
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

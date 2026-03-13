import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Product } from "@/lib/schema";
import { Scale } from "lucide-react";

interface QuantityInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  product: Product | null;
  unitSymbol?: string;
}

export function QuantityInputDialog({ isOpen, onClose, onConfirm, product, unitSymbol }: QuantityInputDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValue(""); // Limpia siempre al abrir
    }
  }, [isOpen]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const qty = parseFloat(value);
    if (!isNaN(qty) && qty > 0) {
      onConfirm(qty);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <div className="mx-auto bg-primary/10 p-3 rounded-full mb-2">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            ¿Qué cantidad?
          </DialogTitle>
          <DialogDescription className="text-center">
            {product?.name || "Artículo seleccionado"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Input
              type="number"
              step="any"
              min="0.001"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ej: 0.500"
              className="text-center text-3xl h-16 pr-12 font-mono"
              autoFocus
            />
            {unitSymbol && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                {unitSymbol}
              </span>
            )}
          </div>
          
          <DialogFooter className="sm:justify-stretch">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={!value || isNaN(parseFloat(value)) || parseFloat(value) <= 0}>
              Aceptar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

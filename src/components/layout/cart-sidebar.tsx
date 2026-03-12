"use client";

import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCartStore } from "@/store/useCartStore";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Banknote, CheckCircle2 } from "lucide-react";

export function CartSidebar() {
  const [mounted, setMounted] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const { items, updateQuantity, clearCart } = useCartStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <aside className="hidden lg:flex w-96 flex-col border-l bg-background/50 backdrop-blur-xl h-screen sticky top-0" />
    );
  }

  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const tax = subtotal * 0.16;
  const total = subtotal + tax;

  const handleCheckout = (method: "cash" | "card") => {
    toast.success(`Pago con ${method === "cash" ? "Efectivo" : "Tarjeta"} aprobado`, {
      description: `Total cobrado: $${total.toFixed(2)}`,
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    });
    clearCart();
    setIsCheckoutOpen(false);
  };

  return (
    <aside className="hidden lg:flex w-96 flex-col border-l bg-background/50 backdrop-blur-xl h-screen sticky top-0">
      <div className="flex items-center p-6 border-b border-border/50 justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          Orden Actual
        </h2>
        {items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearCart} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-6">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground mt-20 gap-4">
            <div className="p-4 bg-muted rounded-full">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p>El carrito está vacío</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div key={item.product.id} className="flex gap-4">
                <div className="flex flex-col justify-between flex-1">
                  <div>
                    <h4 className="font-semibold line-clamp-1">{item.product.name}</h4>
                    <p className="text-primary font-medium">${item.product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-sm" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="font-semibold">
                  ${(item.product.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-6 bg-background border-t border-border/50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="space-y-3 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Impuestos (16%)</span>
            <span className="font-medium">${tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-xl font-bold">
            <span>Total</span>
            <span className="text-primary">${total.toFixed(2)}</span>
          </div>
        </div>
        
        <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
          <DialogTrigger 
            className="inline-flex items-center justify-center whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-14 rounded-2xl w-full text-lg"
            disabled={items.length === 0}
          >
            Cobrar ${total.toFixed(2)}
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl">Confirmar Pago</DialogTitle>
              <DialogDescription>
                Selecciona el método de pago para completar la transacción por <span className="font-bold text-foreground">${total.toFixed(2)}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-6">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => handleCheckout('cash')}
              >
                <Banknote className="h-8 w-8 text-emerald-500" />
                <span className="font-semibold">Efectivo</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                onClick={() => handleCheckout('card')}
              >
                <CreditCard className="h-8 w-8 text-blue-500" />
                <span className="font-semibold">Tarjeta</span>
              </Button>
            </div>
            <DialogFooter className="sm:justify-center">
              <p className="text-xs text-muted-foreground text-center">La orden se generará automáticamente después de cobrar.</p>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  );
}

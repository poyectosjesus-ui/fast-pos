"use client";

/**
 * Diario de Ventas (Historial y Anulaciones)
 *
 * FUENTE DE VERDAD: analitica_plan.md — Sección 4.3
 *
 * Muestra el registro cronológico del día con capacidad de ver detalles (ticket)
 * y anular ventas en caso de error (CA-4.3.3) regresando el stock.
 */

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { formatCurrency, BUSINESS_NAME } from "@/lib/constants";
import { OrderService } from "@/lib/services/orders";
import { Sidebar } from "@/components/layout/sidebar";
import { Order } from "@/lib/schema";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { AlertCircle, FileText, Ban, Printer, CircleCheck, CircleX } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function HistoryPage() {
  // Traemos todas las ventas ordenadas por fecha más reciente
  const allOrders = useLiveQuery(() => OrderService.getAll(), []);
  
  // Estado para el visor del ticket digital (Detalle rápido)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Estado para la alerta de confirmación de anulación
  const [voidCandidate, setVoidCandidate] = useState<Order | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const handleVoidOrder = async () => {
    // Prevenimos ejecución si el usuario cerró el modal antes o si el candidato es nulo
    if (!voidCandidate) return;
    
    // Bloqueamos la interfaz visualmente para prevenir dobles clics accidentales
    // que podrían causar inconsistencias o múltiples llamadas a la base de datos
    setIsVoiding(true);
    try {
      const result = await OrderService.voidOrder(voidCandidate.id);
      
      if (!result.success) {
        toast.error("No pudimos anular este ticket", { description: result.error });
        return;
      }
      
      toast.success("Venta anulada correctamente", { description: "El dinero ha sido descontado y los artículos ya están de vuelta en tu mostrador." });
      setVoidCandidate(null);
      // Cerramos el modal de detalle para no dejar al usuario viendo un ticket ahora obsoleto
      setSelectedOrder(null); 
    } finally {
      setIsVoiding(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        {/* Glassmorphism requerido por frontend_guidelines.md */}
        <header className="sticky top-0 z-20 bg-background/50 backdrop-blur-xl border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Diario de Ventas</h1>
            <p className="text-sm text-muted-foreground">Revisa qué has cobrado hoy o en días anteriores.</p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 max-w-5xl mx-auto w-full">
          {allOrders === undefined ? (
            <div className="flex flex-col gap-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-full h-16 rounded-xl border bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : allOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed h-[50vh]">
              <FileText className="h-12 w-12 mb-4 text-muted-foreground/30" />
              <p className="text-lg font-bold">Sin movimientos aún</p>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">Cuando realices tu primer cobro, el ticket aparecerá en esta lista.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {allOrders.map((order) => {
                const isCancelled = order.status === "CANCELLED";
                return (
                  <div 
                    key={order.id} 
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border bg-card transition-colors gap-3 cursor-pointer ${isCancelled ? "opacity-75 bg-muted/30" : "hover:bg-muted/10 hover:shadow-sm"}`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${isCancelled ? "bg-rose-100/50 text-rose-500" : "bg-emerald-100/50 text-emerald-600"}`}>
                        {isCancelled ? <CircleX className="h-5 w-5" /> : <CircleCheck className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold text-sm">
                          {isCancelled ? "Ticket anulado" : "Venta exitosa"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {new Date(order.createdAt).toLocaleString("es-MX")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 sm:ml-auto">
                      <div className="flex flex-col items-end">
                        <span className={`font-bold ${isCancelled ? "text-muted-foreground line-through" : ""}`}>
                          {formatCurrency(order.total)}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase tracking-wider">
                          {order.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground hidden sm:block w-16 text-right">
                        {order.items.length} art.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* MODAL DEL RECIBO (CA-4.3.2) */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        {/* Usamos Glassmorphism estricto dictaminado por la guía */}
        <DialogContent className="sm:max-w-md bg-background/50 backdrop-blur-xl">
          {selectedOrder && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg">Recibo del Cliente</DialogTitle>
                  {selectedOrder.status === "CANCELLED" && (
                    <span className="text-[10px] font-bold bg-rose-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Anulado</span>
                  )}
                </div>
                <DialogDescription>
                  Documento guardado de la venta. No puede ser alterado.
                </DialogDescription>
              </DialogHeader>

              {/* Área del ticket imprimible */}
              <div className="border rounded-lg p-5 bg-card" id="print-ticket">
                <div className="text-center mb-4">
                  <h3 className="font-bold text-lg">{BUSINESS_NAME}</h3>
                  <p className="text-xs text-muted-foreground">{new Date(selectedOrder.createdAt).toLocaleString("es-MX")}</p>
                </div>

                <Separator className="my-3 border-dashed" />

                <div className="space-y-2 text-sm">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="flex-1 truncate pr-2">{item.name} × {item.quantity}</span>
                      <span className="font-medium">{formatCurrency(item.subtotal)}</span>
                    </div>
                  ))}
                </div>

                <Separator className="my-3 border-dashed" />

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>IVA</span><span>{formatCurrency(selectedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-2">
                    <span>Total Pagado</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
                
                <div className="mt-4 text-center">
                   {/* Cero tecnicismos: Preferimos "Folio" en vez de "ID UUID" */}
                   <p className="text-xs text-muted-foreground font-mono">Folio: {selectedOrder.id.split('-')[0]}</p>
                   <p className="text-xs text-muted-foreground uppercase mt-1">Pagado con {selectedOrder.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta"}</p>
                </div>
              </div>

              {/* Controles de Acción */}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={handlePrint} disabled={selectedOrder.status === "CANCELLED"}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Copia
                </Button>
                
                {selectedOrder.status !== "CANCELLED" && (
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => setVoidCandidate(selectedOrder)}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Anular Ticket
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ALERTA DE CONFIRMACIÓN DE ANULACIÓN (Garantía de Integridad) */}
      <AlertDialog open={!!voidCandidate} onOpenChange={(open: boolean) => { if (!open) setVoidCandidate(null); }}>
         {/* Glassmorphism requerido */}
         <AlertDialogContent className="bg-background/50 backdrop-blur-xl">
           <AlertDialogHeader>
             <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                   <AlertCircle className="h-5 w-5" />
                </div>
                <AlertDialogTitle className="text-xl">¿Anular este recibo?</AlertDialogTitle>
             </div>
             <AlertDialogDescription className="text-base">
               Si confirmas, restaremos <strong>{voidCandidate && formatCurrency(voidCandidate.total)}</strong> de tus ventas de hoy y devolveremos automáticamente <strong>{voidCandidate && voidCandidate.items.length} artículos</strong> a tu inventario físico.
               <br/><br/>
               <span className="font-bold text-foreground">Asegúrate de que estás haciendo lo correcto. Esta acción no se puede deshacer.</span>
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel disabled={isVoiding}>No, mantener la venta</AlertDialogCancel>
             <AlertDialogAction 
                onClick={(e: React.MouseEvent) => { e.preventDefault(); handleVoidOrder(); }}
                disabled={isVoiding}
                className="bg-rose-600 hover:bg-rose-700 text-white"
             >
               {isVoiding ? "Anulando transacción..." : "Sí, anular y devolver stock"}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

"use client";

/**
 * Diario de Ventas (Historial y Anulaciones)
 *
 * FUENTE DE VERDAD: analitica_plan.md — Sección 4.3
 *
 * Muestra el registro cronológico del día con capacidad de ver detalles (ticket)
 * y anular ventas en caso de error (CA-4.3.3) regresando el stock.
 */

import { useState, useEffect, useCallback } from "react";
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
import { 
  AlertCircle, FileText, Ban, Printer, CircleCheck, CircleX, 
  TrendingUp, Calendar, Wallet, CreditCard, Filter, ChevronRight, ChevronLeft,
  ArrowUpRight, ShoppingBag, Banknote
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default function HistoryPage() {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [filterPayment, setFilterPayment] = useState<'ALL' | 'CASH' | 'CARD'>('ALL');

  // Estado SQLite (antes era useLiveQuery)
  const [allOrders, setAllOrders] = useState<Order[] | undefined>(undefined);
  const [totalOrders, setTotalOrders] = useState(0);
  const [todayStats, setTodayStats] = useState<Awaited<ReturnType<typeof OrderService['getStatsForDay']>> | undefined>(undefined);
  const [overallStats, setOverallStats] = useState<Awaited<ReturnType<typeof OrderService['getOverallStats']>> | undefined>(undefined);

  const totalPages = Math.ceil(totalOrders / itemsPerPage);

  const loadOrders = useCallback(async () => {
    const result = await OrderService.searchOrders({
      status: filterStatus,
      paymentMethod: filterPayment,
      limit: itemsPerPage,
      offset: (currentPage - 1) * itemsPerPage,
    });
    setAllOrders(result.items);
    setTotalOrders(result.total);
  }, [currentPage, filterStatus, filterPayment]);

  const loadStats = useCallback(async () => {
    const [today, overall] = await Promise.all([
      OrderService.getStatsForDay(),
      OrderService.getOverallStats(),
    ]);
    setTodayStats(today);
    setOverallStats(overall);
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const handleNextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1));
  const handlePrevPage = () => setCurrentPage(p => Math.max(1, p - 1));

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [voidCandidate, setVoidCandidate] = useState<Order | null>(null);
  const [isVoiding, setIsVoiding] = useState(false);

  const handleVoidOrder = async () => {
    if (!voidCandidate) return;
    setIsVoiding(true);
    try {
      const result = await OrderService.voidOrder(voidCandidate.id);
      if (!result.success) {
        toast.error("No pudimos anular este ticket", { description: result.error });
        return;
      }
      toast.success("Venta anulada correctamente");
      setVoidCandidate(null);
      setSelectedOrder(null);
      // Refrescar
      await Promise.all([loadOrders(), loadStats()]);
    } finally {
      setIsVoiding(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="flex h-screen bg-muted/40 font-sans">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Diario de Ventas
              </h1>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider opacity-70">
                Historial de operaciones y arqueo rápido
              </p>
            </div>
            
            {/* Quick Stats Grid (Fase 12.1) */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Ventas Hoy</p>
                  <p className="text-sm font-black text-emerald-700">{formatCurrency(todayStats?.totalWithTax ?? 0)}</p>
                </div>
              </div>
              <div className="bg-primary/5 border border-primary/10 px-3 py-2 rounded-xl flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-tighter">Histórico Total</p>
                  <p className="text-sm font-black text-primary">{formatCurrency(overallStats?.totalRevenue ?? 0)}</p>
                </div>
              </div>
              <div className="hidden lg:flex bg-blue-500/10 border border-blue-500/20 px-3 py-2 rounded-xl items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-tighter">Ticket Promedio</p>
                  <p className="text-sm font-black text-blue-700">{formatCurrency(overallStats?.avgTicket ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Filters Bar (Fase 12.2) */}
          <div className="flex flex-wrap items-center gap-3 bg-card border px-4 py-3 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted-foreground mr-2">
              <Filter className="h-3.5 w-3.5" /> Filtrar por:
            </div>
            
            <div className="flex bg-muted p-1 rounded-lg">
              <Button 
                variant={filterStatus === 'ALL' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 text-[10px] uppercase font-bold"
                onClick={() => { setFilterStatus('ALL'); setCurrentPage(1); }}
              >Todos</Button>
              <Button 
                variant={filterStatus === 'COMPLETED' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 text-[10px] uppercase font-bold"
                onClick={() => { setFilterStatus('COMPLETED'); setCurrentPage(1); }}
              >Exitosos</Button>
              <Button 
                variant={filterStatus === 'CANCELLED' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 text-[10px] uppercase font-bold"
                onClick={() => { setFilterStatus('CANCELLED'); setCurrentPage(1); }}
              >Anulados</Button>
            </div>

            <Separator orientation="vertical" className="h-6 hidden sm:block" />

            <div className="flex bg-muted p-1 rounded-lg">
              <Button 
                variant={filterPayment === 'ALL' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 text-[10px] uppercase font-bold px-3"
                onClick={() => { setFilterPayment('ALL'); setCurrentPage(1); }}
              >Cualquier Pago</Button>
              <Button 
                variant={filterPayment === 'CASH' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 text-[10px] uppercase font-bold px-3 gap-1.5"
                onClick={() => { setFilterPayment('CASH'); setCurrentPage(1); }}
              ><Banknote className="h-3 w-3" /> Efectivo</Button>
              <Button 
                variant={filterPayment === 'CARD' ? 'secondary' : 'ghost'} 
                size="sm" className="h-7 text-[10px] uppercase font-bold px-3 gap-1.5"
                onClick={() => { setFilterPayment('CARD'); setCurrentPage(1); }}
              ><CreditCard className="h-3 w-3" /> Tarjeta</Button>
            </div>
            
            <div className="ml-auto text-[10px] font-black uppercase text-muted-foreground/50 tracking-widest hidden lg:block">
              {totalOrders} Registros Encontrados
            </div>
          </div>

          {allOrders === undefined ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="aspect-[4/3] rounded-2xl border bg-card/50 animate-pulse" />
              ))}
            </div>
          ) : allOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-card border-2 border-dashed rounded-3xl opacity-60">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center mb-4">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Sin Movimientos</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                No hay ventas que coincidan con los filtros seleccionados actualmente.
              </p>
              <Button variant="link" onClick={() => { setFilterStatus('ALL'); setFilterPayment('ALL'); }} className="mt-4 uppercase text-xs font-bold">Limpiar Filtros</Button>
            </div>
          ) : (
            <>
              {/* Grid de Ventas Responsivo (Fase 12.3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allOrders.map((order) => {
                  const isCancelled = order.status === "CANCELLED";
                  const dateObj = new Date(order.createdAt);
                  
                  return (
                    <div 
                      key={order.id} 
                      onClick={() => setSelectedOrder(order)}
                      className={cn(
                        "group relative flex flex-col p-5 rounded-2xl border bg-card transition-all duration-300 cursor-pointer overflow-hidden",
                        "hover:shadow-2xl hover:shadow-black/5 hover:-translate-y-1 active:scale-95 border-border/50",
                        isCancelled && "opacity-80 bg-muted/20 grayscale border-dashed"
                      )}
                    >
                      {/* Badge de Estado flotante */}
                      <div className="absolute top-4 right-4 group-hover:scale-110 transition-transform">
                        {isCancelled ? (
                          <div className="h-8 w-8 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                            <Ban className="h-4 w-4" />
                          </div>
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                            <CircleCheck className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col h-full gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Ticket #{order.id.slice(0, 8)}</p>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-2xl font-black tracking-tighter",
                              isCancelled ? "text-muted-foreground line-through" : "text-foreground"
                            )}>
                              {formatCurrency(order.total)}
                            </span>
                          </div>
                        </div>

                        <div className="mt-auto pt-4 border-t border-muted/50 flex items-end justify-between">
                          <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {dateObj.toLocaleDateString()}
                            </p>
                            <p className="text-xs font-black uppercase text-foreground/80">
                              {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <Badge variant={isCancelled ? "outline" : "secondary"} className="text-[9px] h-5 font-black uppercase tracking-widest px-2">
                              {order.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta"}
                            </Badge>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{order.items.length} artículos</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Efecto hover decorativo */}
                      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                })}
              </div>

              {/* PAGINACIÓN PREMIUM */}
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-6 p-4 sm:p-2 bg-card/50 backdrop-blur border rounded-full px-6 shadow-sm">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  Página {currentPage} de {totalPages || 1}
                </div>
                
                <div className="flex items-center gap-1 bg-muted rounded-full p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  {/* Números de página simples */}
                  <div className="flex items-center gap-0.5 px-4 h-8 bg-background rounded-full text-xs font-black shadow-sm ring-1 ring-black/5">
                    {currentPage}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full"
                    onClick={handleNextPage}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="hidden sm:block text-[10px] font-bold uppercase text-muted-foreground italic">
                  Viendo {(allOrders.length).toLocaleString()} tickets de {totalOrders}
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* MODAL DEL RECIBO PREMIUM */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent className="sm:max-w-md bg-background/95 backdrop-blur-2xl border-2 shadow-2xl rounded-3xl">
          {selectedOrder && (
            <div className="space-y-6 py-2">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-xl font-black uppercase">Detalle de Venta</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase text-primary/60 tracking-widest">Recibo Digital #{selectedOrder.id.slice(0,8)}</DialogDescription>
                  </div>
                  {selectedOrder.status === "CANCELLED" && (
                    <Badge variant="destructive" className="h-6 font-black uppercase tracking-wider scale-110">Anulado</Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="bg-card border-x border-y shadow-inner rounded-2xl overflow-hidden">
                <div className="p-6 space-y-4">
                  <div className="text-center pb-4 border-b border-dashed">
                    <h3 className="font-black text-lg tracking-tight uppercase">{BUSINESS_NAME}</h3>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">
                      {new Date(selectedOrder.createdAt).toLocaleString("es-MX", { dateStyle: 'long', timeStyle: 'short' })}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div className="flex flex-col">
                          <span className="font-bold">{item.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-black">{item.quantity} uni. × {formatCurrency(item.price)}</span>
                        </div>
                        <span className="font-black text-right">{formatCurrency(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-dashed space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground font-bold uppercase">
                      <span>Subtotal</span><span>{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground font-bold uppercase">
                      <span>Impuestos</span><span>{formatCurrency(selectedOrder.tax)}</span>
                    </div>
                    <div className="flex justify-between font-black text-xl pt-2 text-primary">
                      <span className="uppercase tracking-tighter">Total Pago</span>
                      <span>{formatCurrency(selectedOrder.total)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded-xl flex justify-between items-center mt-4">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-background flex items-center justify-center">
                        {selectedOrder.paymentMethod === "CASH" ? <Banknote className="h-3.5 w-3.5 text-emerald-600" /> : <CreditCard className="h-3.5 w-3.5 text-blue-600" />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                        Metodo: {selectedOrder.paymentMethod === "CASH" ? "Efectivo" : "Tarjeta"}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground opacity-50">
                      SYS_ID: {selectedOrder.id.slice(0, 13)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-12 rounded-xl font-black uppercase text-xs border-2 hover:bg-muted" onClick={handlePrint} disabled={selectedOrder.status === "CANCELLED"}>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir
                </Button>
                
                {selectedOrder.status !== "CANCELLED" ? (
                  <Button 
                    variant="destructive" 
                    className="h-12 rounded-xl font-black uppercase text-xs shadow-lg shadow-rose-500/20"
                    onClick={() => setVoidCandidate(selectedOrder)}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Anular Venta
                  </Button>
                ) : (
                  <Button variant="ghost" disabled className="h-12 rounded-xl font-black uppercase text-xs opacity-50">
                    Ya Anulado
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CONFIRMACIÓN DE ANULACIÓN */}
      <AlertDialog open={!!voidCandidate} onOpenChange={(open: boolean) => { if (!open) setVoidCandidate(null); }}>
         <AlertDialogContent className="bg-background/95 backdrop-blur-2xl border-2 rounded-3xl shadow-2xl">
           <AlertDialogHeader>
             <div className="flex items-center gap-4 mb-4">
                <div className="h-14 w-14 rounded-2xl bg-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/30">
                   <AlertCircle className="h-8 w-8" />
                </div>
                <div>
                  <AlertDialogTitle className="text-2xl font-black uppercase tracking-tight">Anular Ticket</AlertDialogTitle>
                  <AlertDialogDescription className="text-rose-500/80 font-bold text-xs uppercase tracking-widest">Proceso Irreversible</AlertDialogDescription>
                </div>
             </div>
             <p className="text-sm font-medium leading-relaxed">
               Al anular este recibo de <span className="font-black text-rose-600">{voidCandidate && formatCurrency(voidCandidate.total)}</span>, el sistema devolverá automáticamente <span className="font-black underline">{voidCandidate && voidCandidate.items.length} artículos</span> al inventario disponible.
               <br/><br/>
               <span className="inline-block p-3 bg-muted rounded-xl text-xs font-bold text-muted-foreground border">
                 🚨 Se restará del reporte de ventas diario y ya no aparecerá como ingreso activo en caja.
               </span>
             </p>
           </AlertDialogHeader>
           <AlertDialogFooter className="mt-6 gap-3">
             <AlertDialogCancel disabled={isVoiding} className="rounded-xl font-black uppercase text-xs h-11 border-2">Cancelar</AlertDialogCancel>
             <AlertDialogAction 
                onClick={(e: React.MouseEvent) => { e.preventDefault(); handleVoidOrder(); }}
                disabled={isVoiding}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-xs h-11 px-6 shadow-lg shadow-rose-600/20 border-none"
             >
               {isVoiding ? "Procesando..." : "Sí, Anular Movimiento"}
             </AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

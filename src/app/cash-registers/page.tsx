"use client";

import { useState, useEffect, useCallback } from "react";
import { HandCoins, CreditCard, Printer, FileText, Wallet, ArrowDownCircle, ArrowUpCircle, LockOpen } from "lucide-react";
import { toast } from "sonner";
import { OrderService } from "@/lib/services/orders";
import { CashService } from "@/lib/services/cash";
import { formatCurrency } from "@/lib/constants";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/useSessionStore";

export default function CashRegistersPage() {
  const { user } = useSessionStore();
  const [stats, setStats] = useState({
    totalNet: 0,
    totalWithTax: 0,
    cashTotal: 0,
    cardTotal: 0,
    orderCount: 0,
    avgTicket: 0,
  });

  const [balance, setBalance] = useState({
    opening: 0,
    cashIn: 0,
    cashOut: 0,
    cashSales: 0,
    expectedBalance: 0
  });

  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [movType, setMovType] = useState<'IN' | 'OUT'>('IN');
  const [movAmount, setMovAmount] = useState("");
  const [movConcept, setMovConcept] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [currentStats, currentBalance] = await Promise.all([
        OrderService.getStatsForDay(),
        CashService.getTodayBalance()
      ]);
      setStats(currentStats);
      setBalance(currentBalance);
      setIsOpen(currentBalance.opening > 0);
    } catch (error) {
      console.error("Error cargando caja:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60_000); // 1 min update
    return () => clearInterval(interval);
  }, [loadStats]);

  const handleOpenRegister = async () => {
    const amount = parseFloat(openingAmount.replace(/[$,\s]/g, ''));
    if (isNaN(amount) || amount < 0) {
      return toast.error("Monto inválido", { description: "Ingresa un fondo de caja inicial válido." });
    }
    
    try {
      await CashService.registerMovement({
        type: 'OPENING',
        amount: Math.round(amount * 100),
        concept: 'Fondo de Cierre / Apertura',
        userId: user?.id || 'admin'
      });
      toast.success("Caja Abierta Exitosamente");
      loadStats();
    } catch (error: any) {
      toast.error("Error", { description: error.message });
    }
  };

  const handleRegisterMovement = async () => {
    const amount = parseFloat(movAmount.replace(/[$,\s]/g, ''));
    if (isNaN(amount) || amount <= 0 || !movConcept) {
      return toast.error("Datos incompletos", { description: "Revisa monto y concepto." });
    }
    
    try {
      await CashService.registerMovement({
        type: movType,
        amount: Math.round(amount * 100),
        concept: movConcept,
        userId: user?.id || 'admin'
      });
      toast.success("Movimiento guardado con éxito");
      setIsModalOpen(false);
      setMovAmount("");
      setMovConcept("");
      loadStats();
    } catch (error: any) {
      toast.error("Error registrando", { description: error.message });
    }
  };

  if (isLoading && isOpen === null) {
    return <div className="flex h-screen items-center justify-center bg-muted/20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden relative">
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black tracking-tight uppercase">Gestión de Cajas</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.2em] opacity-70">
              Control de Efectivo y Reportes Físicos
            </p>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto w-full">
          
          {!isOpen ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto space-y-6 pt-10">
              <div className="bg-primary/10 p-6 rounded-full">
                <LockOpen className="h-16 w-16 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-3xl font-black uppercase tracking-tight text-foreground">Abrir Turno</h2>
                <p className="text-sm font-bold text-muted-foreground uppercase opacity-80 tracking-widest">
                  Ingresa el fondo o cambio inicial que hay en la caja registradora.
                </p>
              </div>
              
              <div className="w-full bg-card border shadow-lg rounded-3xl p-6 lg:p-8 space-y-6">
                <div className="space-y-4">
                  <Input 
                    type="text" inputMode="decimal"
                    placeholder="Monto de apertura ($0.00)" 
                    className="h-16 text-3xl font-black text-center"
                    value={openingAmount}
                    onChange={(e) => setOpeningAmount(e.target.value)}
                  />
                  <Button 
                    size="lg" 
                    className="w-full h-14 text-sm font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-transform"
                    onClick={handleOpenRegister}
                  >
                    Iniciar Caja
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Acciones Rápidas (IN/OUT) */}
              <div className="flex justify-end mb-4">
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger render={<Button variant="outline" className="h-10 text-[11px] font-black uppercase tracking-widest rounded-xl border-primary text-primary hover:bg-primary/10" />}>
                    <Wallet className="w-4 h-4 mr-2"/>
                    Registrar Movimiento Extra
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-3xl">
                    <DialogHeader>
                      <DialogTitle className="font-black uppercase tracking-widest">Registrar Movimiento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="flex bg-muted p-1 rounded-xl">
                        <Button 
                          variant={movType === 'IN' ? 'default' : 'ghost'} 
                          className={cn("flex-1 text-[11px] font-bold uppercase", movType === 'IN' && "bg-background text-primary shadow-sm")}
                          onClick={() => setMovType('IN')}
                        >
                          ENTRADA
                        </Button>
                        <Button 
                          variant={movType === 'OUT' ? 'default' : 'ghost'} 
                          className={cn("flex-1 text-[11px] font-bold uppercase", movType === 'OUT' && "bg-background text-destructive shadow-sm")}
                          onClick={() => setMovType('OUT')}
                        >
                          SALIDA
                        </Button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cantidad</label>
                          <Input 
                            type="text" inputMode="decimal" 
                            className="h-12 text-2xl font-black" 
                            placeholder="0.00" 
                            value={movAmount} 
                            onChange={(e) => setMovAmount(e.target.value)} 
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Concepto</label>
                          <Input 
                            className="h-12" 
                            placeholder="Ej. Pago Proveedor, Cambio..." 
                            value={movConcept} 
                            onChange={(e) => setMovConcept(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button className="w-full h-12 uppercase font-black text-xs tracking-widest rounded-xl" onClick={handleRegisterMovement}>
                        Guardar Movimiento
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Fila 1: Resumen de Dinero */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* CAJA FÍSICA (Verde Dominante) */}
                <div className="bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors border-2 border-emerald-500/30 rounded-3xl p-6 lg:p-8 space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <HandCoins className="h-40 w-40 text-emerald-500" />
                  </div>
                  
                  <div className="flex justify-between items-center bg-background/50 rounded-2xl p-4 relative z-10 w-fit">
                    <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Efectivo Físico Esperado</span>
                  </div>
                  
                  <div className="pt-2 relative z-10">
                    <p className="text-5xl lg:text-7xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                      {formatCurrency(balance.expectedBalance)}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600/70 uppercase mt-4 tracking-widest break-words leading-relaxed max-w-[80%]">
                      Fondo ({formatCurrency(balance.opening)}) + Ingresos ({formatCurrency(balance.cashSales + balance.cashIn)}) - Egresos ({formatCurrency(balance.cashOut)}) = Lo que debes tener en billetes.
                    </p>
                  </div>
                </div>

                {/* DINERO DIGITAL (Muted) */}
                <div className="bg-card hover:bg-muted/50 transition-colors border-2 rounded-3xl p-6 lg:p-8 space-y-4">
                  <div className="flex justify-between items-center bg-muted/60 rounded-2xl p-4 w-fit">
                    <span className="text-xs font-black uppercase tracking-widest text-blue-500">Vouchers / Transferencias</span>
                  </div>
                  <div className="pt-2">
                    <p className="text-5xl lg:text-7xl font-black tracking-tighter text-foreground">
                      {formatCurrency(stats.cardTotal)}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground uppercase mt-4 tracking-widest leading-relaxed">
                      Dinero digital cobrado por terminal o transferencia. <br/> No lo busques en la caja de seguridad.
                    </p>
                  </div>
                </div>
              </div>

              {/* Fila 2: Mix Operativo y Movimientos */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="col-span-1 border rounded-3xl bg-card p-6 shadow-sm flex flex-col justify-center">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Ventas de Hoy</p>
                  <div className="flex items-end gap-3 mb-4">
                    <span className="text-6xl font-black tracking-tighter">{stats.orderCount}</span>
                  </div>
                  {stats.orderCount > 0 && (
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>Preferencia Efectivo</span>
                        <span className="text-primary">{Math.round((stats.cashTotal / (stats.totalWithTax || 1)) * 100)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                        <div 
                          className="h-full bg-primary" 
                          style={{ width: `${Math.round((stats.cashTotal / (stats.totalWithTax || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="col-span-2 border rounded-3xl bg-card p-6 shadow-sm">
                   <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Resumen de Operaciones</p>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="space-y-1">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground">Fondo</p>
                       <p className="text-lg font-black">{formatCurrency(balance.opening)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground text-emerald-500 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3"/> Cobrado (Efec)</p>
                       <p className="text-lg font-black">{formatCurrency(balance.cashSales)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground text-emerald-500 flex items-center gap-1"><ArrowUpCircle className="w-3 h-3"/> Entradas</p>
                       <p className="text-lg font-black">{formatCurrency(balance.cashIn)}</p>
                     </div>
                     <div className="space-y-1">
                       <p className="text-[10px] uppercase font-bold text-muted-foreground text-destructive flex items-center gap-1"><ArrowDownCircle className="w-3 h-3"/> Salidas</p>
                       <p className="text-lg font-black">{formatCurrency(balance.cashOut)}</p>
                     </div>
                   </div>
                </div>
              </div>

          {/* Fila 3: Botones de Corte amigables */}
          <div className="pt-6">
            <h2 className="text-lg font-black uppercase tracking-tighter mb-6 flex items-center gap-2">
              <Printer className="h-5 w-5" /> Impresión de Reportes
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* CORTE X -> Reporte de Turno */}
              <div className="bg-card border rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Reporte de Turno (X)
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mb-4">
                    Imprime un ticket con el total de ventas hasta este momento. 
                    <b> No borra ni cierra la caja.</b> Úsalo para cuadrar cajeros a mitad del día.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl border-dashed hover:border-primary hover:text-primary font-bold text-[11px] uppercase tracking-wider"
                  onClick={async () => {
                     const today = new Date().toISOString().split("T")[0];
                     const res = await window.electronAPI?.generateZReportPdf({ 
                       dateString: today, 
                       title: "REPORTE DE TURNO (CORTE X)",
                       userId: user?.id 
                     });
                     if (res?.success && !res.canceled) {
                       toast.success("Reporte Generado", { description: res.filePath });
                     }
                  }}
                >
                  Imprimir Turno
                </Button>
              </div>

              {/* CORTE Z -> Cierre de Día */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest mb-2 flex items-center gap-2 text-primary">
                    <Wallet className="h-4 w-4" /> Cierre del Día (Z)
                  </h3>
                  <p className="text-xs font-medium text-muted-foreground mb-4">
                    Imprime el cálculo final de todo el día. 
                    Declara el total cobrado oficialmente. Úsalo al finalizar las ventas frente a mostrador.
                  </p>
                </div>
                <Button
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-[11px] uppercase tracking-wider shadow-lg shadow-primary/20"
                  onClick={async () => {
                     const today = new Date().toISOString().split("T")[0];
                     const res = await window.electronAPI?.generateZReportPdf({ 
                       dateString: today, 
                       title: "CIERRE DEL DÍA (CORTE Z)",
                       userId: user?.id 
                     });
                     if (res?.success && !res.canceled) {
                       toast.success("Cierre Generado", { description: res.filePath });
                     }
                  }}
                >
                  Imprimir Cierre
                </Button>
              </div>

            </div>
          </div>
          </>
          )}

        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, UserRoundCheck, HandCoins, ArrowDownToLine, Phone, HelpCircle } from "lucide-react";
import { CustomerService, type Customer } from "@/lib/services/customers";
import { useSessionStore } from "@/store/useSessionStore";
import { formatCents } from "@/lib/services/tax";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { driver } from "driver.js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Sidebar } from "@/components/layout/sidebar";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

export default function CustomersPage() {
  const { user } = useSessionStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // States para Abono/Pago
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAmountStr, setPaymentAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "OTHER">("CASH");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      const data = await CustomerService.getAll();
      setCustomers(data);
    } catch (e: any) {
      toast.error("Error al cargar clientes", { description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterPayment = async () => {
    if (!selectedCustomer || !user) return;
    const amount = Math.round(parseFloat(paymentAmountStr) * 100);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error("Monto inválido");
      return;
    }

    if (amount > (selectedCustomer.currentDebt || 0)) {
      toast.error("Monto excedido", { description: "El abono es mayor a la deuda actual." });
      return;
    }

    setIsProcessing(true);
    try {
      await CustomerService.registerPayment({
        customerId: selectedCustomer.id,
        amount,
        paymentMethod,
        userId: user.id
      });
      
      toast.success("Abono registrado", { description: `Se redujo la deuda en ${formatCents(amount)}` });
      setIsPaymentDialogOpen(false);
      setPaymentAmountStr("");
      loadCustomers();
    } catch (e: any) {
      toast.error("Fallo al registrar", { description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: "Siguiente ➔",
      prevBtnText: "🡨 Anterior",
      doneBtnText: "¡Entendido!",
      popoverClass: 'driver-theme',
      steps: [
        { element: '#tour-customers-search', popover: { title: '🔍 Motor de Búsqueda', description: 'Encuentra a tus clientes deudores rápidamente escribiendo su nombre o teléfono.', side: "bottom", align: 'start' }},
        { element: '#tour-customers-debt', popover: { title: '💰 Capital Atrapado', description: 'Esta métrica resume todo el dinero en mercancía que tienes fiado en la calle. Un termómetro vital para tu liquidez.', side: "bottom", align: 'start' }},
        { element: '#tour-customers-abono', popover: { title: '💵 Cobrar Abonos', description: 'Aquí es donde puedes registrar los pagos parciales o totales de tus clientes para ir disminuyendo su deuda.', side: "left", align: 'start' }}
      ]
    });
    driverObj.drive();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "CASHIER"]}>
      <div className="min-h-[100dvh] bg-muted/30">
        <Sidebar />
        <main className="sm:pl-20">
          <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
            {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <UserRoundCheck className="h-8 w-8 text-primary" />
            Clientes y Fiados
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-2 h-8 w-8 text-primary/80 hover:bg-primary/10 rounded-full" 
              onClick={startTour}
              title="Tour Guiado"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </h1>
          <p className="text-muted-foreground mt-1">
            Revisa las cuentas por cobrar y registra abonos a deudores.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div id="tour-customers-search" className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              autoFocus
              placeholder="Buscar cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-11 bg-background"
            />
          </div>
        </div>
      </div>

      {/* Stats Quick View */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card id="tour-customers-debt" className="bg-primary/10 border-primary/20 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5">
              <HandCoins className="w-4 h-4" /> Capital Atrapado (Por cobrar)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-black text-primary">
              {formatCents(customers.reduce((acc, c) => acc + (c.currentDebt || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table List */}
      <Card className="shadow-sm border-dashed">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-widest">
              <tr>
                <th className="px-6 py-4 rounded-tl-xl whitespace-nowrap">Cliente</th>
                <th className="px-6 py-4 whitespace-nowrap">Contacto</th>
                <th className="px-6 py-4 text-right whitespace-nowrap">Deuda Activa</th>
                <th className="px-6 py-4 whitespace-nowrap">Último Fiado</th>
                <th id="tour-customers-abono" className="px-6 py-4 rounded-tr-xl text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground font-semibold">Cargando cuentas...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground font-semibold">
                    {searchTerm ? "No se encontraron clientes." : "No hay cuentas registradas."}
                  </td>
                </tr>
              ) : filteredCustomers.map(customer => {
                const hasDebt = (customer.currentDebt || 0) > 0;
                return (
                  <tr key={customer.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">
                      {customer.name}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground font-medium flex items-center gap-1.5">
                      {customer.phone ? <><Phone className="w-3 h-3" /> {customer.phone}</> : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasDebt ? (
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 font-bold text-base px-2 py-0.5">
                          -{formatCents(customer.currentDebt || 0)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground font-semibold px-2">Al corriente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs font-semibold">
                      {customer.lastCreditDate ? format(new Date(customer.lastCreditDate), "dd MMM yy, hh:mm a", { locale: es }) : "—"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button 
                        size="sm" 
                        variant={hasDebt ? "default" : "secondary"}
                        disabled={!hasDebt}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setPaymentAmountStr((customer.currentDebt! / 100).toString());
                          setIsPaymentDialogOpen(true);
                        }}
                      >
                        <ArrowDownToLine className="w-4 h-4 mr-1" />
                        Registrar Abono
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Abono */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <HandCoins className="w-5 h-5 text-primary" />
              Recibir Abono
            </DialogTitle>
            <DialogDescription>
              Estás registrando un pago para saldar o reducir la deuda de <strong className="text-foreground">{selectedCustomer?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-center p-4 rounded-xl border-dashed border-2 border-primary/30 bg-primary/5">
                <span className="font-semibold text-muted-foreground text-sm uppercase tracking-wider">Deuda Actual</span>
                <span className="text-2xl font-black text-primary w-auto">
                  {formatCents(selectedCustomer.currentDebt || 0)}
                </span>
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Pago Recibido</Label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-muted-foreground font-bold text-lg">$</span>
                  <Input 
                    type="number"
                    step="0.01"
                    min="1"
                    className="pl-8 h-12 text-xl font-black bg-muted/30"
                    value={paymentAmountStr}
                    onChange={(e) => setPaymentAmountStr(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Método de ingreso</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={paymentMethod === "CASH" ? "default" : "outline"} className={paymentMethod === "CASH" ? "bg-emerald-600 hover:bg-emerald-700" : ""} onClick={() => setPaymentMethod("CASH")}>Efectivo</Button>
                  <Button variant={paymentMethod === "TRANSFER" ? "default" : "outline"} className={paymentMethod === "TRANSFER" ? "bg-violet-600 hover:bg-violet-700" : ""} onClick={() => setPaymentMethod("TRANSFER")}>Transferencia</Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-between grid grid-cols-2 gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>Cancelar</Button>
            <Button disabled={isProcessing} onClick={handleRegisterPayment}>
              {isProcessing ? "Guardando..." : "Confirmar Pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}

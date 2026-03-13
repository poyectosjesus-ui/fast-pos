"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Store, Calculator, UserCircle2, ArrowRight, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [setupData, setSetupData] = useState({
    license: { key: "" },
    business: { name: "", address: "", phone: "", taxId: "" },
    fiscal: { currency: "MXN", taxName: "IVA", taxRate: "1600" },
    admin: { name: "Manager", pin: "" },
  });

  const handleNext = () => {
    // Validaciones base por paso
    if (step === 1 && setupData.license.key.length < 5) {
      return toast.warning("Ingresa una clave de licencia válida.");
    }
    if (step === 2 && !setupData.business.name) {
      return toast.warning("El Nombre del Negocio es obligatorio.");
    }
    if (step === 4 && setupData.admin.pin.length !== 4) {
      return toast.warning("El código PIN debe tener 4 dígitos.");
    }

    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const submitSetup = async () => {
    if (setupData.admin.pin.length !== 4) {
      return toast.warning("El código PIN debe tener 4 dígitos.");
    }

    setIsSubmitting(true);
    const api = (window as any).electronAPI;
    if (!api) {
      toast.error("Motor SQLite no detectado (API missing).");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await api.completeSetup(setupData);
      if (res.success) {
        toast.success("¡Bienvenido a Fast-POS V2!", { description: "Motor de Base de Datos preparado." });
        router.replace("/login");
      } else {
        toast.error("No se pudo configurar la Base de Datos: " + res.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Error Crítico");
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: 1, title: "Licencia", icon: ShieldCheck },
    { id: 2, title: "Tu Negocio", icon: Store },
    { id: 3, title: "Finanzas", icon: Calculator },
    { id: 4, title: "Seguridad", icon: UserCircle2 },
  ];

  return (
    <div className="min-h-screen w-full flex bg-black relative overflow-hidden">
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-10 pointer-events-none">
        <div className="absolute top-[10%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-primary/40 blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-emerald-500/30 blur-[100px]" />
      </div>

      {/* Pane Izquierdo - Status */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] border-r border-neutral-900 bg-neutral-950/50 p-12 z-10 backdrop-blur-sm">
        <div>
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground mb-8 shadow-2xl shadow-primary/20">
            <Store className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white mb-4">Fast-POS</h1>
          <p className="text-neutral-500 font-medium text-sm leading-relaxed">
            Estamos preparando tu entorno local. 
            Esta información quedará encriptada y guardada en tu equipo, sin requerir conexión a internet.
          </p>
        </div>

        <div className="space-y-6">
          {steps.map(s => {
            const isCompleted = step > s.id;
            const isCurrent = step === s.id;
            return (
              <div key={s.id} className="flex items-center gap-4">
                <div className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500",
                  isCompleted ? "bg-primary border-primary text-primary-foreground" : 
                  isCurrent ? "border-primary text-primary shadow-[0_0_15px_rgba(255,255,255,0.1)]" : "border-neutral-800 text-neutral-600"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className={cn("text-sm font-bold uppercase tracking-widest transition-colors", isCurrent ? "text-white" : "text-neutral-500")}>
                    {s.title}
                  </h3>
                  <p className="text-[10px] text-neutral-600 uppercase font-bold tracking-wider">
                    Paso {s.id} de 4
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-[10px] font-bold text-neutral-600 uppercase tracking-[0.2em]">
          NATIVE CORE v2 ENCRYPTION
        </div>
      </div>

      {/* Pane Derecho - Formulario Dinámico */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 z-10">
        <div className="w-full max-w-lg bg-neutral-900/50 border border-neutral-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden">
          
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">Activación Cero</h2>
                <p className="text-sm text-neutral-400">Ingresa la clave de producto otorgada por tu proveedor para desbloquear las capacidades del motor Fast-POS.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300 font-bold uppercase tracking-widest text-xs">Clave de Licencia</Label>
                <Input 
                  placeholder="FAST-XXXX-XXXX"
                  value={setupData.license.key}
                  onChange={e => setSetupData({...setupData, license: { key: e.target.value }})}
                  className="h-14 bg-neutral-950/50 border-neutral-800 text-lg uppercase tracking-widest placeholder:text-neutral-700 focus:border-primary transition-colors rounded-xl font-mono"
                />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">Acerca del Negocio</h2>
                <p className="text-sm text-neutral-400">Estos detalles se imprimirán en la cabecera del Ticket.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300 font-bold uppercase tracking-widest text-xs">Nombre Público (*)</Label>
                <Input 
                  placeholder="Ej. Abarrotes La Esperanza"
                  value={setupData.business.name}
                  onChange={e => setSetupData({...setupData, business: { ...setupData.business, name: e.target.value }})}
                  className="h-12 bg-neutral-950/50 border-neutral-800 text-base focus:border-primary rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Teléfono Visible</Label>
                  <Input 
                    placeholder="555-123-4567"
                    value={setupData.business.phone}
                    onChange={e => setSetupData({...setupData, business: { ...setupData.business, phone: e.target.value }})}
                    className="h-12 bg-neutral-950/50 border-neutral-800 text-sm focus:border-primary rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">RFC / Tax ID</Label>
                  <Input 
                    placeholder="Opcional"
                    value={setupData.business.taxId}
                    onChange={e => setSetupData({...setupData, business: { ...setupData.business, taxId: e.target.value }})}
                    className="h-12 bg-neutral-950/50 border-neutral-800 text-sm focus:border-primary rounded-xl uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Dirección Local</Label>
                <Input 
                  placeholder="Calle Principal #123, Centro"
                  value={setupData.business.address}
                  onChange={e => setSetupData({...setupData, business: { ...setupData.business, address: e.target.value }})}
                  className="h-12 bg-neutral-950/50 border-neutral-800 text-sm focus:border-primary rounded-xl"
                />
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">Sistema Monetario</h2>
                <p className="text-sm text-neutral-400">Personaliza la presentación de la moneda y los recargos impositivos por defecto.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Moneda Principal</Label>
                  <Select value={setupData.fiscal.currency} onValueChange={(val) => setSetupData({...setupData, fiscal: { ...setupData.fiscal, currency: val || "MXN" }})}>
                    <SelectTrigger className="h-12 bg-neutral-950/50 border-neutral-800 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MXN">Pesos Mexicanos (MXN)</SelectItem>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                      <SelectItem value="EUR">Euros (EUR)</SelectItem>
                      <SelectItem value="GTQ">Quetzales (GTQ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Acrónimo Impuesto</Label>
                  <Input 
                    placeholder="Ej. IVA o TAX"
                    value={setupData.fiscal.taxName}
                    onChange={e => setSetupData({...setupData, fiscal: { ...setupData.fiscal, taxName: e.target.value }})}
                    className="h-12 bg-neutral-950/50 border-neutral-800 text-sm focus:border-primary rounded-xl uppercase"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Tasa Impositiva Base (Base points, 1600 = 16%)</Label>
                  <Select value={setupData.fiscal.taxRate} onValueChange={(val) => setSetupData({...setupData, fiscal: { ...setupData.fiscal, taxRate: val || "0" }})}>
                    <SelectTrigger className="h-12 bg-neutral-950/50 border-neutral-800 rounded-xl font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1600">16.0% (General)</SelectItem>
                      <SelectItem value="800">8.0% (Fronterizo)</SelectItem>
                      <SelectItem value="2100">21.0%</SelectItem>
                      <SelectItem value="0">0% (Libre de Impuestos)</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="mb-8">
                <h2 className="text-2xl font-black text-white mb-2">Crear Propietario</h2>
                <p className="text-sm text-neutral-400">Genera la cuenta principal con privilegios del sistema.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Tu Nombre</Label>
                <Input 
                  placeholder="Tu nombre de pila"
                  value={setupData.admin.name}
                  onChange={e => setSetupData({...setupData, admin: { ...setupData.admin, name: e.target.value }})}
                  className="h-12 bg-neutral-950/50 border-neutral-800 text-base focus:border-primary rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-neutral-300 font-bold uppercase tracking-widest text-[10px]">Código PIN (4 Dígitos)</Label>
                <Input 
                  type="password"
                  maxLength={4}
                  placeholder="****"
                  value={setupData.admin.pin}
                  onChange={e => setSetupData({...setupData, admin: { ...setupData.admin, pin: e.target.value.replace(/[^0-9]/g, '') }})}
                  className="h-14 bg-neutral-950/50 border-neutral-800 text-3xl font-mono tracking-[1em] text-center focus:border-emerald-500 rounded-xl"
                />
                <p className="text-[10px] text-neutral-600 uppercase font-bold text-center mt-2">
                  No olvides este PIN, lo ocuparás para desbloquear el Punto de Venta.
                </p>
              </div>
            </div>
          )}

          {/* Botonera de Navegación del Modal */}
          <div className="flex items-center justify-between mt-12 pt-6 border-t border-neutral-800/50">
            <Button 
              variant="ghost" 
              onClick={handleBack} 
              disabled={step === 1 || isSubmitting}
              className="text-neutral-400 hover:text-white rounded-xl uppercase font-bold text-[10px] tracking-widest h-11 px-6 disabled:opacity-0 transition-opacity"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Atrás
            </Button>
            
            {step < 4 ? (
              <Button 
                onClick={handleNext} 
                className="rounded-xl font-bold uppercase text-[10px] tracking-widest h-11 px-6"
              >
                Siguiente <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={submitSetup} 
                disabled={isSubmitting}
                className="rounded-xl font-bold uppercase text-[10px] tracking-widest h-11 px-6 bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border-none"
              >
                {isSubmitting ? "Construyendo Motor..." : "Guardar e Iniciar"} 
                {!isSubmitting && <KeyRound className="w-4 h-4 ml-2" />}
              </Button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

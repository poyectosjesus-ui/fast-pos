"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LicenseExpiredPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleValidate = async () => {
    if (key.length < 10) return toast.error("Llave de Licencia muy corta");
    
    setIsVerifying(true);
    try {
      const api = (window as any).electronAPI;
      if (!api) throw new Error("Entorno Node no encontrado");

      const check = await api.validateLicense(key);

      if (check.isValid) {
        // Renovar licencia en BD
        await api.setSetting("license_key", key);
        await api.setSetting("license_plan", check.payload.plan);
        await api.setSetting("license_expires", String(check.payload.exp));

        toast.success("¡Licencia Renovada con Éxito!");
        setTimeout(() => {
          router.replace("/login");
        }, 1500);
      } else {
        toast.error(check.error || "Licencia no válida o expirada");
        setKey("");
        setIsVerifying(false);
      }
    } catch (err: any) {
      toast.error(err.message || "Error Crítico del Sistema");
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden">
      
      {/* Background Decorativo Rojo/Sangre */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[50vw] h-[50vw] rounded-full bg-red-600/30 blur-[120px]" />
        <div className="absolute bottom-[0%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-orange-600/20 blur-[100px]" />
      </div>

      <div className="w-full max-w-md bg-neutral-900/60 border border-red-900/50 rounded-3xl p-8 shadow-2xl backdrop-blur-md relative overflow-hidden z-10 text-center animate-in zoom-in-95 duration-500">
        
        <div className="w-20 h-20 rounded-2xl bg-red-950/50 border border-red-900/50 flex items-center justify-center mx-auto mb-6 shadow-xl text-red-500">
          <ShieldAlert className="w-10 h-10" />
        </div>
        
        <h1 className="text-3xl font-black tracking-tight text-white mb-2">Sistema Bloqueado</h1>
        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
          La licencia criptográfica de esta instalación ha expirado o es inválida. 
          Contacta a tu proveedor para adquirir una llave de renovación.
        </p>

        <div className="space-y-4 text-left">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest pl-1">
            Nueva Clave de Activación
          </label>
          <Input 
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="FAST-... "
            className="h-14 bg-neutral-950/80 border-neutral-800 text-center font-mono text-sm text-white focus:border-red-500 rounded-xl"
            disabled={isVerifying}
          />
          <Button 
            disabled={isVerifying || key.length < 5}
            onClick={handleValidate}
            className="w-full h-14 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-900/20 font-bold uppercase tracking-widest text-xs"
          >
            {isVerifying ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Verificando Criptografía...</>
            ) : (
              <><KeyRound className="w-5 h-5 mr-2" /> Desbloquear Sistema</>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-neutral-600 font-medium uppercase tracking-[0.2em] mt-10">
          Fast-POS Asymmetric Security
        </p>
      </div>

    </div>
  );
}

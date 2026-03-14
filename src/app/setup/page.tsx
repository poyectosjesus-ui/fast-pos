"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Store,
  Calculator,
  UserCircle2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  Globe,
  Smartphone,
  Instagram,
  Facebook,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";
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

// ─── helpers ───────────────────────────────────────────────────────────────
const PHONE_RE = /^[0-9\-\+\(\)\s]{7,20}$/;
const URL_RE = /^(https?:\/\/)?([\w-]+(\.[\w-]+)+)(\/\S*)?$/;
function isEmpty(s: string) { return !s || !s.trim(); }
function validPhone(s: string) { return isEmpty(s) || PHONE_RE.test(s.trim()); }
function validUrl(s: string) { return isEmpty(s) || URL_RE.test(s.trim()); }

// ─── Datos por paso ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Activación", sublabel: "Licencia del producto", icon: ShieldCheck, img: "/wizard-license.png", badge: "Requerido" },
  { id: 2, label: "Negocio", sublabel: "Datos de la empresa", icon: Store, img: "/wizard-business.png", badge: "Requerido" },
  { id: 3, label: "Configuración", sublabel: "Moneda e impuestos", icon: Calculator, img: "/wizard-fiscal.png", badge: "Requerido" },
  { id: 4, label: "Presencia", sublabel: "Redes y contacto", icon: Globe, img: "/wizard-social.png", badge: "Opcional" },
  { id: 5, label: "Administrador", sublabel: "Cuenta maestra", icon: UserCircle2, img: "/wizard-admin.png", badge: "Requerido" },
];

// ─── Componente ─────────────────────────────────────────────────────────────
export default function SetupWizardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [setupData, setSetupData] = useState({
    license: { key: "" },
    business: { name: "", address: "", phone: "", taxId: "" },
    fiscal: { currency: "MXN", taxName: "IVA", taxRate: "1600" },
    social: { whatsapp: "", instagram: "", facebook: "", website: "" },
    admin: { name: "", pin: "", pinConfirm: "" },
  });

  // ── helpers locales ──────────────────────────────────────────────────────
  function setErr(field: string, msg: string) {
    setFieldErrors(prev => ({ ...prev, [field]: msg }));
  }
  function clearErr(field: string) {
    setFieldErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }
  function hasErr(field: string) { return !!fieldErrors[field]; }

  function updateBusiness(key: string, val: string) {
    clearErr(key);
    setSetupData(p => ({ ...p, business: { ...p.business, [key]: val } }));
  }
  function updateSocial(key: string, val: string) {
    clearErr(key);
    setSetupData(p => ({ ...p, social: { ...p.social, [key]: val } }));
  }
  function updateAdmin(key: string, val: string) {
    clearErr(key);
    setSetupData(p => ({ ...p, admin: { ...p.admin, [key]: val } }));
  }

  // ── Validaciones por paso ────────────────────────────────────────────────
  async function validateStep(): Promise<boolean> {
    const api = (window as any).electronAPI;
    setFieldErrors({});

    // Paso 1 – Licencia
    if (step === 1) {
      const key = setupData.license.key.trim();
      if (key.length < 10) { setErr("key", "Ingrese la clave de producto completa."); return false; }
      if (!key.startsWith("FAST-")) { setErr("key", "La clave debe comenzar con 'FAST-'."); return false; }
      if (!api) { toast.error("Motor de aplicación no detectado."); return false; }

      setIsValidatingKey(true);
      try {
        const res = await api.validateLicense(key);
        if (!res.isValid) {
          setErr("key", res.error || "Clave de licencia inválida o expirada.");
          return false;
        }
        setSetupData(p => ({ ...p, license: { key } }));
        toast.success("Licencia autenticada correctamente.");
        return true;
      } catch {
        setErr("key", "Error al comunicarse con el validador. Intente nuevamente.");
        return false;
      } finally {
        setIsValidatingKey(false);
      }
    }

    // Paso 2 – Negocio
    if (step === 2) {
      let ok = true;
      if (isEmpty(setupData.business.name)) { setErr("name", "El nombre del negocio es obligatorio."); ok = false; }
      if (!isEmpty(setupData.business.phone) && !validPhone(setupData.business.phone)) {
        setErr("phone", "Teléfono con formato inválido (ej. 55-1234-5678)."); ok = false;
      }
      return ok;
    }

    // Paso 3 – Fiscal (siempre válido, valores predeterminados seguros)
    if (step === 3) return true;

    // Paso 4 – Redes (opcional, pero validar formato si hay contenido)
    if (step === 4) {
      let ok = true;
      if (!isEmpty(setupData.social.website) && !validUrl(setupData.social.website)) {
        setErr("website", "Ingrese una dirección web válida (ej. www.minegocio.com)."); ok = false;
      }
      return ok;
    }

    // Paso 5 – Administrador
    if (step === 5) {
      let ok = true;
      if (isEmpty(setupData.admin.name)) { setErr("aName", "El nombre del administrador es obligatorio."); ok = false; }
      if (setupData.admin.pin.length !== 4) { setErr("pin", "El PIN debe ser exactamente 4 dígitos numéricos."); ok = false; }
      if (setupData.admin.pin !== setupData.admin.pinConfirm) { setErr("pinConfirm", "Los PINs no coinciden."); ok = false; }
      return ok;
    }

    return true;
  }

  const handleNext = async () => {
    const valid = await validateStep();
    if (!valid) return;
    if (step < 5) setStep(s => s + 1);
  };

  const handleBack = () => {
    setFieldErrors({});
    if (step > 1) setStep(s => s - 1);
  };

  const submitSetup = async () => {
    const valid = await validateStep();
    if (!valid) return;

    setIsSubmitting(true);
    const api = (window as any).electronAPI;
    try {
      const res = await api.completeSetup(setupData);
      if (res.success) {
        toast.success("Sistema configurado correctamente.", { description: "Redireccionando al inicio de sesión..." });
        router.replace("/login");
      } else {
        toast.error("No se pudo completar la configuración.", { description: res.error });
      }
    } catch {
      toast.error("Error inesperado durante la configuración.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = STEPS[step - 1];
  const isLastStep = step === 5;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full flex bg-[#050505] text-white overflow-hidden">

      {/* ── Panel lateral ── */}
      <aside className="hidden lg:flex flex-col w-[360px] border-r border-white/[0.06] bg-white/[0.015] relative z-20 shrink-0">
        {/* Header del panel */}
        <div className="p-10 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md border border-white/10 p-2">
              <img src="/pos.svg" alt="Fast POS" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] leading-none mb-0.5">Fast-POS</p>
              <p className="text-base font-black tracking-tight leading-none">Configuración inicial</p>
            </div>
          </div>
          <p className="text-neutral-500 text-xs leading-relaxed mt-4">
            Complete cada sección para activar y personalizar su sistema de punto de venta. La información ingresada se almacena de forma cifrada en este dispositivo.
          </p>
        </div>

        {/* Pasos */}
        <nav className="flex-1 p-8 space-y-1">
          {STEPS.map((s, idx) => {
            const done = step > s.id;
            const active = step === s.id;
            return (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-xl transition-all",
                  active ? "bg-white/[0.05] border border-white/[0.08]" : "opacity-50"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-lg border shrink-0 transition-all",
                  done ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                    active ? "bg-white/10 border-white/20 text-white" :
                      "bg-white/[0.03] border-white/5 text-neutral-600"
                )}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <s.icon className="w-3.5 h-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-bold leading-none mb-0.5", active ? "text-white" : "text-neutral-400")}>{s.label}</p>
                  <p className="text-[10px] text-neutral-600 truncate">{s.sublabel}</p>
                </div>
                {active && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 shrink-0">
                    Activo
                  </span>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-8 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Lock className="h-3 w-3 text-neutral-600" />
            <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest">Cifrado local · Sin conexión requerida</span>
          </div>
        </div>
      </aside>

      {/* ── Área principal ── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Imagen de contexto (cambia por paso) */}
        <div className="relative h-44 shrink-0 overflow-hidden">
          <img
            key={currentStep.img}
            src={currentStep.img}
            alt={currentStep.label}
            className="w-full h-full object-cover opacity-30 animate-in fade-in duration-700"
          />
          {/* Gradiente oscurecedor */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/60 to-transparent" />
          {/* Badge del paso */}
          <div className="absolute bottom-4 left-8 flex items-center gap-3">
            <span className={cn(
              "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded border",
              currentStep.badge === "Opcional"
                ? "text-neutral-400 border-neutral-700 bg-neutral-900/50"
                : "text-primary border-primary/30 bg-primary/10"
            )}>
              {currentStep.badge}
            </span>
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
              Paso {step} de {STEPS.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${(step / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Contenido del formulario */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-10">

            {/* Título del paso */}
            <div className="mb-10 animate-in fade-in slide-in-from-bottom-2 duration-400">
              <h1 className="text-3xl font-black tracking-tight mb-2">{currentStep.label}</h1>
              <p className="text-neutral-400 text-sm">{currentStep.sublabel}</p>
            </div>

            {/* ── PASO 1: Licencia ── */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-sm text-neutral-400 leading-relaxed">
                  <span className="font-bold text-blue-400">Nota:</span> La clave de activación fue entregada al momento de adquirir su licencia. Ingrésela exactamente como aparece en el documento de entrega.
                </div>

                <FieldWrapper label="Clave de Activación" error={fieldErrors["key"]} required>
                  <Input
                    placeholder="FAST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx"
                    disabled={isValidatingKey}
                    value={setupData.license.key}
                    onChange={e => {
                      clearErr("key");
                      setSetupData(p => ({ ...p, license: { key: e.target.value } }));
                    }}
                    className={inputCls(hasErr("key"))}
                  />
                  {isValidatingKey && (
                    <p className="text-xs text-primary flex items-center gap-1.5 mt-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" /> Verificando autenticidad de la licencia...
                    </p>
                  )}
                </FieldWrapper>
              </div>
            )}

            {/* ── PASO 2: Negocio ── */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400">
                <p className="text-sm text-neutral-500">
                  Esta información se imprimirá en el encabezado de sus tickets y reportes. Puede modificarla posteriormente desde Ajustes.
                </p>

                <FieldWrapper label="Nombre del negocio" error={fieldErrors["name"]} required>
                  <Input placeholder="Ej. Distribuidora Central S.A. de C.V." value={setupData.business.name}
                    onChange={e => updateBusiness("name", e.target.value)} className={inputCls(hasErr("name"))} />
                </FieldWrapper>

                <div className="grid grid-cols-2 gap-4">
                  <FieldWrapper label="Teléfono de contacto" error={fieldErrors["phone"]}>
                    <Input placeholder="55-1234-5678" value={setupData.business.phone}
                      onChange={e => updateBusiness("phone", e.target.value)} className={inputCls(hasErr("phone"))} />
                  </FieldWrapper>
                  <FieldWrapper label="RFC / ID Fiscal" error={fieldErrors["taxId"]}>
                    <Input placeholder="XAXX010101000 (opcional)" value={setupData.business.taxId}
                      onChange={e => updateBusiness("taxId", e.target.value.toUpperCase())} className={inputCls(hasErr("taxId"))} />
                  </FieldWrapper>
                </div>

                <FieldWrapper label="Dirección" error={fieldErrors["address"]}>
                  <Input placeholder="Calle, Número, Colonia, Ciudad, C.P." value={setupData.business.address}
                    onChange={e => updateBusiness("address", e.target.value)} className={inputCls(hasErr("address"))} />
                </FieldWrapper>
              </div>
            )}

            {/* ── PASO 3: Fiscal ── */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-400">
                <p className="text-sm text-neutral-500">
                  Defina la moneda principal y la configuración de impuestos aplicables a sus ventas. Esta configuración afecta todos los cálculos del sistema.
                </p>

                <div className="grid grid-cols-2 gap-5">
                  <FieldWrapper label="Moneda" required>
                    <Select value={setupData.fiscal.currency} onValueChange={val => setSetupData(p => ({ ...p, fiscal: { ...p.fiscal, currency: val } }))}>
                      <SelectTrigger className={inputCls(false)}><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-neutral-950 border-white/10">
                        <SelectItem value="MXN">MXN — Peso Mexicano</SelectItem>
                        <SelectItem value="USD">USD — Dólar Estadounidense</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                        <SelectItem value="GTQ">GTQ — Quetzal Guatemalteco</SelectItem>
                        <SelectItem value="COP">COP — Peso Colombiano</SelectItem>
                        <SelectItem value="CLP">CLP — Peso Chileno</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldWrapper>
                  <FieldWrapper label="Etiqueta del Impuesto" required>
                    <Input placeholder="IVA" value={setupData.fiscal.taxName}
                      onChange={e => setSetupData(p => ({ ...p, fiscal: { ...p.fiscal, taxName: e.target.value.toUpperCase() } }))}
                      className={inputCls(false)} maxLength={10} />
                  </FieldWrapper>
                </div>

                <FieldWrapper label="Tasa de Impuesto Predeterminada" required>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-1">
                    {[
                      { label: "16%", sub: "Tasa general", value: "1600" },
                      { label: "8%", sub: "Zona fronteriza", value: "800" },
                      { label: "21%", sub: "Tasa especial", value: "2100" },
                      { label: "0%", sub: "Sin impuestos", value: "0" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setSetupData(p => ({ ...p, fiscal: { ...p.fiscal, taxRate: opt.value } }))}
                        className={cn(
                          "flex flex-col items-center p-4 rounded-xl border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50",
                          setupData.fiscal.taxRate === opt.value
                            ? "bg-primary/10 border-primary/50 text-primary"
                            : "bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:border-white/15"
                        )}>
                        <span className="text-xl font-black leading-none">{opt.label}</span>
                        <span className="text-[9px] uppercase tracking-wide mt-1 opacity-70 text-center leading-tight">{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </FieldWrapper>
              </div>
            )}

            {/* ── PASO 4: Redes sociales ── */}
            {step === 4 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400">
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-neutral-400">
                  Esta información es <span className="text-white font-semibold">opcional</span> y se imprimirá al pie de sus tickets y reportes para facilitar el contacto con sus clientes.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FieldWrapper label="WhatsApp" hint="Número con código de país">
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                      <Input placeholder="+52 55 1234 5678" value={setupData.social.whatsapp}
                        onChange={e => updateSocial("whatsapp", e.target.value)}
                        className={cn(inputCls(false), "pl-9")} />
                    </div>
                  </FieldWrapper>
                  <FieldWrapper label="Instagram">
                    <div className="relative">
                      <Instagram className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-pink-500" />
                      <Input placeholder="@su_negocio" value={setupData.social.instagram}
                        onChange={e => updateSocial("instagram", e.target.value)}
                        className={cn(inputCls(false), "pl-9")} />
                    </div>
                  </FieldWrapper>
                  <FieldWrapper label="Facebook">
                    <div className="relative">
                      <Facebook className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-500" />
                      <Input placeholder="facebook.com/su-pagina" value={setupData.social.facebook}
                        onChange={e => updateSocial("facebook", e.target.value)}
                        className={cn(inputCls(false), "pl-9")} />
                    </div>
                  </FieldWrapper>
                  <FieldWrapper label="Sitio Web" error={fieldErrors["website"]}>
                    <div className="relative">
                      <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      <Input placeholder="www.sunegocio.com" value={setupData.social.website}
                        onChange={e => updateSocial("website", e.target.value)}
                        className={cn(inputCls(hasErr("website")), "pl-9")} />
                    </div>
                  </FieldWrapper>
                </div>
              </div>
            )}

            {/* ── PASO 5: Administrador ── */}
            {step === 5 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400">
                <div className="p-4 rounded-xl bg-amber-500/[0.05] border border-amber-500/10 text-sm text-neutral-400">
                  <span className="font-bold text-amber-400">Importante:</span> El PIN de administrador otorga acceso completo al sistema. Guárdelo en un lugar seguro. No es recuperable sin intervención técnica.
                </div>

                <FieldWrapper label="Nombre del administrador" error={fieldErrors["aName"]} required>
                  <Input placeholder="Nombre completo" value={setupData.admin.name}
                    onChange={e => updateAdmin("name", e.target.value)} className={inputCls(hasErr("aName"))} />
                </FieldWrapper>

                <div className="grid grid-cols-2 gap-4">
                  <FieldWrapper label="PIN de acceso" hint="4 dígitos numéricos" error={fieldErrors["pin"]} required>
                    <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                      value={setupData.admin.pin}
                      onChange={e => updateAdmin("pin", e.target.value.replace(/[^0-9]/g, ""))}
                      className={cn(inputCls(hasErr("pin")), "text-center text-2xl font-mono tracking-[0.5em]")} />
                  </FieldWrapper>
                  <FieldWrapper label="Confirmar PIN" error={fieldErrors["pinConfirm"]} required>
                    <Input type="password" inputMode="numeric" maxLength={4} placeholder="••••"
                      value={setupData.admin.pinConfirm}
                      onChange={e => updateAdmin("pinConfirm", e.target.value.replace(/[^0-9]/g, ""))}
                      className={cn(inputCls(hasErr("pinConfirm")), "text-center text-2xl font-mono tracking-[0.5em]")} />
                  </FieldWrapper>
                </div>
              </div>
            )}

            {/* ── Navegación ── */}
            <div className="flex items-center justify-between mt-14 pt-8 border-t border-white/[0.06]">
              <Button variant="ghost" onClick={handleBack} disabled={step === 1 || isSubmitting || isValidatingKey}
                className="text-neutral-500 hover:text-white px-0 disabled:opacity-0 transition-opacity flex items-center gap-2 text-sm font-semibold">
                <ArrowLeft className="h-4 w-4" /> Regresar
              </Button>

              {isLastStep ? (
                <Button onClick={submitSetup} disabled={isSubmitting}
                  className="h-12 px-8 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_8px_30px_rgba(16,185,129,0.25)] border-0 transition-all active:scale-[0.98]">
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Procesando...</>
                    : <><KeyRound className="h-4 w-4 mr-2" />Finalizar configuración</>}
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={isValidatingKey}
                  className="h-12 px-8 rounded-xl font-bold text-sm bg-white text-black hover:bg-neutral-100 shadow-[0_8px_24px_rgba(255,255,255,0.08)] transition-all active:scale-[0.98]">
                  {isValidatingKey
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validando...</>
                    : <>Continuar <ArrowRight className="h-4 w-4 ml-2" /></>}
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-componentes de ayuda ────────────────────────────────────────────────
function FieldWrapper({
  label, error, hint, required, children
}: {
  label: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-neutral-300 uppercase tracking-widest flex items-center gap-1">
        {label}
        {required && <span className="text-red-500 text-base leading-none">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[10px] text-neutral-600">{hint}</p>}
      {error && (
        <p className="text-[11px] text-red-400 flex items-center gap-1.5 font-medium">
          <AlertCircle className="h-3 w-3 shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "h-11 bg-white/[0.03] border rounded-xl text-sm transition-colors focus:ring-2 placeholder:text-neutral-700",
    hasError
      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/10"
      : "border-white/[0.08] focus:border-primary/60 focus:ring-primary/10"
  );
}

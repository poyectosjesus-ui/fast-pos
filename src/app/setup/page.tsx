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
    business: { name: "", address: "", phone: "", taxId: "", businessType: "", businessTypeCustom: "" },
    fiscal: { currency: "MXN", taxName: "IVA", taxRate: "1600" },
    social: { whatsapp: "", instagram: "", facebook: "", website: "" },
    admin: { name: "", pin: "", pinConfirm: "" },
  });
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

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
      if (!privacyAccepted) { setErr("privacy", "Debe aceptar los Términos y el Aviso de Privacidad para continuar."); ok = false; }
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
                  <span className="font-bold text-blue-400">Nota:</span> La clave de activación fue entregada en forma de archivo <code className="bg-white/10 px-1 rounded text-white font-mono">.fastkey</code> al adquirir su licencia. También puede ingresarla manualmente.
                </div>

                {/* Opción primaria: cargar archivo .fastkey */}
                <button
                  type="button"
                  disabled={isValidatingKey}
                  onClick={async () => {
                    const api = (window as any).electronAPI;
                    if (!api) return toast.error("Motor de aplicación no detectado.");
                    const res = await api.openLicenseFile();
                    if (res.canceled) return;
                    if (!res.success) {
                      setErr("key", res.error || "No se pudo leer el archivo.");
                      return;
                    }
                    clearErr("key");
                    setLoadedFileName(res.fileName!);
                    setSetupData(p => ({ ...p, license: { key: res.key! } }));
                    toast.success("Archivo de licencia cargado.", { description: res.fileName });
                  }}
                  className="w-full flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/40 hover:bg-white/[0.02] transition-all group cursor-pointer disabled:opacity-50"
                >
                  {loadedFileName ? (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white font-mono">{loadedFileName}</p>
                        <p className="text-xs text-emerald-400 mt-0.5">Archivo cargado — listo para verificar</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center group-hover:bg-primary/10 group-hover:border-primary/30 transition-all">
                        <KeyRound className="h-6 w-6 text-neutral-500 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-neutral-300">Cargar archivo de licencia</p>
                        <p className="text-xs text-neutral-600 mt-0.5">Seleccionar archivo <span className="text-neutral-400 font-mono">.fastkey</span></p>
                      </div>
                    </>
                  )}
                </button>

                {/* Separador */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">o ingrese manualmente</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>

                {/* Opción secundaria: texto manual */}
                <FieldWrapper label="Clave de Activación" error={fieldErrors["key"]}>
                  <Input
                    placeholder="FAST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxxxxxx"
                    disabled={isValidatingKey}
                    value={setupData.license.key}
                    onChange={e => {
                      clearErr("key");
                      setLoadedFileName(null);
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

                {/* Giro del negocio */}
                <FieldWrapper label="Giro o Actividad Principal" hint="Seleccione la categoría que mejor describe su negocio">
                  <Select
                    value={setupData.business.businessType}
                    onValueChange={val => updateBusiness("businessType", val ?? "")}
                  >
                    <SelectTrigger className={inputCls(false)}>
                      <SelectValue placeholder="Seleccionar giro..." />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-950 border-white/10 max-h-64">
                      {[
                        "Abarrotes / Minisuper",
                        "Restaurante / Taquería / Fonda",
                        "Papelería / Librería",
                        "Ropa / Calzado / Accesorios",
                        "Farmacia / Botica",
                        "Ferretería / Tlapalería",
                        "Panadería / Pastelería / Repostería",
                        "Estética / Salón de Belleza",
                        "Taller Mecánico / Vulcanizadora",
                        "Electrónica / Celulares / Cómputo",
                        "Verdulería / Frutería",
                        "Carnicería / Pescadería",
                        "Cafetería / Dulcería / Heladería",
                        "Joyería / Relojería",
                        "Lavandería / Tintorería",
                        "Materiales para Construcción",
                        "Servicios Profesionales",
                        "Otro",
                      ].map(giro => (
                        <SelectItem key={giro} value={giro}>{giro}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldWrapper>

                {/* Campo libre si eligió "Otro" */}
                {setupData.business.businessType === "Otro" && (
                  <FieldWrapper label="Especifique el giro" required>
                    <Input
                      placeholder="Ej. Vivero, Videojuegos, Veterinaria..."
                      value={setupData.business.businessTypeCustom}
                      onChange={e => updateBusiness("businessTypeCustom", e.target.value)}
                      className={inputCls(false)}
                    />
                  </FieldWrapper>
                )}

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
                    <Select value={setupData.fiscal.currency} onValueChange={val => setSetupData(p => ({ ...p, fiscal: { ...p.fiscal, currency: val ?? p.fiscal.currency } }))}>
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

                {/* ── Aviso de Privacidad + Términos ── */}
                <div className="pt-2">
                  {/* Toggle para leer */}
                  <button
                    type="button"
                    onClick={() => setShowPrivacy(v => !v)}
                    className="w-full flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/10 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Lock className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-xs font-bold text-neutral-300">Aviso de Privacidad y Términos de Uso</span>
                    </div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                      {showPrivacy ? "Cerrar" : "Leer"}
                    </span>
                  </button>

                  {/* Contenido legal expandible */}
                  {showPrivacy && (
                    <div className="mt-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 text-[11px] text-neutral-400 leading-relaxed max-h-52 overflow-y-auto space-y-3 scrollbar-thin scrollbar-track-white/5 scrollbar-thumb-white/10">
                      <p className="font-bold text-white text-xs">AVISO DE PRIVACIDAD — Fast-POS</p>
                      <p><span className="text-neutral-300 font-semibold">Responsable del tratamiento:</span> El proveedor de la licencia Fast-POS (en adelante &quot;Fast-POS&quot;) es responsable del tratamiento de sus datos personales, conforme a lo establecido en la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento.</p>
                      <p><span className="text-neutral-300 font-semibold">Datos que recopilamos:</span> Durante el proceso de configuración inicial, recopilamos: nombre del negocio, giro comercial, datos de contacto (teléfono, dirección, RFC), nombre del administrador, información de presencia digital (redes sociales y sitio web), así como información técnica del dispositivo (sistema operativo, versión del software) con fines de soporte técnico.</p>
                      <p><span className="text-neutral-300 font-semibold">Finalidades del tratamiento:</span> Los datos son utilizados exclusivamente para: (1) Gestión y validación de licencias de uso del software, (2) Prestación de servicios de soporte técnico, (3) Envío de notificaciones relacionadas con el servicio (renovaciones, actualizaciones), (4) Mejora continua del producto.</p>
                      <p><span className="text-neutral-300 font-semibold">Transferencia de datos:</span> Sus datos no serán compartidos con terceros ajenos a Fast-POS, salvo obligación legal expresa.</p>
                      <p><span className="text-neutral-300 font-semibold">Derechos ARCO:</span> Usted tiene derecho a Acceder, Rectificar, Cancelar u Oponerse al tratamiento de sus datos personales. Para ejercer estos derechos, comuníquese con el responsable a través de los canales de soporte de Fast-POS.</p>
                      <p><span className="text-neutral-300 font-semibold">Datos operativos del negocio:</span> La información de ventas, productos, clientes y movimientos registrada en el sistema es propiedad exclusiva del usuario. Fast-POS no accede a estos datos con fines comerciales ni los comparte con terceros.</p>
                      <p className="border-t border-white/[0.06] pt-3 font-bold text-white text-xs">TÉRMINOS DE USO — Fast-POS</p>
                      <p><span className="text-neutral-300 font-semibold">Licencia de uso:</span> Fast-POS otorga una licencia de uso no exclusiva, intransferible y limitada al número de instalaciones estipuladas en la licencia adquirida. Queda prohibida la reproducción, distribución, modificación o ingeniería inversa del software.</p>
                      <p><span className="text-neutral-300 font-semibold">Vigencia:</span> La licencia es válida por el período indicado al momento de la activación. Al vencimiento, el acceso al sistema puede restringirse hasta la renovación de la misma.</p>
                      <p><span className="text-neutral-300 font-semibold">Limitación de responsabilidad:</span> Fast-POS no se hace responsable por pérdidas de datos derivadas de fallos del hardware, cortes de energía, uso indebido del software o eventos de fuerza mayor. Se recomienda realizar respaldos periódicos de la base de datos.</p>
                      <p><span className="text-neutral-300 font-semibold">Modificaciones:</span> Fast-POS se reserva el derecho de actualizar los presentes términos. Las modificaciones serán notificadas a través de los canales oficiales del producto.</p>
                      <p className="text-neutral-600">Versión 1.0 — Marzo 2026</p>
                    </div>
                  )}

                  {/* Checkbox de aceptación */}
                  <button
                    type="button"
                    onClick={() => { setPrivacyAccepted(v => !v); clearErr("privacy"); }}
                    className="mt-3 flex items-start gap-3 w-full text-left"
                  >
                    <div className={cn(
                      "mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-all",
                      privacyAccepted
                        ? "bg-primary border-primary"
                        : hasErr("privacy")
                          ? "border-red-500 bg-red-500/5"
                          : "border-white/20 bg-white/[0.02]"
                    )}>
                      {privacyAccepted && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    <span className="text-xs text-neutral-400 leading-relaxed">
                      He leído y acepto el <span className="text-white font-semibold">Aviso de Privacidad</span> y los <span className="text-white font-semibold">Términos de Uso</span> de Fast-POS. Entiendo el alcance del tratamiento de mis datos personales.
                    </span>
                  </button>
                  {fieldErrors["privacy"] && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1.5 mt-1.5 font-medium">
                      <AlertCircle className="h-3 w-3 shrink-0" />{fieldErrors["privacy"]}
                    </p>
                  )}
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

"use client";

/**
 * SETTINGS PAGE — Fast-POS 2.0
 *
 * Responsabilidad: Configuración del sistema, respaldos nativos SQLite,
 *   diagnóstico de hardware y datos del negocio.
 * Fuente de Verdad: ARCHITECTURE.md §2.2, implementation_plan.md FASE 1
 *
 * Cambios v2.0:
 *   - Backup/Restore ahora usa db:exportSqlite / db:importSqlite (nativo)
 *   - Se elimina la dependencia de Dexie / dexie-export-import
 *   - Nueva pestaña "Negocio" con datos del local y configuración IVA
 */

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  RefreshCcw,
  Trash2,
  Scan,
  Keyboard,
  Activity,
  Store,
  Printer,
  Users,
  Palette,
  Instagram,
  MessageCircle,
  Globe,
  Image as ImageIcon,
  Sun,
  Moon,
  KeyRound,
  BadgeCheck,
  Calendar,
  Clock,
  CircleAlert,
  ShoppingBag,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { BarcodeHandler } from "@/components/shared/barcode-handler";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { useThemeStore } from "@/store/useThemeStore";
import { useSessionStore } from "@/store/useSessionStore";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────
// Sub-componente: Panel de Licencia Activa
// ─────────────────────────────────────────────

function LicensePanel() {
  const [licInfo, setLicInfo] = useState<{
    key?: string;
    plan?: string;
    exp?: string;
    client?: string;
    isValid?: boolean;
    daysLeft?: number | null;
  } | null>(null);

  useEffect(() => {
    const api = (window as Window & { electronAPI?: any }).electronAPI;
    if (!api) return;
    api.getAllSettings().then((settings: Record<string, string>) => {
      const key = settings["license_key"] || "";
      const plan = settings["license_plan"] || "—";
      const exp  = settings["license_expires"] || "LIFETIME";
      const client = settings["license_client"] || "—";

      // Calcular días restantes
      let daysLeft: number | null = null;
      let isValid = true;
      if (exp !== "LIFETIME" && exp) {
        const msLeft = parseInt(exp) - Date.now();
        daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        if (daysLeft <= 0) isValid = false;
      }

      setLicInfo({ key: key.slice(0, 16) + "...", plan, exp, client, isValid, daysLeft });
    }).catch(() => {});
  }, []);

  if (!licInfo) return null;

  const isLifetime = licInfo.exp === "LIFETIME";
  const isExpired  = !licInfo.isValid;
  const isWarning  = !isLifetime && !isExpired && (licInfo.daysLeft ?? -1) >= 0 && (licInfo.daysLeft ?? 999) <= 30;

  return (
    <Card className={cn(
      "border overflow-hidden",
      isExpired  ? "border-red-500/30 bg-red-500/[0.03]" :
      isWarning  ? "border-amber-500/30 bg-amber-500/[0.03]" :
                   "border-primary/20 bg-primary/[0.03]"
    )}>
      <CardHeader className="flex flex-row items-center gap-4 pb-3">
        <div className={cn(
          "p-2.5 rounded-xl",
          isExpired ? "bg-red-500/10" : isWarning ? "bg-amber-500/10" : "bg-primary/10"
        )}>
          <KeyRound className={cn(
            "h-5 w-5",
            isExpired ? "text-red-400" : isWarning ? "text-amber-400" : "text-primary"
          )} />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">Licencia Activa</CardTitle>
          <CardDescription className="font-mono text-xs">{licInfo.key}</CardDescription>
        </div>
        <Badge className={cn(
          "text-[10px] font-black uppercase tracking-widest border",
          isExpired  ? "bg-red-500/10 text-red-400 border-red-500/20" :
          isWarning  ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                       "bg-primary/10 text-primary border-primary/20"
        )}>
          {isExpired ? "EXPIRADA" : licInfo.plan}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Estado */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Estado</p>
            <div className={cn(
              "flex items-center gap-1.5 font-bold text-sm",
              isExpired ? "text-red-400" : isWarning ? "text-amber-400" : "text-primary"
            )}>
              {isExpired ? <CircleAlert className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
              {isExpired ? "Licencia expirada" : "Activa y válida"}
            </div>
          </div>

          {/* Vigencia */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Válida hasta</p>
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {isLifetime
                ? <span className="text-primary">♾️ Permanente</span>
                : <span>{new Date(parseInt(licInfo.exp!)).toLocaleDateString("es-MX")}</span>
              }
            </div>
          </div>

          {/* Días restantes */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Tiempo Restante</p>
            <div className="flex items-center gap-1.5 text-sm font-bold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {isLifetime ? (
                <span className="text-muted-foreground">Sin vencimiento</span>
              ) : isExpired ? (
                <span className="text-red-400">Venció hace {Math.abs(licInfo.daysLeft ?? 0)} días</span>
              ) : isWarning ? (
                <span className="text-amber-400">⚠️ {licInfo.daysLeft} días restantes</span>
              ) : (
                <span>{licInfo.daysLeft} días restantes</span>
              )}
            </div>
          </div>
        </div>

        {/* Alerta de expiración próxima o vencida */}
        {(isExpired || isWarning) && (
          <div className={cn(
            "mt-4 p-3 rounded-lg text-xs font-medium flex items-start gap-2",
            isExpired ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"
          )}>
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            {isExpired
              ? "Tu licencia ha expirado. Las ventas están bloqueadas. Contacta a soporte técnico para renovar."
              : `Tu licencia vence en ${licInfo.daysLeft} días. Contacta a soporte para renovar y evitar interrupciones.`
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ─────────────────────────────────────────────
// Sub-componente: Panel de Canales de Venta
// Sprint-1 E2: Permite editar canales post-wizard
// ─────────────────────────────────────────────

const ALL_CH = [
  { id: "COUNTER",   label: "Mostrador",  sub: "Ventas presenciales en tu local" },
  { id: "WHATSAPP",  label: "WhatsApp",   sub: "Pedidos por mensaje directo" },
  { id: "INSTAGRAM", label: "Instagram",  sub: "Pedidos vía DM o story" },
  { id: "FACEBOOK",  label: "Facebook",   sub: "Pedidos vía Messenger o página" },
  { id: "OTHER",     label: "Otro canal", sub: "Correo, teléfono, etc." },
] as const;

function SalesChannelsPanel() {
  const [enabled, setEnabled] = useState<string[]>(["COUNTER"]);
  const [defaultCh, setDefaultCh] = useState<string>("COUNTER");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) return;
    api.getAllSettings().then((res: any) => {
      const cfg = res?.config ?? {};
      const raw = cfg["enabled_channels"] || "COUNTER";
      setEnabled(raw.split(",").map((s: string) => s.trim()));
      setDefaultCh(cfg["default_channel"] || "COUNTER");
      setLoaded(true);
    });
  }, []);

  const toggleChannel = (id: string) => {
    setEnabled(prev => {
      const was = prev.includes(id);
      const next = was ? prev.filter(e => e !== id) : [...prev, id];
      if (next.length === 0) return prev; // al menos uno
      if (!next.includes(defaultCh)) setDefaultCh(next[0]);
      return next;
    });
  };

  const handleSave = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;
    setSaving(true);
    try {
      await api.setBulkSettings({
        enabled_channels: enabled.join(","),
        default_channel: defaultCh,
      });
      toast.success("Canales de venta actualizados", { description: "Los cambios se aplicarán al reabrir el POS." });
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingBag className="h-4 w-4 text-primary" />
          Canales de Venta
        </CardTitle>
        <CardDescription>
          ¿Por cuáles canales recibe pedidos tu negocio? Solo los activos aparecerán en el cobro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {ALL_CH.map(ch => {
            const active = enabled.includes(ch.id);
            return (
              <button key={ch.id} type="button"
                onClick={() => toggleChannel(ch.id)}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
                  active ? "bg-primary/5 border-primary/40" : "bg-muted/20 border-border hover:border-muted-foreground/30"
                )}>
                <div className={cn("w-4 h-4 mt-0.5 rounded border shrink-0", active ? "bg-primary border-primary" : "border-muted-foreground")} />
                <div>
                  <p className={cn("text-sm font-bold", active ? "text-foreground" : "text-muted-foreground")}>{ch.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ch.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {enabled.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canal por defecto en cobro</p>
            <div className="flex gap-2 flex-wrap">
              {enabled.map(id => {
                const ch = ALL_CH.find(c => c.id === id);
                return (
                  <button key={id} type="button"
                    onClick={() => setDefaultCh(id)}
                    className={cn(
                      "px-4 py-1.5 rounded-lg border text-sm font-semibold transition-all",
                      defaultCh === id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted/30"
                    )}>
                    {ch?.label ?? id}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">El cajero siempre puede cambiarlo al momento de cobrar.</p>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Guardando..." : "Guardar canales"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Sub-componente: Panel de salud de la DB
// ─────────────────────────────────────────────

function DbHealthPanel() {
  const [status, setStatus] = useState<{
    success?: boolean;
    path?: string;
    size?: string;
    schemaVersion?: string;
    mode?: string;
    counts?: { products: number; categories: number; orders: number };
  } | null>(null);

  const load = useCallback(async () => {
    const api = (window as Window & { electronAPI?: ElectronAPI }).electronAPI;
    if (!api) return;
    const res = await api.getDbStatus();
    setStatus(res);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-primary/10">
      <div className="p-6 space-y-2">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
          Motor y Versión
        </p>
        <div className="flex items-center gap-2 text-primary font-black italic">
          <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
          SQLite (WAL)
        </div>
        <p className="text-[10px] text-muted-foreground font-bold">
          Esquema: {status?.schemaVersion ?? "—"}
        </p>
        <p className="text-[10px] text-muted-foreground truncate max-w-[200px] font-mono">
          {status?.path}
        </p>
      </div>
      <div className="p-6 space-y-2">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
          Volumen de Datos
        </p>
        <p className="text-lg font-black text-foreground/80">
          {status?.size || "0.00 MB"}
        </p>
        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
            {status?.counts?.products ?? 0} Prod.
          </span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
            {status?.counts?.orders ?? 0} Ventas
          </span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">
            {status?.counts?.categories ?? 0} Cat.
          </span>
        </div>
      </div>
      <div className="p-6 space-y-2 bg-primary/5">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
          Protección Anti-Apagones
        </p>
        <div className="flex items-center gap-2 text-primary font-bold">
          <ShieldCheck className="h-4 w-4" /> WAL ENABLED
        </div>
        <p className="text-[10px] text-muted-foreground">
          Tus ventas están protegidas aunque se vaya la luz.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tipos de electronAPI (contrato de preload.js)
// ─────────────────────────────────────────────

interface ElectronAPI {
  getDbStatus: () => Promise<{
    success: boolean;
    path?: string;
    size?: string;
    schemaVersion?: string;
    mode?: string;
    counts?: { products: number; categories: number; orders: number };
  }>;
  exportSqlite: () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
  importSqlite: () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
  getAllSettings: () => Promise<{ success: boolean; config?: Record<string, string> }>;
  setBulkSettings: (entries: Record<string, string>) => Promise<{ success: boolean; error?: string }>;
  getPrinters?: () => Promise<{ name: string; isDefault: boolean }[]>;
}

// ─────────────────────────────────────────────
// Sub-componente: Branding del Ticket
// ─────────────────────────────────────────────

function TicketBrandingTab({ api }: { api: ElectronAPI | undefined }) {
  const [form, setForm] = useState({
    store_footer_message: "",
    store_policies: "",
    store_whatsapp: "",
    store_instagram: "",
    store_facebook: "",
    store_website: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!api) return;
      const res = await api.getAllSettings();
      if (res.success && res.config) {
        setForm(prev => ({
          ...prev,
          store_footer_message: res.config!["store_footer_message"] ?? "",
          store_policies:       res.config!["store_policies"] ?? "",
          store_whatsapp:       res.config!["store_whatsapp"] ?? "",
          store_instagram:      res.config!["store_instagram"] ?? "",
          store_facebook:       res.config!["store_facebook"] ?? "",
          store_website:        res.config!["store_website"] ?? "",
        }));
      }
    }
    load();
  }, [api]);

  const handleSave = async () => {
    if (!api) return toast.error("Solo disponible en la app de escritorio.");
    setIsSaving(true);
    try {
      const result = await api.setBulkSettings(form);
      if (!result.success) throw new Error(result.error);
      toast.success("Branding del ticket actualizado", {
        description: "Los cambios aparecerán en el próximo ticket impreso."
      });
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, icon: React.ReactNode, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={key} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </Label>
      {type === "textarea" ? (
        <textarea
          id={key}
          rows={3}
          value={form[key]}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          placeholder={placeholder}
          className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <Input
          id={key}
          type="text"
          value={form[key]}
          onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
          placeholder={placeholder}
          className="bg-muted/30"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4" /> Mensaje del Ticket
          </CardTitle>
          <CardDescription>
            Personaliza lo que aparece al pie de cada ticket impreso o PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("store_footer_message", "Frase de despedida", "Ej: ¡Gracias por su compra! Vuelva pronto 🙏", <MessageCircle className="h-3 w-3" />, "textarea")}
          {field("store_policies", "Políticas de Venta", "Ej: No hay devoluciones sin ticket. Cambios en 7 días.", <Printer className="h-3 w-3" />, "textarea")}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4" /> Presencia Digital
          </CardTitle>
          <CardDescription>
            Aparece al pie del ticket como un mini-directorio de contacto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {field("store_whatsapp", "Número WhatsApp", "Ej: +52 555 000 0000", <MessageCircle className="h-3 w-3" />)}
          {field("store_instagram", "Instagram", "Ej: @minegocio", <Instagram className="h-3 w-3" />)}
          {field("store_facebook", "Facebook", "Ej: facebook.com/minegocio", <Globe className="h-3 w-3" />)}
          {field("store_website", "Sitio Web", "Ej: www.minegocio.com", <Globe className="h-3 w-3" />)}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className="w-full h-11">
        {isSaving ? "Guardando..." : "Guardar Cambios de Identidad"}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useSessionStore();
  const { themeColor, setThemeColor, themeMode, setThemeMode } = useThemeStore();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showNukeDialog, setShowNukeDialog] = useState(false);

  // Diagnóstico de escáner
  const [lastScan, setLastScan] = useState<{ code: string; time: number } | null>(null);

  // Configuración del negocio
  const [businessForm, setBusinessForm] = useState({
    store_name: "",
    store_address: "",
    store_phone: "",
    store_tax_id: "",
    tax_name: "IVA",
    currency_symbol: "$",
    receiptPrinter: "",
    receiptPaperSize: "80mm",
  });

  const [printers, setPrinters] = useState<{name: string; isDefault: boolean}[]>([]);

  const api = (typeof window !== "undefined"
    ? (window as Window & { electronAPI?: ElectronAPI }).electronAPI
    : undefined);

  // Cargar configuración del negocio desde SQLite
  useEffect(() => {
    async function loadSettings() {
      if (!api) return;
      const res = await api.getAllSettings();
      if (res.success && res.config) {
        setBusinessForm((prev) => ({
          ...prev,
          store_name:      res.config!["store_name"] ?? prev.store_name,
          store_address:   res.config!["store_address"] ?? prev.store_address,
          store_phone:     res.config!["store_phone"] ?? prev.store_phone,
          store_tax_id:    res.config!["store_tax_id"] ?? prev.store_tax_id,
          tax_name:        res.config!["tax_name"] ?? prev.tax_name,
          currency_symbol: res.config!["currency_symbol"] ?? prev.currency_symbol,
          receiptPrinter:  res.config!["receiptPrinter"] ?? prev.receiptPrinter,
          receiptPaperSize:res.config!["receiptPaperSize"] ?? prev.receiptPaperSize,
        }));
      }

      // Cargar lista de impresoras locales
      if (api.getPrinters) {
        try {
          const printerList = await api.getPrinters();
          setPrinters(printerList);
        } catch (error) {
          console.error("Error al cargar impresoras", error);
        }
      }
    }
    loadSettings();
  }, [api]);

  // ── Handlers de Backup / Restore (SQLite nativo) ──

  const handleExport = async () => {
    if (!api) return toast.error("Función solo disponible en la app de escritorio.");
    setIsExporting(true);
    try {
      const result = await api.exportSqlite();
      if (result.canceled) return;
      if (!result.success) throw new Error((result as any).error || "Error al respaldar la DB");
      toast.success("¡Respaldo guardado!", {
        description: `Archivo: ${result.path?.split("/").pop()}`,
      });
    } catch (err) {
      toast.error("No se pudo generar el respaldo", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!api) return toast.error("Función solo disponible en la app de escritorio.");
    setIsImporting(true);
    try {
      const result = await api.importSqlite();
      if (result.canceled) return;
      if (!result.success) throw new Error((result as any).error || "Error al restaurar la DB");
      toast.success("¡Restauración exitosa!", {
        description: "Reiniciando para aplicar los cambios...",
      });
      setTimeout(() => window.location.reload(), 1800);
    } catch (err) {
      toast.error("No se pudo restaurar el respaldo", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsImporting(false);
    }
  };

  // ── Guardar datos del negocio ──

  const handleSaveBusiness = async () => {
    if (!api) return toast.error("Función solo disponible en la app de escritorio.");
    setIsSavingBusiness(true);
    try {
      const result = await api.setBulkSettings(businessForm);
      if (!result.success) throw new Error(result.error);
      toast.success("¡Datos del negocio actualizados!");
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsSavingBusiness(false);
    }
  };

  const handleScan = (code: string) => {
    setLastScan({ code, time: Date.now() });
    toast.success("Código detectado", { description: code });
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-muted/20">
      <BarcodeHandler onScan={handleScan} profile="diagnostic" />
      <Sidebar />

      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/50 backdrop-blur-xl border-b px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">
                Configuración
              </h1>
              <p className="text-sm text-muted-foreground italic">
                Fast-POS Desktop v2.0
              </p>
            </div>
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20"
            >
              NATIVE CORE v2
            </Badge>
          </div>
        </header>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6 pb-24">
          <Tabs defaultValue={user?.role === "ADMIN" ? "general" : "system"} className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-xl border border-primary/5 backdrop-blur-sm h-auto flex-wrap gap-1">
              {user?.role === "ADMIN" && (
                <TabsTrigger value="general" className="uppercase text-[10px] font-black tracking-widest gap-1.5 focus:bg-primary/20 bg-primary/5 text-primary">
                  <Activity className="w-3 h-3" /> General
                </TabsTrigger>
              )}
              {user?.role === "ADMIN" && (
                <TabsTrigger value="business" className="uppercase text-[10px] font-black tracking-widest gap-1.5">
                  <Store className="w-3 h-3" /> Negocio
                </TabsTrigger>
              )}
              <TabsTrigger value="system" className="uppercase text-[10px] font-black tracking-widest gap-1.5 hidden sm:flex">
                <ShieldCheck className="w-3 h-3" /> Temas y Periféricos
              </TabsTrigger>
            </TabsList>

            {/* Se ha movido a /users */}

            {/* Se ha fusionado con Negocios */}

            {/* ── PESTAÑA: GENERAL ── */}
            {user?.role === "ADMIN" && (
              <TabsContent value="general" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="border-primary/20 bg-primary/5 shadow-xl overflow-hidden">
                  <CardHeader className="flex flex-row items-center gap-4 bg-primary/10 border-b border-primary/10 py-4">
                    <Activity className="h-6 w-6 text-primary" />
                    <div>
                      <CardTitle className="text-primary">
                        Salud del Motor
                      </CardTitle>
                      <CardDescription className="text-primary/70 text-xs font-bold uppercase tracking-widest">
                        Diagnóstico en tiempo real
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <DbHealthPanel />
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* ── PESTAÑA: NEGOCIO ── */}
            {user?.role === "ADMIN" && (
              <TabsContent value="business" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-primary/10">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Store className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Datos de tu Negocio</CardTitle>
                    <CardDescription>
                      Esta información aparece en los tickets de venta.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="store_name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Nombre del Negocio *
                      </Label>
                      <Input
                        id="store_name"
                        placeholder="Ej: Boutique Yetza"
                        value={businessForm.store_name}
                        onChange={(e) =>
                          setBusinessForm((p) => ({ ...p, store_name: e.target.value }))
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store_phone" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Teléfono
                      </Label>
                      <Input
                        id="store_phone"
                        placeholder="Ej: 55 1234 5678"
                        value={businessForm.store_phone}
                        onChange={(e) =>
                          setBusinessForm((p) => ({ ...p, store_phone: e.target.value }))
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="store_address" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Dirección
                      </Label>
                      <Input
                        id="store_address"
                        placeholder="Calle, número, colonia, ciudad"
                        value={businessForm.store_address}
                        onChange={(e) =>
                          setBusinessForm((p) => ({ ...p, store_address: e.target.value }))
                        }
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store_tax_id" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        RFC / Tax ID
                      </Label>
                      <Input
                        id="store_tax_id"
                        placeholder="Ej: XAXX010101000"
                        value={businessForm.store_tax_id}
                        onChange={(e) =>
                          setBusinessForm((p) => ({ ...p, store_tax_id: e.target.value }))
                        }
                        className="h-11 font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency_symbol" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Símbolo de Moneda
                      </Label>
                      <Input
                        id="currency_symbol"
                        placeholder="$"
                        value={businessForm.currency_symbol}
                        maxLength={3}
                        onChange={(e) =>
                          setBusinessForm((p) => ({ ...p, currency_symbol: e.target.value }))
                        }
                        className="h-11 w-24 font-mono text-center"
                      />
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveBusiness}
                    disabled={isSavingBusiness || !businessForm.store_name.trim()}
                    className="w-full h-11 uppercase text-[10px] font-black tracking-widest"
                  >
                    {isSavingBusiness ? "Guardando..." : "Guardar Datos del Negocio"}
                  </Button>
                </CardContent>
              </Card>

              {/* Sprint-1 E2: Canales de venta configurables */}
              <SalesChannelsPanel />

              {/* Branding visual del ticket */}
              <div className="pt-2 border-t border-border/50">
                <TicketBrandingTab api={api} />
              </div>

              {/* Licencia activa al pie del negocio */}
              <LicensePanel />
            </TabsContent>
            )}

            {/* ── PESTAÑA: SISTEMA, HARDWARE Y SEGURIDAD ── */}
            <TabsContent value="system" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* TEMA DEL SISTEMA */}
              <Card className="bg-card/40 border-primary/10 shadow-lg p-6">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                  <div>
                    <h3 className="font-bold uppercase tracking-tight text-sm flex items-center gap-2">
                      <Palette className="h-4 w-4 text-primary" /> Apariencia y Tema
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Elige el modo (claro/oscuro) y el color de acento principal.
                    </p>
                  </div>
                  
                  {/* Selector Modo Claro / Oscuro */}
                  <div className="flex gap-2 bg-muted/50 p-1 rounded-xl border border-primary/5">
                    <button
                      onClick={() => setThemeMode('light')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tighter transition-all",
                        themeMode === 'light' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Sun className="h-4 w-4" /> Claro
                    </button>
                    <button
                      onClick={() => setThemeMode('dark')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-tighter transition-all",
                        themeMode === 'dark' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Moon className="h-4 w-4" /> Oscuro
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-8 pt-6 border-t border-border/50">
                  {([
                    { id: "zinc", color: "bg-zinc-500", label: "Neutro Ágata" },
                    { id: "emerald", color: "bg-teal-400", label: "Menta Salvia" },
                    { id: "blue", color: "bg-indigo-400", label: "Azul Cosmos" },
                    { id: "rose", color: "bg-rose-400", label: "Rosa Cerezo" },
                    { id: "orange", color: "bg-orange-400", label: "Durazno Suave" },
                    { id: "crimson", color: "bg-red-600", label: "Rojo Carmesí" },
                    { id: "amber", color: "bg-amber-500", label: "Ámbar Fuego" },
                    { id: "cyan", color: "bg-cyan-500", label: "Cyan Neón" },
                    { id: "violet", color: "bg-violet-600", label: "Violeta Eléctrico" },
                    { id: "fuchsia", color: "bg-fuchsia-500", label: "Fucsia Intenso" },
                  ] as const).map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setThemeColor(theme.id)}
                      className={cn(
                        "group flex flex-col items-center gap-2 transition-all p-2 rounded-xl border border-transparent hover:bg-muted/50",
                        themeColor === theme.id ? "scale-105 bg-muted/30" : "opacity-70 hover:opacity-100"
                      )}
                    >
                      <div className={cn(
                        "h-10 w-10 rounded-full border-2 shadow-sm transition-all duration-300",
                        theme.color,
                        themeColor === theme.id ? "border-primary ring-4 ring-primary/20 ring-offset-2 ring-offset-background scale-110" : "border-transparent"
                      )} />
                      <span className={cn(
                        "text-[10px] uppercase font-bold tracking-tighter mt-1 transition-colors",
                        themeColor === theme.id ? "text-primary" : "text-muted-foreground"
                      )}>
                        {theme.label}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>

              {user?.role === "ADMIN" && (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Respaldos de la Base de Datos</CardTitle>
                    <CardDescription>
                      Genera una copia del archivo SQLite completo. Sin pérdida de datos,
                      sin nube.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Exportar */}
                  <div className="space-y-3 border p-6 rounded-xl bg-muted/20">
                    <p className="font-bold text-sm flex items-center gap-2 uppercase tracking-tight">
                      <Download className="h-4 w-4 text-primary" /> Exportar
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Guarda una copia de tu base de datos en el lugar que elijas.
                      El archivo{" "}
                      <span className="font-mono font-bold">.fastpos.db</span> incluye
                      todo tu inventario, ventas e historial.
                    </p>
                    <Button
                      className="w-full h-11 uppercase text-[10px] font-black tracking-widest"
                      onClick={handleExport}
                      disabled={isExporting || isImporting}
                    >
                      {isExporting ? "Generando respaldo..." : "Descargar Respaldo"}
                    </Button>
                  </div>

                  {/* Restaurar */}
                  <div className="space-y-3 border border-dashed p-6 rounded-xl bg-muted/10">
                    <p className="font-bold text-sm flex items-center gap-2 uppercase tracking-tight">
                      <Upload className="h-4 w-4 text-amber-500" /> Restaurar
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Carga un respaldo anterior. Tus datos actuales serán
                      reemplazados. Esta acción no se puede deshacer.
                    </p>
                    <Button
                      variant="secondary"
                      className="w-full h-11 uppercase text-[10px] font-black tracking-widest"
                      disabled={isExporting || isImporting}
                      onClick={() => setShowImportDialog(true)}
                    >
                      {isImporting ? "Restaurando..." : "Cargar Respaldo"}
                    </Button>
                    <AlertDialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            ¿Restaurar un respaldo anterior?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Todos tus datos actuales (inventario, ventas, categorías)
                            serán <strong>reemplazados</strong> por los del archivo que
                            selecciones. La app se reiniciará al terminar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => { setShowImportDialog(false); handleImport(); }}
                            className="bg-amber-600 hover:bg-amber-700"
                          >
                            Sí, restaurar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>

              {/* Zona de Peligro */}
              <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
                <CardHeader className="bg-destructive/10 border-b border-destructive/10 py-3">
                  <CardTitle className="text-destructive text-sm flex items-center gap-2 uppercase tracking-widest font-black">
                    <AlertTriangle className="h-4 w-4" /> Zona de Peligro
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-bold text-sm uppercase tracking-tight">
                        Borrado Integral
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Limpia inventario, ventas y categorías. No se puede deshacer.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="uppercase text-[10px] font-black tracking-widest shrink-0"
                      onClick={() => setShowNukeDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Borrar Todo
                    </Button>
                    <AlertDialog open={showNukeDialog} onOpenChange={setShowNukeDialog}>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            ¿Borrar absolutamente todo?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción eliminará todo tu inventario, historial de ventas
                            y categorías de manera permanente. No hay vuelta atrás.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={async () => {
                              setShowNukeDialog(false);
                              if (typeof window !== "undefined" && (window as any).electronAPI) {
                                const api = (window as any).electronAPI;
                                const loadingToast = toast.loading("Borrando todo el inventario y ventas...");
                                try {
                                  const res = await (api as any).factoryReset({ userId: user?.id });
                                  if (res.success) {
                                    toast.success("Borrado exitoso", { id: loadingToast });
                                    setTimeout(() => window.location.reload(), 1500);
                                  } else {
                                    toast.error("Error al borrar datos", { description: res.error, id: loadingToast });
                                  }
                                } catch (err: any) {
                                  toast.error("Fallo inesperado", { description: err.message, id: loadingToast });
                                }
                              } else {
                                toast.error("Solo disponible en versión de escritorio.");
                              }
                            }}
                          >
                            Sí, borrar todo
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

              {/* ── SECCIÓN DE PERIFÉRICOS (antes Hardware) ── */}
              <Card className="border-primary/20 bg-primary/5 mt-6">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Scan className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Periféricos</CardTitle>
                    <CardDescription>
                      Diagnóstico de lectores y escáneres de código de barras.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* CONFIGURACIÓN DE IMPRESORA TÉRMICA */}
                  <div className="border bg-background/50 rounded-2xl p-6 space-y-4 mb-6">
                    <div className="flex items-center gap-3 border-b pb-4 mb-4">
                      <div className="h-8 w-8 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                        <Printer className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold uppercase tracking-tight text-sm">Impresora de Tickets</h4>
                        <p className="text-xs text-muted-foreground">Selecciona tu miniprinter local y el formato del rollo térmico.</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="receiptPrinter" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Impresora Activa
                        </Label>
                        <select
                          id="receiptPrinter"
                          value={businessForm.receiptPrinter}
                          onChange={(e) => setBusinessForm(p => ({ ...p, receiptPrinter: e.target.value }))}
                          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">(Impresora por defecto del OS)</option>
                          {printers.map((p, i) => (
                            <option key={i} value={p.name}>
                              {p.name} {p.isDefault ? "[Defecto]" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="receiptPaperSize" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Tamaño de Papel
                        </Label>
                        <select
                          id="receiptPaperSize"
                          value={businessForm.receiptPaperSize}
                          onChange={(e) => setBusinessForm(p => ({ ...p, receiptPaperSize: e.target.value }))}
                          className="flex h-11 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="80mm">80mm (Estándar)</option>
                          <option value="58mm">58mm (Pequeño)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-4">
                       <Button
                        variant="secondary"
                        onClick={handleSaveBusiness}
                        disabled={isSavingBusiness}
                        className="h-9 text-xs"
                      >
                        {isSavingBusiness ? "Guardando..." : "Guardar Preferencias de Impresión"}
                      </Button>

                      <Button
                        variant="outline"
                        onClick={async () => {
                          if (!api) return toast.error("Solo en escritorio");
                          if (!businessForm.receiptPrinter) return toast.error("Selecciona una impresora primero");
                          const loadingToast = toast.loading("Enviando pulso a la caja...");
                          try {
                            const res = await (api as any).openCashDrawer(businessForm.receiptPrinter);
                            if (res.success) {
                              toast.success("Cajón abierto", { id: loadingToast });
                            } else {
                              toast.error("Error", { description: res.error, id: loadingToast });
                            }
                          } catch (err: any) {
                            toast.error("Error inesperado", { description: err.message, id: loadingToast });
                          }
                        }}
                        className="h-9 text-xs border-primary/30 text-primary hover:bg-primary/10"
                      >
                        <Scan className="w-4 h-4 mr-2" />
                        Probar Apertura Cajón
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 bg-background/50 gap-4 text-center border-primary/20">
                    {!lastScan ? (
                      <>
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                          <Scan className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase tracking-widest">
                            Puerto en Escucha...
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase">
                            Dispara el gatillo del escáner ahora
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Activity className="h-8 w-8 text-primary animate-bounce" />
                        <div className="space-y-1">
                          <p className="text-2xl font-black font-mono text-primary">
                            {lastScan.code}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                            Última lectura certificada
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4 border-primary/10">
                      <div className="h-10 w-10 rounded-lg bg-secondary/20 flex items-center justify-center">
                        <Keyboard className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                          Tipo de escáner
                        </p>
                        <p className="text-sm font-black uppercase tracking-tight">
                          HID Keyboard
                        </p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4 border-primary/10">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                          Estado
                        </p>
                        <p className="text-sm font-black text-primary uppercase tracking-tight">
                          Certificado
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="flex flex-col items-center gap-4 pt-10 border-t border-primary/5 opacity-50">
            <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
              Fast-POS v2.0 — Powered by Next.js & SQLite Native Core © 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

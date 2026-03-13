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
} from "lucide-react";
import { BarcodeHandler } from "@/components/shared/barcode-handler";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { UsersManager } from "./_components/users-manager";

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
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-emerald-500/10">
      <div className="p-6 space-y-2">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
          Motor y Versión
        </p>
        <div className="flex items-center gap-2 text-emerald-600 font-black italic">
          <div className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
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
      <div className="p-6 space-y-2 bg-emerald-200/20 dark:bg-emerald-800/20">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">
          Integridad Atómica
        </p>
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
          <ShieldCheck className="h-4 w-4" /> WAL ENABLED
        </div>
        <p className="text-[10px] text-muted-foreground">
          Tus transacciones están protegidas ante cierres inesperados.
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
// Página principal
// ─────────────────────────────────────────────

export default function SettingsPage() {
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
      if (!result.success) throw new Error(result.error);
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
      if (!result.success) throw new Error(result.error);
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
          <Tabs defaultValue="general" className="w-full space-y-6">
             <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 bg-muted/50 p-1 rounded-xl border border-primary/5 backdrop-blur-sm h-auto flex-wrap">
              <TabsTrigger value="general" className="uppercase text-[10px] font-black tracking-widest gap-1.5">
                <Activity className="w-3 h-3" /> General
              </TabsTrigger>
              <TabsTrigger value="business" className="uppercase text-[10px] font-black tracking-widest gap-1.5">
                <Store className="w-3 h-3" /> Negocio
              </TabsTrigger>
              <TabsTrigger value="security" className="uppercase text-[10px] font-black tracking-widest gap-1.5">
                <ShieldCheck className="w-3 h-3" /> Respaldos
              </TabsTrigger>
              <TabsTrigger value="hardware" className="uppercase text-[10px] font-black tracking-widest gap-1.5">
                <Scan className="w-3 h-3" /> Hardware
              </TabsTrigger>
              <TabsTrigger value="advanced" className="uppercase text-[10px] font-black tracking-widest gap-1.5 hidden sm:flex">
                <RefreshCcw className="w-3 h-3" /> Avanzado
              </TabsTrigger>
              <TabsTrigger value="users" className="uppercase text-[10px] font-black tracking-widest gap-1.5 focus:bg-primary/20 bg-primary/5 text-primary">
                <Users className="w-3 h-3" /> Usuarios
              </TabsTrigger>
            </TabsList>

            {/* ── PESTAÑA: USUARIOS ── */}
            <TabsContent value="users" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
               <UsersManager />
            </TabsContent>

            {/* ── PESTAÑA: GENERAL ── */}
            <TabsContent value="general" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xl overflow-hidden">
                <CardHeader className="flex flex-row items-center gap-4 bg-emerald-500/10 border-b border-emerald-500/10 py-4">
                  <Activity className="h-6 w-6 text-emerald-600" />
                  <div>
                    <CardTitle className="text-emerald-700 dark:text-emerald-400">
                      Salud del Motor
                    </CardTitle>
                    <CardDescription className="text-emerald-600/70 text-xs font-bold uppercase tracking-widest">
                      Diagnóstico en tiempo real
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <DbHealthPanel />
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-primary/10 shadow-lg p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-bold uppercase tracking-tight text-sm">
                    Versión del Sistema
                  </h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">
                    Commercial Build 🚀
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary/80">2.0.0</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">
                    Schema v3
                  </p>
                </div>
              </Card>
            </TabsContent>

            {/* ── PESTAÑA: NEGOCIO ── */}
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
            </TabsContent>

            {/* ── PESTAÑA: RESPALDOS ── */}
            <TabsContent value="security" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                            onClick={() => {
                              setShowNukeDialog(false);
                              toast.info("Factory Reset disponible en v2.1 con autenticación ADMIN.");
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
            </TabsContent>

            {/* ── PESTAÑA: HARDWARE ── */}
            <TabsContent value="hardware" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Scan className="h-6 w-6 text-blue-500" />
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
                      <div className="h-8 w-8 bg-blue-500/10 text-blue-600 rounded-lg flex items-center justify-center">
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

                    <div className="pt-2">
                       <Button
                        variant="secondary"
                        onClick={handleSaveBusiness}
                        disabled={isSavingBusiness}
                        className="h-9 text-xs"
                      >
                        {isSavingBusiness ? "Guardando..." : "Guardar Preferencias de Impresión"}
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 bg-background/50 gap-4 text-center border-blue-500/20">
                    {!lastScan ? (
                      <>
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
                          <Scan className="h-6 w-6 text-blue-500" />
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
                        <Activity className="h-8 w-8 text-emerald-500 animate-bounce" />
                        <div className="space-y-1">
                          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
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
                    <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4 border-blue-500/10">
                      <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <Keyboard className="h-5 w-5 text-orange-600" />
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
                    <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4 border-blue-500/10">
                      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                          Estado
                        </p>
                        <p className="text-sm font-black text-emerald-600 uppercase tracking-tight">
                          Certificado
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── PESTAÑA: AVANZADO ── */}
            <TabsContent value="advanced" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 uppercase tracking-tight font-black">
                    <RefreshCcw className="h-5 w-5 text-primary" /> Laboratorio
                  </CardTitle>
                  <CardDescription className="text-xs uppercase font-bold text-muted-foreground/60">
                    Herramientas de estrés y población de datos.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-6 border rounded-xl bg-background/40 space-y-4">
                    <div>
                      <p className="font-bold text-sm uppercase tracking-tight">
                        Poblar Datos de Prueba
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Carga un catálogo de demostración para probar el sistema.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="h-11 uppercase text-[10px] font-black tracking-widest"
                        onClick={async () => {
                          const id = toast.loading("Procesando...");
                          try {
                            const { generateMassiveData } = await import("@/lib/seed");
                            await generateMassiveData((msg: string) =>
                              toast.loading(msg, { id })
                            );
                            toast.success("¡Carga masiva completa!", { id });
                            setTimeout(() => window.location.reload(), 1500);
                          } catch {
                            toast.error("Error en la carga", { id });
                          }
                        }}
                      >
                        Carga de Estrés
                      </Button>
                      <Button
                        className="h-11 bg-blue-600 hover:bg-blue-700 uppercase text-[10px] font-black tracking-widest text-white border-0"
                        onClick={async () => {
                          const id = toast.loading("Descargando activos...");
                          try {
                            const { seedDemoData } = await import("@/lib/seed");
                            await seedDemoData((msg: string) =>
                              toast.loading(msg, { id })
                            );
                            toast.success("Catálogo Demo cargado.", { id });
                            setTimeout(() => window.location.reload(), 1500);
                          } catch {
                            toast.error("Error", { id });
                          }
                        }}
                      >
                        Seed Demo Pro
                      </Button>
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

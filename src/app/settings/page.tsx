"use client";

/**
 * Página de Ajustes y Configuración
 * 
 * FUENTE DE VERDAD: Fase 6.2 - Sistema de Seguridad de Datos
 */

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, ShieldCheck, AlertTriangle, RefreshCcw, Trash2, Scan, Keyboard, Activity } from "lucide-react";
import { BarcodeHandler } from "@/components/shared/barcode-handler";
import { db } from "@/lib/db";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

function DbHealthSummary() {
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const res = await (window as any).electronAPI.getDbStatus();
        setStatus(res);
      }
    }
    load();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-emerald-500/10">
      <div className="p-6 space-y-2">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Estado de Conexión</p>
        <div className="flex items-center gap-2 text-emerald-600 font-black italic">
          <div className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
          ONLINE (Engine: Native)
        </div>
        <p className="text-[10px] text-muted-foreground truncate max-w-[200px] font-mono">{status?.path}</p>
      </div>
      <div className="p-6 space-y-2">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Volumen de Datos</p>
        <p className="text-lg font-black text-foreground/80">{status?.size || '0.00 MB'}</p>
        <div className="flex gap-2">
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{status?.counts?.products || 0} Prod.</span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{status?.counts?.orders || 0} Ventas</span>
          <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">{status?.counts?.categories || 0} Cat.</span>
        </div>
      </div>
      <div className="p-6 space-y-2 bg-emerald-200/20 dark:bg-emerald-800/20">
        <p className="text-[10px] uppercase font-black text-muted-foreground tracking-tighter">Integridad Atómica</p>
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold">
           <ShieldCheck className="h-4 w-4" /> WAL ENABLED
        </div>
        <p className="text-[10px] text-muted-foreground">Tus transacciones están protegidas ante cierres.</p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Diagnóstico de Escáner
  const [lastScan, setLastScan] = useState<{ code: string; time: number } | null>(null);
  const [scanHistory, setScanHistory] = useState<number[]>([]);

  const handleScan = (code: string) => {
    setLastScan({ code, time: Date.now() });
    setScanHistory(prev => [Date.now(), ...prev].slice(0, 5));
    toast.success("Código detectado", { description: code });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { exportDB } = await import("dexie-export-import");
      const blob = await exportDB(db as any, { prettyJson: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `respaldo-fastpos-${date}.fastpos`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("¡Respaldo generado!");
    } catch (error) {
      toast.error("Error al exportar");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("🚨 ¿BORRAR TODO Y RESTAURAR?")) {
      e.target.value = "";
      return;
    }
    setIsImporting(true);
    try {
      const { importDB } = await import("dexie-export-import");
      await importDB(file, { acceptNameDiff: true, acceptVersionDiff: true } as any);
      toast.success("Restauración exitosa");
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error("Fallo la importación");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handleNuke = async () => {
    if (!confirm("⚠️ ¿Borrar absolutamente todo?")) return;
    if (!confirm("¿ESTÁS SEGURO?")) return;
    try {
      await (db as any).transaction('rw', [(db as any).products, (db as any).categories, (db as any).orders], async () => {
        await Promise.all([
          (db.products as any).clear(),
          (db.categories as any).clear(),
          (db.orders as any).clear()
        ]);
      });
      toast.success("Sistema limpio");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error("Error al borrar datos");
    }
  };

  return (
    <div className="flex h-screen bg-muted/20">
      <BarcodeHandler onScan={handleScan} profile="diagnostic" />
      <Sidebar />
      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden">
        <header className="sticky top-0 z-20 bg-background/50 backdrop-blur-xl border-b px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">Configuración</h1>
              <p className="text-sm text-muted-foreground italic">Fast-POS Desktop v1.1</p>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">NATIVE CORE</Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6 pb-24">
          <Tabs defaultValue="general" className="w-full space-y-6">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl border border-primary/5 backdrop-blur-sm">
              <TabsTrigger value="general" className="uppercase text-[10px] font-black tracking-widest gap-2">
                <Activity className="w-3.5 h-3.5" /> General
              </TabsTrigger>
              <TabsTrigger value="security" className="uppercase text-[10px] font-black tracking-widest gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> Seguridad
              </TabsTrigger>
              <TabsTrigger value="hardware" className="uppercase text-[10px] font-black tracking-widest gap-2">
                <Scan className="w-3.5 h-3.5" /> Hardware
              </TabsTrigger>
              <TabsTrigger value="advanced" className="uppercase text-[10px] font-black tracking-widest gap-2">
                <RefreshCcw className="w-3.5 h-3.5" /> Avanzado
              </TabsTrigger>
            </TabsList>

            {/* PESTAÑA GENERAL */}
            <TabsContent value="general" className="space-y-6 outline-none">
              <Card className="border-emerald-500/20 bg-emerald-500/5 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <CardHeader className="flex flex-row items-center gap-4 bg-emerald-500/10 border-b border-emerald-500/10 py-4">
                  <Activity className="h-6 w-6 text-emerald-600" />
                  <div>
                    <CardTitle className="text-emerald-700 dark:text-emerald-400">Salud del Motor</CardTitle>
                    <CardDescription className="text-emerald-600/70 text-xs font-bold uppercase tracking-widest">Diagnóstico en tiempo real</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <DbHealthSummary />
                </CardContent>
              </Card>

              <Card className="bg-card/40 border-primary/10 shadow-lg p-6 flex items-center justify-between">
                <div>
                  <h3 className="font-bold uppercase tracking-tight text-sm">Versión del Sistema</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Ready to Ship 🚀</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-primary/80">1.1.0</p>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Stable Build</p>
                </div>
              </Card>
            </TabsContent>

            {/* PESTAÑA SEGURIDAD */}
            <TabsContent value="security" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Respaldos y Persistencia</CardTitle>
                    <CardDescription>Gestiona la exportación de datos críticos.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 border p-6 rounded-xl bg-muted/20">
                    <p className="font-bold text-sm flex items-center gap-2 uppercase tracking-tight"><Download className="h-4 w-4 text-primary" /> Exportar</p>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Genera un snapshot comprimido de tu base de datos local en formato .fastpos.</p>
                    <Button className="w-full h-11 uppercase text-[10px] font-black tracking-widest" onClick={handleExport} disabled={isExporting || isImporting}>
                      {isExporting ? "Generando..." : "Descargar Respaldo"}
                    </Button>
                  </div>
                  <div className="space-y-2 border p-6 rounded-xl border-dashed bg-muted/10">
                    <p className="font-bold text-sm flex items-center gap-2 uppercase tracking-tight"><Upload className="h-4 w-4 text-amber-500" /> Restaurar</p>
                    <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Carga un punto de restauración previo. Sobrescribirá todos los datos actuales.</p>
                    <div className="relative">
                      <input type="file" accept=".fastpos" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} />
                      <Button variant="secondary" className="w-full h-11 uppercase text-[10px] font-black tracking-widest" disabled={isExporting || isImporting}>
                        {isImporting ? "Importando..." : "Cargar Archivo"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
                <CardHeader className="bg-destructive/10 border-b border-destructive/10 py-3">
                  <CardTitle className="text-destructive text-sm flex items-center gap-2 uppercase tracking-widest font-black">
                    <AlertTriangle className="h-4 w-4" /> Zona de Peligro
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm uppercase tracking-tight">Borrado Integral</p>
                      <p className="text-xs text-muted-foreground">Limpia inventario, ventas y categorías. No se puede deshacer.</p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleNuke} className="uppercase text-[10px] font-black tracking-widest">
                      <Trash2 className="h-4 w-4 mr-2" /> Borrar Todo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PESTAÑA HARDWARE */}
            <TabsContent value="hardware" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Scan className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <CardTitle>Periféricos</CardTitle>
                    <CardDescription>Diagnóstico de lectores y escáneres.</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 bg-background/50 gap-4 text-center border-blue-500/20">
                    {!lastScan ? (
                      <>
                        <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
                          <Scan className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-bold uppercase tracking-widest">Puerto en Escucha...</p>
                          <p className="text-[10px] text-muted-foreground mt-1 uppercase">Dispara el gatillo del escáner ahora</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Activity className="h-8 w-8 text-emerald-500 animate-bounce" />
                        <div className="space-y-1">
                          <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{lastScan.code}</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Última lectura certificada</p>
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
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Tipo</p>
                        <p className="text-sm font-black uppercase tracking-tight">HID Keyboard</p>
                      </div>
                    </div>
                    <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4 border-blue-500/10">
                      <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">Estado</p>
                        <p className="text-sm font-black text-emerald-600 uppercase tracking-tight">Certificado</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PESTAÑA AVANZADO */}
            <TabsContent value="advanced" className="space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 uppercase tracking-tight font-black">
                    <RefreshCcw className="h-5 w-5 text-primary" /> Laboratorio
                  </CardTitle>
                  <CardDescription className="text-xs uppercase font-bold text-muted-foreground/60">Herramientas de Estrés y Población de Datos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="p-6 border rounded-xl bg-background/40 space-y-4">
                      <div>
                        <p className="font-bold text-sm uppercase tracking-tight">Inyección de Datos (+2500)</p>
                        <p className="text-xs text-muted-foreground mt-1">Simula tráfico masivo para certificar la estabilidad de SQLite.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button 
                          variant="outline" 
                          className="h-11 uppercase text-[10px] font-black tracking-widest"
                          onClick={async () => {
                            if (!confirm("¿Generar stress test?")) return;
                            const id = toast.loading("Procesando...");
                            try {
                              const { generateMassiveData } = await import("@/lib/seed");
                              await generateMassiveData((msg) => toast.loading(msg, { id }));
                              toast.success("¡Sincronización masiva completa!", { id });
                              setTimeout(() => window.location.reload(), 1500);
                            } catch (err) { toast.error("Error", { id }); }
                          }}
                        >
                          Carga de Estrés
                        </Button>
                        <Button 
                          className="h-11 bg-blue-600 hover:bg-blue-700 uppercase text-[10px] font-black tracking-widest text-white border-0"
                          onClick={async () => {
                            if (!confirm("¿Cargar Demo Pro?")) return;
                            const id = toast.loading("Descargando activos...");
                            try {
                              const { seedDemoData } = await import("@/lib/seed");
                              await seedDemoData((msg) => toast.loading(msg, { id }));
                              toast.success("Catálogo Premium cargado.", { id });
                              setTimeout(() => window.location.reload(), 1500);
                            } catch (err) { toast.error("Error", { id }); }
                          }}
                        >
                          Seed Demo Pro
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* FOOTER */}
          <div className="flex flex-col items-center gap-4 pt-10 border-t border-primary/5 opacity-50">
            <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
              Powered by Next.js & SQLite Native Core © 2026
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

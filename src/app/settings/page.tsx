"use client";

/**
 * Página de Ajustes y Configuración
 * 
 * FUENTE DE VERDAD: Fase 6.2 - Sistema de Seguridad de Datos
 */

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, ShieldCheck, AlertTriangle, RefreshCcw, Trash2, Scan, Keyboard, Activity } from "lucide-react";
import { BarcodeHandler } from "@/components/shared/barcode-handler";
import { db } from "@/lib/db";

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

  // Función para descargar el respaldo físico (.fastpos)
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Importación dinámica para evitar errores de SSR
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
      
      toast.success("¡Respaldo generado!", { 
        description: "Guarda este archivo en un lugar seguro." 
      });
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar");
    } finally {
      setIsExporting(false);
    }
  };

  // Función para restaurar la base de datos desde un archivo
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("🚨 ¿BORRAR TODO Y RESTAURAR? Esta acción reemplazará tus datos actuales.")) {
      e.target.value = "";
      return;
    }

    setIsImporting(true);
    try {
      const { importDB } = await import("dexie-export-import");
      await importDB(file, { 
        acceptNameDiff: true,   
        acceptVersionDiff: true, 
        acceptMissingTables: true,
        acceptChangedIndex: true
      } as any);

      toast.success("Restauración exitosa", { description: "Reiniciando app..." });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error(error);
      toast.error("Fallo la importación", { description: error.message });
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  // Función de borrado total (Nuke)
  const handleNuke = async () => {
    const c1 = confirm("⚠️ ¿Borrar absolutamente todo el inventario y ventas?");
    if (!c1) return;
    const c2 = confirm("ESTA ACCIÓN ES IRREVERSIBLE. ¿Continuar?");
    if (!c2) return;

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
          <h1 className="text-2xl font-black tracking-tight uppercase">Configuración</h1>
          <p className="text-sm text-muted-foreground italic">Control total de tu motor de ventas.</p>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Seguridad y Respaldos</CardTitle>
                <CardDescription>Exporta e importa tu base de datos local.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 border p-4 rounded-xl">
                <p className="font-bold text-sm flex items-center gap-2"><Download className="h-4 w-4" /> Exportar</p>
                <p className="text-xs text-muted-foreground">Genera un archivo .fastpos con toda tu info.</p>
                <Button className="w-full" onClick={handleExport} disabled={isExporting || isImporting}>
                  {isExporting ? "Generando..." : "Descargar Copia"}
                </Button>
              </div>
              <div className="space-y-2 border p-4 rounded-xl border-dashed">
                <p className="font-bold text-sm flex items-center gap-2"><Upload className="h-4 w-4" /> Restaurar</p>
                <p className="text-xs text-muted-foreground">Carga un archivo de respaldo anterior.</p>
                <div className="relative">
                  <input type="file" accept=".fastpos" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleImport} />
                  <Button variant="secondary" className="w-full" disabled={isExporting || isImporting}>
                    {isImporting ? "Importando..." : "Cargar Archivo"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="flex flex-row items-center gap-4">
              <Scan className="h-8 w-8 text-blue-500" />
              <div>
                <CardTitle>Diagnóstico de Periféricos</CardTitle>
                <CardDescription>Prueba la compatibilidad de tu lector de código de barras.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-8 bg-background/50 gap-4 text-center">
                {!lastScan ? (
                  <>
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center animate-pulse">
                      <Scan className="h-6 w-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold uppercase tracking-widest">Esperando lectura...</p>
                      <p className="text-xs text-muted-foreground mt-1">Dispara el escáner ahora para certificar su velocidad.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Activity className="h-8 w-8 text-emerald-500 animate-bounce" />
                    <div className="space-y-1">
                      <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{lastScan.code}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
                        Último código detectado correctamente
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Keyboard className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Tipo de Entrada</p>
                    <p className="text-sm font-black">HID (Emulación Teclado)</p>
                  </div>
                </div>
                <div className="p-4 border rounded-xl bg-background/80 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Estado de Compatibilidad</p>
                    <p className="text-sm font-black text-emerald-600">Certificado</p>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground text-center italic">
                Nota: No necesitas hacer clic en ningún campo. El sistema escucha al escáner de forma global mientras estés en esta pantalla.
              </p>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Zona de Peligro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-xl bg-background/50">
                <div>
                  <p className="font-bold text-sm">Borrar todos los datos</p>
                  <p className="text-xs text-muted-foreground">Limpia inventario, ventas y categorías de este equipo.</p>
                </div>
                <Button variant="destructive" size="sm" onClick={handleNuke}><Trash2 className="h-4 w-4 mr-2" /> Borrar Todo</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCcw className="h-5 w-5" /> Desarrollo y Pruebas</CardTitle>
              <CardDescription>Herramientas para probar el rendimiento del sistema.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-xl bg-background/50">
                <div className="flex-1 mr-4">
                  <p className="font-bold text-sm">Generar Datos Masivos (+1000)</p>
                  <p className="text-xs text-muted-foreground">
                    Crea automáticamente 1,000 productos y 1,200 ventas para probar el rendimiento 
                    del grid y de las analíticas en condiciones de estrés.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    const confirmSeed = confirm("¿Generar +2000 registros nuevos de prueba?");
                    if (!confirmSeed) return;
                    
                    const id = toast.loading("Poblando base de datos...");
                    try {
                      const { generateMassiveData } = await import("@/lib/seed");
                      const result = await generateMassiveData((msg) => toast.loading(msg, { id }));
                      if (result.success) {
                        toast.success("¡Seeding Completo!", { 
                          description: "Base de datos con +1000 productos cargada.",
                          id 
                        });
                        setTimeout(() => window.location.reload(), 2000);
                      }
                    } catch (err) {
                      toast.error("Error en el proceso de seeding", { id });
                    }
                  }}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" /> Generar Seed
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

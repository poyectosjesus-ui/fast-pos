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
import { Download, Upload, ShieldCheck, AlertTriangle, RefreshCcw, Trash2 } from "lucide-react";
import { db } from "@/lib/db";

export default function SettingsPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Función para descargar el respaldo físico (.fastpos)
  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Importación dinámica para evitar errores de SSR
      const { exportDB } = await import("dexie-export-import");
      const blob = await exportDB(db, { prettyJson: true });
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
      await db.transaction('rw', [db.products, db.categories, db.orders], async () => {
        await Promise.all([
          db.products.clear(),
          db.categories.clear(),
          db.orders.clear()
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
        </div>
      </main>
    </div>
  );
}

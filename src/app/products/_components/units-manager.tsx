import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { PlusCircle, Trash2, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Unit = { id: string; name: string; symbol: string; allowFractions: number; isSystem: number };

export function UnitsManager() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Unit | null>(null);

  // Form State
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [allowFractions, setAllowFractions] = useState(false);

  // Load Data
  const loadData = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api || !api.getAllUnits) return;
    try {
      const dbUnits = await api.getAllUnits();
      setUnits(dbUnits);
    } catch (err) {
      console.error(err);
      toast.error("Error al cargar unidades", { description: "Revisa la consola." });
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenAlert = () => {
    setId("");
    setName("");
    setSymbol("");
    setAllowFractions(false);
    setIsOpen(true);
  };

  const handleSave = async () => {
    if (!id.trim() || !name.trim() || !symbol.trim()) {
      toast.error("Datos incompletos", { description: "El ID, Nombre y Símbolo son requeridos." });
      return;
    }
    const reqId = id.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

    setIsSaving(true);
    try {
      const api = (window as any).electronAPI;
      const res = await api.createUnit({
        id: reqId,
        name: name.trim(),
        symbol: symbol.trim(),
        allowFractions,
      });

      if (res.success) {
        toast.success("Unidad creada", { description: `${name} (${symbol})` });
        setIsOpen(false);
        loadData();
      } else {
        toast.error("No se pudo guardar", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    try {
      const api = (window as any).electronAPI;
      const res = await api.deleteUnit(pendingDelete.id);
      if (res.success) {
        toast.success("Unidad eliminada", { description: pendingDelete.name });
        loadData();
      } else {
        toast.error("Error al eliminar", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Excepción", { description: err.message });
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b">
          <div className="flex flex-col gap-1 flex-1">
            <CardTitle>Catálogo de Unidades</CardTitle>
            <CardDescription>
              Define cómo mides tus productos. (Las unidades predeterminadas del sistema no se pueden borrar).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2 shrink-0" onClick={handleOpenAlert}>
                <PlusCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Nueva Unidad</span>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Nueva Unidad de Medida</DialogTitle>
                  <DialogDescription>
                    Agrega una nueva unidad al sistema que podrás asignar a tus productos.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="unitId">Identificador / Clave</Label>
                    <Input
                      id="unitId"
                      placeholder="Ej: CAJA, COSTAL, DOZENA"
                      value={id}
                      onChange={(e) => setId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
                      disabled={isSaving}
                      className="uppercase"
                      maxLength={10}
                    />
                    <p className="text-[10px] text-muted-foreground">ID único en base de datos. Sólo mayúsculas y guión bajo.</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="unitName">Nombre</Label>
                      <Input
                        id="unitName"
                        placeholder="Ej: Caja, Costal"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="unitSymbol">Símbolo</Label>
                      <Input
                        id="unitSymbol"
                        placeholder="Ej: cja, saco, dz"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">Aceptar Fracciones / Granel</Label>
                      <p className="text-xs text-muted-foreground">
                        Actívalo si esta unidad permite capturar cantidades decimales en caja (ej: 0.5 cajas).
                      </p>
                    </div>
                    <Switch
                      checked={allowFractions}
                      onCheckedChange={setAllowFractions}
                      disabled={isSaving}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    Guardar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="divide-y">
            {units.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Cargando unidades...
              </div>
            ) : (
              units.map(unit => (
                <div key={unit.id} className="flex items-center justify-between p-4 sm:px-6 hover:bg-muted/5">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{unit.name}</p>
                      <span className="text-xs font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border">
                        {unit.symbol}
                      </span>
                      {unit.isSystem === 1 && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <ShieldAlert className="h-3 w-3" /> Sistema
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ID: <span className="font-mono">{unit.id}</span> | Venta Fraccionada: {unit.allowFractions ? "Sí" : "No"}
                    </p>
                  </div>
                  <div>
                    {unit.isSystem === 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setPendingDelete(unit)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar unidad de medida?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de borrar la unidad <strong>{pendingDelete?.name}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
              Eliminar Unidad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

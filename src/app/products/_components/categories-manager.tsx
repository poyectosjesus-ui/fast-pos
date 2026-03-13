"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

import { Edit2, Plus, Trash2 } from "lucide-react";

import { CategoryService } from "@/lib/services/categories";
import { Category } from "@/lib/schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function CategoriesManager() {
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof CategoryService['getAll']>> | undefined>(undefined);

  const loadCategories = useCallback(async () => {
    const cats = await CategoryService.getAll();
    setCategories(cats);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // Estado Controlado por Componente (UI Guideline 3)
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const handleOpenAlert = (category?: Category) => {
    if (category) {
      setEditingId(category.id);
      setCategoryName(category.name);
    } else {
      setEditingId(null);
      setCategoryName("");
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    // Validamos en UI para no desgastar promesas en DB si está vacío (UX Guideline)
    if (!categoryName.trim()) {
      toast.error("Faltan datos", { description: "Por favor, escribe un nombre para este grupo antes de continuar."});
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        await CategoryService.update(editingId, categoryName);
        toast.success("¡Listo!", { description: "Los cambios se guardaron correctamente." });
      } else {
        await CategoryService.create(categoryName);
        toast.success("¡Excelente!", { description: "Familia registrada y lista para usarse." });
      }
      setIsOpen(false);
      await loadCategories(); // Refrescar
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "No pudimos guardar los cambios. Intenta de nuevo.";
      toast.error("Hubo un problema", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };


  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Estás seguro que deseas borrar el grupo "${name}" para siempre?`)) return;
    try {
      await CategoryService.delete(id);
      toast.success("Eliminado", { description: `El grupo "${name}" ha sido borrado de tu lista.` });
      await loadCategories(); // Refrescar
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("No podemos borrar esto", { description: msg, duration: 5000 });
    }
  };


  // Computación segura: deshabilitamos el guardado si nombre está vacío (UI Guideline 5)
  const isSubmitDisabled = !categoryName.trim() || isSaving;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Familias</CardTitle>
          <CardDescription>
            Agrupa tus productos (Ej. Postres, Comida, Bebidas Frias) para encontrarlos más rápido al vender.
          </CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"
            onClick={() => handleOpenAlert()}
          >
            <Plus className="h-4 w-4" />
            Crear Grupo
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Editar nombre del grupo" : "Crear un nuevo grupo"}</DialogTitle>
              <DialogDescription>
                 Elige un nombre corto y descriptivo para clasificar tus ventas.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Input
                className="h-12 text-lg"
                placeholder="Ej. Desayunos, Postres, Limpieza..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isSubmitDisabled && handleSave()}
                disabled={isSaving}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>Cerrar</Button>
              <Button onClick={handleSave} disabled={isSubmitDisabled}>
                {isSaving ? "Guardando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {categories === undefined ? (
          <p className="text-muted-foreground animate-pulse text-sm">Abriendo tus archivos...</p>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed bg-muted/20">
            <span className="text-sm text-foreground font-medium mb-1">Todo está vacío por aquí.</span>
            <span className="text-sm text-muted-foreground mb-4">Antes de registrar lo que vendes, debes crear al menos un grupo general (como "Bebidas" o "Comida").</span>
            <Button onClick={() => handleOpenAlert()}>Añadir tu primer grupo</Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between p-3 rounded-lg border bg-card transition-colors hover:bg-muted/10 shadow-sm gap-2">
                <span className="font-medium text-sm truncate">{category.name}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenAlert(category)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(category.id, category.name)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

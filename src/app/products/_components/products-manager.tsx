"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Edit2, PackagePlus, Trash2, SearchX } from "lucide-react";

import { ProductService } from "@/lib/services/products";
import { CategoryService } from "@/lib/services/categories";
import { Product } from "@/lib/schema";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function ProductsManager() {
  const products = useLiveQuery(() => ProductService.getAll(), []);
  const categories = useLiveQuery(() => CategoryService.getAll(), []);
  
  // UI State Control
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [stockStr, setStockStr] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const handleOpenAlert = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setName(product.name);
      setSku(product.sku);
      // Backend Rule 2: El dinero viene en centavos enteros desde la DB, lo mostramos como decimal
      setPriceStr((product.price / 100).toFixed(2));
      setStockStr(product.stock.toString());
      setCategoryId(product.categoryId);
    } else {
      setEditingId(null);
      setName("");
      setSku("");
      setPriceStr("");
      setStockStr("");
      // Setup default fallback para selects en UI
      setCategoryId(categories?.[0]?.id || "");
    }
    setIsOpen(true);
  };

  const handleSave = async () => {
    // UI Rule 4: Zero Trust Frontend validation
    if (!name.trim() || !sku.trim() || !categoryId || !priceStr || !stockStr) {
       toast.error("Información incompleta", { description: "Revisa que todos los campos tengan información antes de guardar." });
       return;
    }

    setIsSaving(true);
    try {
      // Backend Rule 2: Convertir floats a Integer (Centavos) antes de tocar Lógica o DB.
      const priceInCents = Math.round(parseFloat(priceStr) * 100);
      const stock = parseInt(stockStr, 10);

      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        price: priceInCents,
        stock,
        categoryId,
      };

      if (editingId) {
        await ProductService.update(editingId, payload);
        toast.success("¡Listo!", { description: "Los cambios de este producto han sido guardados."});
      } else {
        await ProductService.create(payload);
        toast.success("¡Excelente!", { description: "El artículo ya está disponible para vender."});
      }
      setIsOpen(false);
    } catch (error: any) {
      // Backend Rule 4: Trazabilidad amigable hacia la UI
      toast.error("No pudimos guardar", { description: error.message || String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, productName: string) => {
    if (!confirm(`¿Estás completamente seguro de que quieres borrar el artículo "${productName}"? Esto no afectará las ventas pasadas donde se incluyó.`)) return;
    try {
      await ProductService.delete(id);
      toast.success("Eliminado", { description: "El artículo ya no aparecerá en tu catálogo." });
    } catch (error: any) {
      toast.error("Fallo inesperado", { description: "No pudimos borrar este artículo. Intenta de nuevo." });
    }
  };

  // UI Rule 5: Bloqueos Preventivos
  const isSubmitDisabled = isSaving || !name.trim() || !sku.trim() || !categoryId;

  // Render condicional a prueba de fallos (Error Boundary Básico)
  if (!categories || categories.length === 0) {
     return (
        <Card className="border-dashed bg-muted/10 shadow-none border-2">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <SearchX className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Aún no existen familias registradas.</p>
                <p className="text-xs text-muted-foreground w-[80%] mx-auto">
                   Para poder organizar tus ventas de forma efectiva, es necesario que todos tus productos tengan una categoría. Ve a la pestaña de "Categorías" y crea al menos una familia (ej. "Bebidas") para poder empezar a llenar tus estantes.
                </p>
            </CardContent>
        </Card>
     );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Mi Catálogo</CardTitle>
          <CardDescription>
            Agrega o edita lo que vendes. Asegúrate de ponerle un precio y cuántos tienes.
          </CardDescription>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger 
            className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"
            onClick={() => handleOpenAlert()}
          >
            <PackagePlus className="h-4 w-4" />
            Añadir Artículo
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Actualizar detalles" : "Un nuevo artículo"}</DialogTitle>
              <DialogDescription>
                Llena la siguiente información sobre el producto. Solo tú podrás ver los códigos e inventario.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">¿Cómo se llama tu producto?</Label>
                <Input id="name" placeholder="Ej. Frappé de Moka Extra Grande" value={name} onChange={(e) => setName(e.target.value)} disabled={isSaving} />
                <p className="text-[10px] text-muted-foreground">Este es el nombre visible en el punto de venta y recibos de los clientes.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sku">Código Corto (Identificador)</Label>
                  <Input id="sku" placeholder="Ej. MOKA-XLG" value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} disabled={isSaving} />
                  <p className="text-[10px] text-muted-foreground">Útil para búsquedas rápidas. Debe ser único.</p>
                </div>
                <div className="space-y-2">
                  <Label>¿A qué grupo pertenece?</Label>
                  <Select value={categoryId} onValueChange={(val) => setCategoryId(val || "")} disabled={isSaving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Elige un grupo" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">¿En cuánto lo vendes?</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground font-medium">$</span>
                    <Input id="price" type="number" step="0.01" min="0" placeholder="0.00" className="pl-7" value={priceStr} onChange={(e) => setPriceStr(e.target.value)} disabled={isSaving} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">El cliente pagará este monto final (incluye impuestos).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stock">¿Cuántos tenemos ahora?</Label>
                  <Input id="stock" type="number" step="1" min="0" placeholder="Ej. 100" value={stockStr} onChange={(e) => setStockStr(e.target.value)} disabled={isSaving} />
                  <p className="text-[10px] text-muted-foreground">Cada venta descontará -1 de esta cantidad global.</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving}>Cerrar</Button>
              <Button onClick={handleSave} disabled={isSubmitDisabled}>
                 {isSaving ? "Guardando de forma segura..." : "Guardar Producto"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {products === undefined ? (
          <p className="text-muted-foreground text-center py-8 text-sm animate-pulse">Abriendo tu libreta de productos...</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed bg-muted/10 mx-6 mb-6">
            <p className="text-sm font-medium mb-1">Aún no has agregado nada</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[250px] mx-auto">Tus estantes están vacíos. Haz clic en "Añadir Artículo" para registrar tus productos, sus precios y poder comenzar a vender.</p>
            <Button onClick={() => handleOpenAlert()} className="h-9">Añadir tu primer artículo</Button>
          </div>
        ) : (
          <div className="flex flex-col w-full divide-y sm:border sm:rounded-md bg-card">
            {products.map((product) => {
              const catName = categories.find(c => c.id === product.categoryId)?.name || "N/A";
              return (
                <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/10 transition-colors gap-3">
                  <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
                    <div className="flex flex-col gap-0.5 w-[50%] sm:w-[220px]">
                      <span className="font-semibold text-sm truncate">{product.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">{product.sku}</span>
                    </div>
                    <Badge variant="secondary" className="hidden sm:flex text-[10px] w-fit font-medium">
                      {catName}
                    </Badge>
                    <div className="flex flex-col items-end sm:items-center sm:flex-row ml-auto sm:ml-0 gap-1 sm:gap-4 ml-auto">
                        <span className="font-bold text-primary sm:w-[80px] text-right">
                          ${(product.price / 100).toFixed(2)}
                        </span>
                        <div className="text-[11px] font-medium sm:w-[60px] text-right sm:text-left">
                            <span className={product.stock > 5 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                              {product.stock} un.
                            </span>
                        </div>
                    </div>
                  </div>
                  <div className="flex gap-1 justify-end mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-border/50">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenAlert(product)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(product.id, product.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

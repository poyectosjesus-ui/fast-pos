import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { toast } from "sonner";
import { Edit2, PackagePlus, Trash2, SearchX, PlusCircle, MinusCircle, EyeOff, Eye, ImageIcon } from "lucide-react";

import { BarcodeHandler } from "@/components/shared/barcode-handler";

import { db } from "@/lib/db";
import { Product } from "@/lib/schema";
import { ProductService } from "@/lib/services/products";
import { CategoryService } from "@/lib/services/categories";

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
import { Switch } from "@/components/ui/switch";
import { SearchInput } from "@/components/ui/search-input";

export function ProductsManager() {
  const categories = useLiveQuery(() => CategoryService.getAll(), []);
  
  // UI State Control
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");
  
  // PAGINACIÓN (CA-10.6)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [stockStr, setStockStr] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);

  // Consulta reactiva y paginada (Fase 10.6)
  const { filteredProducts, totalCount } = useLiveQuery(async () => {
    let collection = db.products.toCollection();

    // Filtro por categoría
    if (activeTab !== "ALL") {
      collection = collection.and((p: Product) => p.categoryId === activeTab);
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      collection = collection.filter((p: Product) => 
        p.name.toLowerCase().includes(searchLower) || 
        p.sku.toLowerCase().includes(searchLower)
      );
    }

    const total = await collection.count();
    const items = await collection
      .offset((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .toArray();

    return { filteredProducts: items, totalCount: total };
  }, [activeTab, searchTerm, currentPage]) ?? { filteredProducts: [], totalCount: 0 };

  const products = filteredProducts; // Alias para mantener compatibilidad con el resto del componente
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handleOpenAlert = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setName(product.name);
      setSku(product.sku);
      // Backend Rule 2: El dinero viene en centavos enteros desde la DB, lo mostramos como decimal
      setPriceStr((product.price / 100).toFixed(2));
      setStockStr(product.stock.toString());
      setCategoryId(product.categoryId);
      setImageBase64(product.image);
    } else {
      setEditingId(null);
      setName("");
      setSku("");
      setPriceStr("");
      setStockStr("");
      setImageBase64(undefined);
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
        isVisible: true,
        image: imageBase64,
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

  const handleQuickStock = async (id: string, currentStock: number, change: number) => {
    const newStock = currentStock + change;
    if (newStock < 0) return; // UI Rule 5: Math Block
    try {
       await ProductService.adjustStock(id, newStock);
       toast.success("Inventario listo", { description: change > 0 ? "Añadiste existencias" : "Retiraste existencias" });
    } catch (error: any) {
       toast.error("Ocurrió un problema", { description: error.message });
    }
  };

  const handleToggleVisibility = async (id: string, currentVal: boolean) => {
    try {
       await ProductService.toggleVisibility(id, !currentVal);
       toast.success("Visibilidad cambiada", { description: !currentVal ? "El producto volverá a verse en ventas." : "Ocultaste el producto del menú público." });
    } catch (error: any) {
       toast.error("Ocurrió un problema", { description: error.message });
    }
  };

  const handleBarcodeScanned = (code: string) => {
    const upperCode = code.toUpperCase();

    // SMART FOCUS: Si el formulario está abierto, llenamos el SKU del formulario
    if (isOpen) {
      setSku(upperCode);
      toast.success("Código capturado", { description: "SKU actualizado en el formulario." });
      return;
    }

    // Si el formulario NO está abierto, filtramos la lista principal
    setActiveTab("ALL");
    setCurrentPage(1);
    setSearchTerm(upperCode);
    
    db.products.where("sku").equals(upperCode).first().then((found) => {
      if (found) {
        toast.success("Producto encontrado", { description: found.name });
      } else {
        toast.error("Sin resultado", { description: `El código "${code}" no existe.` });
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Limitamos el tamaño para no saturar IndexedDB (Normativa 5: Resiliencia Offline)
    if (file.size > 500 * 1024) {
      toast.error("Imagen demasiado grande", { description: "Elige una foto de menos de 500KB para que no ocupe demasiado espacio en este dispositivo." });
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // UI Rule 5: Bloqueos Preventivos
  const isSubmitDisabled = isSaving || !name.trim() || !sku.trim() || !categoryId;

  // Filtrado amigable — Reset de página al cambiar filtros
  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

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
      <BarcodeHandler onScan={handleBarcodeScanned} profile="catalog" />
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b">
        <div className="flex flex-col gap-1 flex-1">
          <CardTitle>Mi Catálogo</CardTitle>
          <CardDescription>
            Agrega o edita lo que vendes. Asegúrate de ponerle un precio y cuántos tienes.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <SearchInput
            value={searchTerm}
            onChange={handleSearchChange}
            onBarcodeScanned={handleBarcodeScanned}
            placeholder="Buscar por nombre o código..."
            className="flex-1 sm:w-64"
          />
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 gap-2"
              onClick={() => handleOpenAlert()}
            >
              <PackagePlus className="h-4 w-4" />
              <span className="hidden sm:inline">Añadir Artículo</span>
            </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Actualizar detalles" : "Un nuevo artículo"}</DialogTitle>
              <DialogDescription>
                Llena la siguiente información sobre el producto. Solo tú podrás ver los códigos e inventario.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-5 py-4">
              
              {/* Avatar / Foto del producto */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                  {imageBase64 ? (
                    <img src={imageBase64} alt="Vista previa" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="image" className="text-sm font-medium">Foto del artículo (opcional)</Label>
                  <Input 
                    id="image" 
                    type="file" 
                    accept="image/*" 
                    onChange={handleImageChange}
                    disabled={isSaving}
                    className="text-sm cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground">Máx. 500KB. Se guarda en este dispositivo.</p>
                </div>
              </div>

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
        </div>
      </CardHeader>
      
      {/* Categories Filter Tabs */}
      {categories && categories.length > 0 && products && products.length > 0 && (
        <div className="flex items-center flex-nowrap overflow-x-auto gap-2 px-6 py-3 border-b border-border/50 no-scrollbar">
          <Button 
            variant={activeTab === "ALL" ? "default" : "secondary"} 
            size="sm" 
            className="rounded-full shrink-0 h-8 text-xs px-4"
            onClick={() => handleTabChange("ALL")}
          >
            Todos
          </Button>
          {categories.map(cat => (
            <Button 
              key={cat.id}
              variant={activeTab === cat.id ? "default" : "secondary"} 
              size="sm" 
              className="rounded-full shrink-0 h-8 text-xs px-4"
              onClick={() => handleTabChange(cat.id)}
            >
              {cat.name}
            </Button>
          ))}
        </div>
      )}

      <CardContent className="p-0 sm:p-6 sm:pt-6">
        {products === undefined ? (
          <p className="text-muted-foreground text-center py-8 text-sm animate-pulse">Abriendo tu libreta de productos...</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed bg-muted/10 mx-6 mb-6">
            <p className="text-sm font-medium mb-1">Aún no has agregado nada</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-[250px] mx-auto">Tus estantes están vacíos. Haz clic en "Añadir Artículo" para registrar tus productos, sus precios y poder comenzar a vender.</p>
            <Button onClick={() => handleOpenAlert()} className="h-9">Añadir tu primer artículo</Button>
          </div>
        ) : filteredProducts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center mx-6">
            <SearchX className="h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">No encontramos lo que buscas</p>
            <p className="text-xs text-muted-foreground">Intenta buscar usando otras palabras o recorta el código.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col w-full divide-y sm:border sm:rounded-md bg-card">
              {filteredProducts!.map((product: Product) => {
                const catName = categories.find(c => c.id === product.categoryId)?.name || "N/A";
                return (
                  <div key={product.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-muted/10 transition-colors gap-3">
                    <div className="flex items-center gap-3 sm:gap-6 flex-1 min-w-0">
                      {/* Avatar: foto real si existe, o iniciales del nombre como fallback */}
                      <div className="h-10 w-10 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground uppercase">
                            {product.name.slice(0, 2)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-0.5 w-[50%] sm:w-[180px]">
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
                          
                          <div className="flex items-center gap-2 bg-muted/40 rounded-full px-1.5 py-0.5 border border-border/50">
                             <button onClick={() => handleQuickStock(product.id, product.stock, -1)} disabled={product.stock === 0} className="hover:text-destructive disabled:opacity-30 transition-colors p-1">
                                <MinusCircle className="h-4 w-4" />
                             </button>
                             <span className={`text-[11px] font-bold w-[24px] text-center ${product.stock > 5 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                                {product.stock}
                             </span>
                             <button onClick={() => handleQuickStock(product.id, product.stock, 1)} className="hover:text-primary transition-colors p-1">
                                <PlusCircle className="h-4 w-4" />
                             </button>
                          </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-border/50">
                      <div className="flex items-center gap-1.5 px-2">
                         {product.isVisible !== false ? (
                             <Eye className="h-3 w-3 text-muted-foreground" />
                         ) : (
                             <EyeOff className="h-3 w-3 text-muted-foreground" />
                         )}
                         <Switch 
                            checked={product.isVisible !== false} 
                            onCheckedChange={() => handleToggleVisibility(product.id, product.isVisible ?? true)} 
                            className="scale-75"
                         />
                      </div>
                      <div className="flex gap-1 justify-end ml-auto border-l pl-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenAlert(product)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(product.id, product.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* PAGINACIÓN ESTRICTA (CA-10.6) */}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/20 rounded-2xl border border-border/50 backdrop-blur-sm mx-6 mb-6">
              <div className="text-xs text-muted-foreground font-medium order-2 sm:order-1">
                Mostrando <span className="text-foreground">{Math.min(totalCount, (currentPage - 1) * itemsPerPage + 1)}</span> - <span className="text-foreground">{Math.min(totalCount, currentPage * itemsPerPage)}</span> de <span className="text-foreground font-bold">{totalCount}</span> productos
              </div>
              
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  &lt;
                </Button>
                
                <div className="flex items-center gap-1.5 px-3 h-8 bg-background rounded-lg text-xs font-bold">
                  Página {currentPage} de {totalPages || 1}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  &gt;
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

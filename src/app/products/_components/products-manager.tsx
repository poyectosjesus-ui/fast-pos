import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ImageService } from "@/lib/services/image";

import { Edit2, PackagePlus, Trash2, SearchX, PlusCircle, MinusCircle, EyeOff, Eye, ImageIcon, Barcode } from "lucide-react";
import { BarcodeLabelDialog } from "@/components/pos/barcode-label-dialog";

import { BarcodeHandler } from "@/components/shared/barcode-handler";

import { Product } from "@/lib/schema";
import { ProductService } from "@/lib/services/products";
import { CategoryService } from "@/lib/services/categories";
import { useSessionStore } from "@/store/useSessionStore";
import { calculateItemTax, formatCents, pctToRate, rateToPercent } from "@/lib/services/tax";
import { getInventoryStyle } from "@/lib/utils/inventory";



import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

/**
 * ProductImage — Carga la URL file:// de una imagen del bucket local y la muestra.
 * El componente padre es responsable de manejar el caso vacío (sin imagen).
 * EPIC-003: las imágenes no se guardan como base64 en DB sino como archivos en disco.
 */
function ProductImage({ filename, alt }: { filename: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    ImageService.getUrl(filename).then(url => setSrc(url));
  }, [filename]);
  if (!src) return null;
  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

export function ProductsManager() {
  const { user } = useSessionStore();

  // Estado SQLite
  type Unit = { id: string; name: string; symbol: string; allowFractions: number; isSystem: number };
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof CategoryService['getAll']>>>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // UI State Control
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelProduct, setLabelProduct] = useState<Product | null>(null);
  const [businessName, setBusinessName] = useState<string>("Fast-POS");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  // Confirmar borrado (evita window.confirm — CODING_STANDARDS)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; image?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [costPriceStr, setCostPriceStr] = useState("");
  const [stockStr, setStockStr] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // EPIC-003: filename guardado en DB ("uuid.webp") + previewUrl sólo para el formulario
  const [imageFilename, setImageFilename] = useState<string | undefined>(undefined);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | undefined>(undefined);
  // Unidad de Medida - EPIC-008
  const [unitType, setUnitType] = useState<string>("PIECE");
  // IVA — EPIC-002
  const [taxRate, setTaxRate] = useState(1600);  // puntos básicos (1600 = 16%)
  const [taxIncluded, setTaxIncluded] = useState(true);
  const [taxPreset, setTaxPreset] = useState<"0" | "800" | "1600" | "custom">("1600");
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);

  // Preview IVA en tiempo real
  const priceInCents = useMemo(() => Math.round(parseFloat(priceStr || "0") * 100), [priceStr]);
  const taxPreview = useMemo(
    () => (priceInCents > 0 && taxRate > 0 ? calculateItemTax(priceInCents, taxRate, taxIncluded) : null),
    [priceInCents, taxRate, taxIncluded]
  );

  // Carga y recarga de datos
  const loadData = useCallback(async () => {
    const api = (window as any).electronAPI;
    const [cats, prods, unts] = await Promise.all([
      CategoryService.getAll(),
      ProductService.getAll(),
      api?.getAllUnits ? api.getAllUnits() : Promise.resolve([])
    ]);
    setCategories(cats);
    setUnits(unts as Unit[]);

    // Filtrado en memoria
    let filtered = [...prods];
    if (activeTab !== "ALL") filtered = filtered.filter(p => p.categoryId === activeTab);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      );
    }
    setTotalCount(filtered.length);
    setFilteredProducts(filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage));
  }, [activeTab, searchTerm, currentPage]);

  useEffect(() => { loadData(); }, [loadData]);

  const products = filteredProducts;
  const totalPages = Math.ceil(totalCount / itemsPerPage);


  const handleOpenAlert = (product?: Product) => {
    if (product) {
      setEditingId(product.id);
      setName(product.name);
      setSku(product.sku);
      setPriceStr((product.price / 100).toFixed(2));
      setCostPriceStr((product.costPrice / 100).toFixed(2));
      setStockStr(product.stock.toString());
      setCategoryId(product.categoryId);
      setUnitType(product.unitType ?? "PIECE");
      setImageFilename(product.image?.startsWith("data:") ? undefined : product.image);
      // Preview: si es base64 legacy mostrarlo directo; si es filename moderno, resolver URL
      if (product.image) {
        if (product.image.startsWith("data:")) {
          // Imagen guardada antes de EPIC-003 — mostrar base64 hasta que el usuario la cambie
          setImagePreviewUrl(product.image);
        } else {
          ImageService.getUrl(product.image).then(url => setImagePreviewUrl(url ?? undefined));
        }
      } else {
        setImagePreviewUrl(undefined);
      }
      // Pre-cargar IVA del producto
      const rate = product.taxRate ?? 1600;
      setTaxRate(rate);
      setTaxIncluded(product.taxIncluded ?? true);
      if ([0, 800, 1600].includes(rate)) {
        setTaxPreset(String(rate) as "0" | "800" | "1600");
      } else {
        setTaxPreset("custom");
      }
      setAllowNegativeStock(product.allowNegativeStock ?? false);
    } else {
      setEditingId(null);
      setName("");
      setSku("");
      setPriceStr("");
      setCostPriceStr("");
      setStockStr("");
      setUnitType("PIECE");
      setImageFilename(undefined);
      setImagePreviewUrl(undefined);
      // Defaults IVA para nuevo producto
      setTaxRate(1600);
      setTaxIncluded(true);
      setTaxPreset("1600");
      setCategoryId(categories?.[0]?.id || "");
      setAllowNegativeStock(false);
    }
    setIsOpen(true);
  };


  const handleSave = async () => {
    if (!name.trim() || !sku.trim() || !categoryId || !priceStr || !stockStr) {
      toast.error("Información incompleta", { description: "Revisa que todos los campos tengan información antes de guardar." });
      return;
    }
    setIsSaving(true);
    try {
      const priceInCentsVal = Math.round(parseFloat(priceStr) * 100);
      const costInCentsVal = Math.round(parseFloat(costPriceStr || "0") * 100);
      const stock = parseFloat(stockStr) || 0;
      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        price: priceInCentsVal,
        costPrice: costInCentsVal,
        stock,
        categoryId,
        unitType, // EPIC-008: Decimales y Medidas
        isVisible: true,
        image: imageFilename,
        taxRate,        // EPIC-002
        taxIncluded,    // EPIC-002
        allowNegativeStock,
      };
      if (editingId) {
        await ProductService.update(editingId, payload, user?.id);
        toast.success("¡Listo!", { description: "Los cambios de este producto han sido guardados." });
      } else {
        await ProductService.create(payload);
        toast.success("¡Excelente!", { description: "El artículo ya está disponible para vender." });
      }
      await loadData(); // ← primero recargar la tabla
      setIsOpen(false); // ← luego cerrar el modal

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("No pudimos guardar", { description: msg });
    } finally {
      setIsSaving(false);
    }
  };



  /** Abre el diálogo de confirmación de borrado. NO borra nada todavía. */
  const handleDelete = (id: string, productName: string, image?: string) => {
    setPendingDelete({ id, name: productName, image });
  };

  /** Ejecuta el borrado real (llamado desde AlertDialog). */
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      // Limpiar imagen del bucket local ANTES de borrar el registro
      // (si falla, no es crítico — el huérfano se ignora)
      if (pendingDelete.image) {
        await ImageService.delete(pendingDelete.image);
      }
      await ProductService.delete(pendingDelete.id, user?.id);
      toast.success("Eliminado", { description: `"${pendingDelete.name}" ya no está en tu catálogo.` });
      await loadData();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("Fallo al eliminar", { description: msg });
    } finally {
      setPendingDelete(null);
    }
  };


  const handleQuickStock = async (id: string, currentStock: number, change: number) => {
    const newStock = currentStock + change;
    if (newStock < 0) return;
    try {
      await ProductService.adjustStock(id, newStock, user?.id);
      toast.success("Inventario listo", { description: change > 0 ? "Añadiste existencias" : "Retiraste existencias" });
      await loadData(); // Refrescar
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("Ocurrió un problema", { description: msg });
    }
  };

  const handleToggleVisibility = async (id: string, currentVal: boolean) => {
    try {
      await ProductService.toggleVisibility(id, !currentVal, user?.id);
      toast.success("Visibilidad cambiada", { description: !currentVal ? "El producto volverá a verse en ventas." : "Ocultaste el producto del menú público." });
      await loadData(); // Refrescar
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error("Ocurrió un problema", { description: msg });
    }
  };


  const handleBarcodeScanned = (code: string) => {
    const upperCode = code.toUpperCase();
    if (isOpen) {
      setSku(upperCode);
      toast.success("Código capturado", { description: "SKU actualizado en el formulario." });
      return;
    }
    setActiveTab("ALL");
    setCurrentPage(1);
    setSearchTerm(upperCode);
  };


  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading("Procesando imagen...", { description: "Comprimiendo y guardando en disco." });
    try {
      // Comprimir en el renderer con Canvas API → WebP < 40KB
      const base64 = await compressImageToBase64(file, 400, 0.7);
      // Previsualizar de inmediato (URL de objeto temporal)
      setImagePreviewUrl(URL.createObjectURL(file));
      // Guardar en bucket local → obtener filename
      const filename = await ImageService.save(base64);
      setImageFilename(filename);
      toast.success("Imagen lista", { id: toastId, description: "Guardada en el dispositivo." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Error al procesar imagen", { id: toastId, description: msg });
    }
  };

  /** Comprime un File a base64 WebP usando Canvas API del Renderer. */
  function compressImageToBase64(file: File, maxPx: number, quality: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/webp", quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo cargar la imagen.")) };
      img.src = url;
    });
  }

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
    <>
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
          <DialogContent className="sm:max-w-lg flex flex-col max-h-[90dvh] p-0">
            {/* ── HEADER ─────────────────────────── */}
            <DialogHeader className="px-6 pt-6 pb-2 shrink-0 border-b">
              <DialogTitle className="text-lg font-black">
                {editingId ? "Editar artículo" : "Nuevo artículo"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {editingId
                  ? "Modifica los datos de este producto."
                  : "Llena la información. Solo tú ves los códigos e inventario."}
              </DialogDescription>
            </DialogHeader>

            {/* ── CUERPO CON SCROLL ──────────────── */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

              {/* Foto */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center bg-muted/20 overflow-hidden shrink-0">
                  {imagePreviewUrl ? (
                    <img src={imagePreviewUrl} alt="Vista previa" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="image" className="text-sm font-medium">Foto (opcional)</Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    disabled={isSaving}
                    className="text-sm cursor-pointer"
                  />
                  <p className="text-[10px] text-muted-foreground">Máx 500KB. Se guarda en este dispositivo.</p>
                </div>
              </div>

              {/* Nombre */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre del producto</Label>
                <Input
                  id="name"
                  placeholder="Ej. Frappé de Moka Grande"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSaving}
                />
                <p className="text-[10px] text-muted-foreground">Aparecerá en el punto de venta y en los tickets.</p>
              </div>

              {/* Grupo (categoría) — renglón propio para que se vea el nombre */}
              <div className="space-y-1.5">
                <Label htmlFor="categorySelect">Familia / Grupo</Label>
                <Select
                  value={categoryId}
                  onValueChange={(val) => setCategoryId(val || "")}
                  disabled={isSaving}
                >
                  <SelectTrigger id="categorySelect" className="h-11">
                    <SelectValue placeholder="Elige un grupo…">
                      {categories.find(c => c.id === categoryId)?.name ?? "Elige un grupo…"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categories.length === 0 && (
                  <p className="text-[10px] text-destructive font-bold">⚠️ Necesitas crear un grupo en la pestaña "Categorías" primero.</p>
                )}
              </div>

              {/* Unidad de medida */}
              <div className="space-y-1.5">
                <Label htmlFor="unitTypeSelect">Unidad de Medida</Label>
                <Select
                  value={unitType}
                  onValueChange={(val) => setUnitType(val || "PIECE")}
                  disabled={isSaving}
                >
                  <SelectTrigger id="unitTypeSelect" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.length > 0 ? units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.symbol})</SelectItem>
                    )) : (
                      <>
                        <SelectItem value="PIECE">Pieza (Pza)</SelectItem>
                        <SelectItem value="KILO">Kilo (Kg)</SelectItem>
                        <SelectItem value="BULK">A Granel (G)</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">Pieza impide cobrar mitades o medios kilos. Granel permite capturas decimales en el cajero.</p>
              </div>

              {/* Precios e Inventario */}
              <div className="grid grid-cols-2 gap-4 border p-4 rounded-xl bg-muted/20">
                <div className="space-y-1.5">
                  <Label htmlFor="sku">Código (SKU)</Label>
                  <Input
                    id="sku"
                    placeholder="Ej. MOKA-GDE"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    disabled={isSaving}
                  />
                  <p className="text-[10px] text-muted-foreground">Para búsquedas y lectora de códigos.</p>
                </div>
                <div className="space-y-1.5 uppercase">
                  <Label htmlFor="stock" className="text-[10px] font-black opacity-70">Existencias (Stock)</Label>
                  <div className="relative border bg-muted/30 rounded-md overflow-hidden flex items-center h-11 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:bg-background">
                    <button 
                      type="button" 
                      onClick={() => setStockStr(String(Math.max(0, (parseFloat(stockStr) || 0) - 1)))} 
                      className="px-3 h-full hover:bg-muted text-muted-foreground select-none"
                    >
                      -
                    </button>
                    <Input
                      id="stock"
                      type="number"
                      step={unitType === "BULK" ? "0.01" : "1"}
                      min="0"
                      className="text-center font-bold px-0 border-0 shadow-none rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent h-full"
                      value={stockStr}
                      onChange={(e) => setStockStr(e.target.value)}
                      disabled={isSaving}
                    />
                    <button 
                      type="button" 
                      onClick={() => setStockStr(String((parseFloat(stockStr) || 0) + 1))} 
                      className="px-3 h-full hover:bg-muted text-muted-foreground select-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Flexibilidad de Stock (Venta sin stock) */}
              <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-primary/30 bg-primary/5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Venta sin stock</Label>
                  <p className="text-[10px] text-muted-foreground">Permite vender aunque no haya existencias (Bajo pedido/Elaboración propia).</p>
                </div>
                <Switch 
                  checked={allowNegativeStock} 
                  onCheckedChange={setAllowNegativeStock} 
                  disabled={isSaving}
                />
              </div>

              {/* Precio */}
              <div className="space-y-1.5">
                <Label htmlFor="price">Precio de venta</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-bold text-sm">$</span>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7 h-11 text-base font-bold"
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>

              {/* Precio de Costo y Margen */}
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-end">
                   <Label htmlFor="costPrice">Costo de compra (opcional)</Label>
                   {parseFloat(priceStr) > 0 && parseFloat(costPriceStr) > 0 && (
                     <Badge variant="outline" className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border-emerald-200">
                        Margen: {(((parseFloat(priceStr) - parseFloat(costPriceStr)) / parseFloat(priceStr)) * 100).toFixed(1)}%
                     </Badge>
                   )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-bold text-sm">$</span>
                  <Input
                    id="costPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-7 h-11 text-base"
                    value={costPriceStr}
                    onChange={(e) => setCostPriceStr(e.target.value)}
                    disabled={isSaving}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Cuánto te cuesta a ti este producto. Se usa para reportes de utilidad.</p>
              </div>

              {/* ── IVA ──────────────────────────────── */}
              <div className="space-y-4 pt-3 border-t border-border/50">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Impuesto (IVA)
                </p>

                {/* Tasa de IVA + Toggle en la misma fila */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="taxRateSelect" className="text-xs">Tasa</Label>
                    <Select
                      value={taxPreset}
                      onValueChange={(val) => {
                        setTaxPreset(val as typeof taxPreset);
                        if (val !== "custom") setTaxRate(parseInt(val ?? "0"));
                      }}
                      disabled={isSaving}
                    >
                      <SelectTrigger id="taxRateSelect" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Exento (0%)</SelectItem>
                        <SelectItem value="800">8% Frontera</SelectItem>
                        <SelectItem value="1600">16% Estándar</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {taxRate > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">El precio incluye IVA</Label>
                      <div className="flex items-center gap-3 h-10 px-3 border rounded-md bg-muted/20">
                        <Switch
                          checked={taxIncluded}
                          onCheckedChange={setTaxIncluded}
                          disabled={isSaving}
                        />
                        <span className="text-xs text-muted-foreground leading-tight">
                          {taxIncluded ? "Sí, ya incluye" : "No, se suma al cobrar"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {taxPreset === "custom" && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Ej: 10.5"
                      className="h-10 w-28"
                      disabled={isSaving}
                      defaultValue={rateToPercent(taxRate)}
                      onChange={(e) => setTaxRate(pctToRate(parseFloat(e.target.value || "0")))}
                    />
                    <span className="text-sm text-muted-foreground font-medium">%</span>
                  </div>
                )}

                {/* Preview IVA */}
                {taxPreview && (
                  <div className="rounded-lg bg-primary/5 border border-primary/10 divide-y divide-border/30 text-sm overflow-hidden">
                    <div className="flex justify-between px-3 py-2 text-muted-foreground">
                      <span>Precio base (sin IVA)</span>
                      <span className="font-mono font-semibold">{formatCents(taxPreview.basePrice)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 text-amber-600 dark:text-amber-400">
                      <span>IVA ({taxRate / 100}%)</span>
                      <span className="font-mono font-semibold">+{formatCents(taxPreview.taxAmount)}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2 font-black bg-primary/5">
                      <span>Total a cobrar</span>
                      <span className="font-mono text-primary">{formatCents(taxPreview.total)}</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* ── FOOTER ─────────────────────────── */}
            <div className="flex items-center gap-2 px-6 py-4 border-t shrink-0">
              <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSaving} className="w-28">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSubmitDisabled} className="flex-1">
                {isSaving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar producto"}
              </Button>
            </div>
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
                          <ProductImage filename={product.image} alt={product.name} />
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
                          <div className="flex flex-col items-end sm:w-[80px]">
                            <span className="font-bold text-primary">
                              ${(product.price / 100).toFixed(2)}
                            </span>
                            {product.costPrice > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded-sm">
                                +{(((product.price - product.costPrice) / product.price) * 100).toFixed(0)}%
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 bg-muted/40 rounded-full px-1.5 py-0.5 border border-border/50">
                             <button onClick={() => handleQuickStock(product.id, product.stock, -1)} disabled={product.stock === 0} className="hover:text-destructive disabled:opacity-30 transition-colors p-1">
                                <MinusCircle className="h-4 w-4" />
                             </button>
                             <span className={cn(
                               "text-[11px] font-bold w-[24px] text-center",
                               getInventoryStyle(product.stock).textClass
                             )}>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" title="Generar etiqueta" onClick={() => setLabelProduct(product)}>
                          <Barcode className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleOpenAlert(product)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(product.id, product.name, product.image)}>
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

    <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a eliminar <strong>&apos;{pendingDelete?.name}&apos;</strong>. Esta acción no afecta ventas
            pasadas pero el artículo desaparecerá del catálogo y del punto de venta de forma permanente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Sí, eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <BarcodeLabelDialog
      open={!!labelProduct}
      product={labelProduct}
      businessName={businessName}
      onClose={() => setLabelProduct(null)}
    />
    </>
  );
}

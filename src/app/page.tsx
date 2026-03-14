"use client";

/**
 * Pantalla Principal del Punto de Venta (POS)
 *
 * FUENTE DE VERDAD: ARCHITECTURE.md §2.1
 *
 * Layout:
 * [ Buscador + Filtros de Categoría ]
 * [ Grid de Productos (solo visibles) ] | [ Sidebar: Carrito Activo ]
 */

import { useState, useEffect, useCallback } from "react";
import { ShoppingCart, Scan, PackageOpen, Wallet } from "lucide-react";
import { toast } from "sonner";
import { BarcodeHandler } from "@/components/shared/barcode-handler";

import { Sidebar } from "@/components/layout/sidebar";
import { ProductCard } from "@/components/pos/product-card";
import { CartSidebar } from "@/components/pos/cart-sidebar";
import { CheckoutDialog } from "@/components/pos/checkout-dialog";
import { QuickSaleDialog } from "@/components/pos/quick-sale-dialog";
import { QuantityInputDialog } from "@/components/pos/quantity-input-dialog";
import { OpenRegisterDialog } from "@/components/pos/open-register-dialog";
import { CashMovementDialog } from "@/components/pos/cash-movement-dialog";
import { GridDensitySelector, type GridDensity, GRID_COLS_MAP, GRID_DENSITY_KEY } from "@/components/pos/grid-density-selector";
import { SearchInput } from "@/components/ui/search-input";
import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product, Category } from "@/lib/schema";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [isCashMovementOpen, setIsCashMovementOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);

  // Estado SQLite (antes era useLiveQuery)
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [unitsMap, setUnitsMap] = useState<Record<string, { allowFractions: boolean, symbol: string }>>({});
  const [fractionalProduct, setFractionalProduct] = useState<Product | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [gridDensity, setGridDensity] = useState<GridDensity>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(GRID_DENSITY_KEY) as GridDensity) || "4";
    }
    return "4";
  });

  const handleGridDensityChange = (density: GridDensity) => {
    setGridDensity(density);
    if (typeof window !== "undefined") localStorage.setItem(GRID_DENSITY_KEY, density);
  };

  const cartItemCount = useCartStore(s => s.items.reduce((acc, i) => acc + i.quantity, 0));
  const addItem = useCartStore(s => s.addItem);

  const loadData = useCallback(async () => {
    const api = (window as Window & { electronAPI?: Record<string, (...a: unknown[]) => Promise<unknown>> }).electronAPI;
    if (!api) return;
    const [prods, cats, settingsRes, unitsRaw] = await Promise.all([
      api.getAllProducts() as Promise<Product[]>,
      api.getAllCategories() as Promise<Category[]>,
      api.getAllSettings() as Promise<{ success: boolean; config?: Record<string, string> }>,
      api.getAllUnits ? api.getAllUnits() as Promise<any[]> : Promise.resolve([])
    ]);
    
    // Process units map
    const map = unitsRaw.reduce((acc, u) => {
      acc[u.id] = { allowFractions: u.allowFractions === 1 || u.allowFractions === true || u.allowFractions === "1", symbol: u.symbol };
      return acc;
    }, {} as Record<string, { allowFractions: boolean, symbol: string }>);
    setUnitsMap(map);

    setAllProducts((prods ?? []).filter(p => p.isVisible !== false));
    setCategories(cats ?? []);
    if (settingsRes?.success && settingsRes.config) {
      setAllowNegativeStock(settingsRes.config["allow_negative_stock"] === "true");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtrado + paginación en memoria (client-side)
  const filtered = allProducts
    .filter(p => activeCategory === "ALL" || p.categoryId === activeCategory)
    .filter(p => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });

  const totalCount = filtered.length;
  const filteredProducts = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Reset página al cambiar filtros
  const handleFilterChange = (catId: string) => {
    setActiveCategory(catId);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleBarcodeScanned = (code: string) => {
    const found = allProducts.find(p => p.sku === code.toUpperCase());
    if (found) {
      if (!found.isVisible) {
        toast.error("Producto oculto", { description: "Este artículo no está marcado como visible." });
        return;
      }
      
      const unitInfo = unitsMap[found.unitType] || { allowFractions: false, symbol: "" };
      if (unitInfo.allowFractions) {
         setFractionalProduct(found);
         setLastScanTime(Date.now());
         return; // El modal concluirá la acción
      }

      const result = addItem({ ...found, allowFractions: false }, allowNegativeStock);
      if (result.success) {
        toast.success("¡Lectura Correcta!", {
          description: `${found.name} añadido.`,
          duration: 1200,
          icon: "✅"
        });
      } else {
        toast.warning("Atención en Caja", { description: result.message });
      }
    } else {
      toast.error("Producto no identificado", {
        description: `El código ${code} no está en el catálogo.`,
        icon: "❌"
      });
    }
    setLastScanTime(Date.now());
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "CASHIER"]}>
    <div className="flex h-screen bg-muted/40">
      <BarcodeHandler 
        onScan={handleBarcodeScanned}
        profile="pos"
        enabled={!isCheckoutOpen && !isProcessing}
      />
      <Sidebar />

      {/* Área principal del POS */}
      <div className="flex flex-col flex-1 sm:pl-20 overflow-hidden">
        {/* Barra de herramientas */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-3 px-4 py-3">
             {/* Indicador de Salud del Escáner */}
             <div className={cn(
               "flex items-center justify-center h-8 w-8 rounded-full border transition-all duration-300 shrink-0",
               Date.now() - lastScanTime < 1000 
                ? "bg-primary/20 border-primary/50 text-primary animate-pulse" 
                : "bg-muted/30 border-border text-muted-foreground/50"
             )}>
                <Scan className="h-4 w-4" />
             </div>

            <SearchInput
              value={searchTerm}
              onChange={handleSearchChange}
              onBarcodeScanned={handleBarcodeScanned}
              placeholder="Buscar o escanear..."
              className="flex-1 max-w-sm"
            />

            {categories && categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                <Button
                  size="sm"
                  variant={activeCategory === "ALL" ? "default" : "secondary"}
                  className="rounded-full shrink-0 h-8 text-xs"
                  onClick={() => handleFilterChange("ALL")}
                >
                  Todos
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={activeCategory === cat.id ? "default" : "secondary"}
                    className="rounded-full shrink-0 h-8 text-xs"
                    onClick={() => handleFilterChange(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Selector de densidad del grid */}
            <GridDensitySelector
              value={gridDensity}
              onChange={handleGridDensityChange}
              className="shrink-0"
            />

            <Button
              variant="outline"
              className="shrink-0 text-muted-foreground border-border hover:bg-muted"
              onClick={() => setIsCashMovementOpen(true)}
              title="Movimientos de Caja"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline-block ml-2 text-xs">Caja</span>
            </Button>

            <Button
              variant="outline"
              className="shrink-0 text-secondary-foreground border-border bg-secondary hover:bg-secondary/80"
              onClick={() => setIsQuickSaleOpen(true)}
              title="Venta Libre"
            >
              <PackageOpen className="h-4 w-4" />
              <span className="hidden sm:inline-block ml-2 font-bold text-xs uppercase tracking-widest">Pase Libre</span>
            </Button>

            <Button
              variant="outline"
              className="relative xl:hidden shrink-0"
              onClick={() => setIsCheckoutOpen(true)}
              disabled={cartItemCount === 0}
            >
              <ShoppingCart className="h-4 w-4" />
              {cartItemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {cartItemCount}
                </span>
              )}
            </Button>
          </div>
        </header>

        {/* Grid de productos */}
        <main className="flex-1 overflow-y-auto p-4 flex flex-col">
          {filteredProducts === undefined ? (
            <div className={cn("grid gap-3", GRID_COLS_MAP[gridDensity])}>
              {[...Array(8)].map((_, i) => (
                <div key={i} className="rounded-xl border bg-muted/40 animate-pulse" style={{ minHeight: "10rem" }} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
              <p className="text-2xl">🔍</p>
              <p className="text-sm font-medium">No hay resultados</p>
              <p className="text-xs text-muted-foreground">Intenta con otros filtros.</p>
            </div>
          ) : (
            <>
              <div className={cn("grid gap-3 content-start", GRID_COLS_MAP[gridDensity])}>
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currentStock={product.stock}
                    allowNegativeStock={allowNegativeStock}
                    unitInfo={unitsMap[product.unitType]}
                  />
                ))}
              </div>

              {/* PAGINACIÓN ESTRICTA (CA-10.2) */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-background/50 rounded-2xl border border-border/50 backdrop-blur-sm mb-4">
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
                  
                  <div className="flex items-center gap-1.5 px-3 h-8 bg-muted/50 rounded-lg text-xs font-bold">
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
        </main>
      </div>

      {/* Sidebar del carrito (desktop: siempre visible, mobile: se abre con el modal) */}
      <aside className={cn(
        "hidden xl:flex flex-col border-l bg-background w-80 shrink-0"
      )}>
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">Cuenta actual</h2>
          <p className="text-xs text-muted-foreground">
            {cartItemCount > 0 ? `${cartItemCount} artículo(s)` : "Vacía"}
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <CartSidebar
            onCheckout={() => setIsCheckoutOpen(true)}
            isProcessing={isProcessing}
            allowNegativeStock={allowNegativeStock}
          />
        </div>
      </aside>

      {/* Modal de Checkout (CA-3.3.x y CA-3.4.x) */}
        <CheckoutDialog 
          open={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
        />

        <QuickSaleDialog
          open={isQuickSaleOpen}
          onClose={() => setIsQuickSaleOpen(false)}
        />

        <CashMovementDialog
          open={isCashMovementOpen}
          onOpenChange={setIsCashMovementOpen}
        />

        <OpenRegisterDialog />
      </div>
    </ProtectedRoute>
  );
}

"use client";

/**
 * Pantalla Principal del Punto de Venta (POS)
 *
 * FUENTE DE VERDAD: motor_ventas_plan.md — Sección 3.2
 *
 * Layout:
 * [ Buscador + Filtros de Categoría ]
 * [ Grid de Productos (CA-3.1.7: solo visibles) ] | [ Sidebar: Carrito Activo ]
 */

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ShoppingCart, Scan } from "lucide-react";
import { toast } from "sonner";
import { BarcodeHandler } from "@/components/shared/barcode-handler";

import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { ProductCard } from "@/components/pos/product-card";
import { CartSidebar } from "@/components/pos/cart-sidebar";
import { CheckoutDialog } from "@/components/pos/checkout-dialog";
import { SearchInput } from "@/components/ui/search-input";
import { useCartStore } from "@/store/useCartStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function POSPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanTime, setLastScanTime] = useState(0);

  const cartItemCount = useCartStore(s => s.items.reduce((acc, i) => acc + i.quantity, 0));
  const addItem = useCartStore(s => s.addItem);

  // Categorías (pocas, se pueden traer todas)
  const categories = useLiveQuery(() => db.categories.orderBy("name").toArray(), []);

  /**
   * CONSULTA OPTIMIZADA (Fase 10.2): 
   * En lugar de traer 1000 productos a memoria, calculamos el subset directamente.
   */
  const { filteredProducts, totalCount } = useLiveQuery(async () => {
    let collection = db.products.toCollection().filter(p => p.isVisible !== false);

    // Filtro por categoría (usamos filter para evitar múltiples índices complejos offline)
    if (activeCategory !== "ALL") {
      collection = collection.and(p => p.categoryId === activeCategory);
    }

    // Filtro por búsqueda (Buscamos en todo el set antes de paginar)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      collection = collection.filter(p => 
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
  }, [activeCategory, searchTerm, currentPage]) ?? { filteredProducts: [], totalCount: 0 };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Reset de página al cambiar filtros
  const handleFilterChange = (catId: string) => {
    setActiveCategory(catId);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setCurrentPage(1);
  };

  const handleBarcodeScanned = (code: string) => {
    // Buscar en toda la DB por SKU
    db.products.where("sku").equals(code.toUpperCase()).first().then((product) => {
      if (product) {
        if (!product.isVisible) {
          toast.error("Producto oculto", { description: "Este artículo no está marcado como visible." });
          return;
        }
        
        const result = addItem(product);
        if (result.success) {
          toast.success("¡Lectura Correcta!", { 
            description: `${product.name} añadido.`,
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
    });
  };

  return (
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
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-600 animate-pulse" 
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl border bg-muted/40 animate-pulse" />
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 flex-1">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currentStock={product.stock}
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
          />
        </div>
      </aside>

      {/* Modal de Checkout (CA-3.3.x y CA-3.4.x) */}
      <CheckoutDialog
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </div>
  );
}

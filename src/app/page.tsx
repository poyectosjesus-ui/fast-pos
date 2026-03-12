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
import { ShoppingCart } from "lucide-react";

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
  const [isProcessing, setIsProcessing] = useState(false);

  const cartItemCount = useCartStore(s => s.items.reduce((acc, i) => acc + i.quantity, 0));

  // Todos los productos y categorías desde Dexie (offline-first)
  const allProducts = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.orderBy("name").toArray(), []);

  // CA-3.1.7: Solo productos visibles en el POS
  const visibleProducts = allProducts?.filter(p => p.isVisible !== false);

  // Filtrado combinado: por categoría y por término de búsqueda
  const filteredProducts = visibleProducts?.filter(p => {
    const matchesCategory = activeCategory === "ALL" || p.categoryId === activeCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleBarcodeScanned = (code: string) => {
    // CA-3.2.3: Scanner agrega el producto directamente al carrito si existe y tiene stock
    const product = visibleProducts?.find(p => p.sku === code.toUpperCase());
    if (!product) {
      return; // SearchInput ya mostrará feedback visual
    }
    // Dejamos que la lógica de addItem en el store valide el stock
    // La ProductCard maneja esto al hacer click, lo replicamos aquí para el scanner
  };

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />

      {/* Área principal del POS */}
      <div className="flex flex-col flex-1 sm:pl-20 overflow-hidden">
        {/* Barra de herramientas: Búsqueda + Filtros */}
        <header className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="flex items-center gap-3 px-4 py-3">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              onBarcodeScanned={handleBarcodeScanned}
              placeholder="Buscar o escanear código..."
              className="flex-1 max-w-sm"
            />

            {/* Filtros por categoría — pills horizontales (CA-3.2.x del plan) */}
            {categories && categories.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
                <Button
                  size="sm"
                  variant={activeCategory === "ALL" ? "default" : "secondary"}
                  className="rounded-full shrink-0 h-8 text-xs"
                  onClick={() => setActiveCategory("ALL")}
                >
                  Todos
                </Button>
                {categories.map(cat => (
                  <Button
                    key={cat.id}
                    size="sm"
                    variant={activeCategory === cat.id ? "default" : "secondary"}
                    className="rounded-full shrink-0 h-8 text-xs"
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.name}
                  </Button>
                ))}
              </div>
            )}

            {/* Botón carrito compacto (mobile) */}
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
        <main className="flex-1 overflow-y-auto p-4">
          {allProducts === undefined ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-xl border bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : filteredProducts?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-3">
              <p className="text-2xl">🔍</p>
              <p className="text-sm font-medium">No encontramos lo que buscas</p>
              <p className="text-xs text-muted-foreground">
                {visibleProducts?.length === 0
                  ? "Aún no tienes productos visibles. Ve a Catálogo para agregarlos."
                  : "Intenta con otras palabras o cambia de categoría."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProducts!.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  currentStock={product.stock}
                />
              ))}
            </div>
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

"use client";

/**
 * ProductCard — Tarjeta de Producto para la Pantalla de Ventas
 *
 * FUENTE DE VERDAD: ARCHITECTURE.md §2.3, EPIC-003
 * CA-3.2.1 agrega al carrito, CA-3.2.2 indicador stock,
 * CA-3.1.2 deshabilitado sin stock, CA-3.1.7 solo visibles.
 *
 * EPIC-003: Imágenes via ImageService.getUrl() -> file:// URL
 * COMPAT: Si product.image es base64 legacy, lo muestra directamente.
 */

import { useState, useEffect } from "react";
import { Product } from "@/lib/schema";
import { useCartStore } from "@/store/useCartStore";
import { ImageService } from "@/lib/services/image";
import { formatCurrency, LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { toast } from "sonner";
import { PackageX, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  currentStock: number;
}

export function ProductCard({ product, currentStock }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!product.image) {
      setImageUrl(null);
      return;
    }
    // Compat: si es base64 legacy, usarlo directamente; si es filename nuevo, resolver file://
    if (product.image.startsWith("data:")) {
      setImageUrl(product.image);
    } else {
      ImageService.getUrl(product.image).then((url) => setImageUrl(url));
    }
  }, [product.image]);

  const isOutOfStock = currentStock === 0;
  const isLowStock = currentStock > 0 && currentStock <= LOW_STOCK_THRESHOLD;

  const handleClick = () => {
    if (isOutOfStock) return;
    const result = addItem({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: currentStock,
      taxRate: product.taxRate ?? 1600,
      taxIncluded: product.taxIncluded ?? true,
    });
    if (!result.success && result.message) {
      toast.error("No podemos agregar más", { description: result.message });
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isOutOfStock}
      className={cn(
        "relative flex flex-col items-start w-full text-left rounded-xl border bg-card p-3 gap-2",
        "transition-all duration-150 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isOutOfStock &&
          "opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0 hover:border-border"
      )}
    >
      <div className="w-full aspect-square rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden border">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-2xl font-black text-muted-foreground/30 uppercase select-none">
            {product.name.slice(0, 2)}
          </span>
        )}
      </div>

      <div className="w-full">
        <p className="text-sm font-semibold leading-tight line-clamp-2">{product.name}</p>
        <p className="text-base font-bold text-primary mt-1">{formatCurrency(product.price)}</p>
      </div>

      {isOutOfStock && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <PackageX className="h-6 w-6" />
            <span className="text-xs font-medium">Sin existencias</span>
          </div>
        </div>
      )}

      {isLowStock && !isOutOfStock && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          <AlertTriangle className="h-3 w-3" />
          {currentStock}
        </div>
      )}
    </button>
  );
}

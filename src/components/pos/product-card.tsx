"use client";

/**
 * ProductCard — Tarjeta de Producto para la Pantalla de Ventas
 *
 * FUENTE DE VERDAD: ARCHITECTURE.md §2.3, EPIC-003
 * CA-3.2.1 agrega al carrito, CA-3.2.2 indicador stock,
 * CA-3.1.2 deshabilitado sin stock, CA-3.1.7 solo visibles.
 *
 * EPIC-003: Imágenes via ImageService.getUrl() → file:// URL
 * EPIC-008: Modal para productos fraccionarios (granel, kg, litros)
 *           El card es auto-suficiente: consulta el unitType para
 *           determinar si permite fracciones y abre un modal propio.
 */

import { useState, useEffect } from "react";
import { Product } from "@/lib/schema";
import { useCartStore } from "@/store/useCartStore";
import { ImageService } from "@/lib/services/image";
import { formatCurrency, LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { toast } from "sonner";
import { PackageX, AlertTriangle, Scale, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuantityInputDialog } from "@/components/pos/quantity-input-dialog";

interface ProductCardProps {
  product: Product;
  currentStock: number;
  allowNegativeStock?: boolean;
  // Mapa de unidades precargado desde page.tsx (opcional — el card también puede funcionar solo)
  unitInfo?: { allowFractions: boolean; symbol: string };
}

export function ProductCard({ product, currentStock, allowNegativeStock, unitInfo }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showFractionalDialog, setShowFractionalDialog] = useState(false);

  // Leer info de unidad desde prop o fallback al product.unitType
  // allowFractions se considera truthy si el mapa lo dice
  const allowFractions = unitInfo?.allowFractions === true;
  const unitSymbol = unitInfo?.symbol ?? product.unitType;

  useEffect(() => {
    if (!product.image) {
      setImageUrl(null);
      return;
    }
    if (product.image.startsWith("data:")) {
      setImageUrl(product.image);
    } else {
      ImageService.getUrl(product.image).then((url) => setImageUrl(url));
    }
  }, [product.image]);

  // Deshabilitado: sin stock Y sin permiso de negativo Y no es fraccionario
  const isOutOfStock = !allowNegativeStock && currentStock <= 0;
  const isDisabled = isOutOfStock && !allowFractions;
  const isLowStock = currentStock > 0 && currentStock <= LOW_STOCK_THRESHOLD;

  const handleClick = () => {
    if (isDisabled) return;

    if (allowFractions) {
      setShowFractionalDialog(true);
      return;
    }

    const result = addItem({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: currentStock,
      taxRate: product.taxRate ?? 1600,
      taxIncluded: product.taxIncluded ?? true,
      unitType: product.unitType,
      allowFractions: false,
    }, allowNegativeStock);

    if (!result.success && result.message) {
      toast.error("No podemos agregar más", { description: result.message });
    }
  };

  const handleFractionalConfirm = (qty: number) => {
    setShowFractionalDialog(false);
    const result = addItem({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      stock: currentStock,
      taxRate: product.taxRate ?? 1600,
      taxIncluded: product.taxIncluded ?? true,
      unitType: product.unitType,
      allowFractions: true,
    }, allowNegativeStock, qty);

    if (result.success) {
      toast.success("Añadido", {
        description: `${qty} ${unitSymbol} de ${product.name}`,
        duration: 1200,
        icon: "✅"
      });
    } else if (result.message) {
      toast.warning("Atención en Caja", { description: result.message });
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isDisabled}
        className={cn(
          "relative flex flex-col items-start w-full text-left rounded-xl border bg-card p-3 gap-2",
          "transition-all duration-150 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "max-h-64",                          // Altura máxima: nunca se alarga feo avec pocos cárdenas
          isDisabled && "opacity-50 cursor-not-allowed hover:shadow-none hover:translate-y-0 hover:border-border",
          allowFractions && "border-primary/50 dark:border-primary/30"
        )}
      >
        <div className="w-full flex-1 min-h-0 rounded-lg bg-muted/30 flex items-center justify-center overflow-hidden border" style={{ maxHeight: '9rem' }}>
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

        {/* Overlay Sin existencias */}
        {isDisabled && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/60 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <PackageX className="h-6 w-6" />
              <span className="text-xs font-medium">Sin existencias</span>
            </div>
          </div>
        )}

        {/* Badge Fraccionable */}
        {allowFractions && !isDisabled && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <Scale className="h-3 w-3" />
            {unitSymbol}
          </div>
        )}

        {/* Badge Stock Bajo */}
        {isLowStock && !isOutOfStock && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-secondary/90 text-secondary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            {currentStock}
          </div>
        )}

        {/* Indicador de clic para fraccionables */}
        {allowFractions && (
          <div className="absolute bottom-2 right-2 flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary">
            <Plus className="h-3.5 w-3.5" />
          </div>
        )}
      </button>

      {/* Modal de cantidad fraccionaria — auto-contenido en el card */}
      <QuantityInputDialog
        isOpen={showFractionalDialog}
        product={product}
        unitSymbol={unitSymbol}
        onClose={() => setShowFractionalDialog(false)}
        onConfirm={handleFractionalConfirm}
      />
    </>
  );
}

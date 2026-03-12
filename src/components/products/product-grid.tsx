"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MOCK_PRODUCTS } from "@/lib/mock";
import { useCartStore } from "@/store/useCartStore";

export function ProductGrid() {
  const { addItem } = useCartStore();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
      {MOCK_PRODUCTS.map((product) => (
        <Card 
          key={product.id} 
          onClick={() => addItem(product)}
          className="cursor-pointer hover:border-primary/50 transition-colors bg-background/50 backdrop-blur-sm overflow-hidden border-border/50 group"
        >
          <CardContent className="p-0">
            <div className="aspect-square bg-muted/50 rounded-t-xl flex items-center justify-center p-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-6xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                {product.category === "Bebidas" ? "☕️" : product.category === "Panadería" ? "🥐" : product.category === "Postres" ? "🍰" : "🥪"}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-lg line-clamp-1">{product.name}</h3>
              <p className="text-primary font-bold mt-1 text-lg">${product.price.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

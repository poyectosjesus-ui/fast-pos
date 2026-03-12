import { Sidebar } from "@/components/layout/sidebar";
import { CartSidebar } from "@/components/layout/cart-sidebar";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductGrid } from "@/components/products/product-grid";

export default function Home() {
  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-20 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-md px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <div className="relative ml-auto flex-1 md:grow-0">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar productos..."
              className="w-full rounded-full bg-background pl-9 shadow-sm md:w-[300px] lg:w-[400px]"
            />
          </div>
          <div className="flex gap-2 ml-auto">
            <Badge variant="secondary" className="px-4 py-1.5 rounded-full text-sm">
               ☕️ Bebidas
            </Badge>
            <Badge variant="outline" className="px-4 py-1.5 rounded-full text-sm bg-background">
               🍰 Postres
            </Badge>
            <Badge variant="outline" className="px-4 py-1.5 rounded-full text-sm bg-background">
               🥪 Comida
            </Badge>
          </div>
        </header>
        <main className="flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 overflow-y-auto">
          <ProductGrid />
        </main>
      </div>
      <CartSidebar />
    </div>
  );
}

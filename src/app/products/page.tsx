"use client";

import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesManager } from "./_components/categories-manager";
import { ProductsManager } from "./_components/products-manager";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState("products");

  return (
    <div className="flex min-h-screen bg-muted/40">
      <Sidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-20 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight">Inventario</h1>
        </header>

        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
            </TabsList>
            
            <TabsContent value="products" className="mt-6">
              <ProductsManager />
            </TabsContent>
            
            <TabsContent value="categories" className="mt-6">
              <CategoriesManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { driver } from "driver.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoriesManager } from "./_components/categories-manager";
import { ProductsManager } from "./_components/products-manager";
import { UnitsManager } from "./_components/units-manager";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

export default function ProductsPage() {
  const [activeTab, setActiveTab] = useState("products");

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      nextBtnText: "Siguiente ➔",
      prevBtnText: "🡨 Anterior",
      doneBtnText: "¡Entendido!",
      popoverClass: 'driver-theme',
      steps: [
        { element: '#tour-products-add', popover: { title: '📦 Crear Producto', description: 'Este es tu punto de partida. Crea artículos nuevos y define su precio o inventario inicial.', side: "bottom", align: 'start' }},
        { element: '#tour-products-tabs', popover: { title: '🗂️ Clasificación', description: 'Navega entre Productos, Familias y Unidades de medida para estructurar impecablemente tu mercancía.', side: "bottom", align: 'start' }},
        { element: '#tour-products-table', popover: { title: '📋 Control Total', description: 'Tu catálogo maestro. Puedes sumar y restar existencias dando clic a los botones laterales, o editar toda la tarjeta.', side: "top", align: 'start' }}
      ]
    });
    driverObj.drive();
  }, []);

  return (
    <ProtectedRoute requireProductPermission>
    <div className="flex h-screen bg-muted/40">
      <Sidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-20 flex-1 overflow-hidden">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
          <h1 className="text-2xl font-bold tracking-tight uppercase flex items-center">
            Inventario
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-3 h-8 w-8 text-primary/80 hover:bg-primary/10 rounded-full" 
              onClick={startTour}
              title="Tour Guiado de Inventario"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </h1>
        </header>

        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList id="tour-products-tabs" className="grid w-full max-w-lg grid-cols-3">
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="categories">Familias</TabsTrigger>
              <TabsTrigger value="units">Unidades</TabsTrigger>
            </TabsList>
            
            <TabsContent value="products" className="mt-6">
              <ProductsManager />
            </TabsContent>
            
            <TabsContent value="categories" className="mt-6">
              <CategoriesManager />
            </TabsContent>
            
            <TabsContent value="units" className="mt-6">
              <UnitsManager />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
    </ProtectedRoute>
  );
}

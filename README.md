# Fast-POS

Fast-POS es un sistema de Punto de Venta (POS) básico, funcional y orientado al rendimiento ("offline-first"), construido para funcionar como una aplicación web progresiva (PWA) instalable nativamente en macOS y otras plataformas.

## Características Principales

*   🚀 **Rendimiento:** Construido con Next.js (App Router) y React 19.
*   🎨 **Diseño Moderno:** UI premium con Tailwind CSS v4, shadcn/ui y Radix UI.
*   📱 **PWA Integrado:** Funciona offline gracias a Serwist (Service Worker avanzado). Instálalo como aplicación en tu macOS desde el navegador (Chrome/Safari/Edge/Brave).
*   💾 **Estado Local Eficiente:** Uso de Zustand para mantener el carrito de forma persistente.

## Pila Tecnológica

*   [Next.js](https://nextjs.org/) (App Router, TS)
*   [Tailwind CSS](https://tailwindcss.com/)
*   [shadcn/ui](https://ui.shadcn.com/)
*   [Serwist (PWA)](https://serwist.build/)
*   [Zustand](https://docs.pmnd.rs/zustand/)

## Guía de Desarrollo

### Requisitos Previos

*   Node.js v18+ 
*   npm, pnpm o yarn

### Instalación

Clona el repositorio e instala las dependencias:

```bash
npm install
# o
pnpm install
```

### Ejecutar Servidor de Desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador para ver la interfaz.

### Construir para Producción (PWA Habilitada)

Para probar al 100% las capacidades offline y la instalabilidad como PWA en macOS, necesitas hacer el build y correr el servidor de producción:

```bash
npm run build
npm run start
```

Una vez levantado y accedas desde el navegador, verifica si aparece el ícono de "Instalar la aplicación" en la barra de búsqueda.

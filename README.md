# 🚀 Fast-POS v2.0 (Native Desktop Edition)

Fast-POS ha evolucionado de una simple PWA web a un **Sistema de Punto de Venta (POS) Nativo Nivel Empresarial** de alto desempeño. Funciona 100% *Offline-First* aprovechando el poder del hardware físico y el almacenamiento local mediante Electron y SQLite en modo C++. 

Totalmente equipado con un diseño que prioriza al ser humano, es la caja registradora del futuro para el mercado minorista tradicional.

![Fast-POS 2.0 Dashboard Showcase](/demos/boutique/images/dashboard-hero.png) *(Nota conceptual de UI)*

## ✨ Características Principales de la V2.0

*   ⚡ **Cero Nubes (Zero-Cloud)**: Base de datos local transaccional ultrarrápida (SQLite3 nativo + protocolo WAL y Shared Memory) enlazada directamente al file-system del Sistema Operativo. Sin cierres por "caída de internet".
*   🖨️ **Hardware Físico Nativo**: Integración directa (bajo nivel) con **impresoras térmicas (ESC/POS)** y circuitos de 12V para apertura de **Cajón de Dinero**. Todo se detecta automáticamente.
*   📖 **UX "Cuaderno de Ventas"**: La analítica no es para contadores, es para dueños. El Dashboard abandonó las métricas de bolsa de valores para ofrecer gráficas planas, mensajes humanos ("Ganaste un 25% más que ayer") y lectura natural.
*   🔒 **Zero-Trust Security (Auditoría Forense)**: Todo movimiento de inventario o dinero genera un "Eco Silencioso" inmutable e imborrable, resguardando al negocio de fugas de capital y registrando exactamente la huella del cajero.
*   🎨 **Sistemas de Tematización Dinámica**: Soporte HSL dinámico con 10 paletas personalizadas (Muted Pastels y Modern Vibrants) en modo Claro y Oscuro nativo a un clic de distancia.

## 🛠 Pila Tecnológica V2.0

El proyecto está orquestado bajo un ecosistema IPC (Inter-Process Communication) asíncrono y seguro:

*   **Motor Desktop**: [Electron 34](https://www.electronjs.org/) (Gestor IPC, hardware bridges y Native Wrappers).
*   **Motor UI**: [Next.js 15](https://nextjs.org/) (App Router, React 19) + [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/).
*   **Almacenamiento**: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (Transacciones síncronas compiladas en C para Node).
*   **Impresión Térmica**: `react-thermal-printer` y buffers ESC/POS crudos enviando colas lpd:// a puertos del SO.

## 🚀 Guía de Desarrollo Puesta en Marcha

Se necesita **Node.js v20+** (Recomendado) e instalación en crudo mediante un manejador (npm/pnpm).

### 1. Instalación
```bash
npm install
```

### 2. Semillas de Negocio (Simuladores de Demostración)
Si prefieres comenzar con una versión de la base de datos "llena de vida" para presumir Analytics y gráficas en lugar de un programa vacío:
```bash
# Simula 60 días de historia financiera de una Papelería (~40 productos, clientes, cajas)
npm run seed:paper
```

### 3. Entorno de Desarrollo Simultáneo
Ya que es un ecosistema híbrido, Next.js y Electron deben compilarse al mismo tiempo e inyectarse el servidor local:
```bash
npm run dev:native
```
*Esto abrirá la brillante ventana nativa de Chromium gestionando la App.*

### 4. Empaquetado de Instaladores (Producción)
Fast-POS incluye soporte multi-plataforma compilando binarios aislados y auto-contenidos, generando un instalador DMG (Mac), EXE (Windows) o AppImage (Linux).

```bash
# Compilar Instalador para macOS
npm run dist:mac

# Compilar Instalador para Windows
npm run dist:win
```

## 🛡 Licencia e Información
Fast-POS V2.0 posee una arquitectura `UNLICENSED` privada y soporta sistemas de **Llaves de Expiración** (License Keys limitadas por tiempo) para control de distribución.

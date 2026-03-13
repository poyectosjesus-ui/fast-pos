# 📊 CONTEXT.md — Fast-POS 2.0

> Este archivo es la **fuente de verdad** del contexto del proyecto para cualquier IA.
> Antes de generar código, la IA DEBE leer este archivo completo.

---

## Visión General
Fast-POS es un sistema POS (Punto de Venta) **Desktop-First** para **negocios pequeños y medianos**.
- **Mercado objetivo**: Tiendas de ropa, abarrotes, papelerías, heladerías, boutiques (México).
- **Modelo de negocio**: Venta de licencia única por instalación. Sin SaaS. Sin suscripciones.
- **Conectividad**: 100% offline. No requiere internet para operar.
- **Versión actual**: 2.0.0 (en desarrollo activo)

---

## Stack Tecnológico

### Renderer (Frontend)
| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 16.x | Framework React (App Router) |
| TypeScript | 5.x | Tipado estricto (`strict: true`) |
| Tailwind CSS | v4 | Estilos (SIN clases arbitrarias, SIN módulos CSS) |
| Shadcn UI | latest | Componentes de UI (Radix UI base) |
| Zustand | 5.x | Estado global del cliente |
| Zod | 4.x | Validación de schemas (fuente única de tipos) |
| Sonner | 2.x | Sistema de toasts/notificaciones |
| Lucide React | latest | Iconografía |

### Main Process (Backend nativo)
| Tecnología | Versión | Rol |
|---|---|---|
| Electron | 33.x | Shell de escritorio |
| better-sqlite3 | 12.x | Base de datos SQLite (síncrono) |
| Node.js | 18+ | Runtime del processo principal |

### Build & Distribución
| Herramienta | Rol |
|---|---|
| Electron Forge | Empaquetado y distribución |
| Maker DMG | Instalador macOS |
| Maker ZIP | Portable Windows/Linux |

---

## Arquitectura de Capas (NUNCA violar)

```
Componente React
    ↓ (solo llama a Services)
Service (src/lib/services/*.ts)
    ↓ (llama a electronAPI)
window.electronAPI (preload.js)
    ↓ (IPC al Main)
ipc-handlers.js (Main Process)
    ↓ (SQL con placeholders)
SQLite (better-sqlite3)
```

**Reglas de oro:**
1. Un componente NUNCA llama `window.electronAPI` directamente.
2. Los servicios NUNCA hacen cálculos financieros con `float`. Solo centavos (`integer`).
3. El Main Process NUNCA importa código del Renderer.
4. Los tipos siempre salen de `src/lib/schema.ts` (Zod inference).

---

## Esquema de Base de Datos (v3 — estado actual)

```sql
-- PRAGMA user_version = 3 (actual)

CREATE TABLE categories ( id TEXT PK, name TEXT, createdAt INT, updatedAt INT );
CREATE TABLE products (
  id TEXT PK, categoryId TEXT, name TEXT,
  price INT,         -- Centavos (NUNCA float)
  stock INT, sku TEXT UNIQUE, isVisible INT DEFAULT 1,
  image TEXT,        -- Solo nombre de archivo (ej: "uuid.webp")
  taxRate INT DEFAULT 1600,     -- v2: 1600 = 16.00%
  taxIncluded INT DEFAULT 1,    -- v2: 1=precio ya incluye IVA
  createdAt INT, updatedAt INT,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT
);
CREATE TABLE orders (
  id TEXT PK, subtotal INT, tax INT, total INT,
  status TEXT CHECK(status IN ('COMPLETED','CANCELLED')),
  paymentMethod TEXT CHECK(paymentMethod IN ('CASH','CARD')),
  createdAt INT
);
CREATE TABLE order_items (
  id INT AUTOINCREMENT PK, orderId TEXT, productId TEXT,
  name TEXT, price INT, quantity INT, subtotal INT,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE settings ( key TEXT PK, value TEXT );  -- v2
CREATE TABLE users (                                  -- v3
  id TEXT PK, name TEXT, pin TEXT,  -- PIN hashed con bcryptjs
  role TEXT CHECK(role IN ('ADMIN','CASHIER')),
  isActive INT DEFAULT 1, createdAt INT
);
```

---

## Contrato IPC (preload.js → ipc-handlers.js)

```typescript
// Disponible como window.electronAPI en el Renderer
interface ElectronAPI {
  // DB
  checkDbReady:    () => Promise<{ success: boolean; engine: string }>;
  getDbStatus:     () => Promise<DbStatus>;
  exportSqlite:    () => Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }>;
  importSqlite:    () => Promise<{ success: boolean; canceled?: boolean; error?: string }>;
  // Settings
  getSetting:      (key: string) => Promise<{ success: boolean; value: string | null }>;
  getAllSettings:   () => Promise<{ success: boolean; config: Record<string, string> }>;
  setSetting:      (key: string, value: string) => Promise<{ success: boolean }>;
  setBulkSettings: (entries: Record<string, string>) => Promise<{ success: boolean }>;
  // Categories CRUD
  getAllCategories: () => Promise<Category[]>;
  createCategory:  (c: Category) => Promise<{ success: boolean }>;
  updateCategory:  (c: Category) => Promise<{ success: boolean }>;
  deleteCategory:  (id: string) => Promise<{ success: boolean }>;
  // Products CRUD
  getAllProducts:   () => Promise<Product[]>;
  createProduct:   (p: Product) => Promise<{ success: boolean; id: string }>;
  updateProduct:   (p: Product) => Promise<{ success: boolean }>;
  deleteProduct:   (id: string) => Promise<{ success: boolean }>;
  // Orders
  checkout:        (order: Order) => Promise<{ success: boolean; error?: string }>;
  getOrderHistory: () => Promise<Order[]>;
  voidOrder:       (id: string) => Promise<{ success: boolean; error?: string }>;
}
```

---

## Convenciones de Código

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | PascalCase | `ProductCard.tsx` |
| Servicios | camelCase + `Service` | `productService.ts` |
| Stores Zustand | `use` + PascalCase + `Store` | `useCartStore.ts` |
| Hooks | `use` + camelCase | `useDebounce.ts` |
| Constantes | UPPER_SNAKE | `MAX_STORES = 3` |
| IPC Channels | `domain:action` | `products:getAll` |

**Reglas absolutas:**
- ❌ `any` en TypeScript (prohibido)
- ❌ `window.confirm()` (usar `AlertDialog` de Shadcn)
- ❌ `float` para dinero (usar `integer` en centavos)
- ✅ Tipos siempre inferidos de Zod en `schema.ts`
- ✅ Mensajes de error en español informal y empático
- ✅ Estados de loading en toda operación asíncrona

---

## Rutas de la App

| Ruta | Componente | Rol |
|---|---|---|
| `/` | POS | Pantalla principal de ventas |
| `/products` | Catálogo | CRUD de productos y categorías |
| `/analytics` | Dashboard | Métricas de ventas |
| `/history` | Historial | Ventas pasadas + anulación |
| `/settings` | Configuración | Backup, negocio, hardware |
| `/login` | Login PIN | Autenticación (FASE 5) |
| `/setup` | Wizard | Onboarding inicial (FASE 6) |
| `/ticket` | Ticket | Plantilla de impresión (FASE 4) |

---

## Estado de las Fases

| EPIC | Fase | Estado | Archivo |
|---|---|---|---|
| EPIC-001 | Migración SQLite | ✅ Completada | `EPIC-001-SQLITE-MIGRATION.md` |
| EPIC-002 | IVA / Impuestos | ⏳ Pendiente | `EPIC-002-TAX-IVA.md` |
| EPIC-003 | Imágenes Locales | ⏳ Pendiente | `EPIC-003-LOCAL-IMAGES.md` |
| EPIC-004 | Tickets / Impresión | ⏳ Pendiente | `EPIC-004-TICKET-PRINTING.md` |
| EPIC-005 | Usuarios / Roles | ⏳ Pendiente | `EPIC-005-USERS-ROLES.md` |
| EPIC-006 | Setup Wizard | ⏳ Pendiente | `EPIC-006-SETUP-WIZARD.md` |
| EPIC-007 | Licenciamiento | ⏳ Pendiente | `EPIC-007-LICENSING.md` |

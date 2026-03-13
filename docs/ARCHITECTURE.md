# 🏛️ Arquitectura del Sistema — Fast-POS

**Versión:** 2.0  
**Última actualización:** 12-Mar-2026  
**Fuente de Verdad:** Este documento define la arquitectura canónica. Cualquier desviación debe justificarse en `BITACORA.md`.

---

## 1. Visión General

Fast-POS es una aplicación **Desktop-First** construida con Electron + Next.js. No depende de servidores externos. Toda la persistencia es local.

```
┌─────────────────────────────────────────────────────────┐
│                      ELECTRON SHELL                      │
│  ┌──────────────────┐      ┌──────────────────────────┐ │
│  │   MAIN PROCESS   │      │    RENDERER PROCESS       │ │
│  │  (Node.js)       │      │    (Next.js / React)      │ │
│  │                  │◄────►│                           │ │
│  │ • database.js    │ IPC  │ • Pages (App Router)      │ │
│  │ • ipc-handlers   │      │ • Components (Shadcn)     │ │
│  │ • license check  │      │ • Services (lib/services) │ │
│  │ • image store    │      │ • State (Zustand)         │ │
│  │ • backup engine  │      │ • Validation (Zod)        │ │
│  └────────┬─────────┘      └──────────────────────────┘ │
│           │                                              │
│  ┌────────▼─────────┐  ┌────────────────────────────┐  │
│  │  SQLite (WAL)    │  │  FILESYSTEM (userData/)     │  │
│  │  fast-pos.db     │  │  • images/{uuid}.webp       │  │
│  └──────────────────┘  │  • backups/                 │  │
│                         └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Capas de la Aplicación

### 2.1 Main Process (`src/main/`)
Es el backend nativo. Controla todo lo que necesita acceso al sistema operativo.

| Archivo | Responsabilidad |
|---|---|
| `database.js` | Inicialización de SQLite, migraciones versionadas, backup |
| `ipc-handlers.js` | Contrato de comunicación Renderer ↔ Main |
| `preload.js` | Expone APIs seguras al Renderer via `contextBridge` |
| `license-generator.js` | Script privado (NO en build) para generar claves |

**Regla:** El Main Process NUNCA importa código del Renderer. La comunicación es siempre vía IPC.

### 2.2 Renderer Process (`src/`)
Es el frontend. No conoce SQLite directamente. Solo conoce `window.electronAPI`.

```
src/
├── app/           # Rutas del App Router (Next.js)
│   ├── page.tsx       # POS (Punto de Venta)
│   ├── products/      # Gestión de catálogo
│   ├── analytics/     # Dashboard de analíticas
│   ├── history/       # Historial y anulaciones
│   ├── settings/      # Configuración del sistema
│   ├── login/         # Pantalla de PIN (FASE 5)
│   ├── setup/         # Wizard onboarding (FASE 6)
│   └── ticket/        # Plantilla de ticket (FASE 4)
├── components/    # UI reutilizable
│   ├── ui/            # Componentes Shadcn (NO modificar)
│   ├── pos/           # Componentes específicos del POS
│   ├── products/      # Componentes de catálogo
│   ├── layout/        # Layout, Sidebar, ProtectedRoute
│   └── shared/        # Componentes cross-feature
├── lib/           # Lógica de negocio y utilidades
│   ├── schema.ts      # 🔴 FUENTE DE VERDAD de tipos
│   ├── services/      # Servicios de negocio (CRUD, Tax, etc.)
│   ├── db.ts          # Dexie (SOLO para PWA/offline)
│   └── utils.ts       # Funciones puras de utilidad
└── store/         # Estado global (Zustand)
    ├── useCartStore.ts
    └── useSessionStore.ts
```

### 2.3 Flujo de Datos Canónico

```
UI Component
    │ (llama a)
    ▼
Service (src/lib/services/*.ts)
    │ (llama a)
    ▼
window.electronAPI.method()
    │ (IPC al Main)
    ▼
ipc-handlers.js
    │ (ejecuta SQL)
    ▼
SQLite (better-sqlite3)
    │ (retorna)
    ▼
... mismo camino en reversa
```

**Regla:** Un componente React NUNCA llama directamente a `window.electronAPI`. Siempre pasa por un Service.

---

## 3. Base de Datos

### 3.1 Motor
- **Motor:** `better-sqlite3` (síncrono, sin callbacks — más simple y robusto)
- **Modo:** WAL (Write-Ahead Logging) para mayor concurrencia y seguridad
- **Foreign Keys:** SIEMPRE habilitado (`PRAGMA foreign_keys = ON`)
- **Versión del esquema:** Controlada por `PRAGMA user_version`

### 3.2 Reglas de Migraciones
1. Cada versión de esquema tiene un bloque `if (currentVersion < N)` en `database.js`.
2. Las migraciones son **siempre aditivas**: se añaden columnas/tablas, NUNCA se borran en migraciones automáticas.
3. Si se necesita borrar una columna, se hace manualmente y se documenta en `BITACORA.md`.

### 3.3 Convenciones SQL
- `id TEXT PRIMARY KEY` — UUIDs generados en el Renderer con `uuid`.
- Precio y montos: **siempre en centavos (INTEGER)**, nunca REAL/FLOAT.
- Booleanos: `INTEGER (0/1)` — SQLite no tiene tipo BOOLEAN.
- Timestamps: `INTEGER` (Unix ms, ej. `Date.now()`).

### 3.4 Esquema Completo (v2.0)

```sql
-- v1: Schema base
CREATE TABLE categories ( id TEXT PK, name TEXT, createdAt INT, updatedAt INT );
CREATE TABLE products (
  id TEXT PK, categoryId TEXT, name TEXT, price INT, stock INT,
  sku TEXT UNIQUE, isVisible INT DEFAULT 1, image TEXT,
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

-- v2: IVA + Settings
ALTER TABLE products ADD COLUMN taxRate INT NOT NULL DEFAULT 1600; -- e.g. 16.00% = 1600
ALTER TABLE products ADD COLUMN taxIncluded INT NOT NULL DEFAULT 1; -- 1=precio incluye IVA
CREATE TABLE settings ( key TEXT PK, value TEXT NOT NULL );

-- v3: Usuarios
CREATE TABLE users (
  id TEXT PK, name TEXT NOT NULL, pin TEXT NOT NULL, -- bcrypt hash
  role TEXT CHECK(role IN ('ADMIN','CASHIER')) NOT NULL,
  isActive INT DEFAULT 1, createdAt INT NOT NULL
);
```

---

## 4. Gestión de Imágenes

- Las imágenes se guardan en `{userData}/images/{uuid}.webp`
- La DB solo guarda el nombre del archivo: `image TEXT` → `"abc123.webp"`
- El Renderer comprime en el cliente con Canvas API (→ < 40KB a 800px)
- Después envía el base64 al Main vía `electronAPI.saveImage()`
- Para mostrar: `electronAPI.getImageUrl(filename)` → `file:///...path...`

---

## 5. Licenciamiento

- **Sin internet**: validación 100% local con algoritmo de checksum.
- Formato de clave: `FAST-XXXX-XXXX-XXXX` (20 chars + guiones)
- La clave codifica: `{ plan, maxStores, expiry }` + firma HMAC-SHA256 (salt en build)
- Guardada en `settings` de la DB. Verificada al inicio y al abrir el setup.

---

## 6. Seguridad

| Amenaza | Mitigación |
|---|---|
| SQL Injection | Prepared statements con placeholders (`?`, `@named`) en `better-sqlite3` |
| PIN de usuario expuesto | Hashed con `bcryptjs` (10 rounds) en el Main Process |
| Datos corruptos de UI | Validación con Zod en el Renderer antes de enviar al Main |
| Acceso no autorizado a rutas | `ProtectedRoute` verifica `useSessionStore.role` |
| Pérdida de datos | Backup automático al cerrar la app (últimos 5, rotación automática) |

---

## 7. Electron Forge (Build y Distribución)

```js
// forge.config.js — Targets
makers: [
  { name: '@electron-forge/maker-dmg' },   // macOS
  { name: '@electron-forge/maker-zip' },   // Windows / Linux portable
]
```
- El `electron-main.js` verifica `setup_completed` al iniciar.
- En dev: carga `http://localhost:3000`. En prod: carga el build de Next.js.
- Variables de entorno de build (salt de licencia) se inyectan en tiempo de `forge build`.

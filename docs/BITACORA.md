# 📒 Bitácora Maestra de Desarrollo — Fast-POS

**Formato:** `| Fecha | Versión | Fase | Acción | Resultado / Nota |`

> Cada sesión de desarrollo DEBE cerrar con una entrada en esta bitácora.  
> Esta es la única fuente de verdad cronológica del proyecto.

---

## Registro de Cambios

| Fecha | Versión | Fase | Acción | Resultado / Nota |
| :--- | :--- | :--- | :--- | :--- |
| 11-Mar-2026 | 1.0.0 | Setup | Inicialización Next.js 15, TypeScript, Tailwind v4 | App Router configurado. Base del proyecto lista. |
| 12-Mar-2026 | 1.0.0 | UI | Instalación Shadcn UI | Componentes Button, Card, Dialog, Tabs listos. |
| 12-Mar-2026 | 1.0.0 | PWA | Configuración Serwist | Service Workers activos. Soporte offline básico. |
| 12-Mar-2026 | 1.0.0 | Bugfix | Conflicto Turbopack/PWA | Forzado Webpack en dev/build. |
| 12-Mar-2026 | 1.0.0 | Datos | Schema.ts (Fuente de Verdad) | Zod schemas para Category, Product, Order, OrderItem. Centavos, UUIDs. |
| 12-Mar-2026 | 1.0.0 | Datos | Dexie.js (IndexedDB) | Motor offline para PWA con índices de búsqueda. |
| 12-Mar-2026 | 1.0.0 | Catálogo | CRUD Categorías | Formulario + validación Zod + Shadcn components. |
| 12-Mar-2026 | 1.0.0 | Catálogo | CRUD Productos | Formulario con conversión centavos/decimales, control de stock +/-. |
| 12-Mar-2026 | 1.1.0 | Motor POS | Zustand CartStore | Store con snapshots, sessionStorage. Módulo de ventas funcional. |
| 12-Mar-2026 | 1.1.0 | Motor POS | OrderService.checkout() | Transacción atómica: orden + ítems + descuento de stock. |
| 12-Mar-2026 | 1.1.0 | Analytics | Dashboard | MetricCard, TopProducts, pantalla /analytics. |
| 12-Mar-2026 | 1.1.0 | Historial | /history + Anulación | VoidOrder atómico: estado CANCELLED + recuperación de stock. |
| 12-Mar-2026 | 1.1.0 | Settings | Backup/Restore Dexie | Export/Import `.fastpos` con dexie-export-import. |
| 12-Mar-2026 | 1.1.0 | Hardware | BarcodeHandler | Componente centralizado con perfiles pos/catalog/diagnostic. |
| 12-Mar-2026 | 1.1.0 | Imágenes | Compresión cliente | Canvas API → WebP, < 40KB. |
| 12-Mar-2026 | 1.1.0 | SQLite | Instalación better-sqlite3 | Motor nativo en `src/main/database.js`. WAL + Foreign Keys. |
| 12-Mar-2026 | 1.1.0 | SQLite | Esquema SQL v1 | Tablas: categories, products, orders, order_items. |
| 12-Mar-2026 | 1.1.0 | Settings | Health Check DB | Panel de diagnóstico con métricas en tiempo real de SQLite. |
| 12-Mar-2026 | 1.1.0 | UI/Refactor | Tabs en Settings | Pesaña General, Seguridad, Hardware, Avanzado con glassmorphism. |
| 12-Mar-2026 | 1.1.0 | Docs | Documentación inicial | developer_guide.md + bitacora.md + docs/ creados. |
| 12-Mar-2026 | 2.0.0 | FASE 1 | Migraciones SQLite Versionadas | `database.js` reescrito con sistema de migraciones `PRAGMA user_version`. v1=schema base, v2=IVA+settings, v3=users. |
| 12-Mar-2026 | 2.0.0 | FASE 1 | Tabla `settings` | Configuración global del negocio (nombre, RFC, teléfono, moneda, IVA default) persistida en SQLite. |
| 12-Mar-2026 | 2.0.0 | FASE 1 | IPC Handlers v2.0 | Nuevos handlers: `db:exportSqlite`, `db:importSqlite` (con File Dialog nativo), `settings:get/set/setBulk/getAll`, `orders:void`. |
| 12-Mar-2026 | 2.0.0 | FASE 1 | preload.js limpiado | Eliminados bindings legacy de Dexie/sync. Añadidos todos los métodos de la v2.0. |
| 12-Mar-2026 | 2.0.0 | FASE 1 | Settings Page v2.0 | Backup/Restore migrado de Dexie a SQLite nativo. Se añadió pestaña "Negocio". Todos los confirm() reemplazados por AlertDialog. |

---

## Formato Detallado (Para cambios complejos)

Usar este formato cuando se modifiquen múltiples archivos o se tome una decisión de arquitectura importante:

```
### [Fecha] — [Título del cambio]

**Versión:** X.Y.Z
**Fase:** [Nombre de la fase del roadmap]

**Archivos modificados:**
- `ruta/al/archivo.ts` — [qué cambió]
- `ruta/al/otro.js` — [qué cambió]

**Decisión tomada:**
[Explicar por qué se tomó esta decisión y no otra alternativa]

**Deuda técnica generada (si aplica):**
[Qué queda pendiente y por qué se pospuso]
```

---

## Versiones del Producto

| Versión | Estado | Descripción |
|---|---|---|
| 1.0.0 | ✅ Released | MVP: CRUD básico, carrito, PWA. |
| 1.1.0 | ✅ Released | Native Core: SQLite, analytics, historial, settings, barcode. |
| 2.0.0 | 🔄 En desarrollo | Comercial: IVA, tickets, imágenes locales, usuarios, wizard, licencias. |

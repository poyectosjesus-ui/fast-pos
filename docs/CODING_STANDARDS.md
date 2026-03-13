# 🛠️ Estándares de Código — Fast-POS

**Versión:** 2.0 | **Última actualización:** 12-Mar-2026

---

## 1. Reglas Absolutas (Tolerancia Cero)

```typescript
// 🚫 Prohibido: uso de `any`
const data: any = getProducts();           // ❌
const data: Product[] = await ProductService.getAll(); // ✅

// 🚫 Prohibido: window.confirm() 
if (window.confirm("¿Borrar?")) { }       // ❌ → usar AlertDialog

// 🚫 Prohibido: floats para dinero
const total = price * 1.16;               // ❌
const total = Math.round(price * 116) / 100; // ✅ en centavos

// 🚫 Prohibido: electronAPI en componentes
const data = await window.electronAPI.getProducts(); // ❌ en componente
const data = await ProductService.getAll();          // ✅
```

---

## 2. Encabezado Obligatorio en Archivos Nuevos

```typescript
/**
 * [NOMBRE DEL MÓDULO]
 * 
 * Responsabilidad: [Qué hace este archivo en una frase]
 * Fuente de Verdad: [Sección de ARCHITECTURE.md o fase del roadmap]
 */
```

---

## 3. Naming Conventions

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | `PascalCase` | `ProductCard.tsx` |
| Servicios | `camelCase + Service` | `productService.ts` |
| Stores | `use + PascalCase + Store` | `useCartStore.ts` |
| Hooks | `use + camelCase` | `useDebounce.ts` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_STORES = 3` |
| IPC Channels | `domain:action` | `products:getAll` |

---

## 4. Plantilla de Servicio

```typescript
// src/lib/services/products.ts
import { ProductSchema, type Product } from '@/lib/schema';

export const ProductService = {
  async getAll(): Promise<Product[]> {
    if (!window.electronAPI) return [];
    return window.electronAPI.getProducts();
  },

  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const product: Product = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    ProductSchema.parse(product); // Validar antes de enviar
    const result = await window.electronAPI!.createProduct(product);
    if (!result.success) throw new Error(result.error);
    return product;
  },
} as const;
// Los servicios LANZAN errores. Los componentes los capturan y muestran toast.
```

---

## 5. Plantilla de IPC Handler

```javascript
// src/main/ipc-handlers.js
/**
 * Handler: products:create
 * Acción: Inserta un producto en SQLite (transacción atómica).
 */
ipcMain.handle('products:create', async (event, product) => {
  try {
    const db = getDb();
    const insert = db.transaction((p) => {
      db.prepare(`
        INSERT INTO products (id, categoryId, name, price, stock, sku, isVisible, image, createdAt, updatedAt)
        VALUES (@id, @categoryId, @name, @price, @stock, @sku, @isVisible, @image, @createdAt, @updatedAt)
      `).run({ ...p, isVisible: p.isVisible ? 1 : 0 });
      return { success: true };
    });
    return insert(product);
  } catch (err) {
    console.error('[IPC:products:create]', err.message);
    return { success: false, error: err.message };
  }
});
```

---

## 6. Logging Estructurado (Main Process)

```javascript
console.log('[DB]', 'Conexión establecida');
console.log('[IPC]', 'Handlers registrados');
console.error('[IPC:products:create]', err.message);
console.log('[BACKUP]', 'Respaldo creado en:', path);
console.log('[LICENSE]', 'Clave validada:', plan);
console.log('[IMAGE]', 'Imagen guardada:', filename);
```

---

## 7. Migraciones de DB (Patrón Obligatorio)

```javascript
function runMigrations(db) {
  const v = db.pragma('user_version', { simple: true });

  if (v < 1) {
    db.exec(`/* Schema v1 base */`);
    db.pragma('user_version = 1');
    console.log('[DB] Migración v1 aplicada');
  }

  if (v < 2) {
    // NUNCA borrar columnas en migraciones automáticas
    db.exec(`ALTER TABLE products ADD COLUMN taxRate INTEGER NOT NULL DEFAULT 1600`);
    db.pragma('user_version = 2');
    console.log('[DB] Migración v2 aplicada');
  }
}
```

---

## 8. Checklist Pre-Entrega

```
Código TypeScript
[ ] Cero `any`
[ ] Tipos de retorno explícitos en todos los servicios
[ ] `npx tsc --noEmit` pasa sin errores

Datos
[ ] Montos en centavos (INTEGER), sin floats
[ ] CUD dentro de transacciones SQLite
[ ] Queries con placeholders (sin interpolación)

UI / UX
[ ] Sin `window.confirm` — usar AlertDialog
[ ] Estados de loading en todas las operaciones async
[ ] Empty states implementados
[ ] Mensajes en español informal y empático

Arquitectura
[ ] Componentes → Services → electronAPI (nunca saltar capas)
[ ] Tipos desde schema.ts (no duplicados)
[ ] Nuevos handlers con logging `[IPC:domain:action]`
[ ] Archivos nuevos tienen comentario de encabezado
```

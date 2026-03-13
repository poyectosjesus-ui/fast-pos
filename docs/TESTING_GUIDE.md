# 🧪 Guía de Testing — Fast-POS

**Versión:** 2.0  
**Última actualización:** 12-Mar-2026

Esta guía define cómo escribir, organizar y ejecutar tests en Fast-POS. La prioridad es proteger la **lógica de negocio crítica** (dinero, stock, licencias) con tests automatizados.

---

## 1. Filosofía de Testing

> "No testees la librería; testea TU lógica de negocio."

### Qué SÍ testear (obligatorio):
- Cálculos de IVA y desglose de precios (`src/lib/services/tax.ts`)
- Cálculo de totales del carrito (`src/store/useCartStore.ts`)
- Validación de claves de licencia (`src/lib/licensing.ts`)
- Schemas de Zod (cases de borde: precios negativos, SKU vacío, PIN incorrecto)
- Lógica de anulación de órdenes y recuperación de stock

### Qué NO testear (pérdida de tiempo en este proyecto):
- Que Shadcn renderiza un botón
- Que Zod valida un `z.string()` básico
- Que SQLite funciona (confiar en la librería)

---

## 2. Stack de Testing

| Herramienta | Propósito |
|---|---|
| `vitest` | Test runner (rápido, compatible con TS/ESM) |
| `@testing-library/react` | Tests de componentes React |
| `@vitest/coverage-v8` | Reporte de cobertura |

### Instalación (cuando se configure)
```bash
npm install -D vitest @testing-library/react @vitest/coverage-v8 jsdom
```

### Configuración en `vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',     // Para tests de componentes
    globals: true,
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/store/**'],  // Solo lógica de negocio
    },
  },
});
```

---

## 3. Estructura de Archivos de Test

Los tests viven **junto al código** que testean, con extensión `.test.ts`:

```
src/
├── lib/
│   ├── services/
│   │   ├── tax.ts
│   │   └── tax.test.ts          ← Tests de lógica de IVA
│   ├── licensing.ts
│   └── licensing.test.ts        ← Tests de validación de licencia
├── store/
│   ├── useCartStore.ts
│   └── useCartStore.test.ts     ← Tests del carrito
└── test/
    └── setup.ts                 ← Setup global de tests
```

---

## 4. Convenciones para Escribir Tests

### 4.1 Nomenclatura
```ts
// ✅ CORRECTO: describe el comportamiento, no la implementación
describe('calculateItemTax', () => {
  it('debería extraer IVA de un precio que ya lo incluye', () => { ... });
  it('debería agregar IVA a un precio base', () => { ... });
  it('debería retornar 0 de IVA para productos exentos', () => { ... });
  it('debería fallar si el precio es negativo', () => { ... });
});

// ❌ INCORRECTO: testear la implementación
it('llama a Math.round internamente', () => { ... });
```

### 4.2 Patrón AAA (Arrange, Act, Assert)
```ts
it('debería calcular el IVA de un producto con precio incluido de $100', () => {
  // ARRANGE — preparar los datos
  const price = 10000; // $100.00 en centavos
  const taxRate = 1600; // 16%
  const taxIncluded = true;

  // ACT — ejecutar la función
  const result = calculateItemTax(price, taxRate, taxIncluded);

  // ASSERT — verificar el resultado
  expect(result.basePrice).toBe(8621);    // $86.21 (neto)
  expect(result.taxAmount).toBe(1379);    // $13.79 (IVA)
  expect(result.total).toBe(10000);       // $100.00 (total sin cambio)
});
```

### 4.3 Tests de Casos de Borde (obligatorios)
Para cada función crítica, incluir tests de:
- Valor mínimo (0, string vacío, array vacío)
- Valor máximo (stock máximo, precio máximo)
- Valor inválido (negativo, NaN, null, undefined)
- Concurrencia / condición de carrera si aplica

```ts
it('debería rechazar un precio negativo', () => {
  expect(() => calculateItemTax(-100, 1600, true)).toThrow();
});

it('debería manejar IVA del 0% sin romper', () => {
  const result = calculateItemTax(10000, 0, false);
  expect(result.taxAmount).toBe(0);
  expect(result.total).toBe(10000);
});
```

---

## 5. Tests Prioritarios por Módulo

### 5.1 `src/lib/services/tax.ts`
```ts
// Casos que DEBEN tener test:
calculateItemTax(price, taxRate, taxIncluded=true)   // extrae IVA
calculateItemTax(price, taxRate, taxIncluded=false)  // agrega IVA
calculateItemTax(price, 0, false)                    // exento de IVA
calculateCartTax(items)                              // total del carrito
```

### 5.2 `src/lib/licensing.ts`
```ts
// Casos que DEBEN tener test:
validateLicenseKey('FAST-ABCD-1234-EFGH')  // clave válida → LicenseInfo
validateLicenseKey('FAST-XXXX-XXXX-XXXX')  // clave inválida → null
validateLicenseKey('')                       // vacío → null
validateLicenseKey('HACK-AAAA-BBBB-CCCC')  // prefijo incorrecto → null
// Clave expirada → { ...info, isExpired: true }
```

### 5.3 `src/store/useCartStore.ts`
```ts
// Acciones a testear:
addItem(product)              // agrega ítem, incrementa cantidad si ya existe
removeItem(productId)         // remueve ítem completamente
updateQuantity(id, qty)       // actualiza cantidad con validación de stock
clearCart()                   // vacía el carrito
// Selectores:
getTotalCentavos()            // suma exacta en centavos
getItemCount()                // total de unidades
```

### 5.4 Schemas de Zod (`src/lib/schema.ts`)
```ts
// Para cada schema, testear 3 casos de borde:
ProductSchema.parse({ ...validProduct, price: -1 })    // debe lanzar error
ProductSchema.parse({ ...validProduct, sku: 'AB' })    // SKU muy corto
OrderSchema.parse({ ...validOrder, items: [] })        // orden vacía
```

---

## 6. Checklist Manual de Regresión

Cuando no hay tests automáticos disponibles, ejecutar esta checklist antes de un build:

### 🧾 Flujo de Venta Completo
- [ ] Agregar 3 productos al carrito desde el POS
- [ ] Verificar que el total mostrado en pantalla es correcto (calcularlo a mano)
- [ ] Completar la venta con método "Efectivo"
- [ ] Confirmar que el stock de los productos disminuyó correctamente
- [ ] Abrir el historial y verificar que la orden aparece
- [ ] Anular la orden y confirmar que el stock se restauró

### 📦 CRUD de Catálogo
- [ ] Crear categoría → aparece en la lista inmediatamente
- [ ] Crear producto con imagen → imagen visible en el catálogo
- [ ] Editar el precio de un producto → el POS muestra el nuevo precio
- [ ] Intentar borrar una categoría con productos → debe mostrar error

### 🔑 Autenticación
- [ ] PIN incorrecto → no entra
- [ ] PIN correcto (ADMIN) → acceso total
- [ ] PIN correcto (CASHIER) → no ve Settings ni Catálogo

### 🗄️ Base de Datos
- [ ] Cerrar la app y abrir de nuevo → todos los datos persisten
- [ ] Backup → restaurar → datos intactos
- [ ] Factory Reset → todos los datos borrados, wizard aparece

---

## 7. Comandos

```bash
# Correr todos los tests
npm run test

# Correr tests en modo watch (desarrollo)
npm run test:watch

# Generar reporte de cobertura
npm run test:coverage

# Verificar TypeScript (sin compilar)
npx tsc --noEmit
```

### Scripts en `package.json` (agregar)
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 8. Criterio de Cobertura

No se busca el 100% de cobertura. Los objetivos son:

| Módulo | Cobertura Mínima |
|---|---|
| `src/lib/services/` | **80%** |
| `src/lib/licensing.ts` | **90%** |
| `src/store/` | **70%** |
| `src/components/` | No requerida |
| `src/main/` | No (difícil de testear sin Electron) |

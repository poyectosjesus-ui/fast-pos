# 📌 EPIC-002: Sistema de Impuestos e IVA

**EPIC-002**: Sistema de Impuestos e IVA por Producto
**Fase del Roadmap**: 2
**Duración estimada**: 6h
**Prioridad**: 🔴 CRÍTICO
**Estado**: ⏳ Pendiente

---

## 📖 Descripción
Los negocios en México operan con IVA (16% estándar, 8% en frontera, 0% en algunos productos).
Esta épica añade la capacidad de configurar el IVA por producto con dos modos:
(1) el precio ya incluye el IVA, o (2) el IVA se agrega al precio base al momento de cobrar.
El checkout muestra el desglose completo: subtotal, IVA, total.

---

## 🎯 Objetivo Final
Al completar esta épica, cada producto tiene su tasa de IVA y su modo de cálculo configurados.
El checkout muestra el desglose exacto de impuestos en centavos, sin errores de redondeo.

---

## ✅ Criterios de Aceptación
- [ ] El formulario de producto tiene un selector de IVA (0%, 8%, 16%, Personalizado)
- [ ] El toggle "El precio ya incluye IVA" funciona y se persiste en SQLite
- [ ] Un producto con `taxIncluded=true` y 16% muestra el precio desglosado en checkout
- [ ] Un producto con `taxIncluded=false` y 16% suma el IVA al total en checkout
- [ ] Los cálculos de IVA tienen cero errores de redondeo (todo en centavos, `Math.round`)
- [ ] El IVA configurado en Settings se aplica como default a productos nuevos
- [ ] `npx tsc --noEmit` pasa sin errores

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo Est. | Estado |
|----|-------|---------------|-------------|--------|
| TASK-002-001 | Actualizar `schema.ts` con campos `taxRate` + `taxIncluded` + `TaxConfig` | EPIC-001 ✅ | 1h | ⏳ |
| TASK-002-002 | Crear `src/lib/services/tax.ts` con función pura `calculateItemTax` | TASK-002-001 | 1.5h | ⏳ |
| TASK-002-003 | UI de productos: campos IVA en formulario CRUD | TASK-002-001 | 1.5h | ⏳ |
| TASK-002-004 | Checkout y CartSidebar con desglose de IVA | TASK-002-002 | 2h | ⏳ |

---

## ⚠️ Dependencias Externas
- Ninguna dependencia externa nueva. Todo usa el stack existente.
- Los campos `taxRate` (INTEGER) y `taxIncluded` (INTEGER 0/1) ya existen en SQLite (migración v2).

---

## 🔍 Notas de Implementación
- **Puntos básicos**: `taxRate = 1600` significa 16.00%. Se divide entre 10000 para calcular.
- **`taxIncluded = true`**: `basePrice = Math.round(total * 10000 / (10000 + taxRate))`
- **`taxIncluded = false`**: `taxAmount = Math.round(basePrice * taxRate / 10000)`
- La función `calculateItemTax` debe ser pura (sin efectos secundarios) para ser fácil de testear.
- El IVA default del negocio se lee de `settings.tax_rate_default` (ya existe en la tabla `settings`).

---

## 📁 Archivos Modificados / Creados

### Modificados
- [ ] `src/lib/schema.ts` — Añadir `taxRate`, `taxIncluded`, `TaxConfig`
- [ ] `src/app/products/page.tsx` — Campos de IVA en el formulario
- [ ] `src/app/page.tsx` (POS) — CartSidebar y CheckoutDialog con desglose IVA

### Nuevos
- [ ] `src/lib/services/tax.ts` — Lógica pura de cálculo de impuestos

---

## ✅ Checklist de Cierre de Épica
- [ ] Todas las tareas completadas
- [ ] `npx tsc --noEmit` sin errores
- [ ] Verificación manual: producto con IVA incluido y producto con IVA agregado
- [ ] Los totales en el checkout coinciden con cálculo manual a mano
- [ ] Entrada añadida a `docs/BITACORA.md`
- [ ] Estado cambiado a ✅ Completada

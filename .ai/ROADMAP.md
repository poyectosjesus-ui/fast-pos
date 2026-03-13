# 🗺️ ROADMAP.md — Fast-POS 2.0 (Plan Comercial)

> Léase junto con `CONTEXT.md`. Este roadmap define las 7 épicas del upgrade comercial.
> Objetivo: Convertir el MVP en un producto de escritorio vendible para negocios pequeños.

---

## Estado general del proyecto

```
EPIC-001 ✅  | EPIC-002 ⏳ | EPIC-003 ⏳ | EPIC-004 ⏳ | EPIC-005 ⏳ | EPIC-006 ⏳ | EPIC-007 ⏳
Migration    | IVA/Tax    | Images     | Tickets    | Users/RBAC  | Wizard     | Licensing
```

---

## EPIC-001: Migración SQLite Completa ✅
**Prioridad**: 🔴 CRÍTICO | **Tiempo**: ~4h | **Estado**: ✅ Completada

Migra el sistema de backup/restore de Dexie a SQLite nativo, añade migraciones versionadas,
tabla de settings globales y limpia el preload.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-001-001 | Migraciones versionadas (`PRAGMA user_version`) | ✅ |
| TASK-001-002 | Tabla `settings` + IPC handlers settings:* | ✅ |
| TASK-001-003 | preload.js v2.0 (bindings limpios) | ✅ |
| TASK-001-004 | Settings UI v2.0 (sin Dexie, con pestaña Negocio) | ✅ |

---

## EPIC-002: Sistema de Impuestos e IVA ⏳
**Prioridad**: 🔴 CRÍTICO | **Tiempo**: ~6h | **Estado**: ⏳ Pendiente

Permite configurar el IVA por producto: si el precio ya incluye el impuesto o se agrega
al total. Muestra el desglose en el checkout.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-002-001 | Actualizar `schema.ts` con campos IVA + `TaxConfig` | ⏳ |
| TASK-002-002 | Crear `src/lib/services/tax.ts` (función pura de cálculo) | ⏳ |
| TASK-002-003 | UI de productos: campos IVA en formulario | ⏳ |
| TASK-002-004 | Checkout: desglose de IVA en carrito y ticket | ⏳ |

---

## EPIC-003: Manejo Local de Imágenes (Bucket Local) ⏳
**Prioridad**: 🟠 ALTO | **Tiempo**: ~4h | **Estado**: ⏳ Pendiente

Las imágenes se guardan en el sistema de archivos del usuario (`userData/images/`)
en lugar de como base64 en la DB. Esto mantiene la DB liviana y rápida.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-003-001 | IPC handlers: `images:save`, `images:delete`, `images:getUrl` | ⏳ |
| TASK-003-002 | Actualizar `preload.js` con métodos de imágenes | ⏳ |
| TASK-003-003 | Refactorizar `image-processing.ts`: comprimir → enviar al Main | ⏳ |
| TASK-003-004 | Migrar productos existentes (base64 → archivo) | ⏳ |

---

## EPIC-004: Impresión de Tickets ⏳
**Prioridad**: 🔴 CRÍTICO | **Tiempo**: ~6h | **Estado**: ⏳ Pendiente

Imprime tickets en impresoras térmicas (80mm) y genera PDF. Sin ticket físico,
los negocios no pueden vender formalmente.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-004-001 | Ruta `/ticket` con template de ticket HTML (80mm) | ⏳ |
| TASK-004-002 | IPC handler `ticket:print` con ventana invisible de Electron | ⏳ |
| TASK-004-003 | IPC handler `ticket:printToPdf` con guardado en Documentos | ⏳ |
| TASK-004-004 | Botón "Imprimir Ticket" en CheckoutDialog y `/history` | ⏳ |
| TASK-004-005 | Sección de configuración de impresora en Settings | ⏳ |

---

## EPIC-005: Gestión de Usuarios y Roles (RBAC) ⏳
**Prioridad**: 🟠 ALTO | **Tiempo**: ~8h | **Estado**: ⏳ Pendiente

Login por PIN de 4 dígitos. Roles: ADMIN (acceso total) y CASHIER (solo el POS).
Los PINs se hashean con bcryptjs. Sin servidor de auth.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-005-001 | IPC handlers: `auth:login`, `auth:logout`, `users:*` | ⏳ |
| TASK-005-002 | Crear `src/store/useSessionStore.ts` | ⏳ |
| TASK-005-003 | Pantalla de login `/login` con PINpad (3×4) | ⏳ |
| TASK-005-004 | `ProtectedRoute` HOC para control de acceso por rol | ⏳ |
| TASK-005-005 | Gestión de usuarios en Settings (CRUD, solo ADMIN) | ⏳ |

---

## EPIC-006: Setup Wizard (Onboarding) ⏳
**Prioridad**: 🟠 ALTO | **Tiempo**: ~6h | **Estado**: ⏳ Pendiente

Wizard de 4 pasos que corre en el primer inicio de la app. Guía al usuario a
validar su licencia, configurar el negocio, establecer el IVA y crear el admin.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-006-001 | Lógica de detección de primer arranque en `electron-main.js` | ⏳ |
| TASK-006-002 | Layout del wizard (progreso, navegación entre pasos) | ⏳ |
| TASK-006-003 | Paso 1: Validación de licencia | ⏳ |
| TASK-006-004 | Paso 2: Datos del negocio + logo | ⏳ |
| TASK-006-005 | Paso 3: Configuración fiscal (IVA, moneda) | ⏳ |
| TASK-006-006 | Paso 4: Crear usuario ADMIN | ⏳ |

---

## EPIC-007: Licenciamiento por Clave ⏳
**Prioridad**: 🔴 CRÍTICO | **Tiempo**: ~4h | **Estado**: ⏳ Pendiente

Sin internet. Clave `FAST-XXXX-XXXX-XXXX` validada localmente con HMAC-SHA256.
Codifica plan (BASIC/PRO), maxStores (1/3) y expiración.

### Tareas
| ID | Tarea | Estado |
|----|-------|--------|
| TASK-007-001 | `src/lib/licensing.ts`: `validateLicenseKey()` | ⏳ |
| TASK-007-002 | `src/main/license-generator.js` (script privado, fuera del build) | ⏳ |
| TASK-007-003 | Integrar licencia en el wizard y en Settings | ⏳ |
| TASK-007-004 | Bloqueo de funciones al expirar la licencia | ⏳ |

---

## 📊 Estimado Total

| Epic | Hrs | Acumulado |
|---|---|---|
| EPIC-001 Migración | 4h | 4h ✅ |
| EPIC-002 IVA | 6h | 10h |
| EPIC-003 Imágenes | 4h | 14h |
| EPIC-004 Tickets | 6h | 20h |
| EPIC-005 Usuarios | 8h | 28h |
| EPIC-006 Wizard | 6h | 34h |
| EPIC-007 Licencias | 4h | **38h total** |

**~38 horas de trabajo enfocado** para un producto comercial listo para vender.

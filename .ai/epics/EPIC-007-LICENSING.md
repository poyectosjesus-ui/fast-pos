# 📌 EPIC-007: Licenciamiento por Clave

**EPIC-007**: Licenciamiento por Clave (License Key)
**Fase del Roadmap**: 7
**Duración estimada**: 4h
**Prioridad**: 🔴 CRÍTICO
**Estado**: ⏳ Pendiente

---

## 📖 Descripción
Sin un sistema de licencias, no puedes cobrar por el software. Esta épica implementa
un esquema de claves únicas con formato `FAST-XXXX-XXXX-XXXX` que se valida 100%
offline usando HMAC-SHA256. La clave codifica el plan, maxStores y expiración.

---

## 🎯 Objetivo Final
La clave de licencia se valida localmente en < 100ms. El negocio no puede usar
la app sin una clave válida. Tú generas las claves con un script privado.

---

## ✅ Criterios de Aceptación
- [ ] Clave válida: avanza el wizard y muestra el plan (BASIC/PRO)
- [ ] Clave inválida: muestra error claro y no avanza
- [ ] Clave expirada: permite acceso de solo lectura (no puede vender)
- [ ] La información de la licencia es visible en Settings (no editable ahí)
- [ ] `npx tsc --noEmit` pasa sin errores

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo | Estado |
|----|-------|---------------|--------|--------|
| TASK-007-001 | `src/lib/licensing.ts` con `validateLicenseKey()` | Ninguno | 1.5h | ⏳ |
| TASK-007-002 | `src/main/license-generator.js` (script privado) | TASK-007-001 | 1h | ⏳ |
| TASK-007-003 | Integrar licencia en wizard (Paso 1) y Settings | TASK-007-001 | 1h | ⏳ |
| TASK-007-004 | Modo de solo lectura cuando la licencia expira | TASK-007-001 | 0.5h | ⏳ |

---

## ⚠️ Dependencias Externas
- `crypto` (Node.js built-in) — Para HMAC-SHA256 en el proceso de generación
- El SALT secreto debe estar en una variable de entorno de BUILD, NO en el repositorio

---

## 🔍 Notas de Implementación

### Formato de Clave
```
FAST-XXXX-XXXX-XXXX
 ↑    ↑    ↑    ↑
 |    |    |    └── HMAC truncado (firma)
 |    |    └─────── Parámetros (plan + stores + expiry, base36)
 |    └──────────── Versión de clave (0001, 0002...)
 └───────────────── Prefijo del producto
```

### Algoritmo de validación (sin internet)
```typescript
// En licensing.ts:
const SALT = process.env.LICENSE_SALT ?? 'dev-salt'; // ← inyectado en build
const payload = `${version}:${params}`;
const expected = hmacSha256(payload, SALT).substring(0, 4).toUpperCase();
return signature === expected;
```

### Planes disponibles
| Plan | maxStores | Precio sugerido |
|---|---|---|
| BASIC | 1 | $499 MXN |
| PRO | 3 | $899 MXN |
| LIFETIME | 3 | $1,499 MXN |

---

## 📁 Archivos Modificados / Creados

### Nuevos (en repo)
- [ ] `src/lib/licensing.ts` — Función de validación (pura, sin efectos)

### Nuevos (FUERA del build — en `.gitignore`)
- [ ] `src/main/license-generator.js` — Script para generar claves

### Modificados
- [ ] `src/app/setup/page.tsx` — Paso 1 usa `validateLicenseKey()`
- [ ] `src/app/settings/page.tsx` — Panel de información de la licencia

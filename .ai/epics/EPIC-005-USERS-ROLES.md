# 📌 EPIC-005: Gestión de Usuarios y Roles (RBAC)

**EPIC-005**: Gestión de Usuarios y Roles
**Fase del Roadmap**: 5
**Duración estimada**: 8h
**Prioridad**: 🟠 ALTO
**Estado**: ⏳ Pendiente

---

## 📖 Descripción
Los negocios con empleados necesitan restringir el acceso. Esta épica implementa
autenticación por PIN de 4 dígitos con dos roles: ADMIN (acceso total) y CASHIER
(solo el POS y ver historial). Los PINs se hashean con bcryptjs. Sin servidor de auth.

---

## 🎯 Objetivo Final
La app muestra una pantalla de PIN al iniciar. Los CASHIER no pueden acceder a
Catálogo, Analíticas ni Configuración. El ADMIN gestiona usuarios desde Settings.

---

## ✅ Criterios de Aceptación
- [ ] Al iniciar, si hay usuarios en la DB, se muestra la pantalla de PIN
- [ ] PIN incorrecto → mensaje de error + bloqueo de 3 segundos
- [ ] ADMIN ve todas las rutas
- [ ] CASHIER solo ve `/` (POS) y `/history` (sin botón de anulación)
- [ ] El ADMIN puede crear, editar y desactivar usuarios desde Settings
- [ ] `npx tsc --noEmit` pasa sin errores

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo | Estado |
|----|-------|---------------|--------|--------|
| TASK-005-001 | IPC handlers: `auth:login`, `auth:logout`, `users:*` | EPIC-001 ✅ | 2h | ⏳ |
| TASK-005-002 | `src/store/useSessionStore.ts` (Zustand) | TASK-005-001 | 0.5h | ⏳ |
| TASK-005-003 | Pantalla `/login` con PINpad 3×4 | TASK-005-002 | 2h | ⏳ |
| TASK-005-004 | `ProtectedRoute.tsx` + lógica en layout | TASK-005-002 | 1h | ⏳ |
| TASK-005-005 | Gestión de usuarios en Settings (solo ADMIN) | TASK-005-001 | 2.5h | ⏳ |

---

## ⚠️ Dependencias Externas
- `bcryptjs` — Hash de PINs. Instalar: `npm install bcryptjs && npm install -D @types/bcryptjs`
- Importar `bcryptjs` SOLO en el Main Process (ipc-handlers.js), nunca en el Renderer

---

## 🔍 Notas de Implementación
- El PIN de 4 dígitos se hashea con `bcrypt.hash(pin, 10)` en el Main
- La sesión activa se guarda en `useSessionStore` (Zustand, sin persistencia a disco)
- Si no hay usuarios en la DB, la app NO muestra login (va directo al wizard o al POS)
- El `ProtectedRoute` redirige a `/login` si `!isAuthenticated`
- El CASHIER ve el botón de historial pero sin el botón "Anular"

---

## 📁 Archivos Modificados / Creados

### Nuevos
- [ ] `src/app/login/page.tsx` — Pantalla de PIN (PINpad 3×4)
- [ ] `src/store/useSessionStore.ts` — Estado de sesión activa
- [ ] `src/components/layout/ProtectedRoute.tsx` — HOC de control de acceso

### Modificados
- [ ] `src/main/ipc-handlers.js` — Handlers auth:login, auth:logout, users:*
- [ ] `preload.js` — Exponer auth:login, users:getAll, etc.
- [ ] `src/app/settings/page.tsx` — Sección de gestión de usuarios
- [ ] `src/app/layout.tsx` — Usar ProtectedRoute

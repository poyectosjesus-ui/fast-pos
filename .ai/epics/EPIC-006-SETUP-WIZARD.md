# 📌 EPIC-006: Setup Wizard (Onboarding)

**EPIC-006**: Setup Wizard de Configuración Inicial
**Fase del Roadmap**: 6
**Duración estimada**: 6h
**Prioridad**: 🟠 ALTO
**Estado**: ⏳ Pendiente

---

## 📖 Descripción
La primera vez que el usuario instala Fast-POS, un wizard de 4 pasos lo guía
a través de: validar su licencia, configurar el negocio, establecer el IVA
y crear el usuario ADMIN. Sin completar el wizard, no puede usar la app.

---

## 🎯 Objetivo Final
Al completar el wizard, `setup_completed = "true"` en la tabla `settings`,
el usuario ADMIN está creado y la app redirige a la pantalla de login.

---

## ✅ Criterios de Aceptación
- [ ] Al iniciar con DB vacía (o `setup_completed = "false"`), la app va a `/setup`
- [ ] No se puede saltar ningún paso del wizard
- [ ] Paso 1 (Licencia): clave inválida muestra error, válida avanza
- [ ] Paso 2 (Negocio): todos los campos se guardan en `settings`
- [ ] Paso 3 (Fiscal): IVA default y moneda se guardan en `settings`
- [ ] Paso 4 (Admin): crea usuario con PIN hasheado en tabla `users`
- [ ] Al terminar, `setup_completed = "true"` y redirige a `/login`

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo | Estado |
|----|-------|---------------|--------|--------|
| TASK-006-001 | Lógica de detección de primer arranque en `electron-main.js` | EPIC-001 ✅ | 0.5h | ⏳ |
| TASK-006-002 | Layout del wizard (progreso, navegación) | Ninguno | 1h | ⏳ |
| TASK-006-003 | Paso 1: Validación de licencia (integra EPIC-007) | TASK-006-002 | 1h | ⏳ |
| TASK-006-004 | Paso 2: Datos del negocio + logo | TASK-006-002 | 1h | ⏳ |
| TASK-006-005 | Paso 3: Configuración fiscal (IVA, moneda) | TASK-006-002 | 0.5h | ⏳ |
| TASK-006-006 | Paso 4: Crear usuario ADMIN (integra EPIC-005) | TASK-006-002 | 2h | ⏳ |

---

## 🔍 Notas de Implementación
- `electron-main.js` lee `settings.setup_completed` al arrancar. Si `!= "true"` → carga `/setup`
- El wizard no tiene Sidebar ni header de navegación
- El indicador de progreso usa los steps con el color `--primary` para el activo
- El botón "Siguiente" está `disabled` hasta que el paso actual valida correctamente
- Si el wizard se cierra a la mitad, la next vez muestra desde el paso 1 (seguridad)

---

## 📁 Archivos Modificados / Creados

### Nuevos
- [ ] `src/app/setup/page.tsx` — Wizard de 4 pasos
- [ ] `src/app/setup/layout.tsx` — Layout sin Sidebar

### Modificados
- [ ] `electron-main.js` — Verificar `setup_completed` al iniciar

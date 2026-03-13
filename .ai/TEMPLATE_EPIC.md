# 📌 TEMPLATE: Épica

> **Instrucción para IA:** Rellena este template para cada épica.
> NO modifiques la estructura. Adapta el contenido al contexto de `CONTEXT.md`.

---

## Identificador
**EPIC-XXX**: [Nombre descriptivo de la épica]
**Fase del Roadmap**: [Número de fase de `ROADMAP.md`]
**Duración estimada**: [X horas]
**Prioridad**: 🔴 CRÍTICO / 🟠 ALTO / 🟡 MEDIO
**Estado**: ⏳ Pendiente / 🔄 En progreso / ✅ Completada

---

## 📖 Descripción
[2-3 párrafos: qué es, por qué importa ahora, qué cambia en el producto al terminarla]

---

## 🎯 Objetivo Final
Al completar esta épica, [resultado específico y medible desde la perspectiva del usuario/negocio].

---

## ✅ Criterios de Aceptación
> Todos deben ser verificables manualmente en la app Electron.
- [ ] [Criterio 1: Acción → Resultado esperado]
- [ ] [Criterio 2: Acción → Resultado esperado]
- [ ] [Criterio 3: Acción → Resultado esperado]
- [ ] [TypeScript]: `npx tsc --noEmit` pasa sin errores
- [ ] [Build]: `npm run build` pasa sin warnings

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo Est. | Estado |
|----|-------|---------------|-------------|--------|
| TASK-XXX-001 | [Nombre] | Ninguno | Xh | ⏳ Pendiente |
| TASK-XXX-002 | [Nombre] | TASK-XXX-001 | Xh | ⏳ Pendiente |
| TASK-XXX-003 | [Nombre] | TASK-XXX-001 | Xh | ⏳ Pendiente |
| TASK-XXX-004 | [Nombre] | TASK-XXX-003 | Xh | ⏳ Pendiente |

---

## ⚠️ Dependencias Externas
- [Paquete npm / API / Archivo]: [Para qué se necesita]

---

## 🔍 Notas de Implementación
- [Nota técnica importante 1 — referencia a `ARCHITECTURE.md` si aplica]
- [Nota técnica importante 2]
- [Gotcha o edge case conocido]

---

## 📁 Archivos Modificados / Creados

### Modificados
- [ ] `[ruta/al/archivo]` — [Qué cambia]

### Nuevos
- [ ] `[ruta/al/archivo]` — [Qué hace]

---

## ✅ Checklist de Cierre de Épica
- [ ] Todas las tareas marcadas como completadas
- [ ] `npx tsc --noEmit` sin errores
- [ ] Verificación manual en el checklist de `ACCEPTANCE_CRITERIA.md`
- [ ] Entrada añadida a `docs/BITACORA.md`
- [ ] Estado de épica cambiado a ✅ Completada

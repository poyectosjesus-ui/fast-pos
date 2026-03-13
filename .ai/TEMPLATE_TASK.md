# 📋 TEMPLATE: Tarea Atómica

> **Instrucción para IA:** Rellena este template para cada tarea.
> NO modifiques la estructura. El código debe ser TypeScript estricto, listo para copiar-pegar.
> Consulta `CONTEXT.md` antes de generar ANY código.

---

## Identificador
**TASK-XXX-YYY**: [Nombre descriptivo de la tarea]
**Épica**: EPIC-XXX
**Prerrequisito**: TASK-XXX-ZZZ / Ninguno
**Duración estimada**: X horas
**Prioridad**: 🔴 CRÍTICO / 🟠 ALTO / 🟡 MEDIO
**Estado**: ⏳ Pendiente / 🔄 En progreso / ✅ Completada

---

## 📖 Descripción
[2-3 líneas: qué se hace, por qué, qué problema resuelve]

---

## 🎯 Objetivo
Al completar esta tarea: [resultado específico y medible. Ej: "La función `calculateItemTax` existe en `tax.ts` y pasa los 5 casos de prueba."]

---

## 📝 Pasos de Implementación

### Paso 1: [Nombre de la acción]
**Archivo(s):** `ruta/al/archivo.ts`
[Detalle técnico breve]

### Paso 2: [Nombre de la acción]
**Archivo(s):** `ruta/al/archivo.ts`
[Detalle técnico breve]

### Paso 3: [Nombre de la acción]
**Archivo(s):** `ruta/al/archivo.ts`
[Detalle técnico breve]

---

## 💻 Código Completo

> **IA:** Genera el código completo de CADA archivo. Debe ser copy-paste ready.
> Sigue las convenciones de `CODING_STANDARDS.md` y `ARCHITECTURE.md`.

### [CREAR / MODIFICAR]: `src/ruta/archivo.ts`

```typescript
/**
 * [NOMBRE DEL MÓDULO]
 *
 * Responsabilidad: [Una frase]
 * Fuente de Verdad: [ARCHITECTURE.md §X.Y o fase del roadmap]
 */

// [CÓDIGO COMPLETO AQUÍ]
```

### [MODIFICAR]: `src/main/ipc-handlers.js` (si aplica)

```javascript
// Añadir al final de setupIpcHandlers(), antes del log de cierre:

/**
 * [domain:action] — [Descripción del handler]
 */
ipcMain.handle('[domain:action]', async (event, arg) => {
  try {
    // implementación
    return { success: true };
  } catch (err) {
    console.error('[IPC:[domain:action]]', err.message);
    return { success: false, error: err.message };
  }
});
```

### [MODIFICAR]: `preload.js` (si se añade un handler nuevo)

```javascript
// Añadir en el contextBridge.exposeInMainWorld:
newMethod: (arg) => ipcRenderer.invoke('domain:action', arg),
```

---

## ✅ Criterios de Aceptación
- [ ] [Criterio verificable 1]
- [ ] [Criterio verificable 2]
- [ ] `npx tsc --noEmit` pasa sin errores después de este cambio

---

## 🧪 Testing Manual

```bash
# 1. Iniciar la app en modo desarrollo
npm run dev
# En otra terminal:
npm run electron

# 2. Verificar [ACCIÓN]
# Resultado esperado: [LO QUE DEBES VER]
```

**Checklist de verificación rápida:**
- [ ] [Paso observable 1]
- [ ] [Paso observable 2]
- [ ] No hay errores en la consola de Electron

---

## ⚠️ Notas
- [Posible gotcha o edge case]
- [Referencia a `ACCEPTANCE_CRITERIA.md` relevante]

---

## 📎 Archivos Relacionados
- Siguiente tarea: `TASK-XXX-YYY+1.md`
- Épica: `epics/EPIC-XXX.md`

---

## ✅ Completada
- [ ] Código implementado
- [ ] Testing manual OK
- [ ] `tsc --noEmit` sin errores
- [ ] Estado actualizado en `EPIC-XXX.md`

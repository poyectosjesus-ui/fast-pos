# 📌 EPIC-003: Manejo Local de Imágenes (Bucket Local)

**EPIC-003**: Manejo Local de Imágenes
**Fase del Roadmap**: 3
**Duración estimada**: 4h
**Prioridad**: 🟠 ALTO
**Estado**: ⏳ Pendiente

---

## 📖 Descripción
Actualmente las imágenes se guardan como base64 en IndexedDB/SQLite, lo que infla la DB.
Esta épica mueve las imágenes al filesystem local del usuario (`userData/images/`)
en formato WebP comprimido. La DB solo guarda el nombre del archivo (`uuid.webp`).

---

## 🎯 Objetivo Final
Las imágenes de productos se guardan en disco local y persisten entre reinicios.
La DB SQLite no contiene datos binarios de imágenes.

---

## ✅ Criterios de Aceptación
- [ ] Subir imagen: se comprime a < 40KB y se guarda en `userData/images/`
- [ ] La DB solo guarda el nombre del archivo (ej: `"abc123.webp"`)
- [ ] Al reiniciar la app, las imágenes siguen apareciendo
- [ ] Al borrar un producto, su imagen se borra del filesystem
- [ ] `npx tsc --noEmit` pasa sin errores

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo | Estado |
|----|-------|---------------|--------|--------|
| TASK-003-001 | IPC handlers: `images:save`, `images:delete`, `images:getUrl` | EPIC-001 ✅ | 1h | ⏳ |
| TASK-003-002 | Actualizar `preload.js` con métodos de imágenes | TASK-003-001 | 0.5h | ⏳ |
| TASK-003-003 | Refactorizar `image-processing.ts`: comprimir→base64→Main | TASK-003-002 | 1.5h | ⏳ |
| TASK-003-004 | Usar `getImageUrl` en los componentes de producto | TASK-003-003 | 1h | ⏳ |

---

## 🔍 Notas de Implementación
- `images:save(base64, uuid)` guarda en `{userData}/images/{uuid}.webp`
- `images:getUrl(filename)` retorna `file:///absolute/path/to/uuid.webp`
- Next.js necesita `allowedOrigins` o `webSecurity: false` para cargar URLs `file://`
- La compresión (Canvas → WebP) ocurre en el Renderer ANTES de enviar al Main

---

## 📁 Archivos Modificados / Creados

### Modificados
- [ ] `src/main/ipc-handlers.js` — Añadir handlers de imágenes
- [ ] `preload.js` — Exponer `saveImage`, `getImageUrl`, `deleteImage`
- [ ] `src/lib/image-processing.ts` — Adaptar para enviar base64 al Main
- [ ] `src/components/products/` — Usar `getImageUrl` para renderizar

### Directorios creados en runtime
- [ ] `{userData}/images/` — Creado automáticamente por el handler

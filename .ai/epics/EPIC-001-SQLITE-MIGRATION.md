# 📌 EPIC-001: Migración SQLite Completa

**EPIC-001**: Migración SQLite Completa
**Fase del Roadmap**: 1
**Duración estimada**: 4h
**Prioridad**: 🔴 CRÍTICO
**Estado**: ✅ Completada — 12-Mar-2026

---

## 📖 Descripción
El sistema MVP usaba Dexie (IndexedDB) para backup/restore. La v2.0 migra completamente
a SQLite nativo, añade un sistema de migraciones versionadas (`PRAGMA user_version`),
una tabla de settings globales y limpia el preload de bindings obsoletos.

---

## 🎯 Objetivo Final
Al completar esta épica, la app tiene una base de datos SQLite robusta con esquema versionado
(v1→v3), backup/restore nativo con diálogo de archivo del sistema, y configuración del negocio
persistida en SQLite.

---

## ✅ Criterios de Aceptación
- [x] Migraciones corren automáticamente al abrir la app en versión anterior
- [x] `db:exportSqlite` abre el diálogo nativo de "Guardar como" y genera un `.fastpos.db`
- [x] `db:importSqlite` valida integridad antes de restaurar
- [x] Settings muestra la versión del esquema (`v3`)
- [x] Nueva pestaña "Negocio" en Settings guarda datos en SQLite
- [x] `npx tsc --noEmit` pasa sin errores
- [x] Cero uso de Dexie / `dexie-export-import`

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo Est. | Estado |
|----|-------|---------------|-------------|--------|
| TASK-001-001 | Migraciones versionadas en `database.js` | Ninguno | 1.5h | ✅ |
| TASK-001-002 | Tabla `settings` + handlers IPC `settings:*` | TASK-001-001 | 1h | ✅ |
| TASK-001-003 | `preload.js` v2.0 (bindings limpios) | TASK-001-002 | 0.5h | ✅ |
| TASK-001-004 | `settings/page.tsx` v2.0 (sin Dexie, pestaña Negocio) | TASK-001-003 | 1h | ✅ |

---

## ⚠️ Dependencias Externas
- `better-sqlite3`: API de backup nativa (usada en lugar de copy-file para seguridad en WAL)
- `electron` `dialog`: Para los diálogos nativos de guardado/apertura de archivo

---

## 🔍 Notas de Implementación
- Las migraciones son SIEMPRE aditivas: solo ADD COLUMN o CREATE TABLE, nunca DROP.
- El backup usa `db.backup(targetDb)` de better-sqlite3, que es seguro con WAL activo.
- La restauración crea un backup previo automático (`.pre-restore-<timestamp>.bak`) por seguridad.
- La versión del schema se muestra en la UI como `v3`.

---

## 📁 Archivos Modificados / Creados

### Modificados
- [x] `src/main/database.js` — Reescrito con sistema de migraciones v1→v3
- [x] `src/main/ipc-handlers.js` — 22 handlers: db:*, settings:*, products con IVA, orders:void
- [x] `preload.js` — Limpiado, nuevos bindings v2.0
- [x] `src/app/settings/page.tsx` — Sin Dexie, con AlertDialog, pestaña Negocio

---

## ✅ Checklist de Cierre de Épica
- [x] Todas las tareas completadas
- [x] `npx tsc --noEmit` sin errores
- [x] Verificación manual (Settings funciona)
- [x] Entrada añadida a `docs/BITACORA.md`
- [x] Estado cambiado a ✅ Completada

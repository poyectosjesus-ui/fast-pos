# 📌 EPIC-004: Impresión de Tickets

**EPIC-004**: Impresión de Tickets (Térmica + PDF)
**Fase del Roadmap**: 4
**Duración estimada**: 6h
**Prioridad**: 🔴 CRÍTICO
**Estado**: ⏳ Pendiente

---

## 📖 Descripción
Sin ticket físico, muchos negocios informales no pueden vender legalmente.
Esta épica implementa impresión a impresoras térmicas de 80mm/58mm y
exportación a PDF desde el checkout y desde el historial de ventas.

---

## 🎯 Objetivo Final
Después de una venta exitosa, el cajero puede imprimir un ticket inmediatamente
o descargar el PDF. Desde el historial, cualquier venta puede reimprimirse.

---

## ✅ Criterios de Aceptación
- [ ] Ruta `/ticket?orderId=XXX` renderiza el ticket correctamente en 80mm
- [ ] El ticket muestra: nombre del negocio, RFC, fecha, folio, ítems, IVA, total, pago
- [ ] El botón "Imprimir" en CheckoutDialog abre el diálogo de impresión nativo del OS
- [ ] El botón "Descargar PDF" guarda el PDF en Documentos del usuario
- [ ] El botón de reimprimir funciona desde `/history`
- [ ] `npx tsc --noEmit` pasa sin errores

---

## 📚 Tareas Atómicas

| ID | Tarea | Prerrequisito | Tiempo | Estado |
|----|-------|---------------|--------|--------|
| TASK-004-001 | Ruta `/ticket` con template HTML 80mm | EPIC-002 | 1.5h | ⏳ |
| TASK-004-002 | IPC `ticket:print` con ventana oculta de Electron | TASK-004-001 | 1.5h | ⏳ |
| TASK-004-003 | IPC `ticket:printToPdf` con guardado en Documentos | TASK-004-002 | 1h | ⏳ |
| TASK-004-004 | `PrintTicketButton` en CheckoutDialog y `/history` | TASK-004-002 | 1.5h | ⏳ |
| TASK-004-005 | Sección de impresora en Settings (tamaño de papel) | TASK-004-002 | 0.5h | ⏳ |

---

## 🔍 Notas de Implementación
- Electron usa `BrowserWindow.webContents.print()` para impresión nativa
- La ventana del ticket es invisible (`show: false`) y se cierra al terminar
- Font-mono para alinear columnas. Max 48 chars de ancho para 80mm
- Los datos del negocio (nombre, RFC) se obtienen de `settings` a través de `getAllSettings`
- El IVA desglosado se obtiene del `TaxService` de EPIC-002

---

## 📁 Archivos Modificados / Creados

### Nuevos
- [ ] `src/app/ticket/page.tsx` — Template de ticket (solo HTML/CSS, sin sidebar)
- [ ] `src/components/pos/PrintTicketButton.tsx` — Botón de impresión

### Modificados
- [ ] `src/main/ipc-handlers.js` — Handlers `ticket:print` y `ticket:printToPdf`
- [ ] `preload.js` — Exponer `printTicket`, `printTicketToPdf`
- [ ] `src/app/settings/page.tsx` — Sección de configuración de impresora

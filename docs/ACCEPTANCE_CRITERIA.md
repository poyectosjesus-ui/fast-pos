# ✅ Criterios de Aceptación — Fast-POS

**Versión:** 2.0  
**Última actualización:** 12-Mar-2026  

Todo desarrollo de Fast-POS debe superar los criterios aquí definidos para ser considerado "listo para producción". Este documento es la checklist que se revisa **antes de cerrar cualquier tarea**.

---

## 🔴 CA-CORE: Criterios Universales (Aplican a TODA funcionalidad)

Todo código nuevo DEBE pasar estos criterios sin excepción.

### CA-CORE-1: Integridad de Datos
- [ ] Las operaciones CUD (Crear, Actualizar, Borrar) se ejecutan dentro de una **transacción SQLite atómica**.
- [ ] El stock nunca puede quedar en valor negativo. El servicio verifica disponibilidad **antes** de procesar.
- [ ] Todos los montos monetarios se manejan en **centavos (INTEGER)**. Cero uso de FLOAT/REAL para dinero.
- [ ] Los UUIDs se generan una sola vez en el Renderer (`uuid` library) y son inmutables.

### CA-CORE-2: Validación
- [ ] Todo input de usuario se valida con **Zod** en el Renderer antes de llegar al Main.
- [ ] Los schemas de Zod son la única definición de tipos — no se duplican interfaces TS.
- [ ] Se muestra un mensaje de error amigable (en jerga local) cuando la validación falla.
- [ ] El Main Process rechaza IDs malformados o datos faltantes con un error descriptivo.

### CA-CORE-3: Calidad de Código
- [ ] **Cero uso de `any`** en TypeScript. Si el tipo no existe, se crea en `schema.ts`.
- [ ] Cada archivo tiene un comentario de encabezado con su propósito y la fase del roadmap.
- [ ] El código nuevo no rompe el build (`npm run build` pasa sin errores ni warnings de TypeScript).
- [ ] No quedan `console.log` de debug en el código nuevo (sí se permiten los existentes con prefijo `[TAG]`).

### CA-CORE-4: Arquitectura
- [ ] Los componentes React **nunca** llaman a `window.electronAPI` directamente. Usan servicios.
- [ ] La lógica de negocio (cálculos de IVA, stock, totales) vive en `src/lib/services/`, no en componentes.
- [ ] El Main Process no importa código del Renderer.

### CA-CORE-5: UX / Experiencia de Usuario
- [ ] Toda acción asíncrona (carga, guardado, impresión) tiene un estado de **loading visual**.
- [ ] Las acciones destructivas (borrar, anular) requieren una **confirmación explícita** (AlertDialog, no `window.confirm`).
- [ ] Los mensajes de éxito/error usan **Sonner toasts** con lenguaje local y empático (no tecnicismos).
- [ ] En estado vacío (`empty state`), el componente muestra un mensaje descriptivo con una acción sugerida.

---

## 🛒 CA-POS: Motor de Ventas

### CA-POS-1: Agregar al Carrito
- [ ] Se puede agregar un producto por clic o por escaneo de código de barras.
- [ ] Si el producto ya está en el carrito, incrementa la cantidad.
- [ ] No se puede agregar más unidades que el stock disponible. Muestra alerta si se intenta.
- [ ] Solo productos con `isVisible = true` aparecen en el catálogo del POS.

### CA-POS-2: Checkout
- [ ] El total en pantalla coincide exactamente (centavo a centavo) con lo guardado en la DB.
- [ ] El desglose muestra: Subtotal, IVA (si aplica), Total.
- [ ] El método de pago (Efectivo/Tarjeta) es obligatorio para proceder.
- [ ] Al completar la venta: el stock de cada producto disminuye, la orden se guarda y el carrito se vacía.
- [ ] Si la transacción falla, el stock y la orden NO se modifican (rollback).

### CA-POS-3: Ticket
- [ ] Después de una venta exitosa, aparece botón "Imprimir Ticket".
- [ ] El ticket muestra: nombre del negocio, dirección, fecha, folio, ítems con cantidad y precio, desglose de IVA, total, método de pago.
- [ ] El ticket se puede reimprimir desde el historial de ventas.

---

## 📦 CA-CAT: Catálogo de Productos

### CA-CAT-1: Producto
- [ ] SKU es único en todo el sistema. Se valida al crear y al editar.
- [ ] El precio se ingresa en pesos (con decimales) y se convierte a centavos al guardar.
- [ ] El campo de IVA muestra las opciones: Exento (0%), 8%, 16%, Personalizado.
- [ ] El toggle "IVA incluido en el precio" funciona correctamente.
- [ ] El stock manual (campo editable) y el control +/- funcionan correctamente.
- [ ] Si tiene imagen, se muestra en el catálogo y en el ticket.

### CA-CAT-2: Imágenes
- [ ] La imagen se comprime a < 40KB antes de guardarse.
- [ ] La imagen persiste entre reinicios de la app.
- [ ] Al borrar un producto, su imagen se borra del filesystem.

---

## 💰 CA-TAX: Impuestos

- [ ] Un producto con "IVA incluido" muestra el precio total y el IVA desglosado al momento de vender.
- [ ] Un producto con "IVA agregado" muestra el precio base + el IVA sumado en el total.
- [ ] La tasa de IVA del producto se toma de su configuración individual, no de un global.
- [ ] El IVA global por default se configura en Settings (aplica a productos nuevos).
- [ ] Los cálculos nunca tienen error de redondeo (todo en centavos enteros, usando `Math.round`).

---

## 👤 CA-AUTH: Usuarios y Roles

### CA-AUTH-1: Login
- [ ] La pantalla de PIN aparece al iniciar la app (si ya hay un usuario configurado).
- [ ] Si el PIN es incorrecto, muestra mensaje y bloquea por 3 segundos (anti-brute force básico).
- [ ] El PIN correcto permite el acceso según el rol.

### CA-AUTH-2: Roles
| Ruta | ADMIN | CASHIER |
|------|-------|---------|
| POS (`/`) | ✅ | ✅ |
| Catálogo (`/products`) | ✅ | ❌ |
| Analíticas (`/analytics`) | ✅ | ❌ |
| Historial (`/history`) | ✅ | ✅ (solo ver) |
| Configuración (`/settings`) | ✅ | ❌ |

- [ ] El CASHIER no puede anular órdenes (botón oculto o deshabilitado).
- [ ] El ADMIN puede gestionar usuarios (CRUD) desde Settings.

---

## 🧙 CA-SETUP: Wizard de Configuración

- [ ] El wizard aparece únicamente en el primer lanzamiento (`setup_completed = false`).
- [ ] No se puede saltar ningún paso.
- [ ] El Paso 1 (Licencia) valida la clave antes de avanzar.
- [ ] El Paso 4 (Crear Admin) requiere un PIN de 4 dígitos y su confirmación.
- [ ] Al terminar el wizard, `setup_completed = true` y redirige al Login.

---

## 🔑 CA-LIC: Licenciamiento

- [ ] Una clave inválida siempre muestra error claro: "Clave no válida. Comunícate con soporte."
- [ ] Una clave válida muestra el plan y la fecha de expiración (o "Licencia perpetua").
- [ ] La información de licencia es visible en Settings (pero no editable ahí).
- [ ] Si la licencia expira, el sistema permite el acceso de solo lectura (no puede vender).

---

## 🗄️ CA-DB: Base de Datos y Migraciones

- [ ] Al abrir una DB de versión anterior, las migraciones corren automáticamente sin perder datos.
- [ ] El backup automático se crea al cerrar la app correctamente.
- [ ] El backup manual desde Settings genera un archivo `.fastpos.db` válido con la fecha en el nombre.
- [ ] La restauración de un backup reemplaza la DB y recarga la app.
- [ ] El "Borrado Integral" (Factory Reset) solo es ejecutable por el rol ADMIN y requiere doble confirmación.

---

## 🚫 Criterios de Rechazo Automático

Una tarea se rechaza inmediatamente si:
1. Usa `any` en TypeScript.
2. Tiene un `window.confirm` (debe ser `AlertDialog`).
3. Un componente llama directamente a `window.electronAPI`.
4. Hace operaciones financieras con `float` en lugar de `integer`.
5. No tiene estado de loading en operaciones asíncronas.
6. Rompe el build de TypeScript (`tsc --noEmit`).

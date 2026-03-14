# 🚀 Fast-POS 2.0: Master Plan Detallado (MVP → Premium)

Este plan describe la ejecución técnica para transformar Fast-POS en un producto comercial de alto nivel, respetando la arquitectura nativa de Electron y SQLite.

---

## 📑 Guía de Registro en Bitácora
Cada tarea completada debe registrarse en `bitacora.md` con:
1. **ID de Tarea:** (ej. T1.1.1)
2. **Cambio:** Breve descripción técnica.
3. **Impacto:** Qué mejora para el usuario final.
4. **Validación:** Prueba realizada para confirmar éxito.

---

# 🟥 SPRINT 1: Fundación de Datos (Semana 1)
**Objetivo:** Vincular ventas a usuarios y habilitar el cálculo de utilidades reales.

### 🏗️ ÉPICA 1.1: Auditoría de Personal (Asociación Usuario-Venta)
**Meta:** Que cada ticket tenga un responsable rastreable en la base de datos.

*   **T1.1.1: Migración de Esquema v8**
    *   **Acción:** Editar `src/main/database.js`. Añadir `ALTER TABLE orders ADD COLUMN userId TEXT;` y el índice correspondiente.
    *   **Criterio de Aceptación:** Al ejecutar `PRAGMA table_info(orders);` en un gestor SQLite, debe aparecer la columna `userId`. La app debe arrancar sin errores de migración.
*   **T1.1.2: Refactor de Checkout Handler**
    *   **Acción:** Modificar el handler `orders:checkout` en `src/main/ipc-handlers.js` para recibir `userId`. Validar que si no se envía, se registre como 'SYSTEM' o falle.
    *   **Criterio de Aceptación:** Las nuevas filas en la tabla `orders` deben contener el ID del usuario actual.
*   **T1.1.3: Integración con Session Store**
    *   **Acción:** En `src/components/pos/cart-sidebar.tsx`, extraer el `user.id` desde `useSessionStore` y pasarlo como argumento a la función de cobro.
    *   **Criterio de Aceptación:** Realizar una venta con el usuario "Cajero" y verificar en el Historial que su nombre aparezca vinculado.

### 🏗️ ÉPICA 1.2: Visibilidad Financiera (Márgenes y Ganancias)
**Meta:** Permitir al dueño saber cuánto dinero real está ganando por cada producto.

*   **T1.2.1: Implementación de costPrice**
    *   **Acción:** Añadir columna `costPrice` a la tabla `products` vía migración v8.
*   **T1.2.2: Interfaz de Gestión de Costos**
    *   **Acción:** Actualizar el formulario en `ProductsManager.tsx` para incluir el campo "Costo". Añadir validación visual que advierta si el costo es >= precio.
    *   **Criterio de Aceptación:** Poder guardar un producto con costo $50 y precio $100. Ver el cálculo automático de "50% de margen" en la tabla de inventario.

---

# 🟧 SPRINT 2: UX de Alto Impacto (Semana 2)
**Objetivo:** Mejorar la percepción de calidad y control del sistema.

### 🏗️ ÉPICA 2.1: Semáforo de Inventario (Visual Stock)
**Meta:** Prevenir quiebres de stock mediante alertas visuales cromáticas.

*   **T2.1.1: Hook de Estilos Dinámicos**
    *   **Acción:** Crear una utilidad que devuelva clases de Tailwind basadas en el stock: `danger` (rojo) si <= 5, `warning` (ámbar) si <= límite, `success` (verde) si > límite.
*   **T2.1.2: ProductCard Premium**
    *   **Acción:** Aplicar los estilos al borde del componente `ProductCard`. Añadir un pequeño icono de "Alerta" si el stock es crítico.
    *   **Criterio de Aceptación:** El cajero debe poder identificar visualmente qué productos se van a agotar sin leer los números, solo por el color del borde.

### 🏗️ ÉPICA 2.2: Pulso del Negocio (Real-Time KPIs)
**Meta:** Mostrar estadísticas clave en el dashboard de analítica.

*   **T2.2.1: Handler de Resumen Diario**
    *   **Acción:** Crear un IPC Handler `analytics:getSummary` que devuelva venta total, ganancia neta (usando `costPrice`) y número de tickets del día actual.
*   **T2.2.2: Dashboard de Tarjetas**
    *   **Acción:** Implementar en `AnalyticsPage` 4 componentes `MetricCard` que muestren estos datos.
    *   **Criterio de Aceptación:** Al entrar a "Analítica", los números deben reflejar las ventas hechas hoy de forma instantánea.

---

# 🟨 SPRINT 3: Inteligencia y Flexibilidad (Semana 3)
**Objetivo:** Dotar al sistema de herramientas para promociones y reportes visuales.

### 🏗️ ÉPICA 3.1: Motor de Descuentos
**Meta:** Permitir rebajas controladas en el punto de venta.

*   **T3.1.1: Estado de Descuento en Carrito**
    *   **Acción:** Actualizar `useCartStore` para que cada ítem pueda tener una propiedad `discountAmount`.
*   **T3.1.2: Modal de Descuento Rápido**
    *   **Acción:** Crear un componente que permita aplicar un monto de descuento (ej: -$10) a un ítem específico en el carrito.
    *   **Criterio de Aceptación:** El total del carrito debe bajar automáticamente al aplicar un descuento y el ticket debe reflejar "Descuento: -$XX".

### 🏗️ ÉPICA 3.2: Visualización de Tendencias (Gráficos)
**Meta:** Transformar datos crudos en información estratégica.

*   **T3.2.1: Integración de Recharts**
    *   **Acción:** Implementar un gráfico de líneas que compare las ventas de los últimos 7 días.
    *   **Criterio de Aceptación:** Ver una gráfica que suba y baje según el volumen de ventas diario en la pestaña de Analítica.

---

# 🟣 SPRINT 4: Robustez y Auditoría (Semana 4)
**Objetivo:** Garantizar la seguridad post-venta y la calidad del software.

### 🏗️ ÉPICA 4.1: Sistema de Devoluciones (Void orders)
**Meta:** Permitir corregir errores de dedo con registro forense.

*   **T4.1.1: Refactor de orders:void**
    *   **Acción:** Extender la lógica de anulación para que pida un motivo y registre qué administrador autorizó la devolución.
*   **T4.1.2: Tabla de Auditoría**
    *   **Acción:** Crear tabla `audit_logs` que guarde: fecha, usuario, acción (ej: "VENTA ANULADA"), y monto afectado.
    *   **Criterio de Aceptación:** El dueño puede ver un log de quién borró ventas para evitar fraudes internos.

### 🏗️ ÉPICA 4.2: Aseguramiento de Calidad (Hardware QA)
*   **T4.2.1: Estrés de Impresión**
    *   **Acción:** Realizar pruebas de impresión de tickets con 50+ ítems y validar que el formato no se rompa ni en 58mm ni en 80mm.
*   **T4.2.2: Mock de Base de Datos Grande**
    *   **Acción:** Llenar la BD con 2,000 productos y verificar que el buscador del POS no tenga lag.
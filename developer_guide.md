# 📖 Guía Maestra de Desarrollo - Fast-POS 1.1

Esta guía establece el estándar de oro para el desarrollo del ecosistema Fast-POS. Todo código nuevo debe pasar por este filtro antes de ser aceptado.

---

## 🏛️ 1. Fuente de la Verdad (Source of Truth)
- **Esquema de Datos:** `src/lib/schema.ts` es la autoridad única sobre la estructura de la información.
- **Lógica de Negocio:** Centralizada en `src/lib/services/`. Los componentes de React (UI) **nunca** deben realizar cálculos financieros o consultas a DB directamente.
- **Precios:** La moneda se maneja siempre en **centavos (enteros)** para evitar errores de punto flotante.

## 🛠️ 2. Reglas de Creación de Código
1. **Atomicidad:** Si una función realiza múltiples pasos (ej. crear orden y descontar stock), debe ejecutarse dentro de una transacción SQL.
2. **Tipado Estricto:** Prohibido el uso de `any`. Si un tipo no existe, se crea en `schema.ts`.
3. **Comentarios de Propósito:** Cada archivo y función compleja debe tener un encabezado explicando su "Fuente de Verdad" (referencia al roadmap o plan).
4. **Desacoplamiento:** El Frontend no conoce SQLite. Solo conoce la interfaz `electronAPI`.

## 🚦 3. Reglas de Decisión
- **¿IPC o Local?** Todo lo que persista datos (CUD) va vía IPC a SQLite. Los estados efímeros (UI) van en Zustand/React.
- **¿Better-SQLite3 o Dexie?** En la v1.1, **SQLite es el motor primario**. Dexie queda deprecado para datos de negocio.
- **¿Shadcn o Custom?** Priorizar Shadcn. Solo crear CSS custom si la complejidad visual lo exige (Glassmorphism avanzado).

## 🔀 4. Flujo de Trabajo (Step-by-Step)
Para añadir una nueva funcionalidad:
1. **Definir en Schema:** Actualizar `src/lib/schema.ts` si hay nuevos datos.
2. **Main Progress:** Implementar el handler SQL en `src/main/ipc-handlers.ts`.
3. **Preload:** Exponer el nuevo método en `preload.ts`.
4. **Service:** Crear/Actualizar el servicio en `src/lib/services/`.
5. **UI:** Implementar el componente y llamar al servicio.

## 🛡️ 5. Validaciones y Seguridad
- **Input:** Todo input de usuario se valida con **Zod** en el Frontend.
- **Sanitización:** Los strings para SQL deben pasar por los placeholders nativos de `better-sqlite3` para evitar SQL Injection.
- **Validación Cruzada:** El stock nunca puede ser menor a 0. El servicio debe verificar stock disponible antes de procesar una venta.

## 📈 6. Registro de Cambios y Bitácora
- **Tracking:** Cada sesión de desarrollo debe cerrar con una actualización de `bitacora.md`.
- **Formato:** `| Fecha | Fase | Acción | Resultado |`.
- **Versionamiento:** Seguir SemVer (Major.Minor.Patch).

## 💼 7. Reglas de Negocio Críticas
- **Inventario:** Solo productos marcados como `isVisible` aparecen en el POS.
- **Vtas. de Hoy:** Se calculan en base al `createdAt` del registro de la orden, comparándolo con el inicio del día del sistema.
- **Anulaciones:** Una anulación no borra la orden; cambia su estado a `CANCELLED` y lanza un trigger de recuperación de inventario.

## 🗄️ 8. Esquema SQL Nativo (v1.1)
El motor utiliza `better-sqlite3`. Los esquemas físicos deben coincidir con las interfaces de TypeScript.

### 📦 Tabla: products (Fase 1.4)
```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  categoryId TEXT NOT NULL,
  name TEXT NOT NULL,
  price INTEGER NOT NULL, -- En centavos
  stock INTEGER NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  isVisible INTEGER DEFAULT 1, -- Boolean (0/1)
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT
);
```

### 🧾 Tablas: Ventas (Fase 1.5)
```sql
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  subtotal INTEGER NOT NULL,
  tax INTEGER NOT NULL,
  total INTEGER NOT NULL,
  status TEXT CHECK(status IN ('COMPLETED', 'CANCELLED')) NOT NULL,
  paymentMethod TEXT CHECK(paymentMethod IN ('CASH', 'CARD')) NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId TEXT NOT NULL,
  productId TEXT NOT NULL,
  name TEXT NOT NULL, -- Snapshot del nombre
  price INTEGER NOT NULL, -- Snapshot del precio
  quantity INTEGER NOT NULL,
  subtotal INTEGER NOT NULL,
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);
```

---
> **Nota:** Esta guía es dinámica. Cualquier desviación debe ser justificada en la Bitácora.

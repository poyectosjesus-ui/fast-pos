# Manual de Usuario: Fast-POS 2.0

Bienvenido al Manual de Usuario de **Fast-POS 2.0**.
Este documento describe detalladamente la arquitectura visual del sistema, organizado por módulos, pantallas, pestañas y modales operativos para que cualquier cajero, operador o gerente pueda sacarle el máximo provecho al Punto de Venta offline-first.

---

## 🔒 1. Pantalla de Acceso (Login)
El punto de entrada al sistema. Mantiene la seguridad de la información limitando el acceso sin internet.
- **Selector de Cajero/Usuario:** Permite seleccionar visualmente quién está operando la caja.
- **PIN de Acceso:** Teclado numérico de 4 a 6 dígitos (o alfanumérico) privado.

---

## 🛒 2. Terminal de Punto de Venta (Dashboard Principal)
El corazón de la aplicación. Operará el 90% del tiempo aquí.

### Componentes de la Vista Principal:
- **Barra de Búsqueda Universal:** Escáner preparado para pistolas de Código de Barras o búsqueda manual por nombre/SKU de producto.
- **Pestaña Top Ventas / Catálogo Rapido:** Cuadrícula de productos ilustrados con imágenes que el cajero puede tocar rápidamente (pantallas táctiles).
- **Panel Base de Carrito (Panel Derecho):**
  - Lista interactiva de productos escaneados (permite suma/resta de cantidades e insumos).
  - Subtotales, Impuestos (si aplican) y Total en tiempo real.
  - **Botón VACIAR CAJA:** Limpia la orden en curso instantáneamente.

### 💰 Modales asociados:
1. **Modal de Checkout (Cobro Final):** Aparece al pulsar "Cobrar". Se divide en pestañas dinámicas dependiendo del método de cobro:
   - *Pestaña Efectivo:* Cuadros rápidos de billetes comunes ($50, $100, $500) y cálculo automático de **Cambio a devolver**.
   - *Pestaña Tarjeta/Transferencia:* Módulos directos sin cálculo de cambio.
   - *Pestaña A Crédito (Fiado):* Selector de cliente en directorio + campo opcional de "Anticipo de Pago" para enganches.
2. **Pantalla Post-Venta (Recibo Físico/Digital):** Ventana de éxito que permite arrojar automáticamente 2 salidas:
   - *Boucher Local:* Impresión directa térmica a terminal 80/58mm.
   - *Nota de Venta A4:* Exportación nativa y bella a PDF para WhatsApp.

---

## 📦 3. Catálogo de Inventario (`/products`)
Lugar donde los administradores y gerentes controlan el stock.

### Pestañas de Sub-Navegación:
- **Productos:** Tabla maestra con código de barras, fotografía, existencias, costo mayorista y precio de venta unitario.
- **Familias / Categorías:** Administrador de los departamentos del negocio (Abarrotes, Refrescos, Papelería).
- **Unidades de Medida:** Creador de métricas personalizadas (Pieza, Kg, Litro, Caja, Docena).

### Modales Asociados:
- **Modal Nuevo Producto:** Formulario dinámico con subida de imagen recortable (Bucket interno), inventariado ciego y asignación de códigos.
- **Modal de Generación de Etiquetas:** Creador de etiquetas masivas con precio.

---

## 👥 4. Directorio de Clientes y Deudores (`/customers`)
Módulo financiero para control de cuentas por cobrar.

### Componentes:
- **Tabla de Clientes:** Muestra las credenciales de contacto y el **Saldo Pendiente (Deuda)** global e histórico de cada uno.

### Modales Asociados:
- **Modal Crear Cliente:** Alta rápida (Nombre, Teléfono, Correo, Límite de Crédito).
- **Modal "Abonar / Pagar Deuda":** Al dar clic en un cliente endeudado, arroja un mini-POS para ingresar dinero físico o digital que salda parcialmente o totalmente lo que deba el cliente.

---

## 🧾 5. Historial de Tickets (`/history`)
Bitácora viva de todo el movimiento transaccional sin opción a eliminación engañosa.

### Componentes:
- **Filtro de Fechas y Búsqueda:** Selector visual para rastrear ventas de la semana pasada, o ubicar el folio `TKT-XXX`.
- **Tabla de Recibos:** Estatus verde (PAGADO) y Estatus rojo (NULO/CANCELADO).

### Modales Asociados:
- **Visor de Ticket:** Despliega el bloque térmico original o el diseño A4 de aquel día, permite volver a re-imprimir o guardar el PDF si hubo fallas mecánicas de la impresora en su tiempo.
- **Modal "Anular / Cancelar":** Restituye el inventario y descuadra los ingresos formalmente bajo una justificación.

---

## 💵 6. Corte de Caja y Turnos (`/cash-registers`)
El salvavidas del final del día laboral.

### Componentes:
- **Dashboard de Turno Actual:** Contabiliza el flujo total sin necesidad de sumar tickets. Ventas, Ganancia Neta aproximada y desgloses por método de pago.
- **Tabla Lógica de Movimientos Diarios:** Historial encriptado que no se puede borrar hasta el Cierre Temporal.

### Modales Asociados:
- **Modal Movimiento de Efectivo (Ingreso / Retiro):** Permite anotar "Fondo inicial", "Salida para garrafón", "Retiro Gerencial", etc., para que el cajón jamás descuadre céntimos.
- **Cierre Z-Report (Impresión Final):** Produce el famoso comprobante Ciego Térmico o Reporte PDF analítico demostrando matemáticamente que los cajeros entregan cuentas claras.

---

## 📈 7. Cuaderno de Analíticas (`/analytics`)
Módulo exclusivo para directivos donde el SQLite extrae el poder offline.

### Pestañas / Pantallas Relevantes:
- **Rendimiento General:** Diagramas de Barras ilustrados mapeando ventas semanales/mensuales (Top Ventas, Top Categorías que dejan más ROI).
- **Alerta de Stock Mínimo:** Vista enfocada en alertar qué productos hay que comprarle urgentemente al proveedor.

---

## 🔍 8. Auditoría Forense (`/audit`)
La "caja negra" del negocio. Todo click dudoso es rastreado.

- **Datalog Logger:** Tabla técnica con Timestamps y Operador que lista acciones silenciosas como (Inicios de Sesión fuera de hora, Corrección de Precios oculta, Borrado de Usuarios).

---

## ⚙️ 9. Configuraciones Administrativas (`/settings`)
Panel de control de infraestructura pesada. Dividido sutilmente mediante Menú lateral:

### Pestañas Fijas:
1. **Detalles del Negocio:** Personalización del branding (Nombre Fantasía, RFC fiscal, Mensaje de Cortesía, Ligas a Instagram/Facebook).
2. **Cajón y Hardware:** Configuración estricta de Periféricos:
   - Configuración de Impresora Principal (Sincronizada con el driver del SO).
   - *Apertura de Cajón Electrónico (Cash Drawer Command).*
   - *Tamaño del Ticket Papel (58mm / 80mm).*
   - *Estilo de Recibos (Gráfico / Texto Plano).*
3. **Mantenimiento y Respaldo de Base de Datos:** 
   - Exportador universal `.json/.bak` (Rescate manual).
   - "Botón de Pánico" para reinicio de fábrica (Purga total SQLite validada por contraseña extrema).
4. **Licencia y Acerca de:** Diagnóstico del ID Máquina, Estado de la "FastKey" y vigencia de uso vitalicio/mensual del sistema.

---
*Fin del Documento Estructural.*

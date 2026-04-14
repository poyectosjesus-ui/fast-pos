# Registro de Cambios (Changelog) - Fast-POS

Todos los cambios notables en este proyecto se documentarán en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [No Liberado (Unreleased)]

## [2.0.0] - 2026-04-14 (The "Cloud & Hardware" Update)

### Añadido
- **Motor Multi-Arquitectura:** Soporte universal nativo para compilación híbrida (`x64`, `arm64`, `ia32`). Compatible con Windows OS viejo/nuevo y macOS Intel/M-Series.
- **OTA (Over The Air):** Sistema automático `electron-updater` con notificación silenciosa de descargas en segundo plano.
- **Configuración OTA:** Un panel nativo de UI en `Configuración > General` para activar o desactivar la búsqueda automática de nuevas versiones.
- **Formatos de Impresión Dual:** Compatibilidad para la estructuración de ticket físico en formato recibo continuo.
- **Respaldos en la Nube Reales (Google Drive):** Flujo de OAuth2 persistente y un generador local oculto (`.fastpos`) garantizando un "Bring Your Own Drive" seguro para cada cajero.
- **Corte Z Inteligente:** Cálculo a gran altitud, arqueo ciego, registro auditable y forzado del Cloud Backup al finalizar el corte.
- **Múltiples Métodos de Pago:** Soporte y desglose avanzado para divisiones de pagos (Efectivo/Tarjeta/Transferencia) y proyecciones de MSIs.

### Cambiado
- Motor Database de Dexie migrado 100% a **SQLite3 local** con WAL.

### Eliminado
- Dependencias legacy de React Hooks que causaban fallas en la red renderizadora de SSR de Next.js.

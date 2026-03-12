/**
 * ============================================================================
 * PRELOAD SCRIPT - FAST-POS
 * Optimizado para Next.js + Dexie (IndexedDB)
 * ============================================================================
 * 
 * Expone API segura para comunicación IPC entre Next.js y Electron
 */

const { contextBridge, ipcRenderer } = require("electron");

/**
 * API segura expuesta a Next.js
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ========================================================================
  // RUTAS Y SISTEMA
  // ========================================================================

  /**
   * Obtener rutas importantes del sistema
   */
  getPaths: () => ipcRenderer.invoke("get-paths"),

  /**
   * Obtener información del sistema
   */
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // ========================================================================
  // SINCRONIZACIÓN OFFLINE-FIRST (Dexie)
  // ========================================================================

  /**
   * Exportar base de datos Dexie a JSON
   * Útil para backups
   */
  exportDatabase: (dbExportData) =>
    ipcRenderer.invoke("export-database", dbExportData),

  /**
   * Importar base de datos desde JSON
   */
  importDatabase: () => ipcRenderer.invoke("import-database"),

  /**
   * Sincronizar con servidor (si hay conexión)
   */
  syncWithServer: (data) =>
    ipcRenderer.invoke("sync-with-server", data),

  // ========================================================================
  // DIÁLOGOS
  // ========================================================================

  /**
   * Mostrar diálogo de confirmación
   * Retorna: 0 = Cancelar, 1 = Aceptar
   */
  showConfirmDialog: (title, message, buttons = ["Cancelar", "Aceptar"]) =>
    ipcRenderer.invoke("show-confirm-dialog", {
      title,
      message,
      buttons,
      type: "question",
    }),

  /**
   * Mostrar diálogo de información
   */
  showInfoDialog: (title, message, type = "info") =>
    ipcRenderer.invoke("show-info-dialog", {
      title,
      message,
      type,
    }),

  // ========================================================================
  // REPORTES Y EXPORTACIÓN
  // ========================================================================

  /**
   * Generar y guardar reporte
   */
  generateReport: (reportData) =>
    ipcRenderer.invoke("generate-report", reportData),

  // ========================================================================
  // IMPRESIÓN
  // ========================================================================

  /**
   * Obtener lista de impresoras disponibles
   */
  getPrinters: () => ipcRenderer.invoke("get-printers"),

  /**
   * Imprimir contenido
   */
  print: (options = {}) => ipcRenderer.invoke("print", options),

  // ========================================================================
  // LISTENERS DE EVENTOS (Opcional)
  // ========================================================================

  /**
   * Escuchar cambios de conexión
   */
  onOnlineStatusChanged: (callback) => {
    window.addEventListener("online", () => callback(true));
    window.addEventListener("offline", () => callback(false));
  },

  // ========================================================================
  // LOGGING
  // ========================================================================

  /**
   * Log personalizado desde Next.js
   */
  log: (message, level = "info") => {
    console.log(`[${level.toUpperCase()}] ${message}`);
  },
});

/**
 * Interceptar logs de Next.js y enviarlos a consola de Electron
 */
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  originalLog(...args);
  // Los logs se verán en la consola de Electron en desarrollo
};

console.error = (...args) => {
  originalError(...args);
};

/**
 * Detectar estado de conexión
 */
window.addEventListener("online", () => {
  console.log("[NETWORK] Conexión restaurada");
});

window.addEventListener("offline", () => {
  console.log("[NETWORK] Conexión perdida - modo offline");
});

console.log("[Preload] Script cargado correctamente");
console.log("[Preload] electronAPI disponible en window.electronAPI");
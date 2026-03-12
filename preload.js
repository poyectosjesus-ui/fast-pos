/**
 * ============================================================================
 * PRELOAD SCRIPT - FASTPOS
 * ============================================================================
 * 
 * Este script actúa como puente seguro entre el proceso principal (main)
 * y el proceso renderer (React app).
 * 
 * Usa contextBridge para exponer solo los métodos necesarios,
 * manteniendo aislado el contexto de Node.js del renderer.
 * 
 * Seguridad: Se ejecuta con permisos de Node pero en contexto aislado
 */

const { contextBridge, ipcRenderer } = require("electron");

// ============================================================================
// VALIDACIÓN DE ENTRADA
// ============================================================================

/**
 * Valida que los parámetros de entrada sean seguros
 * Previene inyección de código
 */
function validateInput(input, type = "string") {
  if (type === "string") {
    if (typeof input !== "string") {
      throw new Error("Input debe ser string");
    }
    // Evitar inyección HTML
    return input.replace(/[<>]/g, "");
  }

  if (type === "number") {
    const num = Number(input);
    if (isNaN(num)) {
      throw new Error("Input debe ser número");
    }
    return num;
  }

  if (type === "object") {
    if (typeof input !== "object" || input === null) {
      throw new Error("Input debe ser objeto");
    }
    return input;
  }

  return input;
}

// ============================================================================
// CONTEXT BRIDGE - API SEGURA
// ============================================================================

/**
 * Expone una API segura desde el main process al renderer process
 * Esto permite que React llame funciones del proceso principal de forma segura
 */
contextBridge.exposeInMainWorld("electronAPI", {
  // ========================================================================
  // INFORMACIÓN DEL SISTEMA
  // ========================================================================

  /**
   * Obtiene información del sistema
   * @returns {Promise<Object>} Información del sistema
   * 
   * Uso en React:
   * const sysInfo = await window.electronAPI.getSystemInfo();
   */
  getSystemInfo: () => {
    console.log("[Preload] Solicitando información del sistema");
    return ipcRenderer.invoke("get-system-info");
  },

  // ========================================================================
  // CONTROL DE APLICACIÓN
  // ========================================================================

  /**
   * Cierra la aplicación de forma segura
   * @returns {Promise<void>}
   * 
   * Uso en React:
   * await window.electronAPI.closeApp();
   */
  closeApp: () => {
    console.log("[Preload] Cerrando aplicación");
    return ipcRenderer.invoke("close-app");
  },

  /**
   * Obtiene la ruta donde se almacenan los datos del usuario
   * Útil para guardar configuraciones locales, BD local, etc.
   * @returns {Promise<string>} Ruta del directorio de datos
   * 
   * Uso en React:
   * const dataPath = await window.electronAPI.getUserDataPath();
   */
  getUserDataPath: () => {
    console.log("[Preload] Obteniendo ruta de datos del usuario");
    return ipcRenderer.invoke("get-user-data-path");
  },

  // ========================================================================
  // DIÁLOGOS
  // ========================================================================

  /**
   * Muestra un diálogo de error al usuario
   * @param {string} title - Título del diálogo
   * @param {string} message - Mensaje de error
   * @returns {Promise<void>}
   * 
   * Uso en React:
   * await window.electronAPI.showErrorDialog("Error", "No se pudo guardar");
   */
  showErrorDialog: (title, message) => {
    title = validateInput(title, "string");
    message = validateInput(message, "string");
    console.log(`[Preload] Mostrando diálogo de error: ${title}`);
    return ipcRenderer.invoke("show-error-dialog", title, message);
  },

  /**
   * Muestra un diálogo de éxito al usuario
   * @param {string} title - Título del diálogo
   * @param {string} message - Mensaje de éxito
   * @returns {Promise<void>}
   * 
   * Uso en React:
   * await window.electronAPI.showSuccessDialog("Éxito", "Venta guardada");
   */
  showSuccessDialog: (title, message) => {
    title = validateInput(title, "string");
    message = validateInput(message, "string");
    console.log(`[Preload] Mostrando diálogo de éxito: ${title}`);
    return ipcRenderer.invoke("show-success-dialog", title, message);
  },

  // ========================================================================
  // OPERACIONES DE VENTA (POS)
  // ========================================================================

  /**
   * Guarda una venta en la base de datos
   * @param {Object} saleData - Datos de la venta
   * @returns {Promise<Object>} Resultado de la operación
   * 
   * Formato esperado de saleData:
   * {
   *   items: [{product_id, quantity, price, subtotal}],
   *   total: 1000,
   *   tax: 160,
   *   discount: 0,
   *   payment_method: "cash",
   *   customer_id: 123,
   *   timestamp: "2024-01-15T10:30:00Z"
   * }
   * 
   * Uso en React:
   * const result = await window.electronAPI.saveSale(saleData);
   */
  saveSale: (saleData) => {
    try {
      saleData = validateInput(saleData, "object");
      console.log("[Preload] Guardando venta", saleData);
      return ipcRenderer.invoke("save-sale", saleData);
    } catch (error) {
      console.error("[Preload] Error validando datos de venta:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Obtiene el historial de ventas
   * @param {Object} filters - Filtros opcionales {dateFrom, dateTo, customerId, status}
   * @returns {Promise<Object>} {success, sales: []}
   * 
   * Uso en React:
   * const history = await window.electronAPI.getSalesHistory({
   *   dateFrom: "2024-01-01",
   *   dateTo: "2024-01-31"
   * });
   */
  getSalesHistory: (filters = {}) => {
    try {
      filters = validateInput(filters, "object");
      console.log("[Preload] Obteniendo historial de ventas", filters);
      return ipcRenderer.invoke("get-sales-history", filters);
    } catch (error) {
      console.error("[Preload] Error validando filtros:", error);
      return { success: false, error: error.message };
    }
  },

  // ========================================================================
  // IMPRESIÓN (POS)
  // ========================================================================

  /**
   * Imprime un recibo
   * @param {Object} saleData - Datos de la venta a imprimir
   * @returns {Promise<boolean>} True si se imprimió exitosamente
   * 
   * Uso en React:
   * const printed = await window.electronAPI.printReceipt(saleData);
   */
  printReceipt: (saleData) => {
    try {
      saleData = validateInput(saleData, "object");
      console.log("[Preload] Enviando a imprimir recibo");
      return ipcRenderer.invoke("print-receipt", saleData);
    } catch (error) {
      console.error("[Preload] Error al imprimir:", error);
      return Promise.reject(error);
    }
  },

  // ========================================================================
  // EVENTOS Y LISTENERS
  // ========================================================================

  /**
   * Escucha cambios en los productos (sincronización en tiempo real)
   * @param {Function} callback - Función a ejecutar cuando cambien los productos
   * 
   * Uso en React:
   * useEffect(() => {
   *   window.electronAPI.onProductsChanged((newProducts) => {
   *     setProducts(newProducts);
   *   });
   * }, []);
   */
  onProductsChanged: (callback) => {
    if (typeof callback !== "function") {
      throw new Error("Callback debe ser una función");
    }
    console.log("[Preload] Escuchando cambios de productos");
    ipcRenderer.on("products-changed", (event, data) => {
      callback(data);
    });
  },

  /**
   * Deja de escuchar cambios en productos
   */
  offProductsChanged: () => {
    console.log("[Preload] Dejando de escuchar cambios de productos");
    ipcRenderer.removeAllListeners("products-changed");
  },

  /**
   * Escucha cambios en las ventas
   * @param {Function} callback - Función a ejecutar cuando cambien las ventas
   */
  onSalesUpdated: (callback) => {
    if (typeof callback !== "function") {
      throw new Error("Callback debe ser una función");
    }
    console.log("[Preload] Escuchando actualizaciones de ventas");
    ipcRenderer.on("sales-updated", (event, data) => {
      callback(data);
    });
  },

  /**
   * Deja de escuchar cambios en ventas
   */
  offSalesUpdated: () => {
    console.log("[Preload] Dejando de escuchar actualizaciones de ventas");
    ipcRenderer.removeAllListeners("sales-updated");
  },

  // ========================================================================
  // CONFIGURACIÓN
  // ========================================================================

  /**
   * Obtiene las configuraciones de la aplicación
   * @returns {Promise<Object>} Configuraciones
   * 
   * Ejemplo de respuesta:
   * {
   *   storeName: "Mi Tienda",
   *   taxRate: 0.16,
   *   currency: "MXN",
   *   theme: "dark"
   * }
   */
  getConfig: () => {
    console.log("[Preload] Obteniendo configuración");
    return ipcRenderer.invoke("get-config");
  },

  /**
   * Actualiza las configuraciones de la aplicación
   * @param {Object} config - Nuevas configuraciones
   * @returns {Promise<Object>} Configuraciones actualizadas
   * 
   * Uso en React:
   * await window.electronAPI.updateConfig({ theme: "light" });
   */
  updateConfig: (config) => {
    try {
      config = validateInput(config, "object");
      console.log("[Preload] Actualizando configuración", config);
      return ipcRenderer.invoke("update-config", config);
    } catch (error) {
      console.error("[Preload] Error validando configuración:", error);
      return Promise.reject(error);
    }
  },

  // ========================================================================
  // LOGGING (Para debugging)
  // ========================================================================

  /**
   * Envía un log al proceso principal
   * Útil para debugging en producción
   * @param {string} message - Mensaje a registrar
   * @param {string} level - Nivel del log (log, warn, error)
   */
  log: (message, level = "log") => {
    ipcRenderer.send("log-message", { level, message, timestamp: new Date().toISOString() });
  },
});

// ============================================================================
// LOGGING GLOBAL
// ============================================================================

/**
 * Intercepta logs de la app React y los envía al proceso principal
 * Permite debugging en producción sin abrir DevTools
 */
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args) => {
  originalLog(...args);
  ipcRenderer.send("log-message", {
    level: "log",
    args: args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ),
    timestamp: new Date().toISOString(),
  });
};

console.warn = (...args) => {
  originalWarn(...args);
  ipcRenderer.send("log-message", {
    level: "warn",
    args: args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ),
    timestamp: new Date().toISOString(),
  });
};

console.error = (...args) => {
  originalError(...args);
  ipcRenderer.send("log-message", {
    level: "error",
    args: args.map(arg =>
      typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ),
    timestamp: new Date().toISOString(),
  });
};

// ============================================================================
// SEGURIDAD - PREVENTIVOS
// ============================================================================

/**
 * Bloquea intentos de navegar a URLs externas
 */
window.addEventListener("beforeunload", (event) => {
  console.warn("[Preload] Intento de navegación bloqueada");
  // Permitir navegación normal en desarrollo
  if (process.env.NODE_ENV === "production") {
    event.preventDefault();
    event.returnValue = "";
  }
});

/**
 * Bloquea acceso a ciertas APIs globales peligrosas
 */
window.eval = undefined;
window.Function = undefined;
window.setTimeout = window.setTimeout; // Permitir setTimeout necesario

/**
 * Log de inicialización
 */
console.log("[Preload] Script preload cargado correctamente");
console.log("[Preload] electronAPI expuesta al renderer");
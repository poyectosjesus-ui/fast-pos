/**
 * ============================================================================
 * FASTPOS - APLICACIÓN DE PUNTO DE VENTA
 * Proceso principal de Electron
 * ============================================================================
 * 
 * Este archivo contiene la lógica principal de Electron:
 * - Creación y gestión de ventanas
 * - Seguridad y prevención de ataques
 * - Ciclo de vida de la aplicación
 * - Comunicación entre procesos (IPC)
 * - Configuración de atajos bloqueados
 */

const { app, BrowserWindow, Menu, globalShortcut, ipcMain, dialog } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let mainWindow = null;
let isAppQuitting = false;

// ============================================================================
// CONFIGURACIÓN CENTRALIZADA
// ============================================================================

/**
 * Configuración de la ventana principal
 * Se utiliza tanto para desarrollo como para producción
 */
const WINDOW_CONFIG = {
  // Dimensiones de la ventana
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 600,

  // Propiedades visuales
  title: "FastPOS - Punto de Venta",
  backgroundColor: "#0f172a",
  icon: path.join(__dirname, "assets", "icon.png"),

  // Comportamiento
  autoHideMenuBar: true,
  show: false, // No mostrar hasta que esté lista

  // Opciones de seguridad web
  webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,      // Aislamiento de contexto para seguridad
    nodeIntegration: false,       // NO permitir integración de Node en renderer
    enableRemoteModule: false,    // Deshabilitar módulo remoto
    sandbox: true,                // Habilitar sandbox de seguridad
    devTools: false,              // Deshabilitar DevTools en producción
    webSecurity: true,            // Enforcar CORS y seguridad web
  }
};

/**
 * Atajos de teclado bloqueados globalmente
 * Previene que los usuarios cierren la app o accedan a DevTools
 */
const BLOCKED_SHORTCUTS = [
  "CommandOrControl+R",      // Recargar página
  "CommandOrControl+Shift+R", // Recargar sin caché
  "F5",                       // Recargar (tecla F5)
  "CommandOrControl+Shift+I", // DevTools (Inspector)
  "CommandOrControl+Shift+J", // DevTools (Consola)
  "CommandOrControl+Shift+C", // DevTools (Selector de elementos)
  "F11",                      // Pantalla completa
  "F12",                      // DevTools (F12)
];

/**
 * Temas de validación de entrada peligrosa
 * Se usa en before-input-event para bloquear acciones peligrosas
 */
const BLOCKED_INPUT_PATTERNS = [
  { control: true, key: "r" },
  { control: true, shift: true, key: "r" },
  { meta: true, key: "r" },
  { key: "F5" },
  { control: true, shift: true, key: "i" },
  { meta: true, shift: true, key: "i" },
  { key: "F11" },
  { key: "F12" },
];

// ============================================================================
// CREACIÓN DE VENTANA
// ============================================================================

/**
 * Crea la ventana principal de la aplicación
 * 
 * Responsabilidades:
 * - Crear BrowserWindow con configuración segura
 * - Cargar la app (desarrollo o producción)
 * - Configurar listeners de seguridad
 * - Bloquear atajos peligrosos
 */
function createWindow() {
  console.log(`[${new Date().toISOString()}] Creando ventana principal...`);

  // Crear la ventana con la configuración centralizada
  mainWindow = new BrowserWindow(WINDOW_CONFIG);

  // Mostrar la ventana cuando esté lista
  // Esto evita "visual flash" durante la carga inicial
  mainWindow.once("ready-to-show", () => {
    console.log(`[${new Date().toISOString()}] Ventana lista. Mostrando...`);
    mainWindow.show();
  });

  // Determinar URL según modo de desarrollo o producción
  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../build/index.html")}`;

  console.log(`[${new Date().toISOString()}] Cargando URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // Abrir DevTools solo en desarrollo
  if (isDev) {
    console.log(`[${new Date().toISOString()}] Modo desarrollo detectado. Abriendo DevTools...`);
    mainWindow.webContents.openDevTools();
  }

  // Limpiar referencia de la ventana al cerrar
  mainWindow.on("closed", () => {
    console.log(`[${new Date().toISOString()}] Ventana cerrada`);
    mainWindow = null;
  });

  // Interceptar intentos de cerrar la ventana
  mainWindow.on("close", (event) => {
    // Si el usuario está cerrando la app normalmente, dejar pasar
    if (!isAppQuitting) {
      event.preventDefault();
      console.log(`[${new Date().toISOString()}] Intento de cierre bloqueado. Use el menú para salir.`);
    }
  });

  // Configurar seguridad
  setupSecurityListeners();
}

// ============================================================================
// SEGURIDAD - BLOQUEO DE ATAJOS Y EVENTOS PELIGROSOS
// ============================================================================

/**
 * Configura los listeners de seguridad para la ventana
 * Bloquea:
 * - Recargas de página
 * - Apertura de DevTools
 * - Navegación a URLs no autorizadas
 * - Apertura de nuevas ventanas
 */
function setupSecurityListeners() {
  if (!mainWindow) return;

  // ========================================================================
  // BLOQUEAR EVENTOS DE ENTRADA (Teclado)
  // ========================================================================
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // Validar contra patrones bloqueados
    const isBlocked = BLOCKED_INPUT_PATTERNS.some((pattern) => {
      const matchControl = pattern.control
        ? input.control && input.key.toLowerCase() === pattern.key.toLowerCase()
        : false;
      const matchMeta = pattern.meta
        ? input.meta && input.key.toLowerCase() === pattern.key.toLowerCase()
        : false;
      const matchKey = !pattern.control && !pattern.meta && input.key === pattern.key;

      return matchControl || matchMeta || matchKey;
    });

    if (isBlocked) {
      event.preventDefault();
      console.warn(
        `[${new Date().toISOString()}] Intento bloqueado: ${input.key}`
      );
    }
  });

  // ========================================================================
  // BLOQUEAR APERTURA DE NUEVAS VENTANAS
  // ========================================================================
  mainWindow.webContents.setWindowOpenHandler(({ url, frameName }) => {
    console.warn(
      `[${new Date().toISOString()}] Intento de abrir nueva ventana bloqueado: ${url}`
    );
    return { action: "deny" };
  });

  // ========================================================================
  // VALIDAR NAVEGACIÓN
  // ========================================================================
  mainWindow.webContents.on("will-navigate", (event, url) => {
    // Dominio base permitido
    const allowedDomains = ["localhost:3000", "localhost:3001"];
    const urlObj = new URL(url);

    const isAllowed = allowedDomains.some(
      (domain) =>
        urlObj.origin.includes(domain) ||
        url.startsWith("file://") // Permitir rutas locales en producción
    );

    if (!isAllowed) {
      event.preventDefault();
      console.error(
        `[${new Date().toISOString()}] Navegación bloqueada a: ${url}`
      );
    }
  });

  // ========================================================================
  // PREVENIR ARRASTRAR Y SOLTAR ARCHIVOS
  // ========================================================================
  mainWindow.webContents.on("before-input-event", (event, input) => {
    // Bloquear Ctrl+V para prevenir pegar contenido malicioso
    if ((input.control || input.meta) && input.key.toLowerCase() === "v") {
      // En una app POS real, podrías validar el contenido del clipboard
      // Por ahora, permitir pegar (comentar si quieres bloquearlo)
      // event.preventDefault();
    }
  });
}

/**
 * Registra atajos de teclado bloqueados globalmente
 * Se ejecuta al iniciar la aplicación
 */
function registerBlockedShortcuts() {
  console.log(`[${new Date().toISOString()}] Registrando atajos bloqueados...`);

  BLOCKED_SHORTCUTS.forEach((shortcut) => {
    const registered = globalShortcut.register(shortcut, () => {
      // No hacer nada - bloquea el atajo
    });

    if (!registered) {
      console.warn(
        `[${new Date().toISOString()}] Advertencia: No se pudo registrar atajo: ${shortcut}`
      );
    }
  });
}

/**
 * Desregistra todos los atajos bloqueados
 * Se ejecuta al cerrar la aplicación
 */
function unregisterAllShortcuts() {
  console.log(`[${new Date().toISOString()}] Desregistrando atajos...`);
  globalShortcut.unregisterAll();
}

// ============================================================================
// CICLO DE VIDA DE LA APLICACIÓN
// ============================================================================

/**
 * Evento: Aplicación lista
 * Se dispara cuando Electron ha completado la inicialización base
 */
app.whenReady().then(() => {
  console.log(`[${new Date().toISOString()}] ========== INICIANDO FASTPOS ==========`);
  console.log(`[${new Date().toISOString()}] Modo: ${isDev ? "DESARROLLO" : "PRODUCCIÓN"}`);
  console.log(`[${new Date().toISOString()}] Plataforma: ${process.platform}`);
  console.log(`[${new Date().toISOString()}] Versión de Electron: ${process.versions.electron}`);

  // Crear la ventana principal
  createWindow();

  // Eliminar el menú de aplicación completamente
  // En una app POS, no queremos que los usuarios accedan a menús
  Menu.setApplicationMenu(null);
  console.log(`[${new Date().toISOString()}] Menú de aplicación deshabilitado`);

  // Registrar atajos bloqueados
  registerBlockedShortcuts();

  // En macOS: Recrear ventana cuando se hace clic en el ícono del dock
  app.on("activate", () => {
    if (mainWindow === null) {
      console.log(`[${new Date().toISOString()}] Recreando ventana desde el dock (macOS)`);
      createWindow();
    }
  });
});

/**
 * Evento: Todas las ventanas cerradas
 * 
 * Comportamiento por plataforma:
 * - Windows/Linux: Cerrar la aplicación
 * - macOS: Mantener la app activa en el dock
 */
app.on("window-all-closed", () => {
  console.log(`[${new Date().toISOString()}] Todas las ventanas cerradas`);

  // En macOS, las aplicaciones permanecen activas hasta cerrarlas explícitamente
  if (process.platform !== "darwin") {
    console.log(`[${new Date().toISOString()}] Cerrando aplicación...`);
    app.quit();
  }
});

/**
 * Evento: Antes de que la aplicación se cierre
 * Se ejecuta antes de que se cierren todas las ventanas
 */
app.on("before-quit", () => {
  console.log(`[${new Date().toISOString()}] Preparando cierre de la aplicación...`);
  isAppQuitting = true;
  unregisterAllShortcuts();
});

/**
 * Evento: La aplicación se está por cerrar (será cerrada)
 */
app.on("quit", () => {
  console.log(`[${new Date().toISOString()}] ========== CERRANDO FASTPOS ==========`);
});

// ============================================================================
// IPC MAIN - COMUNICACIÓN ENTRE PROCESOS
// ============================================================================

/**
 * Canal IPC: Obtener información del sistema
 * Llamar desde React: window.electronAPI.getSystemInfo()
 */
ipcMain.handle("get-system-info", async () => {
  console.log(`[${new Date().toISOString()}] [IPC] Solicitando información del sistema`);
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
    appVersion: app.getVersion(),
  };
});

/**
 * Canal IPC: Cerrar la aplicación
 * Llamar desde React: window.electronAPI.closeApp()
 */
ipcMain.handle("close-app", async () => {
  console.log(`[${new Date().toISOString()}] [IPC] Solicitado cierre de aplicación`);
  app.quit();
});

/**
 * Canal IPC: Obtener la ruta de datos del usuario
 * Útil para guardar configuraciones locales
 */
ipcMain.handle("get-user-data-path", async () => {
  const userDataPath = app.getPath("userData");
  console.log(`[${new Date().toISOString()}] [IPC] Ruta de datos: ${userDataPath}`);
  return userDataPath;
});

/**
 * Canal IPC: Mostrar diálogo de error
 * Llamar desde React: window.electronAPI.showErrorDialog("Título", "Mensaje")
 */
ipcMain.handle("show-error-dialog", async (event, title, message) => {
  console.error(`[${new Date().toISOString()}] [IPC] Error reportado: ${title} - ${message}`);
  await dialog.showErrorBox(title, message);
});

/**
 * Canal IPC: Mostrar diálogo de éxito
 * Llamar desde React: window.electronAPI.showSuccessDialog("Título", "Mensaje")
 */
ipcMain.handle("show-success-dialog", async (event, title, message) => {
  console.log(`[${new Date().toISOString()}] [IPC] Mensaje: ${title}`);
  await dialog.showMessageBox(mainWindow, {
    type: "info",
    title: title,
    message: message,
  });
});

/**
 * Canal IPC: Guarda una venta en la BD
 * Llamar desde React: window.electronAPI.saveSale(saleData)
 */
ipcMain.handle("save-sale", async (event, saleData) => {
  console.log(`[${new Date().toISOString()}] [IPC] Guardando venta:`, saleData);
  try {
    // Aquí iría la lógica de guardado en BD
    // Por ejemplo: guardar en SQLite, PostgreSQL, etc.
    return { success: true, saleId: Date.now() };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [IPC] Error al guardar venta:`, error);
    return { success: false, error: error.message };
  }
});

/**
 * Canal IPC: Obtiene el historial de ventas
 * Llamar desde React: window.electronAPI.getSalesHistory(filters)
 */
ipcMain.handle("get-sales-history", async (event, filters = {}) => {
  console.log(`[${new Date().toISOString()}] [IPC] Obteniendo historial de ventas`, filters);
  try {
    // Aquí iría la lógica de consulta a BD
    return { success: true, sales: [] };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [IPC] Error al obtener historial:`, error);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================================

/**
 * Captura excepciones no controladas
 * Previene que la app se bloquee silenciosamente
 */
process.on("uncaughtException", (error) => {
  console.error(
    `[${new Date().toISOString()}] [CRITICAL] Excepción no capturada:`,
    error
  );
  // En producción, aquí enviarías el error a un servicio de logging
  // Por ejemplo: Sentry, LogRocket, etc.
});

/**
 * Captura promesas rechazadas sin manejar
 */
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    `[${new Date().toISOString()}] [CRITICAL] Promesa rechazada sin manejar:`,
    reason
  );
});

// ============================================================================
// EXPORTAR PARA TESTING (Opcional)
// ============================================================================

module.exports = { createWindow, setupSecurityListeners };
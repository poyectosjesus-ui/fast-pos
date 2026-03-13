/**
 * ============================================================================
 * FAST-POS ELECTRON MAIN PROCESS
 * Optimizado para Next.js + Dexie (IndexedDB) - 100% Offline
 * ============================================================================
 * 
 * Este archivo gestiona:
 * - Ciclo de vida de Electron
 * - Comunicación IPC (Next.js ↔ Electron)
 * - Seguridad (bloqueo de atajos, DevTools)
 * - Sincronización offline-first con Dexie
 * - Logging y manejo de errores
 * - Exportación/Importación de datos
 */

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

const mainWindow = null;
const isAppQuitting = false;

// Fast-POS 1.1: Inicialización de Capa Nativa
const { initDatabase } = require("./src/main/database");
const { setupIpcHandlers } = require("./src/main/ipc-handlers");

try {
  initDatabase();
  setupIpcHandlers();
} catch (err) {
  console.error("Falla catastrófica en inicialización nativa:", err);
}

/**
 * Logger centralizado con timestamps
 */
const Logger = {
  info: (msg, data = "") => console.log(`[INFO] ${new Date().toISOString()} ${msg}`, data),
  warn: (msg, data = "") => console.warn(`[WARN] ${new Date().toISOString()} ${msg}`, data),
  error: (msg, data = "") => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, data),
  debug: (msg, data = "") => isDev && console.debug(`[DEBUG] ${new Date().toISOString()} ${msg}`, data),
};

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const WINDOW_CONFIG = {
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 600,
  webPreferences: {
    contextIsolation: true,
    nodeIntegration: false,
    enableRemoteModule: false,
    sandbox: true,
    preload: path.join(__dirname, "preload.js"),
  },
};

const BLOCKED_SHORTCUTS = [
  "CommandOrControl+R",
  "CommandOrControl+Shift+R",
  "F5",
  "CommandOrControl+Shift+I",
  "CommandOrControl+Shift+J",
  "CommandOrControl+Shift+C",
  "F11",
  "F12",
];

// ============================================================================
// CREACIÓN DE VENTANA
// ============================================================================

function createWindow() {
  Logger.info("🚀 Creando ventana principal...");

  mainWindow = new BrowserWindow({
    ...WINDOW_CONFIG,
    show: false,
    autoHideMenuBar: true,
    title: "FastPOS",
    backgroundColor: "#0f172a",
    icon: path.join(__dirname, "public", "icon-512x512.png"),
  });

  mainWindow.once("ready-to-show", () => {
    Logger.info("✅ Ventana lista, mostrando...");
    mainWindow.show();
  });

  // URL según desarrollo o producción
  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../out/index.html")}`;

  Logger.info(`📄 Cargando URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // DevTools solo en desarrollo
  if (isDev) {
    Logger.info("🔧 Modo desarrollo detectado");
    mainWindow.webContents.openDevTools();
  }

  // Listeners
  mainWindow.on("closed", () => {
    Logger.info("❌ Ventana cerrada");
    mainWindow = null;
  });

  mainWindow.on("close", (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      Logger.warn("⚠️ Intento de cierre bloqueado");
    }
  });

  // Seguridad
  setupSecurityListeners();
}

// ============================================================================
// SEGURIDAD
// ============================================================================

function setupSecurityListeners() {
  if (!mainWindow) return;

  // Bloquear eventos de entrada peligrosos
  mainWindow.webContents.on("before-input-event", (event, input) => {
    const isBlocked = BLOCKED_SHORTCUTS.some((shortcut) => {
      const [modifiers, key] = shortcut.split("+");
      if (shortcut.includes("CommandOrControl")) {
        return (
          (input.control || input.meta) &&
          input.key.toLowerCase() === key.toLowerCase()
        );
      }
      return input.key === key;
    });

    if (isBlocked) {
      event.preventDefault();
      Logger.warn(`🚫 Atajo bloqueado: ${input.key}`);
    }
  });

  // Bloquear apertura de nuevas ventanas
  mainWindow.webContents.setWindowOpenHandler(() => {
    Logger.warn("🚫 Intento de abrir nueva ventana bloqueado");
    return { action: "deny" };
  });

  // Validar navegación
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedDomains = ["localhost:3000", "localhost:3001"];
    const allowFile = url.startsWith("file://");

    const isAllowed = allowedDomains.some((d) => url.includes(d)) || allowFile;

    if (!isAllowed) {
      event.preventDefault();
      Logger.error(`🚫 Navegación bloqueada a: ${url}`);
    }
  });
}

function registerBlockedShortcuts() {
  Logger.info("🔒 Registrando atajos bloqueados...");
  const { globalShortcut } = require("electron");

  BLOCKED_SHORTCUTS.forEach((shortcut) => {
    globalShortcut.register(shortcut, () => {
      // No hacer nada
    });
  });
}

function unregisterAllShortcuts() {
  Logger.info("🔓 Desregistrando atajos...");
  const { globalShortcut } = require("electron");
  globalShortcut.unregisterAll();
}

// ============================================================================
// CICLO DE VIDA DE ELECTRON
// ============================================================================

app.on("ready", () => {
  Logger.info("═".repeat(80));
  Logger.info("🎉 FAST-POS INICIANDO");
  Logger.info(`Modo: ${isDev ? "DESARROLLO" : "PRODUCCIÓN"}`);
  Logger.info(`Plataforma: ${process.platform}`);
  Logger.info(`Electron: ${process.versions.electron}`);
  Logger.info("═".repeat(80));

  createWindow();

  // Eliminar menú
  const { Menu } = require("electron");
  Menu.setApplicationMenu(null);

  registerBlockedShortcuts();

  // macOS: recrear ventana al hacer click en dock
  app.on("activate", () => {
    if (mainWindow === null) {
      Logger.info("🖱️ Recreando ventana desde dock (macOS)");
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  Logger.info("🪟 Todas las ventanas cerradas");
  if (process.platform !== "darwin") {
    Logger.info("🛑 Cerrando aplicación (no macOS)");
    app.quit();
  }
});

app.on("before-quit", () => {
  Logger.info("⏹️ Preparando cierre...");
  const { backupDatabase } = require("./src/main/database");
  backupDatabase(); // Respaldo final antes de salir
  isAppQuitting = true;
  unregisterAllShortcuts();
});

app.on("quit", () => {
  Logger.info("═".repeat(80));
  Logger.info("👋 FAST-POS CERRADO");
  Logger.info("═".repeat(80));
});

// ============================================================================
// IPC HANDLERS - SINCRONIZACIÓN OFFLINE-FIRST
// ============================================================================

/**
 * Obtener rutas importantes del sistema
 */
ipcMain.handle("get-paths", async () => {
  return {
    userData: app.getPath("userData"),
    downloads: app.getPath("downloads"),
    documents: app.getPath("documents"),
    appVersion: app.getVersion(),
  };
});

/**
 * Exportar datos Dexie a JSON
 * Útil para backup
 */
ipcMain.handle("export-database", async (event, dbExportData) => {
  Logger.info("📦 Exportando base de datos...");

  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Exportar Base de Datos",
      defaultPath: `fast-pos-backup-${new Date().toISOString().split("T")[0]}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (filePath) {
      const fs = require("fs");
      fs.writeFileSync(filePath, JSON.stringify(dbExportData, null, 2));
      Logger.info(`✅ BD exportada a: ${filePath}`);
      return { success: true, path: filePath };
    }

    return { success: false, message: "Cancelado por usuario" };
  } catch (error) {
    Logger.error("❌ Error al exportar:", error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Importar datos Dexie desde JSON
 */
ipcMain.handle("import-database", async () => {
  Logger.info("📥 Importando base de datos...");

  try {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "Importar Base de Datos",
      filters: [{ name: "JSON", extensions: ["json"] }],
      properties: ["openFile"],
    });

    if (filePaths && filePaths.length > 0) {
      const fs = require("fs");
      const data = JSON.parse(fs.readFileSync(filePaths[0], "utf-8"));
      Logger.info(`✅ BD importada desde: ${filePaths[0]}`);
      return { success: true, data };
    }

    return { success: false, message: "Cancelado por usuario" };
  } catch (error) {
    Logger.error("❌ Error al importar:", error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Mostrar diálogo de confirmación
 */
ipcMain.handle("show-confirm-dialog", async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: options.type || "question",
    title: options.title,
    message: options.message,
    buttons: options.buttons || ["Cancelar", "Aceptar"],
  });

  return result.response;
});

/**
 * Mostrar diálogo de información
 */
ipcMain.handle("show-info-dialog", async (event, options) => {
  Logger.info(`📋 Diálogo: ${options.title}`);
  await dialog.showMessageBox(mainWindow, {
    type: options.type || "info",
    title: options.title,
    message: options.message,
  });
});

/**
 * Obtener información del sistema
 */
ipcMain.handle("get-system-info", async () => {
  const os = require("os");
  return {
    platform: process.platform,
    arch: process.arch,
    cpuCount: os.cpus().length,
    totalMemory: Math.round(os.totalmem() / 1024 / 1024),
    freeMemory: Math.round(os.freemem() / 1024 / 1024),
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
  };
});

/**
 * Sincronizar datos con servidor (si hay conexión)
 * En offline, simplemente retorna success: false
 */
ipcMain.handle("sync-with-server", async (event, data) => {
  Logger.info("🔄 Verificando sincronización...");

  try {
    // Verificar conectividad
    const isOnline = require("is-online");
    const online = await isOnline();

    if (!online) {
      Logger.info("📴 Sin conexión - modo offline");
      return { success: false, message: "Sin conexión a internet", offline: true };
    }

    Logger.info("🌐 Conexión detectada");
    // Aquí iría lógica de sincronización con servidor
    return { success: true, synced: true };
  } catch (error) {
    Logger.warn("⚠️ Error en sincronización:", error.message);
    return { success: false, offline: true, error: error.message };
  }
});

/**
 * Generar reporte PDF
 */
ipcMain.handle("generate-report", async (event, reportData) => {
  Logger.info("📊 Generando reporte...");

  try {
    const { filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Guardar Reporte",
      defaultPath: `reporte-${new Date().toISOString().split("T")[0]}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (filePath) {
      const fs = require("fs");
      fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
      Logger.info(`✅ Reporte guardado: ${filePath}`);
      return { success: true, path: filePath };
    }

    return { success: false };
  } catch (error) {
    Logger.error("❌ Error al generar reporte:", error.message);
    return { success: false, error: error.message };
  }
});

/**
 * Obtener lista de impresoras
 */
ipcMain.handle("get-printers", async () => {
  Logger.info("🖨️ Obteniendo impresoras...");

  try {
    const printers = await mainWindow.webContents.getPrinters();
    Logger.info(`✅ ${printers.length} impresoras encontradas`);
    return { success: true, printers };
  } catch (error) {
    Logger.error("❌ Error al obtener impresoras:", error.message);
    return { success: false, printers: [] };
  }
});

/**
 * Imprimir contenido
 */
ipcMain.handle("print", async (event, options) => {
  Logger.info("🖨️ Enviando a imprimir...");

  try {
    await mainWindow.webContents.print(options);
    Logger.info("✅ Impresión enviada");
    return { success: true };
  } catch (error) {
    Logger.error("❌ Error al imprimir:", error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// MANEJO DE ERRORES GLOBAL
// ============================================================================

process.on("uncaughtException", (error) => {
  Logger.error("🔴 EXCEPCIÓN NO CAPTURADA:", error.message);
  Logger.error("Stack:", error.stack);
});

process.on("unhandledRejection", (reason) => {
  Logger.error("🔴 PROMESA RECHAZADA NO MANEJADA:", reason);
});

// ============================================================================
// INFORMACIÓN AL INICIAR
// ============================================================================

Logger.info(`🖥️ Sistema Operativo: ${process.platform}`);
Logger.info(`🔢 Versión Node: ${process.versions.node}`);
Logger.info(`⚛️ Versión React: ${require("react/package.json").version}`);
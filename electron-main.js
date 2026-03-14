/**
 * ============================================================================
 * FAST-POS ELECTRON MAIN PROCESS — v2.0
 * Desktop-First | SQLite Native | 100% Offline
 * ============================================================================
 *
 * Este archivo gestiona:
 * - Ciclo de vida de Electron
 * - Comunicación IPC (Next.js ↔ Electron) — ver ipc-handlers.js
 * - Seguridad (bloqueo de atajos, DevTools en producción)
 * - Backup automático antes del cierre
 * - Logging y manejo de errores global
 */

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const isDev = process.env.NODE_ENV === "development";

// ============================================================================
// VARIABLES GLOBALES
// ============================================================================

let mainWindow = null;
let isAppQuitting = false;

// Los handlers IPC y la DB se inicializan dentro de app.on('ready')
// para garantizar que app.getPath('userData') está disponible.


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

  // ── EPIC-003: Permitir carga de imágenes locales con file:// ───────────────
  // Next.js (localhost) necesita permiso explícito para cargar URLs file://.
  // Usamos session.webRequest para interceptar y permitir file:// desde userData.
  // Alternativa segura: no desactivamos webSecurity globalmente.
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* file:; " +
          "img-src 'self' data: blob: file: http://localhost:*;"
        ],
      },
    });
  });

  // URL según desarrollo o producción
  const startUrl = isDev
    ? "http://localhost:3000"
    : `file://${path.join(__dirname, "../out/index.html")}`;

  Logger.info(`📄 Cargando URL: ${startUrl}`);
  mainWindow.loadURL(startUrl);

  // DevTools solo en desarrollo (DESHABILITADO POR EL USUARIO)
  if (isDev) {
    Logger.info("🔧 Modo desarrollo detectado");
    // mainWindow.webContents.openDevTools();
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
  // ── Inicializar DB e IPC handlers PRIMERO (app.getPath ya está disponible) ──
  try {
    const { initDatabase } = require("./src/main/database");
    const { setupIpcHandlers } = require("./src/main/ipc-handlers");
    initDatabase();
    setupIpcHandlers();
    Logger.info("✅ Base de datos e IPC handlers registrados");
  } catch (err) {
    Logger.error("💥 Falla crítica en inicialización de DB/IPC:", err.message);
    dialog.showErrorBox(
      "Error de base de datos",
      `Fast-POS no pudo iniciar la base de datos:\n\n${err.message}`
    );
    app.quit();
    return;
  }

  createWindow();

  createWindow();

  // Configurar Menú Nativo macOS (Cmd+N, Cmd+S, Editar, Portapapeles)
  const { Menu } = require("electron");
  const isMac = process.platform === 'darwin';
  
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Archivo',
      submenu: [
        { 
          label: 'Nuevo Ticket', 
          accelerator: 'CmdOrCtrl+N',
          click: () => { if (mainWindow) mainWindow.webContents.send("menu:new-ticket"); }
        },
        { type: 'separator' },
        {
          label: 'Exportar Backup',
          accelerator: 'CmdOrCtrl+S',
          click: () => { if (mainWindow) mainWindow.webContents.send("menu:export-backup"); }
        },
        {
          label: 'Ajustes de Almacenamiento',
          accelerator: 'CmdOrCtrl+O',
          click: () => { if (mainWindow) mainWindow.webContents.send("menu:open-settings"); }
        },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

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
 * Selector de almacenamiento local flexible (Nativo macOS/Win)
 */
ipcMain.handle("system:selectStorageFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecciona el directorio de almacenamiento",
    properties: ["openDirectory", "createDirectory", "promptToCreate"]
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }
  
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle("system:saveStorageConfig", async (event, storagePath) => {
  try {
    const fs = require("fs");
    const configPath = path.join(app.getPath("userData"), "config.json");
    const payload = JSON.stringify({ storagePath }, null, 2);
    fs.writeFileSync(configPath, payload, "utf-8");
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
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
/**
 * PRELOAD SCRIPT — Fast-POS 2.0
 *
 * Responsabilidad: Exponer la API segura de Electron al proceso Renderer (Next.js).
 * Fuente de Verdad: ARCHITECTURE.md §2.1 — La capa preload es el único puente entre
 *   Main y Renderer. Los componentes React nunca usan ipcRenderer directamente.
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {

  // ── Base de Datos ───────────────────────────────────────────────────────────
  checkDbReady:   () => ipcRenderer.invoke("db:ready"),
  getDbStatus:    () => ipcRenderer.invoke("db:status"),
  exportSqlite:   () => ipcRenderer.invoke("db:exportSqlite"),
  importSqlite:   () => ipcRenderer.invoke("db:importSqlite"),

  // ── Configuración Global (Settings) ────────────────────────────────────────
  getSetting:     (key)         => ipcRenderer.invoke("settings:get", key),
  getAllSettings:  ()            => ipcRenderer.invoke("settings:getAll"),
  setSetting:     (key, value)  => ipcRenderer.invoke("settings:set", key, value),
  setBulkSettings:(entries)     => ipcRenderer.invoke("settings:setBulk", entries),

  // ── Categorías ──────────────────────────────────────────────────────────────
  getAllCategories:  ()         => ipcRenderer.invoke("categories:getAll"),
  createCategory:   (category) => ipcRenderer.invoke("categories:create", category),
  updateCategory:   (category) => ipcRenderer.invoke("categories:update", category),
  deleteCategory:   (id)       => ipcRenderer.invoke("categories:delete", id),

  // ── Productos ───────────────────────────────────────────────────────────────
  getAllProducts:  ()        => ipcRenderer.invoke("products:getAll"),
  createProduct:  (product) => ipcRenderer.invoke("products:create", product),
  updateProduct:  (product) => ipcRenderer.invoke("products:update", product),
  deleteProduct:  (id)      => ipcRenderer.invoke("products:delete", id),

  // ── Ventas / Órdenes ────────────────────────────────────────────────────────
  checkout:       (order)   => ipcRenderer.invoke("orders:checkout", order),
  getOrderHistory:()        => ipcRenderer.invoke("orders:getHistory"),
  getOrderById:   (id)      => ipcRenderer.invoke("orders:getById", id),
  voidOrder:      (id)      => ipcRenderer.invoke("orders:void", id),

  // ── Imágenes (Bucket Local — EPIC-003) ─────────────────────────────────────
  saveImage:    (base64, filename) => ipcRenderer.invoke("images:save", base64, filename),
  getImageUrl:  (filename)         => ipcRenderer.invoke("images:getUrl", filename),
  deleteImage:  (filename)         => ipcRenderer.invoke("images:delete", filename),

  // ── Impresión de Tickets (EPIC-004) ────────────────────────────────────────
  getPrinters:  () => ipcRenderer.invoke("ticket:getPrinters"),
  printTicket:  (orderId, printerName, silent) => ipcRenderer.invoke("ticket:print", orderId, printerName, silent),
  printTicketToPdf: (orderId) => ipcRenderer.invoke("ticket:printToPdf", orderId),
});


console.log("[Preload] Fast-POS 2.0 — electronAPI disponible.");
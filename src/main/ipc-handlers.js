const { ipcMain, dialog, app } = require("electron");
const { getDb, getDbPath } = require("./database");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

/**
 * IPC HANDLERS — Fast-POS 2.0
 *
 * Responsabilidad: Contrato de comunicación Renderer ↔ Main Process.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, CODING_STANDARDS.md §5
 *
 * Dominios:
 *   db:*        — Base de datos (salud, migración, export/import)
 *   settings:*  — Configuración global del negocio
 *   categories:*— CRUD de categorías
 *   products:*  — CRUD de productos
 *   orders:*    — Procesamiento de ventas (transacciones atómicas)
 */

function setupIpcHandlers() {
  console.log("[IPC] Registrando handlers de Fast-POS 2.0...");

  // ──────────────────────────────────────────
  // DOMINIO: db (Base de Datos)
  // ──────────────────────────────────────────

  /**
   * db:ready — Verifica que SQLite responde correctamente
   */
  ipcMain.handle("db:ready", async () => {
    try {
      const db = getDb();
      const result = db.prepare("SELECT 1 AS connected").get();
      return { success: !!result.connected, engine: "better-sqlite3" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /**
   * db:status — Métricas en tiempo real (panel de salud en Settings)
   */
  ipcMain.handle("db:status", async () => {
    try {
      const db = getDb();
      const dbPath = getDbPath();
      const stats = fs.statSync(dbPath);
      const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
      const schemaVersion = db.pragma("user_version", { simple: true });

      const counts = {
        products: db.prepare("SELECT COUNT(*) AS c FROM products").get().c,
        categories: db.prepare("SELECT COUNT(*) AS c FROM categories").get().c,
        orders: db.prepare("SELECT COUNT(*) AS c FROM orders").get().c,
      };

      return {
        success: true,
        path: dbPath,
        size: `${sizeMb} MB`,
        schemaVersion: `v${schemaVersion}`,
        mode: db.pragma("journal_mode", { simple: true }),
        counts,
      };
    } catch (err) {
      console.error("[IPC:db:status]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * db:exportSqlite — Backup manual con diálogo nativo de guardado
   * Genera un archivo .fastpos.db que es una copia íntegra de la DB.
   */
  ipcMain.handle("db:exportSqlite", async () => {
    try {
      const date = new Date().toISOString().split("T")[0];
      const defaultName = `respaldo-fastpos-${date}.fastpos.db`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Guardar Respaldo de Fast-POS",
        defaultPath: path.join(app.getPath("documents"), defaultName),
        filters: [{ name: "Respaldo Fast-POS", extensions: ["fastpos.db", "db"] }],
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      // Usar la API de backup de SQLite (seguro en caliente, maneja WAL)
      const backupDb = new Database(filePath);
      getDb().backup(backupDb);
      backupDb.close();

      console.log(`[BACKUP] Respaldo manual exportado a: ${filePath}`);
      return { success: true, path: filePath };
    } catch (err) {
      console.error("[IPC:db:exportSqlite]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * db:importSqlite — Restaura la DB desde un archivo .fastpos.db externo
   * Valida la integridad antes de reemplazar la DB activa.
   */
  ipcMain.handle("db:importSqlite", async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Restaurar Respaldo de Fast-POS",
        filters: [{ name: "Respaldo Fast-POS", extensions: ["fastpos.db", "db"] }],
        properties: ["openFile"],
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const sourcePath = filePaths[0];

      // Validar integridad del archivo de respaldo antes de restaurar
      const testDb = new Database(sourcePath, { readonly: true });
      const integrityCheck = testDb.pragma("integrity_check", { simple: true });
      testDb.close();

      if (integrityCheck !== "ok") {
        return {
          success: false,
          error: "El archivo de respaldo está dañado. No se puede restaurar.",
        };
      }

      // Cerrar la DB activa y reemplazar el archivo
      const dbPath = getDbPath();
      // Crear un respaldo de seguridad de la DB actual antes de reemplazar
      const safetyBackup = `${dbPath}.pre-restore-${Date.now()}.bak`;
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, safetyBackup);
      }

      fs.copyFileSync(sourcePath, dbPath);
      console.log(`[BACKUP] DB restaurada desde: ${sourcePath}`);
      return { success: true };
    } catch (err) {
      console.error("[IPC:db:importSqlite]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: settings (Configuración Global)
  // ──────────────────────────────────────────

  /**
   * settings:get — Obtiene un valor de configuración por clave
   */
  ipcMain.handle("settings:get", async (event, key) => {
    try {
      const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return { success: true, value: row ? row.value : null };
    } catch (err) {
      console.error("[IPC:settings:get]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * settings:getAll — Obtiene toda la configuración (para poblar el formulario de Settings)
   */
  ipcMain.handle("settings:getAll", async () => {
    try {
      const rows = getDb().prepare("SELECT key, value FROM settings").all();
      const config = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      return { success: true, config };
    } catch (err) {
      console.error("[IPC:settings:getAll]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * settings:set — Guarda un valor de configuración (upsert)
   */
  ipcMain.handle("settings:set", async (event, key, value) => {
    try {
      getDb()
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .run(key, String(value));
      return { success: true };
    } catch (err) {
      console.error("[IPC:settings:set]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * settings:setBulk — Guarda múltiples configuraciones en una sola transacción
   * Recibe: { key: value, ... }
   */
  ipcMain.handle("settings:setBulk", async (event, entries) => {
    try {
      const db = getDb();
      const upsert = db.prepare(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)"
      );
      const bulkUpdate = db.transaction((map) => {
        for (const [key, value] of Object.entries(map)) {
          upsert.run(key, String(value));
        }
      });
      bulkUpdate(entries);
      return { success: true };
    } catch (err) {
      console.error("[IPC:settings:setBulk]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: categories
  // ──────────────────────────────────────────

  ipcMain.handle("categories:getAll", async () => {
    try {
      return getDb().prepare("SELECT * FROM categories ORDER BY name ASC").all();
    } catch (err) {
      console.error("[IPC:categories:getAll]", err.message);
      throw err;
    }
  });

  ipcMain.handle("categories:create", async (event, category) => {
    try {
      const db = getDb();
      db.prepare(
        "INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)"
      ).run(category.id, category.name, category.createdAt, category.updatedAt);
      return { success: true };
    } catch (err) {
      console.error("[IPC:categories:create]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("categories:update", async (event, category) => {
    try {
      getDb()
        .prepare("UPDATE categories SET name = ?, updatedAt = ? WHERE id = ?")
        .run(category.name, category.updatedAt, category.id);
      return { success: true };
    } catch (err) {
      console.error("[IPC:categories:update]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("categories:delete", async (event, id) => {
    try {
      getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      console.error("[IPC:categories:delete]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: products
  // ──────────────────────────────────────────

  /**
   * products:getAll — Devuelve todos los productos con JOIN a su categoría.
   * Incluye las columnas de IVA (taxRate, taxIncluded) del schema v2.
   */
  ipcMain.handle("products:getAll", async () => {
    try {
      const db = getDb();
      const products = db
        .prepare(
          `SELECT p.*, c.name AS categoryName
           FROM products p
           LEFT JOIN categories c ON p.categoryId = c.id
           ORDER BY p.name ASC`
        )
        .all();

      return products.map((p) => ({
        ...p,
        isVisible: Boolean(p.isVisible),
        taxIncluded: Boolean(p.taxIncluded),
      }));
    } catch (err) {
      console.error("[IPC:products:getAll]", err.message);
      throw err;
    }
  });

  /**
   * products:create — Inserta un producto con todos sus campos (v2: taxRate, taxIncluded)
   */
  ipcMain.handle("products:create", async (event, product) => {
    try {
      const db = getDb();
      const insert = db.transaction((p) => {
        db.prepare(`
          INSERT INTO products
            (id, categoryId, name, price, stock, sku, isVisible, image, taxRate, taxIncluded, createdAt, updatedAt)
          VALUES
            (@id, @categoryId, @name, @price, @stock, @sku, @isVisible, @image, @taxRate, @taxIncluded, @createdAt, @updatedAt)
        `).run({
          ...p,
          isVisible: p.isVisible ? 1 : 0,
          taxIncluded: p.taxIncluded ? 1 : 0,
          taxRate: p.taxRate ?? 1600,
        });
        return { success: true, id: p.id };
      });
      return insert(product);
    } catch (err) {
      console.error("[IPC:products:create]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * products:update — Actualiza todos los campos de un producto (v2: taxRate, taxIncluded)
   */
  ipcMain.handle("products:update", async (event, product) => {
    try {
      const db = getDb();
      const update = db.transaction((p) => {
        db.prepare(`
          UPDATE products SET
            categoryId  = @categoryId,
            name        = @name,
            price       = @price,
            stock       = @stock,
            sku         = @sku,
            isVisible   = @isVisible,
            image       = @image,
            taxRate     = @taxRate,
            taxIncluded = @taxIncluded,
            updatedAt   = @updatedAt
          WHERE id = @id
        `).run({
          ...p,
          isVisible: p.isVisible ? 1 : 0,
          taxIncluded: p.taxIncluded ? 1 : 0,
          taxRate: p.taxRate ?? 1600,
        });
        return { success: true };
      });
      return update(product);
    } catch (err) {
      console.error("[IPC:products:update]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * products:delete — Elimina un producto por su ID
   */
  ipcMain.handle("products:delete", async (event, productId) => {
    try {
      getDb().prepare("DELETE FROM products WHERE id = ?").run(productId);
      return { success: true };
    } catch (err) {
      console.error("[IPC:products:delete]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: orders (Transacciones Atómicas)
  // ──────────────────────────────────────────

  /**
   * orders:checkout — Procesa una venta completa de forma atómica:
   *   1. Verifica stock suficiente para todos los ítems
   *   2. Inserta la orden
   *   3. Inserta cada order_item
   *   4. Descuenta el stock de cada producto
   * Si cualquier paso falla → rollback automático.
   */
  ipcMain.handle("orders:checkout", async (event, order) => {
    const db = getDb();

    const checkStock = db.prepare("SELECT stock FROM products WHERE id = ?");
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, subtotal, tax, total, status, paymentMethod, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (orderId, productId, name, price, quantity, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare(`
      UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ?
    `);

    const transaction = db.transaction((orderData) => {
      // 1. Verificar stock de todos los ítems antes de proceder
      for (const item of orderData.items) {
        const product = checkStock.get(item.productId);
        if (!product || product.stock < item.quantity) {
          throw new Error(
            `Stock insuficiente para "${item.name}". Disponible: ${product?.stock ?? 0}`
          );
        }
      }

      // 2. Crear la orden
      insertOrder.run(
        orderData.id,
        orderData.subtotal,
        orderData.tax,
        orderData.total,
        orderData.status,
        orderData.paymentMethod,
        orderData.createdAt
      );

      // 3. Crear ítems y descontar stock
      for (const item of orderData.items) {
        insertItem.run(
          orderData.id,
          item.productId,
          item.name,
          item.price,
          item.quantity,
          item.subtotal
        );
        updateStock.run(item.quantity, Date.now(), item.productId);
      }

      return { success: true };
    });

    try {
      return transaction(order);
    } catch (err) {
      console.error("[IPC:orders:checkout] Rollback automático:", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * orders:getHistory — Historial de ventas con hidratación de ítems
   */
  ipcMain.handle("orders:getHistory", async () => {
    try {
      const db = getDb();
      const orders = db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all();
      return orders.map((order) => ({
        ...order,
        items: db
          .prepare("SELECT * FROM order_items WHERE orderId = ?")
          .all(order.id),
      }));
    } catch (err) {
      console.error("[IPC:orders:getHistory]", err.message);
      throw err;
    }
  });

  /**
   * orders:void — Anula una orden: cambia estado a CANCELLED y restaura el stock.
   * Operación atómica (rollback si falla la restauración de cualquier ítem).
   */
  ipcMain.handle("orders:void", async (event, orderId) => {
    const db = getDb();

    const voidTransaction = db.transaction((id) => {
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
      if (!order) throw new Error("Orden no encontrada.");
      if (order.status === "CANCELLED") throw new Error("Esta orden ya fue anulada.");

      // Marcar como cancelada
      db.prepare("UPDATE orders SET status = 'CANCELLED' WHERE id = ?").run(id);

      // Restaurar el stock de cada ítem
      const items = db.prepare("SELECT * FROM order_items WHERE orderId = ?").all(id);
      const restoreStock = db.prepare(
        "UPDATE products SET stock = stock + ?, updatedAt = ? WHERE id = ?"
      );
      for (const item of items) {
        restoreStock.run(item.quantity, Date.now(), item.productId);
      }

      return { success: true };
    });

    try {
      return voidTransaction(orderId);
    } catch (err) {
      console.error("[IPC:orders:void]", err.message);
      return { success: false, error: err.message };
    }
  });

  console.log("[IPC] Todos los handlers registrados correctamente.");
}

module.exports = { setupIpcHandlers };

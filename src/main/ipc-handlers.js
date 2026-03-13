const { ipcMain } = require("electron");
const { getDb } = require("./database");

/**
 * Handlers de comunicación para Fast-POS 1.1 (Native Core)
 * Centraliza las llamadas del Renderer al Main.
 */

function setupIpcHandlers() {
  console.log("[IPC] Registrando Handlers de Fast-POS 1.1...");

  // Handler de Salud de la DB (Fase 2.2 del roadmap)
  ipcMain.handle("db:ready", async () => {
    try {
      const db = getDb();
      const result = db.prepare("SELECT 1 as connected").get();
      return { success: !!result.connected, engine: "better-sqlite3" };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  /**
   * Obtener estado de salud detallado de la DB (Fase 6.1)
   */
  ipcMain.handle("db:status", async () => {
    try {
      const { app } = require("electron");
      const path = require("path");
      const fs = require("fs");
      const db = getDb();

      const isDev = process.env.NODE_ENV === "development";
      const dbPath = isDev 
        ? path.join(__dirname, "../../fast-pos-dev.db") 
        : path.join(app.getPath("userData"), "fast-pos.db");

      const stats = fs.statSync(dbPath);
      const fileSizeInBytes = stats.size;
      const fileSizeInMegabytes = fileSizeInBytes / (1024 * 1024);

      // Estadísticas de registros
      const counts = {
        products: db.prepare("SELECT COUNT(*) as count FROM products").get().count,
        categories: db.prepare("SELECT COUNT(*) as count FROM categories").get().count,
        orders: db.prepare("SELECT COUNT(*) as count FROM orders").get().count
      };

      return {
        success: true,
        path: dbPath,
        size: `${fileSizeInMegabytes.toFixed(2)} MB`,
        mode: db.pragma("journal_mode", { simple: true }),
        counts,
        lastBackup: "Al cerrar la app"
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- CATEGORÍAS ---

  ipcMain.handle("categories:getAll", async () => {
    try {
      return getDb().prepare("SELECT * FROM categories ORDER BY name ASC").all();
    } catch (err) {
      console.error("[IPC] Error en categories:getAll:", err.message);
      throw err;
    }
  });

  ipcMain.handle("categories:create", async (event, category) => {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO categories (id, name, createdAt, updatedAt)
        VALUES (?, ?, ?, ?)
      `).run(category.id, category.name, category.createdAt, category.updatedAt);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("categories:update", async (event, category) => {
    try {
      getDb().prepare("UPDATE categories SET name = ?, updatedAt = ? WHERE id = ?")
        .run(category.name, category.updatedAt, category.id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("categories:delete", async (event, id) => {
    try {
      getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // --- PRODUCTOS ---

  /**
   * Obtener todos los productos con el nombre de su categoría (JOIN)
   */
  ipcMain.handle("products:getAll", async () => {
    try {
      const db = getDb();
      const products = db.prepare(`
        SELECT p.*, c.name as categoryName 
        FROM products p
        LEFT JOIN categories c ON p.categoryId = c.id
        ORDER BY p.name ASC
      `).all();

      // Convertir booleanos de SQLite (0/1) a JS boolean
      return products.map(p => ({
        ...p,
        isVisible: Boolean(p.isVisible)
      }));
    } catch (err) {
      console.error("[IPC] Error en products:getAll:", err.message);
      throw err;
    }
  });

  /**
   * Crear un nuevo producto
   */
  ipcMain.handle("products:create", async (event, product) => {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        INSERT INTO products (
          id, categoryId, name, price, stock, sku, isVisible, image, createdAt, updatedAt
        ) VALUES (
          @id, @categoryId, @name, @price, @stock, @sku, @isVisible, @image, @createdAt, @updatedAt
        )
      `);

      stmt.run({
        ...product,
        isVisible: product.isVisible ? 1 : 0 // Convertir booleano a entero para SQLite
      });

      return { success: true, id: product.id };
    } catch (err) {
      console.error("[IPC] Error en products:create:", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Actualizar un producto existente
   */
  ipcMain.handle("products:update", async (event, product) => {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        UPDATE products SET
          categoryId = @categoryId,
          name = @name,
          price = @price,
          stock = @stock,
          sku = @sku,
          isVisible = @isVisible,
          image = @image,
          updatedAt = @updatedAt
        WHERE id = @id
      `);

      stmt.run({
        ...product,
        isVisible: product.isVisible ? 1 : 0
      });

      return { success: true };
    } catch (err) {
      console.error("[IPC] Error en products:update:", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Eliminar un producto
   */
  ipcMain.handle("products:delete", async (event, productId) => {
    try {
      const db = getDb();
      const stmt = db.prepare("DELETE FROM products WHERE id = ?");
      stmt.run(productId);
      return { success: true };
    } catch (err) {
      console.error("[IPC] Error en products:delete:", err.message);
      return { success: false, error: err.message };
    }
  });

  // --- VENTAS (TRANSACCIONES ATÓMICAS) ---

  /**
   * Procesa una venta completa: Crea la orden, guarda los ítems y descuenta stock.
   * Todo dentro de una transacción SQLite para integridad total.
   */
  ipcMain.handle("orders:checkout", async (event, order) => {
    const db = getDb();
    
    // Preparar statements fuera de la transacción para performance
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

    // Ejecutar transacción
    const transaction = db.transaction((orderData) => {
      // 1. Insertar Orden
      insertOrder.run(
        orderData.id,
        orderData.subtotal,
        orderData.tax,
        orderData.total,
        orderData.status,
        orderData.paymentMethod,
        orderData.createdAt
      );

      // 2. Procesar ítems e Inventario
      for (const item of orderData.items) {
        // Guardar ítem de la orden
        insertItem.run(
          orderData.id,
          item.productId,
          item.name,
          item.price,
          item.quantity,
          item.subtotal
        );

        // Descontar stock físicamente
        updateStock.run(item.quantity, Date.now(), item.productId);
      }

      return { success: true };
    });

    try {
      return transaction(order);
    } catch (err) {
      console.error("[IPC] Venta fallida (Rollback automático):", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * Obtener historial de ventas completo
   */
  ipcMain.handle("orders:getHistory", async () => {
    try {
      const db = getDb();
      // Órdenes ordenadas por la más reciente
      const orders = db.prepare("SELECT * FROM orders ORDER BY createdAt DESC").all();
      
      // Enriquecer cada orden con sus ítems (Hidratación)
      return orders.map(order => {
        const items = db.prepare("SELECT * FROM order_items WHERE orderId = ?").all(order.id);
        return { ...order, items };
      });
    } catch (err) {
      console.error("[IPC] Error en orders:getHistory:", err.message);
      throw err;
    }
  });

  // Nota: Los handlers CRUD restantes se añadirán paso a paso.
}

module.exports = {
  setupIpcHandlers
};

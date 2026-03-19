const { ipcMain, dialog, app, BrowserWindow } = require("electron");
const { getDb, getDbPath } = require("./database");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { validateLicenseKey } = require("./licensing");

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
  
  /**
   * Helper para registrar logs de auditoría sin repetir código.
   */
  const logAudit = (userId, action, details) => {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO audit_logs (id, userId, userName, action, details, createdAt)
        VALUES (?, ?, 'Sistema', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        userId || null,
        action,
        typeof details === "string" ? details : JSON.stringify(details),
        Date.now()
      );
    } catch (err) {
      console.error("[AUDIT] Error al guardar log:", err.message);
    }
  };

  // Sprint 6: Analytics Dashboard Premium endpoints
  ipcMain.handle("analytics:getAdvancedFilters", async (event, params) => {
    try {
      const db = getDb();
      const { startDate, endDate } = params || {};
      
      let dateCondition = "";
      const queryParams = [];
      
      if (startDate) {
        dateCondition += " AND createdAt >= ?";
        queryParams.push(startDate);
      }
      if (endDate) {
        dateCondition += " AND createdAt <= ?";
        queryParams.push(endDate);
      }

      // Ventas por Cajero
      const byCashierStmt = db.prepare(`
        SELECT u.name as cashierName, SUM(o.total) as totalAmount, COUNT(o.id) as tickets
        FROM orders o
        LEFT JOIN users u ON o.userId = u.id
        WHERE o.status = 'COMPLETED' ${dateCondition.replace(/createdAt/g, 'o.createdAt')}
        GROUP BY u.id
        ORDER BY totalAmount DESC
      `);
      const byCashier = byCashierStmt.all(...queryParams);

      // Ventas por Canal
      const bySourceStmt = db.prepare(`
        SELECT source as channel, SUM(total) as totalAmount, COUNT(id) as tickets
        FROM orders
        WHERE status = 'COMPLETED' ${dateCondition}
        GROUP BY source
        ORDER BY totalAmount DESC
      `);
      const bySource = bySourceStmt.all(...queryParams);

      // Ventas por Método de Pago
      const byPaymentStmt = db.prepare(`
        SELECT paymentMethod as method, SUM(total) as totalAmount, COUNT(id) as tickets
        FROM orders
        WHERE status = 'COMPLETED' ${dateCondition}
        GROUP BY paymentMethod
        ORDER BY totalAmount DESC
      `);
      const byPayment = byPaymentStmt.all(...queryParams);

      return {
        success: true,
        byCashier,
        bySource,
        byPayment
      };
    } catch (error) {
      console.error("Error analytics:getAdvancedFilters:", error);
      return { success: false, error: error.message };
    }
  });

  // Sprint 8: Top Productos
  ipcMain.handle("analytics:getTopProducts", async (event, params) => {
    try {
      const db = getDb();
      const { startDate, endDate, limit = 5 } = params || {};
      
      let dateCondition = "AND o.status = 'COMPLETED'";
      const queryParams = [];
      
      if (startDate) {
        dateCondition += " AND o.createdAt >= ?";
        queryParams.push(startDate);
      }
      if (endDate) {
        dateCondition += " AND o.createdAt <= ?";
        queryParams.push(endDate);
      }
      
      // Sumatoria agrupada de Ventas y cálculo usando products (Para stock actual)
      const topProductsStmt = db.prepare(`
        SELECT 
          oi.productId,
          oi.name,
          SUM(oi.quantity) as unitsSold,
          SUM(oi.subtotal) as revenue,
          p.stock as currentStock
        FROM order_items oi
        JOIN orders o ON o.id = oi.orderId
        LEFT JOIN products p ON p.id = oi.productId
        WHERE 1=1 ${dateCondition}
        GROUP BY oi.productId
        ORDER BY revenue DESC
        LIMIT ?
      `);
      
      queryParams.push(limit);
      
      const topProducts = topProductsStmt.all(...queryParams);
      return { success: true, data: topProducts };
    } catch (error) {
      console.error("Error analytics:getTopProducts:", error);
      return { success: false, error: error.message };
    }
  });

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
  // DOMINIO: setup (Wizard Inicial Transaccional)
  // ──────────────────────────────────────────

  /**
   * setup:complete — Guarda configuraciones y crea el ADMIN inicial en una sola transacción.
   */
  ipcMain.handle("setup:complete", async (event, data) => {
    try {
      // 0. Validar la licencia Criptográficamente antes de meter a base de datos
      const licenseCheck = validateLicenseKey(data.license.key);
      if (!licenseCheck.isValid) {
        throw new Error(licenseCheck.error || "Licencia no válida");
      }

      const db = getDb();
      const runSetup = db.transaction((setupData) => {
        // 1. Guardar configuraciones
        const upsertSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
        upsertSetting.run("store_name", setupData.business.name || "");
        upsertSetting.run("store_address", setupData.business.address || "");
        upsertSetting.run("store_phone", setupData.business.phone || "");
        upsertSetting.run("store_tax_id", setupData.business.taxId || "");
        upsertSetting.run("tax_name", setupData.fiscal.taxName || "IVA");
        upsertSetting.run("tax_rate_default", String(setupData.fiscal.taxRate || "1600"));
        upsertSetting.run("currency_symbol", setupData.fiscal.currency || "$");
        upsertSetting.run("license_key", setupData.license.key || "");
        
        // Redes Sociales (Premium)
        upsertSetting.run("store_whatsapp", setupData.social?.whatsapp || "");
        upsertSetting.run("store_instagram", setupData.social?.instagram || "");
        upsertSetting.run("store_facebook", setupData.social?.facebook || "");
        upsertSetting.run("store_tiktok", setupData.social?.tiktok || "");
        upsertSetting.run("store_website", setupData.social?.website || "");
        
        // Extraemos detalles del payload criptográfico pre-aprobado para guardar como metadata referencial
        upsertSetting.run("license_plan", licenseCheck.payload.plan || "BASIC");
        upsertSetting.run("license_expires", String(licenseCheck.payload.exp || "LIFETIME"));
        
        // Sprint-1 E2: Canales de venta configurables
        const enabledChannels = (setupData.channels?.enabled || ["COUNTER"]).join(",");
        upsertSetting.run("enabled_channels", enabledChannels);
        upsertSetting.run("default_channel", setupData.channels?.defaultChannel || "COUNTER");

        upsertSetting.run("setup_completed", "true");

        // 2. Limpiar la tabla de usuarios por si había un usuario default o info basura
        db.prepare("DELETE FROM users").run();

        // 3. Crear al nuevo Administrador y hashear su PIN
        const insertUser = db.prepare("INSERT INTO users (id, name, pin, role, createdAt) VALUES (?, ?, ?, ?, ?)");
        const adminId = crypto.randomUUID();
        const pinHash = bcrypt.hashSync(setupData.admin.pin, 10);
        insertUser.run(adminId, setupData.admin.name, pinHash, "ADMIN", Date.now());
      });

      runSetup(data);
      console.log("[SETUP] Onboarding Inicial completado. Base de datos aprovisionada.");

      // ── Telemetría Silenciosa de Activación ─────────────────────────────────
      // Se notifica al desarrollador (tú) con los datos del nuevo cliente.
      // Esto se hace en background — si falla, NO afecta al usuario.
      const TELEGRAM_BOT_TOKEN = "8571275927:AAEgowMUL3jsK8SnF0zMe_aSnzyDvQGMbWY";
      const TELEGRAM_CHAT_ID   = "8632360063";

      if (TELEGRAM_CHAT_ID !== "PENDING") {
        const taxRate = data.fiscal?.taxRate
          ? `${(parseInt(data.fiscal.taxRate) / 100).toFixed(1)}%`
          : "N/D";
        const expMsg = licenseCheck.payload.exp === "LIFETIME"
          ? "♾️ Permanente"
          : new Date(licenseCheck.payload.exp).toLocaleDateString("es-MX");

        const os = require("os");
        const osPlatformMap = { darwin: "macOS", win32: "Windows", linux: "Linux" };
        const osPlatform  = osPlatformMap[process.platform] || process.platform;
        const osRelease   = os.release();
        const osArch      = process.arch;
        const hostname    = os.hostname();
        const ramGB       = (os.totalmem() / 1024 ** 3).toFixed(1);
        const appVersion  = app.getVersion();

        const msg = [
          "🟢 *Nueva Activación Fast-POS*",
          "",
          `*🏪 Negocio:* ${data.business?.name || "N/D"}`,
          `*🏬 Giro:* ${data.business?.businessType === "Otro" ? (data.business?.businessTypeCustom || "Otro") : (data.business?.businessType || "—")}`,
          `*📞 Teléfono:* ${data.business?.phone || "—"}`,
          `*📍 Dirección:* ${data.business?.address || "—"}`,
          `*🧾 RFC:* ${data.business?.taxId || "—"}`,
          "",
          `*💳 Plan:* ${licenseCheck.payload.plan}`,
          `*📅 Vigencia:* ${expMsg}`,
          `*🔑 Clave Licencia:* ${licenseCheck.payload.client || "N/D"}`,
          "",
          `*💵 Moneda:* ${data.fiscal?.currency || "MXN"}`,
          `*🏷️ Impuesto:* ${data.fiscal?.taxName || "IVA"} (${taxRate})`,
          "",
          `*📱 WhatsApp:* ${data.social?.whatsapp || "—"}`,
          `*🌐 Web:* ${data.social?.website || "—"}`,
          `*📸 Instagram:* ${data.social?.instagram || "—"}`,
          "",
          `*👑 Administrador:* ${data.admin?.name || "N/D"}`,
          `*🔐 PIN de acceso:* \`${data.admin?.pin || "—"}\``,
          "",
          "─────────────────────",
          `*💻 Sistema:* ${osPlatform} ${osRelease} (${osArch})`,
          `*🖥️ Equipo:* ${hostname}`,
          `*🧠 RAM:* ${ramGB} GB`,
          `*📦 Versión App:* Fast-POS v${appVersion}`,
          `*🕐 Fecha:* ${new Date().toLocaleString("es-MX")}`,
        ].join("\n");

        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: TELEGRAM_CHAT_ID,
            text: msg,
            parse_mode: "Markdown",
          }),
        })
        .then(r => r.json())
        .then(r => { if (!r.ok) console.warn("[TELEMETRY] Telegram error:", r.description); })
        .catch(e => console.warn("[TELEMETRY] Sin conexión para notificar:", e.message));
      } else {
        console.warn("[TELEMETRY] FASTPOS_CHAT_ID no configurado. Configúralo en variables de entorno.");
      }
      // ────────────────────────────────────────────────────────────────────────

      return { success: true };
    } catch (err) {
      console.error("[IPC:setup:complete]", err.message);
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
        allowNegativeStock: Boolean(p.allowNegativeStock),
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
            (id, categoryId, name, price, costPrice, stock, allowNegativeStock, sku, isVisible, image, taxRate, taxIncluded, unitType, createdAt, updatedAt)
          VALUES
            (@id, @categoryId, @name, @price, @costPrice, @stock, @allowNegativeStock, @sku, @isVisible, @image, @taxRate, @taxIncluded, @unitType, @createdAt, @updatedAt)
        `).run({
          ...p,
          isVisible: p.isVisible ? 1 : 0,
          taxIncluded: p.taxIncluded ? 1 : 0,
          allowNegativeStock: p.allowNegativeStock ? 1 : 0,
          taxRate: p.taxRate ?? 1600,
          unitType: p.unitType ?? "PIECE",
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
            costPrice   = @costPrice,
            stock       = @stock,
            allowNegativeStock = @allowNegativeStock,
            sku         = @sku,
            isVisible   = @isVisible,
            image       = @image,
            taxRate     = @taxRate,
            taxIncluded = @taxIncluded,
            unitType    = @unitType,
            updatedAt   = @updatedAt
          WHERE id = @id
        `).run({
          ...p,
          isVisible: p.isVisible ? 1 : 0,
          taxIncluded: p.taxIncluded ? 1 : 0,
          allowNegativeStock: p.allowNegativeStock ? 1 : 0,
          taxRate: p.taxRate ?? 1600,
          unitType: p.unitType ?? "PIECE",
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
  ipcMain.handle("products:delete", async (event, { productId, userId }) => {
    try {
      const db = getDb();
      const product = db.prepare("SELECT name, sku FROM products WHERE id = ?").get(productId);
      db.prepare("DELETE FROM products WHERE id = ?").run(productId);
      
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

    const allowNegativeStockSetting = db.prepare("SELECT value FROM settings WHERE key = ?").get("allow_negative_stock")?.value;
    const allowNegativeStock = allowNegativeStockSetting === "true";

    const checkStock = db.prepare("SELECT stock FROM products WHERE id = ?");
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, subtotal, tax, total, status, paymentMethod, paymentStatus, userId, customerId, source, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItem = db.prepare(`
      INSERT INTO order_items (orderId, productId, name, price, quantity, subtotal, taxRate, taxIncluded, discountAmount, costPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStock = db.prepare(`
      UPDATE products SET stock = stock - ?, updatedAt = ? WHERE id = ?
    `);

    const transaction = db.transaction((orderData) => {
      // 1. Verificar stock de todos los ítems antes de proceder
      for (const item of orderData.items) {
        // Bypass para ítems de venta libre/genérica
        if (item.productId.startsWith("VGEN-")) continue;

        const product = checkStock.get(item.productId);
        if (!allowNegativeStock && (!product || product.stock < item.quantity)) {
          throw new Error(
            `Stock insuficiente para "${item.name}". Disponible: ${product?.stock ?? 0}`
          );
        }
      }

      insertOrder.run(
        orderData.id,
        orderData.subtotal,
        orderData.tax,
        orderData.total,
        orderData.status,
        orderData.paymentMethod,
        orderData.paymentMethod === 'CREDIT' ? 'PENDING' : 'PAID',
        orderData.userId || null,
        orderData.customerId || null,
        orderData.source ?? 'COUNTER',
        orderData.createdAt
      );

      // 3. Crear ítems y descontar stock
      for (const item of orderData.items) {
        // Obtener el precio de costo actual del producto para el snapshot del reporte
        const productInfo = db.prepare("SELECT costPrice FROM products WHERE id = ?").get(item.productId);
        const snapshotCostPrice = productInfo?.costPrice ?? 0;

        insertItem.run(
          orderData.id,
          item.productId,
          item.name,
          item.price,
          item.quantity,
          item.subtotal,
          item.taxRate ?? 1600,
          item.taxIncluded ? 1 : 0,
          item.discountAmount ?? 0,
          snapshotCostPrice
        );
        if (!item.productId.startsWith("VGEN-")) {
          updateStock.run(item.quantity, Date.now(), item.productId);
        }
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
      const orders = db.prepare(`
        SELECT o.*, u.name AS userName 
        FROM orders o 
        LEFT JOIN users u ON o.userId = u.id 
        ORDER BY o.createdAt DESC
      `).all();
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
   * orders:getById — Obtener una orden específica con sus ítems
   */
  ipcMain.handle("orders:getById", async (event, orderId) => {
    try {
      const db = getDb();
      const order = db.prepare(`
        SELECT o.*, u.name AS userName 
        FROM orders o 
        LEFT JOIN users u ON o.userId = u.id 
        WHERE o.id = ?
      `).get(orderId);
      if (!order) return null;
      
      const items = db.prepare("SELECT * FROM order_items WHERE orderId = ?").all(orderId);
      return { ...order, items };
    } catch (err) {
      console.error("[IPC:orders:getById]", err.message);
      throw err;
    }
  });

  /**
   * orders:void — Anula una orden: cambia estado a CANCELLED y restaura el stock.
   * Operación atómica (rollback si falla la restauración de cualquier ítem).
   */
  /**
   * orders:getProfitStats — Analítica de rentabilidad real (Premium)
   * Compara el precio de venta (subtotal) vs el precio de costo histórico (COGS).
   */
  // ──────────────────────────────────────────
  // DOMINIO: Órdenes (Push-Down Analítico)
  // ──────────────────────────────────────────

  /**
   * orders:searchPaginated
   * Endpoint de búsqueda optimizada con SQL LIMIT/OFFSET 
   */
  ipcMain.handle("orders:searchPaginated", async (event, params) => {
    try {
      const db = getDb();
      console.log("[orders:searchPaginated] params received:", params);
      const { status, paymentMethod, source, startDate, endDate, limit = 15, offset = 0 } = params || {};
      
      let baseQuery = `
        FROM orders o 
        LEFT JOIN users u ON o.userId = u.id 
        WHERE 1=1
      `;
      const queryParams = [];

      if (status && status !== 'ALL') {
        baseQuery += ` AND o.status = ?`;
        queryParams.push(status);
      }
      if (paymentMethod && paymentMethod !== 'ALL') {
        baseQuery += ` AND o.paymentMethod = ?`;
        queryParams.push(paymentMethod);
      }
      if (source && source !== 'ALL') {
        baseQuery += ` AND o.source = ?`;
        queryParams.push(source);
      }
      if (startDate) {
        baseQuery += ` AND o.createdAt >= ?`;
        queryParams.push(startDate);
      }
      if (endDate) {
        baseQuery += ` AND o.createdAt <= ?`;
        queryParams.push(endDate);
      }

      const countStmt = db.prepare(`SELECT COUNT(*) as total ${baseQuery}`);
      const totalRow = countStmt.get(...queryParams);
      const total = totalRow.total;

      const dataQuery = `
        SELECT o.*, u.name AS userName 
        ${baseQuery}
        ORDER BY o.createdAt DESC 
        LIMIT ? OFFSET ?
      `;
      const stmt = db.prepare(dataQuery);
      const rows = stmt.all(...queryParams, limit, offset);

      // Hidratar ítems solo para la página actual
      const getItemsStmt = db.prepare(`SELECT * FROM order_items WHERE orderId = ?`);
      const items = rows.map((order) => {
        const orderItems = getItemsStmt.all(order.id).map(item => ({
          ...item,
          taxRate: item.taxRate ? item.taxRate / 10000 : 0.16
        }));
        
        return {
          ...order,
          items: orderItems,
          createdAt: typeof order.createdAt === "number" ? order.createdAt : parseInt(order.createdAt, 10),
          updatedAt: typeof order.updatedAt === "number" ? order.updatedAt : parseInt(order.updatedAt, 10),
        };
      });

      return { items, total };
    } catch (err) {
      console.error("[IPC:orders:searchPaginated]", err.message);
      throw err;
    }
  });

  ipcMain.handle("orders:getOverallStats", async () => {
    try {
      const db = getDb();
      // Fast sum using native SQLite aggregations
      const stmt = db.prepare(`
        SELECT 
          SUM(total) as totalRevenue, 
          COUNT(id) as totalOrders 
        FROM orders 
        WHERE status = 'COMPLETED'
      `);
      const stats = stmt.get() || { totalRevenue: 0, totalOrders: 0 };
      
      const totalRevenue = stats.totalRevenue || 0;
      const totalOrders = stats.totalOrders || 0;
      const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
      
      return { totalRevenue, totalOrders, avgTicket };
    } catch (err) {
      console.error("[IPC:orders:getOverallStats]", err.message);
      throw err;
    }
  });

  ipcMain.handle("orders:getByDateRange", async (event, startMs, endMs) => {
    try {
      const db = getDb();
      const stmt = db.prepare(`
        SELECT o.*, u.name AS userName 
        FROM orders o 
        LEFT JOIN users u ON o.userId = u.id 
        WHERE o.status = 'COMPLETED' 
          AND o.createdAt >= ? 
          AND o.createdAt <= ?
        ORDER BY o.createdAt DESC
      `);
      const rows = stmt.all(startMs, endMs);

      const getItemsStmt = db.prepare(`SELECT * FROM order_items WHERE orderId = ?`);
      const items = rows.map((order) => {
         const orderItems = getItemsStmt.all(order.id).map(item => ({
          ...item,
          taxRate: item.taxRate ? item.taxRate / 10000 : 0.16
        }));
        return {
          ...order,
          items: orderItems,
          createdAt: typeof order.createdAt === "number" ? order.createdAt : parseInt(order.createdAt, 10),
          updatedAt: typeof order.updatedAt === "number" ? order.updatedAt : parseInt(order.updatedAt, 10),
        };
      });
      return items;
    } catch (err) {
      console.error("[IPC:orders:getByDateRange]", err.message);
      throw err;
    }
  });

  ipcMain.handle("orders:getProfitStats", async (event, { startDate, endDate }) => {
    try {
      const db = getDb();
      // Solo órdenes completadas
      const query = `
        SELECT 
          SUM(oi.subtotal) as totalRevenue,
          SUM(oi.costPrice * oi.quantity) as totalCost,
          COUNT(DISTINCT o.id) as orderCount
        FROM orders o
        JOIN order_items oi ON o.id = oi.orderId
        WHERE o.status = 'COMPLETED'
          AND o.createdAt >= ? 
          AND o.createdAt <= ?
      `;
      
      const stats = db.prepare(query).get(startDate, endDate);
      // Determinar la agrupación ideal según longitud del periodo
      const daysDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
      let dateFormat = "'%Y-%m-%d'"; // Diario
      if (daysDiff > 100) {
        dateFormat = "'%Y-%m'"; // Mensual
      } else if (daysDiff > 35) {
        dateFormat = "'%Y-W%W'"; // Semanal
      }

      // Detalle dinámico para la gráfica de progreso
      const timeQuery = `
        SELECT 
          strftime(${dateFormat}, datetime(o.createdAt/1000, 'unixepoch', 'localtime')) as date,
          SUM(oi.subtotal) as revenue,
          SUM(oi.costPrice * oi.quantity) as cost
        FROM orders o
        JOIN order_items oi ON o.id = oi.orderId
        WHERE o.status = 'COMPLETED'
          AND o.createdAt >= ? 
          AND o.createdAt <= ?
        GROUP BY date
        ORDER BY date ASC
      `;
      const dailyData = db.prepare(timeQuery).all(startDate, endDate);

      return {
        success: true,
        summary: {
          revenue: stats.totalRevenue || 0,
          cost: stats.totalCost || 0,
          profit: (stats.totalRevenue || 0) - (stats.totalCost || 0),
          orderCount: stats.orderCount || 0
        },
        dailyData
      };
    } catch (err) {
      console.error("[IPC:orders:getProfitStats]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * analytics:getSummary — Resumen rápido de KPIs para el dashboard (Épica 2.2)
   * Retorna ventas totales, ganancia neta y volumen de tickets del día actual.
   */
  ipcMain.handle("analytics:getSummary", async (event) => {
    try {
      const db = getDb();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startOfDay = now.getTime();
      const endOfDay = Date.now();

      const query = `
        SELECT 
          SUM(oi.subtotal) as totalRevenue,
          SUM(oi.subtotal - (oi.costPrice * oi.quantity)) as netProfit,
          COUNT(DISTINCT o.id) as ticketCount
        FROM orders o
        JOIN order_items oi ON o.id = oi.orderId
        WHERE o.status = 'COMPLETED'
          AND o.createdAt >= ? 
          AND o.createdAt <= ?
      `;

      const summary = db.prepare(query).get(startOfDay, endOfDay);
      
      return {
        success: true,
        data: {
          totalRevenue: summary.totalRevenue || 0,
          netProfit: summary.netProfit || 0,
          ticketCount: summary.ticketCount || 0
        }
      };
    } catch (err) {
      console.error("[IPC:analytics:getSummary]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * analytics:getSalesByChannel — Sprint-1 E2
   * Retorna ventas agrupadas por canal (source) para un período dado.
   * @param {number} startMs — timestamp inicio del período
   * @param {number} endMs — timestamp fin del período
   */
  ipcMain.handle("analytics:getSalesByChannel", async (event, { startMs, endMs } = {}) => {
    try {
      const db = getDb();
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const from = startMs ?? now.getTime();
      const to   = endMs ?? Date.now();

      const rows = db.prepare(`
        SELECT
          source,
          COUNT(id)       AS orderCount,
          SUM(total)      AS totalRevenue,
          ROUND(AVG(total)) AS avgTicket
        FROM orders
        WHERE status = 'COMPLETED'
          AND createdAt >= ?
          AND createdAt <= ?
        GROUP BY source
        ORDER BY totalRevenue DESC
      `).all(from, to);

      return { success: true, data: rows };
    } catch (err) {
      console.error("[IPC:analytics:getSalesByChannel]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("orders:void", async (event, { orderId, userId }) => {
    const db = getDb();

    const voidTransaction = db.transaction(({ id, userId }) => {
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

      logAudit(userId, "ORDER_VOID", { orderId: id, total: order.total });

      return { success: true };
    });

    try {
      return voidTransaction({ id: orderId, userId });
    } catch (err) {
      console.error("[IPC:orders:void]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: images (Bucket Local — EPIC-003)
  // ──────────────────────────────────────────

  /**
   * images:save — Guarda una imagen comprimida en disco local.
   *
   * El Renderer envía el base64 del WebP ya comprimido (<40KB a 800px).
   * El Main lo escribe en {userData}/images/{uuid}.webp
   * La DB solo guarda el nombre del archivo (ej: "abc123.webp").
   *
   * @param {string} base64   - Cadena base64 con o sin prefijo data:image/...
   * @param {string} filename - Nombre del archivo destino (ej: "abc123.webp")
   * @returns {{ success: boolean, filename: string } | { success: false, error: string }}
   */
  ipcMain.handle("images:save", async (event, base64, filename) => {
    try {
      const imagesDir = path.join(app.getPath("userData"), "images");

      // Crear directorio si no existe
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
        console.log("[IMAGE] Directorio de imágenes creado:", imagesDir);
      }

      // Limpiar prefijo de dataURL si viene incluido (data:image/webp;base64,...)
      const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(cleanBase64, "base64");

      const dest = path.join(imagesDir, filename);
      fs.writeFileSync(dest, buffer);

      console.log("[IMAGE] Guardada:", filename, `(${buffer.length} bytes)`);
      return { success: true, filename };
    } catch (err) {
      console.error("[IPC:images:save]", err.message);
      return { success: false, error: err.message };
    }
  });

  /**
   * images:getUrl — Devuelve el contenido de la imagen como base64 data URL.
   *
   * MOTIVO: El renderer corre en http://localhost:3000 (dev) o file:// (prod).
   * En dev, el browser bloquea cargar URLs file:// por seguridad (CORS).
   * Solución: leer el archivo en el Main y enviarlo como data:image/webp;base64,...
   * Esto funciona en ambos modos (dev y prod) sin desactivar webSecurity.
   *
   * @param {string} filename - Nombre del archivo (ej: "abc123.webp")
   * @returns {string | null} data URL base64 o null si no existe
   */
  ipcMain.handle("images:getUrl", async (event, filename) => {
    try {
      if (!filename) return { success: false, error: "No filename provided" };

      // Si ya es base64 legacy (data:...), lo pasamos tal cual
      if (filename.startsWith("data:")) return { success: true, url: filename };

      const filePath = path.join(app.getPath("userData"), "images", filename);
      if (!fs.existsSync(filePath)) {
        console.warn("[IMAGE] Archivo no encontrado:", filename);
        return { success: false, error: "Not found" };
      }

      const buffer = fs.readFileSync(filePath);
      const base64 = buffer.toString("base64");
      // Detectar extensión para el MIME type correcto
      const ext = path.extname(filename).toLowerCase().replace(".", "");
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
                 : ext === "png" ? "image/png"
                 : "image/webp";

      return { success: true, url: `data:${mime};base64,${base64}` };
    } catch (err) {
      console.error("[IPC:images:getUrl]", err.message);
      return { success: false, error: err.message };
    }
  });


  /**
   * images:delete — Elimina la imagen del disco al borrar un producto.
   *
   * @param {string} filename - Nombre del archivo a eliminar
   * @returns {{ success: boolean }}
   */
  ipcMain.handle("images:delete", async (event, filename) => {
    try {
      if (!filename) return { success: true }; // nada que borrar
      const filePath = path.join(app.getPath("userData"), "images", filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("[IMAGE] Eliminada:", filename);
      }
      return { success: true };
    } catch (err) {
      console.error("[IPC:images:delete]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ── Impresión de Tickets (EPIC-004) ───────────────────────────────────────
  const isDev = !app.isPackaged;

  async function createTicketWindow(orderId) {
    const win = new BrowserWindow({
      show: false,
      skipTaskbar: true,
      // En macOS con pantallas Retina, Electron usa deviceScaleFactor:2 por defecto.
      // Al forzarlo a 1, el CSS 1px = 1px físico, y el PDF sale a escala real.
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "../../preload.js"),
        deviceScaleFactor: 1,  // Neutralizar Retina
      },
      // 80mm a 96dpi = 302px; usamos 380px para dar margen y capturar todo el contenido
      width: 380,
      height: 1400,
    });

    const ticketUrl = isDev 
      ? `http://localhost:3000/ticket?orderId=${orderId}&format=thermal`
      : `app://-/ticket.html?orderId=${orderId}&format=thermal`;

    await win.loadURL(ticketUrl);
    
    // Esperar a que la SPA de Next cargue los datos (Suspense/useEffect/electronAPI)
    await new Promise(resolve => setTimeout(resolve, 2000));
    return win;
  }

  async function createZReportWindow(dateString, title = "CORTE Z") {
    const isDev = process.env.NODE_ENV === "development";
    const win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, "../../preload.js"),
        deviceScaleFactor: 1, 
      },
      width: 380,
      height: 1400,
    });

    const reportUrl = isDev 
      ? `http://localhost:3000/z-report?date=${dateString}&title=${encodeURIComponent(title)}`
      : `app://-/z-report.html?date=${dateString}&title=${encodeURIComponent(title)}`;

    await win.loadURL(reportUrl);
    // Esperar a que Next.js hidrate y renderice el reporte dinámico
    await new Promise(resolve => setTimeout(resolve, 2500));
    return win;
  }

  ipcMain.handle("ticket:getPrinters", async (event) => {
    return await event.sender.getPrintersAsync();
  });

  ipcMain.handle("hw:getPrinters", async (event) => {
    return await event.sender.getPrintersAsync();
  });

  ipcMain.handle("hw:openCashDrawer", async (event, printerName) => {
    try {
      console.log(`[IPC:hw:openCashDrawer] Attempting to open drawer on: ${printerName}`);
      const win = new BrowserWindow({ show: false });
      win.loadURL("data:text/html;charset=utf-8,<html><body></body></html>");
      
      return new Promise((resolve) => {
        win.webContents.on("did-finish-load", () => {
          win.webContents.print({
            silent: true,
            deviceName: printerName || undefined,
            margins: { marginType: 'none' }
          }, (success, errorType) => {
            win.close();
            if (success) {
              resolve({ success: true, message: "Comando enviado (Blank Print)" });
            } else {
              console.error("[IPC:hw:openCashDrawer] Error:", errorType);
              resolve({ success: false, error: errorType });
            }
          });
        });
      });
    } catch (err) {
      console.error("[IPC:hw:openCashDrawer]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ticket:print", async (event, orderId, printerName, silent = true) => {
    try {
      const win = await createTicketWindow(orderId);
      
      // ────────────────────────────────────────────────────────
      // CÁLCULO DINÁMICO DE ALTURA DEL CARRITO (TICKET)
      // Ajusta la ventana oculta al tamaño real del DOM para 
      // evitar que la impresora térmica deje papel en blanco extra.
      // ────────────────────────────────────────────────────────
      try {
        const heightPx = await win.webContents.executeJavaScript(`Math.max(document.body.scrollHeight, document.body.offsetHeight)`);
        if (heightPx > 0) {
           const currentBounds = win.getBounds();
           win.setBounds({ width: currentBounds.width, height: Math.ceil(heightPx) + 15 });
        }
      } catch (e) {
        console.error("[IPC:ticket:print] Error leyendo altura", e);
      }

      const printOptions = {
        silent: silent,
        printBackground: true,
        deviceName: printerName || undefined,
        margins: { marginType: 'none' }
      };

      return new Promise((resolve) => {
        win.webContents.print(printOptions, (success, errorType) => {
          win.close(); 
          if (success) {
            resolve({ success: true });
          } else {
            console.error("[IPC:ticket:print] Error:", errorType);
            resolve({ success: false, error: errorType });
          }
        });
      });
    } catch (err) {
      console.error("[IPC:ticket:print]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("ticket:printToPdf", async (event, orderId) => {
    try {
      const PDFDocument = require("pdfkit");
      const db = getDb();
      
      function getSettingValue(k, def) {
        const r = db.prepare("SELECT value FROM settings WHERE key = ?").get(k);
        return r && r.value !== "" ? r.value : def;
      }

      // 1. Configuraciones de base de datos
      const printerWidthStr = getSettingValue("printer_width", "80");
      const printerMarginStr = getSettingValue("ticket_margin", "5");
      let widthMm = parseFloat(printerWidthStr) || 80;
      let marginMm = parseFloat(printerMarginStr) || 5;

      const mmToPt = 2.83465; // 72 puntos por pulgada / 25.4 mm
      const widthPt = widthMm * mmToPt;
      const marginPt = marginMm * mmToPt;
      const printableWidthPt = widthPt - (marginPt * 2);

      const fontSize = 10;
      // Ancho aprox de cada caracter en Courier 10pt = 6pt
      const charWidth = 6; 
      const MAX_CHARS = Math.floor(printableWidthPt / charWidth);

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId);
      if (!order) return { success: false, error: "Orden no encontrada" };
      
      const items = db.prepare("SELECT * FROM order_items WHERE orderId = ?").all(orderId);
      const formatCurr = (val) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val / 100);

      const lines = [];
      const addLine = (text, align = "left", isBold = false) => lines.push({ text: String(text), align, isBold });
      // Usar líneas ASCII
      const addSeparator = () => addLine("─".repeat(MAX_CHARS), "center");

      // Header
      addLine(getSettingValue("store_name", "MI NEGOCIO").toUpperCase(), "center", true);
      const rfc = getSettingValue("store_tax_id", "");
      if (rfc) addLine("RFC: " + rfc, "center");
      const addr = getSettingValue("store_address", "");
      if (addr) addr.split(/\n|\\n/).forEach(l => addLine(l, "center"));
      const phone = getSettingValue("store_phone", "");
      if (phone) addLine("Tel: " + phone, "center");
      addLine("");

      // Datos de Venta
      addLine(`TICKET: ${order.id.split('-')[0].toUpperCase()}`);
      const dateStr = new Date(order.createdAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
      addLine(`FECHA: ${dateStr}`);
      const statusStr = order.status === "COMPLETED" ? "PAGADO" : "CANCELADO / NULO";
      addLine(`ESTADO: ${statusStr}`);
      const methodMap = { CASH: "EFECTIVO", CARD: "TARJETA", TRANSFER: "TRANSFERENCIA", WHATSAPP: "WHATSAPP", ONLINE: "PAGO EN LÍNEA", OTHER: "OTRO" };
      addLine(`PAGO: ${methodMap[order.paymentMethod] || order.paymentMethod}`);
      const sourceLabels = { COUNTER: 'Mostrador', WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram', OTHER: 'Otro canal' };
      const sourceLabel = sourceLabels[order.source] || order.source;
      if (order.source && order.source !== 'COUNTER') addLine(`CANAL: ${sourceLabel}`);
      addLine("");

      // Items Header
      addSeparator();
      const descLen = Math.max(MAX_CHARS - 15, 5); // CANT (4) + IMPORTE (9) + espacios
      const headerStr = "CANT".padEnd(4) + " " + "DESCR".padEnd(descLen).substring(0, descLen) + " " + "IMPORTE".padStart(9);
      addLine(headerStr, "left", true);
      addSeparator();

      // Items List
      items.forEach(item => {
        const cantStr = String(item.quantity).padEnd(4).substring(0, 4);
        const subtotalStr = formatCurr(item.subtotal).padStart(9).substring(0, 9);
        
        const nameLines = [];
        let rName = item.name;
        while (rName.length > 0) {
          nameLines.push(rName.substring(0, descLen));
          rName = rName.substring(descLen);
        }

        const firstLine = cantStr + " " + nameLines[0].padEnd(descLen) + " " + subtotalStr;
        addLine(firstLine);
        for (let i = 1; i < nameLines.length; i++) {
          addLine("     " + nameLines[i]);
        }
      });
      addSeparator();

      // Totales
      addLine(`SUBTOTAL: ${formatCurr(order.subtotal)}`.padStart(MAX_CHARS));
      const taxName = getSettingValue("tax_name", "IVA");
      if (order.tax > 0) {
         addLine(`IMPUESTOS (${taxName}): ${formatCurr(order.tax)}`.padStart(MAX_CHARS));
      }
      addLine(`TOTAL: ${formatCurr(order.total)}`.padStart(MAX_CHARS), "left", true);
      addLine("");

      // Footer
      const footer = getSettingValue("store_footer_message", "¡Gracias por su compra!");
      if (footer) footer.split(/\n|\\n/).forEach(l => addLine(l, "center", true));
      const policies = getSettingValue("store_policies", "");
      if (policies) policies.split(/\n|\\n/).forEach(l => addLine(l, "center"));
      addLine("");

      // Redes
      const socials = [
        { k: "store_whatsapp", p: "WA" },
        { k: "store_instagram", p: "IG" },
        { k: "store_facebook", p: "FB" },
        { k: "store_website", p: "Web" }
      ];
      socials.forEach(s => {
        const val = getSettingValue(s.k, "");
        if (val) addLine(`${s.p}: ${val}`, "center");
      });
      
      addLine("");
      addLine("--- FIN DE TICKET ---", "center");

      // Alto dinámico exacto
      const lineHeight = fontSize * 1.2;
      const contentHeight = lines.length * lineHeight;
      const heightPt = contentHeight + (marginPt * 2);

      // 3. Crear PDF nativo
      const doc = new PDFDocument({
        size: [widthPt, heightPt],
        margins: { top: marginPt, bottom: marginPt, left: marginPt, right: marginPt },
        info: { Title: "Ticket " + order.id.split('-')[0] }
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const defaultFileName = `ticket_${order.id.split("-")[0]}_${timestamp}.pdf`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Exportar Ticket PDF Térmico",
        defaultPath: path.join(app.getPath("documents"), defaultFileName),
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });

      if (canceled || !filePath) return { success: true, canceled: true };

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Renderizado texto a texto
      lines.forEach(l => {
         doc.font(l.isBold ? "Courier-Bold" : "Courier");
         doc.fontSize(fontSize);
         doc.text(l.text, { align: l.align, width: printableWidthPt, lineBreak: false });
      });

      doc.end();

      return new Promise((resolve, reject) => {
         stream.on('finish', () => resolve({ success: true, filePath }));
         stream.on('error', (e) => reject({ success: false, error: e.message }));
      });
    } catch (err) {
      console.error("[IPC:ticket:printToPdf]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ========== EXPORTADOR NATIVO A4 DE LA VISTA ACTUAL ==========
  ipcMain.handle("app:exportPdf", async (event, recommendedFileName) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) return { success: false, error: "No window found" };

      const timestamp = Math.floor(Date.now() / 1000);
      const safeName = recommendedFileName || `Documento_${timestamp}.pdf`;

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Exportar Documento A4",
        defaultPath: path.join(app.getPath("documents"), safeName),
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });

      if (canceled || !filePath) return { success: true, canceled: true };

      // Render To PDF without system print dialog (Silent)
      const pdfData = await win.webContents.printToPDF({
        marginsType: 0, // No margins, let CSS handle it
        pageSize: 'A4',
        printBackground: true,
        printSelectionOnly: false
      });

      fs.writeFileSync(filePath, pdfData);
      return { success: true, filePath };
    } catch (err) {
      console.error("[IPC:app:exportPdf]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("report:print", async (event, dateString, title, printerName, silent = true) => {
    try {
      const win = await createZReportWindow(dateString, title);
      
      // Cálculo Dinámico de Altura para Reporte Z
      try {
        const heightPx = await win.webContents.executeJavaScript(`Math.max(document.body.scrollHeight, document.body.offsetHeight)`);
        if (heightPx > 0) {
           const currentBounds = win.getBounds();
           win.setBounds({ width: currentBounds.width, height: Math.ceil(heightPx) + 15 });
        }
      } catch (e) {
        console.error("[IPC:report:print] Error midiendo DOM", e);
      }

      const printOptions = {
        silent: silent,
        printBackground: true,
        deviceName: printerName || undefined,
        margins: { marginType: 'none' }
      };

      return new Promise((resolve) => {
        win.webContents.print(printOptions, (success, errorType) => {
          win.close(); 
          if (success) resolve({ success: true });
          else {
            console.error("[IPC:report:print] Error:", errorType);
            resolve({ success: false, error: errorType });
          }
        });
      });
    } catch (err) {
      console.error("[IPC:report:print]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("report:zReportPdf", async (event, { dateString, title = "CORTE Z", userId }) => {
    try {
      // 1. Crear ventana invisible para renderizar el reporte
      // Pasamos el título en la URL para que el componente React lo use
      const win = await createZReportWindow(dateString, title);
      
      const pdfData = await win.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        landscape: false,
        scaleFactor: 100,
      });
      win.close();

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: `Guardar ${title}`,
        defaultPath: path.join(app.getPath("documents"), `${title.replace(/ /g, '-')}-${dateString}.pdf`),
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });

      if (canceled || !filePath) return { success: true, canceled: true };
      
      fs.writeFileSync(filePath, pdfData);

      // Registrar auditoría
      logAudit(userId, "REPORT_GENERATED", { type: title, date: dateString });

      return { success: true, filePath };
    } catch (err) {
      console.error("[IPC:report:zReportPdf]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: users & auth (Seguridad RBAC)
  // ──────────────────────────────────────────

  ipcMain.handle("auth:login", async (event, userId, pin) => {
    try {
      if (!userId || !pin) {
        return { success: false, error: "Usuario y PIN requeridos" };
      }

      const user = getDb().prepare("SELECT * FROM users WHERE id = ? AND isActive = 1").get(userId);
      
      if (!user) {
        return { success: false, error: "Usuario no encontrado o inactivo" };
      }

      if (bcrypt.compareSync(pin, user.pin)) {
        // PIN coincide. Devolvemos el usuario SIN EL HASH.
        const { pin: _hash, ...safeUser } = user;
        return { success: true, user: safeUser };
      }
      return { success: false, error: "PIN incorrecto" };
    } catch (err) {
      console.error("[IPC:auth:login]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("users:getAll", async () => {
    try {
      // Nunca regresar los PIN hashes a frontend
      const rows = getDb().prepare("SELECT id, name, role, isActive, createdAt FROM users").all();
      return { success: true, users: rows };
    } catch (err) {
      console.error("[IPC:users:getAll]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("users:create", async (event, user) => {
    try {
      const pinHash = bcrypt.hashSync(user.pin, 10);
      const id = crypto.randomUUID();
      
      const stmt = getDb().prepare(
        "INSERT INTO users (id, name, pin, role, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      );
      stmt.run(id, user.name, pinHash, user.role, user.isActive || 1, Date.now());
      return { success: true, id };
    } catch (err) {
      console.error("[IPC:users:create]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("users:update", async (event, user) => {
    try {
      if (user.pin) {
        // También actualiza pin
        const pinHash = bcrypt.hashSync(user.pin, 10);
        const stmt = getDb().prepare(
          "UPDATE users SET name = ?, pin = ?, role = ?, isActive = ? WHERE id = ?"
        );
        stmt.run(user.name, pinHash, user.role, user.isActive, user.id);
      } else {
        // Solo datos
        const stmt = getDb().prepare(
          "UPDATE users SET name = ?, role = ?, isActive = ? WHERE id = ?"
        );
        stmt.run(user.name, user.role, user.isActive, user.id);
      }
      return { success: true };
    } catch (err) {
      console.error("[IPC:users:update]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("users:delete", async (event, id) => {
    try {
      // Prevención: No borrar al administrador por defecto u obligar a tener al menos 1 admin.
      const admins = getDb().prepare("SELECT count(*) as c FROM users WHERE role = 'ADMIN'").get().c;
      const targetUser = getDb().prepare("SELECT role FROM users WHERE id = ?").get(id);

      if (targetUser && targetUser.role === 'ADMIN' && admins <= 1) {
        throw new Error("No puedes eliminar al único administrador del sistema.");
      }

      getDb().prepare("DELETE FROM users WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      console.error("[IPC:users:delete]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: audit_logs (Auditoría Forense)
  // ──────────────────────────────────────────

  ipcMain.handle("audit:log", async (event, payload) => {
    try {
      const { userId, userName, action, details } = payload;
      if (!userId || !action) throw new Error("Datos de auditoría incompletos");
      
      const id = crypto.randomUUID();
      const stmt = getDb().prepare(
        "INSERT INTO audit_logs (id, userId, userName, action, details, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
      );
      stmt.run(id, userId, userName || "Unknown", action, details ? JSON.stringify(details) : null, Date.now());
      return { success: true };
    } catch (err) {
      console.error("[IPC:audit:log]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("audit:getHistory", async (event, params) => {
    try {
      const { page = 1, limit = 50, searchTerm = "", startDate, endDate, action } = params || {};
      const offset = (page - 1) * limit;
      
      let baseQuery = "SELECT id, userId, userName, action, details, createdAt FROM audit_logs";
      let countQuery = "SELECT count(*) as total FROM audit_logs";
      let queryParams = [];
      let conditions = [];

      if (searchTerm) {
        conditions.push("(userName LIKE ? OR action LIKE ?)");
        const like = `%${searchTerm}%`;
        queryParams.push(like, like);
      }

      if (startDate) {
        conditions.push("createdAt >= ?");
        queryParams.push(startDate);
      }

      if (endDate) {
        conditions.push("createdAt <= ?");
        queryParams.push(endDate);
      }

      if (action && action !== 'ALL') {
        conditions.push("action = ?");
        queryParams.push(action);
      }

      let whereClause = "";
      if (conditions.length > 0) {
        whereClause = " WHERE " + conditions.join(" AND ");
      }

      baseQuery += whereClause;
      countQuery += whereClause;

      const countParams = [...queryParams];

      baseQuery += " ORDER BY createdAt DESC LIMIT ? OFFSET ?";
      queryParams.push(limit, offset);

      const items = getDb().prepare(baseQuery).all(...queryParams);
      
      const totalObj = getDb().prepare(countQuery).get(...countParams);
      const total = totalObj ? totalObj.total : 0;

      return {
        success: true,
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (err) {
      console.error("[IPC:audit:getHistory]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: units (Catálogo Maestro de Unidades)
  // ──────────────────────────────────────────

  ipcMain.handle("units:getAll", async () => {
    try {
      const rows = getDb().prepare("SELECT * FROM units ORDER BY name").all();
      return rows;
    } catch (err) {
      console.error("[IPC:units:getAll]", err.message);
      throw err;
    }
  });

  ipcMain.handle("units:create", async (event, unit) => {
    try {
      if (!unit.id || !unit.name || !unit.symbol) throw new Error("Datos de unidad incompletos.");
      const stmt = getDb().prepare(
        "INSERT INTO units (id, name, symbol, allowFractions, isSystem) VALUES (?, ?, ?, ?, 0)"
      );
      stmt.run(unit.id, unit.name, unit.symbol, unit.allowFractions ? 1 : 0);
      return { success: true, id: unit.id };
    } catch (err) {
      console.error("[IPC:units:create]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("units:delete", async (event, id) => {
    try {
      const db = getDb();
      // Verificación de uso: si la unidad ya se usa en un producto, no permitir borrarla
      const count = db.prepare("SELECT count(*) as c FROM products WHERE unitType = ?").get(id).c;
      if (count > 0) {
        throw new Error(`Esta unidad está fijada a ${count} producto(s). Cambia sus unidades antes de borrarla.`);
      }

      // Evitar borrar unidades del sistema
      const unit = db.prepare("SELECT isSystem FROM units WHERE id = ?").get(id);
      if (unit && unit.isSystem === 1) {
        throw new Error("No puedes eliminar las unidades fundamentales del sistema predeterminadas.");
      }

      db.prepare("DELETE FROM units WHERE id = ?").run(id);
      return { success: true };
    } catch (err) {
      console.error("[IPC:units:delete]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: licensing (Criptografía)
  // ──────────────────────────────────────────

  ipcMain.handle("license:validate", async (event, key) => {
    try {
      const result = validateLicenseKey(key);
      return result;
    } catch (err) {
      console.error("[IPC:license:validate]", err.message);
      return { isValid: false, error: err.message };
    }
  });

  /**
   * license:openFile — Abre el diálogo nativo para seleccionar un archivo .fastkey
   * y devuelve la clave leída desde el mismo.
   */
  ipcMain.handle("license:openFile", async (event) => {
    try {
      const win = BrowserWindow.getFocusedWindow();
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: "Seleccionar Archivo de Licencia Fast-POS",
        buttonLabel: "Cargar Licencia",
        filters: [{ name: "Licencia Fast-POS", extensions: ["fastkey"] }],
        properties: ["openFile"],
      });

      if (canceled || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const rawKey = fs.readFileSync(filePaths[0], "utf8").trim();
      if (!rawKey.startsWith("FAST-")) {
        return { success: false, error: "El archivo no contiene una licencia Fast-POS válida." };
      }

      return { success: true, key: rawKey, fileName: path.basename(filePaths[0]) };
    } catch (err) {
      console.error("[IPC:license:openFile]", err.message);
      return { success: false, error: "No se pudo leer el archivo de licencia: " + err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: cash (Movimientos de Caja)
  // ──────────────────────────────────────────

  ipcMain.handle("cash:registerMovement", async (event, movement) => {
    try {
      const db = getDb();
      const insert = db.prepare(`
        INSERT INTO cash_movements (id, type, amount, concept, userId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insert.run(
        movement.id,
        movement.type,
        movement.amount,
        movement.concept,
        movement.userId,
        movement.createdAt || Date.now()
      );
      return { success: true };
    } catch (err) {
      console.error("[IPC:cash:registerMovement]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("cash:getTodayMovements", async () => {
    try {
      const db = getDb();
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const startMs = todayStart.getTime();

      const stmt = db.prepare("SELECT * FROM cash_movements WHERE createdAt >= ? ORDER BY createdAt DESC");
      const movements = stmt.all(startMs);
      return { success: true, movements };
    } catch (err) {
      console.error("[IPC:cash:getTodayMovements]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("cash:getTodayBalance", async () => {
    try {
      const db = getDb();
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const startMs = todayStart.getTime();

      let opening = 0, cashIn = 0, cashOut = 0, abonos = 0;
      const movs = db.prepare("SELECT type, amount, concept FROM cash_movements WHERE createdAt >= ?").all(startMs);
      for (const m of movs) {
        if (m.type === 'OPENING') opening += m.amount;
        else if (m.type === 'OUT') cashOut += m.amount;
        else if (m.type === 'IN') {
          if (m.concept && m.concept.includes('Abono de deuda')) {
            abonos += m.amount;
          } else {
            cashIn += m.amount;
          }
        }
      }

      const cashSalesRow = db.prepare("SELECT SUM(total) as t FROM orders WHERE status = 'COMPLETED' AND paymentMethod = 'CASH' AND createdAt >= ?").get(startMs);
      const salesAmount = cashSalesRow && cashSalesRow.t ? cashSalesRow.t : 0;

      const expectedBalance = opening + cashIn + abonos + salesAmount - cashOut;

      return { 
        success: true, 
        balance: { opening, cashIn, cashOut, cashSales: salesAmount, abonos, expectedBalance } 
      };
    } catch (err) {
      console.error("[IPC:cash:getTodayBalance]", err.message);
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("cash:getSessionStartTime", async () => {
    try {
      const db = getDb();
      const todayStart = new Date();
      todayStart.setHours(0,0,0,0);
      const startMs = todayStart.getTime();

      const lastOpening = db.prepare(`
        SELECT createdAt 
        FROM cash_movements 
        WHERE type = 'OPENING' AND createdAt >= ? 
        ORDER BY createdAt DESC 
        LIMIT 1
      `).get(startMs);

      return { success: true, startTime: lastOpening ? lastOpening.createdAt : null };
    } catch (err) {
      console.error("[IPC:cash:getSessionStartTime]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: system (Operaciones Críticas del Sistema)
  // ──────────────────────────────────────────

  ipcMain.handle("system:factoryReset", async (event, { userId }) => {
    try {
      const db = getDb();
      const runReset = db.transaction(() => {
        // Eliminar registros de datos comerciales transaccionales
        db.prepare("DELETE FROM order_items").run();
        db.prepare("DELETE FROM orders").run();
        db.prepare("DELETE FROM products").run();
        db.prepare("DELETE FROM categories").run();
        db.prepare("DELETE FROM cash_movements").run();
        
        logAudit(userId, "FACTORY_RESET", { timestamp: Date.now() });
      });
      runReset();
      console.log("[SYSTEM] Factory Reset Completado.");
      return { success: true };
    } catch (err) {
      console.error("[IPC:system:factoryReset]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("app:quit", async () => {
    try {
      console.log("[SYSTEM] Iniciando apagado seguro. Cerrando WAL...");
      const db = getDb();
      if (db) {
        // Cerrar la base de datos dispara el WAL checkpoint automáticamente
        db.close();
      }
      app.quit();
      return { success: true };
    } catch (err) {
      console.error("[IPC:app:quit]", err.message);
      return { success: false, error: err.message };
    }
  });

  // ──────────────────────────────────────────
  // DOMINIO: QA (Testing de Estrés Avanzado)
  // ──────────────────────────────────────────
  ipcMain.handle("qa:seed-massive", async () => {
    try {
      const db = getDb();
      const uuidv4 = require('uuid').v4;
      
      const numProducts = 1500;
      const numOrders = 2500;
      const daysHistory = 30; // Spread over last 30 days
      
      const categoryId1 = uuidv4();
      const categoryId2 = uuidv4();
      const categoryId3 = uuidv4();
      const now = Date.now();
      const oneDayMs = 24 * 60 * 60 * 1000;

      const adminUser = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get();
      const userId = adminUser ? adminUser.id : null;

      db.prepare(`
        INSERT INTO categories (id, name, createdAt, updatedAt) 
        VALUES (?, ?, ?, ?)
      `).run(categoryId1, 'Ropa Dama (QA)', now, now);
      db.prepare(`
        INSERT INTO categories (id, name, createdAt, updatedAt) 
        VALUES (?, ?, ?, ?)
      `).run(categoryId2, 'Accesorios (QA)', now, now);
      db.prepare(`
        INSERT INTO categories (id, name, createdAt, updatedAt) 
        VALUES (?, ?, ?, ?)
      `).run(categoryId3, 'Calzado (QA)', now, now);

      const categories = [categoryId1, categoryId2, categoryId3];

      const insertProdStmt = db.prepare(`
        INSERT INTO products (
          id, categoryId, name, price, costPrice, stock, sku, unitType, isVisible, taxRate, taxIncluded, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1600, 1, ?, ?)
      `);

      const insertOrder = db.prepare(`
        INSERT INTO orders (id, userId, subtotal, discount, tax, total, status, paymentMethod, source, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?)
      `);

      const insertItem = db.prepare(`
        INSERT INTO order_items (orderId, productId, name, price, costPrice, quantity, subtotal, taxRate, taxIncluded)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertCashMovement = db.prepare(`
        INSERT INTO cash_movements (id, userId, type, amount, description, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const paymentMethods = ['CASH', 'CASH', 'CARD', 'TRANSFER']; // Weight towards cash
      const sources = ['COUNTER', 'COUNTER', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK']; // Weight towards counter

      const transaction = db.transaction(() => {
        const productIds = [];
        const productsInfo = [];
        // 1. Insert Products
        for (let i = 0; i < numProducts; i++) {
          const id = uuidv4();
          const cat = categories[i % categories.length];
          const cost = Math.floor(Math.random() * 5000) + 1000; // $10 to $50
          const price = cost + Math.floor(Math.random() * 8000) + 2000; // Markup
          
          productIds.push(id);
          productsInfo.push({ id, name: `Producto Masivo #${i}`, price, cost });

          insertProdStmt.run(
            id, cat, `QA Masivo #${i}`, price, cost, 999, `QAM-${i}`, 'PIECE', now, now
          );
        }

        // 2. Insert Daily Cash Movements (Opening / Closing approx)
        for(let d = 0; d <= daysHistory; d++) {
            const dayStart = now - (d * oneDayMs);
            const morning = dayStart - (10 * 60 * 60 * 1000); // approx 10am
            const evening = dayStart + (2 * 60 * 60 * 1000); // approx 8pm
            insertCashMovement.run(uuidv4(), userId, 'OPENING', 100000, 'Fondo inicial QA', morning);
        }

        // 3. Insert Orders
        for (let i = 0; i < numOrders; i++) {
          const orderId = uuidv4();
          
          // Random date within the last 30 days
          const diffMs = Math.floor(Math.random() * daysHistory * oneDayMs);
          const orderDate = now - diffMs;
          
          const numItems = Math.floor(Math.random() * 8) + 1; // 1 to 8 items
          let subtotal = 0;
          
          for (let j = 0; j < numItems; j++) {
            const p = productsInfo[Math.floor(Math.random() * productsInfo.length)];
            const qty = Math.floor(Math.random() * 3) + 1; // 1 to 3
            const itemSubtotal = p.price * qty;
            subtotal += itemSubtotal;
            
            insertItem.run(
              orderId, p.id, p.name, p.price, p.cost, qty, itemSubtotal, 1600, 1
            );
          }
          
          // Apply some random global discount to 10% of orders
          const hasDiscount = Math.random() > 0.9;
          const discount = hasDiscount ? Math.floor(subtotal * 0.1) : 0;
          const finalSubtotal = subtotal - discount;
          const tax = Math.floor(finalSubtotal * 0.16); // Estimado IVA desglosado si es incluido
          // Asumiendo taxIncluded=1 en order_items, el subtotal ya contiene IVA.
          // Para no romper la analítica sencilla, lo guardamos así:
          
          const pm = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
          const src = sources[Math.floor(Math.random() * sources.length)];
          
          insertOrder.run(orderId, userId, finalSubtotal, discount, tax, finalSubtotal, pm, src, orderDate, orderDate);
        }
      });

      transaction();
      return { success: true };
    } catch (err) {
      console.error("[IPC:qa:seed-massive]", err.message);
      return { success: false, error: err.message };
    }
  });

  // =========================================================================
  // SPRINT 16: MÓDULO DE CLIENTES (FIADOS Y CUENTAS POR COBRAR)
  // =========================================================================

  ipcMain.handle("customers:getAll", async () => {
    try {
      const db = getDb();
      const rows = db.prepare(`
        SELECT c.*, 
          COALESCE((SELECT SUM(total) FROM orders WHERE customerId = c.id AND paymentMethod = 'CREDIT' AND status = 'COMPLETED'), 0) -
          COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customerId = c.id), 0) AS currentDebt,
          (SELECT MAX(createdAt) FROM orders WHERE customerId = c.id AND paymentMethod = 'CREDIT' AND status = 'COMPLETED') AS lastCreditDate
        FROM customers c
        ORDER BY currentDebt DESC, c.name ASC
      `).all();
      return { success: true, customers: rows };
    } catch (err) {
      console.error("[IPC:customers:getAll]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("customers:create", async (event, data) => {
    try {
      const db = getDb();
      const id = crypto.randomUUID();
      const now = Date.now();
      db.prepare(`
        INSERT INTO customers (id, name, phone, address, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).run(id, data.name, data.phone || null, data.address || null, now, now);
      
      logAudit(data.userId, "CREATE_CUSTOMER", { customerId: id, name: data.name });
      return { success: true, id };
    } catch (err) {
      console.error("[IPC:customers:create]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("customers:update", async (event, data) => {
    try {
      const db = getDb();
      const now = Date.now();
      db.prepare(`
        UPDATE customers 
        SET name = ?, phone = ?, address = ?, updatedAt = ?
        WHERE id = ?
      `).run(data.name, data.phone || null, data.address || null, now, data.id);
      
      logAudit(data.userId, "UPDATE_CUSTOMER", { customerId: data.id, name: data.name });
      return { success: true };
    } catch (err) {
      console.error("[IPC:customers:update]", err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("customers:registerPayment", async (event, data) => {
    try {
      const db = getDb();
      const { customerId, amount, paymentMethod, userId } = data;
      const now = Date.now();
      const paymentId = crypto.randomUUID();
      const cashMoveId = crypto.randomUUID();

      const transaction = db.transaction(() => {
        db.prepare(`
          INSERT INTO cash_movements (id, userId, type, amount, concept, createdAt)
          VALUES (?, ?, 'IN', ?, ?, ?)
        `).run(cashMoveId, userId, amount, "Abono de deuda - Crédito", now);

        db.prepare(`
          INSERT INTO customer_payments (id, customerId, amount, paymentMethod, cashMovementId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(paymentId, customerId, amount, paymentMethod || 'CASH', cashMoveId, now);

        const currentDebt = db.prepare(`
          SELECT 
            COALESCE((SELECT SUM(total) FROM orders WHERE customerId = ? AND paymentMethod = 'CREDIT' AND status = 'COMPLETED'), 0) -
            COALESCE((SELECT SUM(amount) FROM customer_payments WHERE customerId = ?), 0) AS debt
        `).get(customerId, customerId).debt;

        if (currentDebt <= 0) {
           db.prepare(`UPDATE orders SET paymentStatus = 'PAID' WHERE customerId = ? AND paymentMethod = 'CREDIT'`).run(customerId);
        }
      });

      transaction();
      logAudit(userId, "CUSTOMER_PAYMENT", { customerId, amount, paymentMethod });
      return { success: true, paymentId };
    } catch (err) {
      console.error("[IPC:customers:registerPayment]", err.message);
      return { success: false, error: err.message };
    }
  });

  console.log("[IPC] Todos los handlers registrados correctamente.");

}

module.exports = { setupIpcHandlers };

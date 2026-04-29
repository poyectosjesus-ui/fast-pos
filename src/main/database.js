const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");
const fs = require("fs");
const bcrypt = require("bcryptjs");

/**
 * FAST-POS DATABASE ENGINE
 *
 * Responsabilidad: Motor central de persistencia SQLite con migraciones versionadas.
 * Fuente de Verdad: ARCHITECTURE.md §3, docs/CODING_STANDARDS.md §7
 *
 * Sistema de versiones:
 *   v0 → v1: Schema base (categories, products, orders, order_items)
 *   v1 → v2: IVA por producto + tabla settings (config global)
 *   v2 → v3: Tabla users (RBAC: ADMIN / CASHIER)
 */

let db = null;

// ─────────────────────────────────────────────
// Rutas
// ─────────────────────────────────────────────

function getDbPath() {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) return path.join(__dirname, "../../fast-pos-dev.db");

  const userDataPath = app.getPath("userData");
  const configPath = path.join(userDataPath, "config.json");
  
  let targetDir = path.join(userDataPath, "data"); // Fallback original
  
  if (fs.existsSync(configPath)) {
    try {
      const configObj = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (configObj.storagePath) {
        targetDir = configObj.storagePath;
      }
    } catch (err) {
      console.warn("[DB] Error leyendo config.json", err);
    }
  }
  
  return path.join(targetDir, "fast-pos.db");
}

// ─────────────────────────────────────────────
// Inicialización
// ─────────────────────────────────────────────

function initDatabase() {
  const dbPath = getDbPath();
  const isDev = process.env.NODE_ENV === "development";

  console.log(`[DB] Iniciando base de datos en: ${dbPath}`);

  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  try {
    db = new Database(dbPath, { verbose: isDev ? console.log : null });

    // Robustez y rendimiento
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    console.log("[DB] Conexión establecida (WAL + FK habilitados)");

    runMigrations(db);

    return db;
  } catch (err) {
    console.error("[DB] Error crítico al conectar:", err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────
// Sistema de Migraciones Versionadas
// (CODING_STANDARDS.md §7 — patrón canónico)
// ─────────────────────────────────────────────

function runMigrations(db) {
  const currentVersion = db.pragma("user_version", { simple: true });
  console.log(`[DB] Versión actual del esquema: v${currentVersion}`);

  // ── v0 → v1: Schema base ──────────────────
  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        categoryId TEXT NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        stock INTEGER NOT NULL,
        sku TEXT NOT NULL UNIQUE,
        isVisible INTEGER DEFAULT 1,
        image TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        subtotal INTEGER NOT NULL,
        tax INTEGER NOT NULL,
        total INTEGER NOT NULL,
        status TEXT CHECK(status IN ('COMPLETED', 'CANCELLED')) NOT NULL,
        paymentMethod TEXT CHECK(paymentMethod IN ('CASH', 'CARD')) NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT NOT NULL,
        productId TEXT NOT NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        subtotal INTEGER NOT NULL,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
      );
    `);
    db.pragma("user_version = 1");
    console.log("[DB] Migración v1 aplicada: Schema base creado.");
  }

  // ── v1 → v2: IVA + Settings ───────────────
  if (currentVersion < 2) {
    // Columnas de IVA en products
    // DEFAULT 1600 = 16.00% | taxIncluded = 1 (precio YA incluye IVA)
    db.exec(`
      ALTER TABLE products ADD COLUMN taxRate INTEGER NOT NULL DEFAULT 1600;
      ALTER TABLE products ADD COLUMN taxIncluded INTEGER NOT NULL DEFAULT 1;

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    // Valores por defecto de configuración global
    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );
    insertSetting.run("store_name", "Mi Negocio");
    insertSetting.run("store_address", "");
    insertSetting.run("store_phone", "");
    insertSetting.run("store_tax_id", "");
    insertSetting.run("tax_name", "IVA");
    insertSetting.run("tax_rate_default", "1600");
    insertSetting.run("currency_symbol", "$");
    insertSetting.run("setup_completed", "false");
    insertSetting.run("allow_negative_stock", "true");

    db.pragma("user_version = 2");
    console.log("[DB] Migración v2 aplicada: IVA por producto + tabla settings.");
  }

  // ── v2 → v3: Usuarios / RBAC ─────────────
  if (currentVersion < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pin TEXT NOT NULL,
        role TEXT CHECK(role IN ('ADMIN', 'CASHIER')) NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt INTEGER NOT NULL
      );
    `);
    
    // Crear Admin por defecto si no existe ningún usuario
    const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    if (userCount === 0) {
      const defaultPinHash = bcrypt.hashSync("1234", 10);
      const insertUser = db.prepare(
        "INSERT INTO users (id, name, pin, role, createdAt) VALUES (?, ?, ?, ?, ?)"
      );
      insertUser.run(
        "usr-admin-default",
        "Admin",
        defaultPinHash,
        "ADMIN",
        Date.now()
      );
      console.log("[DB] Usuario Admin por defecto creado (PIN: 1234).");
    }

    db.pragma("user_version = 3");
    console.log("[DB] Migración v3 aplicada: Tabla users (RBAC).");
  }

  // ── v3 → v4: Decimales (Cantidades a granel) ─────────────
  if (currentVersion < 4) {
    db.exec(`
      -- A pesar de que SQLite usa typado dinámico (REAL / INTEGER),
      -- Modificamos explícitamente el registro mental migratorio para que
      -- conste que quantity, price, total y stock deben tratarse en UI como flotantes limitados.
      -- No hacemos un 'ALTER TABLE TYPE' porque SQLite no lo soporta directamente,
      -- pero podemos agregar la columna unitType a products.
      ALTER TABLE products ADD COLUMN unitType TEXT NOT NULL DEFAULT 'PIECE';
    `);

    db.pragma("user_version = 4");
    console.log("[DB] Migración v4 aplicada: Unidad de Medida (unitType) para productos.");
  }

  // ── v4 → v5: Catálogo Maestro de Unidades ────────
  if (currentVersion < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        allowFractions INTEGER NOT NULL DEFAULT 0,
        isSystem INTEGER NOT NULL DEFAULT 0
      );
    `);
    
    // Sembrar unidades base inmutables (isSystem = 1)
    const insertUnit = db.prepare("INSERT OR IGNORE INTO units (id, name, symbol, allowFractions, isSystem) VALUES (?, ?, ?, ?, ?)");
    insertUnit.run("PIECE", "Pieza", "Pza", 0, 1);
    insertUnit.run("BULK", "A Granel", "G", 1, 1);
    insertUnit.run("KILO", "Kilo", "Kg", 1, 1);
    insertUnit.run("LITER", "Litro", "L", 1, 1);
    insertUnit.run("METER", "Metro", "m", 1, 1);

    db.pragma("user_version = 5");
    console.log("[DB] Migración v5 aplicada: Tabla units creada.");
  }

  // ── v5 → v6: Branding de Ticket + Métodos de Pago Flexibles ────────
  if (currentVersion < 6) {
    // 1. Nuevas keys de branding en settings
    const insertSetting = db.prepare(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)"
    );
    insertSetting.run("store_logo_path", "");         // Ruta local del logo
    insertSetting.run("store_footer_message", "");     // Mensaje pie de ticket
    insertSetting.run("store_policies", "");           // Políticas (texto libre)
    insertSetting.run("store_whatsapp", "");           // Número de WhatsApp
    insertSetting.run("store_instagram", "");          // @instagram
    insertSetting.run("store_facebook", "");           // Facebook page
    insertSetting.run("store_website", "");            // Sitio web

    // 2. Recrear la tabla orders para ampliar el CHECK de paymentMethod
    //    y añadir la columna source (LOCAL | ONLINE)
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders_v6 (
        id TEXT PRIMARY KEY,
        subtotal INTEGER NOT NULL,
        tax INTEGER NOT NULL,
        total INTEGER NOT NULL,
        status TEXT CHECK(status IN ('COMPLETED', 'CANCELLED')) NOT NULL,
        paymentMethod TEXT CHECK(paymentMethod IN ('CASH', 'CARD', 'TRANSFER', 'WHATSAPP', 'ONLINE', 'OTHER')) NOT NULL DEFAULT 'CASH',
        source TEXT CHECK(source IN ('LOCAL', 'ONLINE')) NOT NULL DEFAULT 'LOCAL',
        createdAt INTEGER NOT NULL
      );

      INSERT INTO orders_v6 (id, subtotal, tax, total, status, paymentMethod, source, createdAt)
      SELECT id, subtotal, tax, total, status, paymentMethod, 'LOCAL', createdAt FROM orders;

      DROP TABLE orders;
      ALTER TABLE orders_v6 RENAME TO orders;
    `);

    db.pragma("user_version = 6");
    console.log("[DB] Migración v6 aplicada: Branding + métodos de pago flexibles.");
  }

  // ── v6 → v7: Control de Caja ────────
  if (currentVersion < 7) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cash_movements (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('OPENING', 'IN', 'OUT')) NOT NULL,
        amount INTEGER NOT NULL,
        concept TEXT NOT NULL,
        userId TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);

    db.pragma("user_version = 7");
    console.log("[DB] Migración v7 aplicada: Tabla cash_movements creada.");
  }

  // ── v7 → v8: Fundación Premium (Usuarios, Márgenes y Auditoría) ────────
  if (currentVersion < 8) {
    db.exec(`
      -- 1. Vincular órdenes a usuarios
      ALTER TABLE orders ADD COLUMN userId TEXT;
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(userId);

      -- 2. Soporte para margen de ganancia real
      ALTER TABLE products ADD COLUMN costPrice INTEGER NOT NULL DEFAULT 0;

      -- 3. Auditoría de impuestos, costos y descuentos por partida
      ALTER TABLE order_items ADD COLUMN taxRate INTEGER NOT NULL DEFAULT 1600;
      ALTER TABLE order_items ADD COLUMN taxIncluded INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE order_items ADD COLUMN discountAmount INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE order_items ADD COLUMN costPrice INTEGER NOT NULL DEFAULT 0;

      -- 4. Tabla de auditoría para acciones sensibles
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        action TEXT NOT NULL,
        details TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    db.pragma("user_version = 8");
    console.log("[DB] Migración v8 aplicada: userId, costPrice y audit_logs configurados.");
  }
  if (currentVersion < 9) {
    db.exec(`
      -- Permitir ventas sin stock (bajo pedido)
      ALTER TABLE products ADD COLUMN allowNegativeStock INTEGER NOT NULL DEFAULT 0;
    `);

    db.pragma("user_version = 9");
    console.log("[DB] Migración v9 aplicada: allowNegativeStock configurada.");
  }
  if (currentVersion < 10) {
    // Sprint-1 E2: Ampliar canales de venta.
    // source: LOCAL|ONLINE  ->  COUNTER|WHATSAPP|INSTAGRAM|OTHER
    db.exec(`
      CREATE TABLE orders_v10 (
        id          TEXT PRIMARY KEY,
        subtotal    INTEGER NOT NULL DEFAULT 0,
        tax         INTEGER NOT NULL DEFAULT 0,
        total       INTEGER NOT NULL DEFAULT 0,
        status      TEXT CHECK(status IN ('PENDING','COMPLETED','CANCELLED')) NOT NULL DEFAULT 'PENDING',
        paymentMethod TEXT CHECK(paymentMethod IN ('CASH','CARD','TRANSFER','OTHER')) NOT NULL DEFAULT 'CASH',
        source      TEXT CHECK(source IN ('COUNTER','WHATSAPP','INSTAGRAM','OTHER')) NOT NULL DEFAULT 'COUNTER',
        userId      TEXT,
        createdAt   INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      );
      INSERT INTO orders_v10 (id, subtotal, tax, total, status, paymentMethod, source, userId, createdAt)
        SELECT id, subtotal, tax, total, status, paymentMethod,
               CASE source WHEN 'LOCAL' THEN 'COUNTER' ELSE 'OTHER' END,
               userId, createdAt
        FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_v10 RENAME TO orders;
    `);
    db.pragma("user_version = 10");
    console.log("[DB] Migración v10 aplicada: source ampliado a COUNTER|WHATSAPP|INSTAGRAM|OTHER.");
  }
  if (currentVersion < 11) {
    // Agregar canal FACEBOOK
    db.exec(`
      CREATE TABLE orders_v11 (
        id          TEXT PRIMARY KEY,
        subtotal    INTEGER NOT NULL DEFAULT 0,
        tax         INTEGER NOT NULL DEFAULT 0,
        total       INTEGER NOT NULL DEFAULT 0,
        status      TEXT CHECK(status IN ('PENDING','COMPLETED','CANCELLED')) NOT NULL DEFAULT 'PENDING',
        paymentMethod TEXT CHECK(paymentMethod IN ('CASH','CARD','TRANSFER','OTHER')) NOT NULL DEFAULT 'CASH',
        source      TEXT CHECK(source IN ('COUNTER','WHATSAPP','INSTAGRAM','FACEBOOK','OTHER')) NOT NULL DEFAULT 'COUNTER',
        userId      TEXT,
        createdAt   INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      );
      INSERT INTO orders_v11 (id, subtotal, tax, total, status, paymentMethod, source, userId, createdAt)
        SELECT id, subtotal, tax, total, status, paymentMethod, source, userId, createdAt
        FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_v11 RENAME TO orders;
    `);
    db.pragma("user_version = 11");
    console.log("[DB] Migración v11 aplicada: source ampliado con FACEBOOK.");
  }

  if (currentVersion < 12) {
    // Sprint 14: Auditoría Forense
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        userName TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        createdAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_logs(createdAt);
    `);
    db.pragma("user_version = 12");
    console.log("[DB] Migración v12 aplicada: Tabla audit_logs configurada para rastreo forense.");
  }

  if (currentVersion < 13) {
    // Sprint 16: Clientes y Fiados (Cuentas por Cobrar)
    db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      
      CREATE TABLE IF NOT EXISTS customer_payments (
        id TEXT PRIMARY KEY,
        customerId TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        paymentMethod TEXT CHECK(paymentMethod IN ('CASH','CARD','TRANSFER','OTHER')) NOT NULL DEFAULT 'CASH',
        cashMovementId TEXT,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (cashMovementId) REFERENCES cash_movements(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_customer_payments_client ON customer_payments(customerId);

      CREATE TABLE orders_v13 (
        id          TEXT PRIMARY KEY,
        subtotal    INTEGER NOT NULL DEFAULT 0,
        tax         INTEGER NOT NULL DEFAULT 0,
        total       INTEGER NOT NULL DEFAULT 0,
        status      TEXT CHECK(status IN ('PENDING','COMPLETED','CANCELLED')) NOT NULL DEFAULT 'PENDING',
        paymentMethod TEXT CHECK(paymentMethod IN ('CASH','CARD','TRANSFER','CREDIT','OTHER')) NOT NULL DEFAULT 'CASH',
        paymentStatus TEXT CHECK(paymentStatus IN ('PAID','PENDING')) NOT NULL DEFAULT 'PAID',
        source      TEXT CHECK(source IN ('COUNTER','WHATSAPP','INSTAGRAM','FACEBOOK','OTHER')) NOT NULL DEFAULT 'COUNTER',
        userId      TEXT,
        customerId  TEXT,
        createdAt   INTEGER NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
      );
      INSERT INTO orders_v13 (id, subtotal, tax, total, status, paymentMethod, source, userId, createdAt)
        SELECT id, subtotal, tax, total, status, paymentMethod, source, userId, createdAt
        FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_v13 RENAME TO orders;
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customerId);
    `);
    db.pragma("user_version = 13");
    console.log("[DB] Migración v13 aplicada: Módulo de Clientes, Fiados y pagos diferidos establecido.");
  }

  if (currentVersion < 14) {
    // Hotfix: El Sprint 14 intentó meter userName a audit_logs con un CREATE TABLE IF NOT EXISTS,
    // pero la tabla ya existía (creada en la v8), por ende omitió la columna de nombre.
    try {
      db.exec(`ALTER TABLE audit_logs ADD COLUMN userName TEXT DEFAULT 'Desconocido';`);
    } catch(e) { /* Si la columna ya estuviese ahí por X razón, prevenir crash */ }
    
    db.pragma("user_version = 14");
    console.log("[DB] Migración v14 aplicada: Columna userName restaurada en audit_logs.");
  }

  // ── v14 → v15: Permisos granulares de Catálogo para Vendedoras ─────────────
  if (currentVersion < 15) {
    try {
      db.exec(`ALTER TABLE users ADD COLUMN canManageProducts INTEGER NOT NULL DEFAULT 0;`);
    } catch(e) { /* En caso de fallas silenciosas previas */ }
    
    db.pragma("user_version = 15");
    console.log("[DB] Migración v15 aplicada: Añadida columna canManageProducts en tabla users.");
  }

  const newVersion = db.pragma("user_version", { simple: true });
  console.log(`[DB] Esquema actualizado a v${newVersion}. Listo.`);
}

// ─────────────────────────────────────────────
// Acceso a la instancia
// ─────────────────────────────────────────────

function getDb() {
  if (!db) return initDatabase();
  return db;
}

// ─────────────────────────────────────────────
// Backup Automático (al cierre de la app)
// ─────────────────────────────────────────────

function backupDatabase() {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) return;

  try {
    const dbPath = path.join(app.getPath("userData"), "fast-pos.db");
    const backupDir = path.join(app.getPath("userData"), "backups");

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `auto-${timestamp}.fastpos.db`);

    if (fs.existsSync(dbPath)) {
      // Usar la API de backup de SQLite para mayor seguridad (no copia en caliente)
      const backupDb = new Database(backupPath);
      getDb().backup(backupDb);
      backupDb.close();
      console.log(`[BACKUP] Respaldo automático creado: ${backupPath}`);

      // Rotación: mantener solo los últimos 7 backups automáticos
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith("auto-"))
        .map((f) => ({
          name: f,
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 7) {
        files.slice(7).forEach((f) => {
          fs.unlinkSync(path.join(backupDir, f.name));
          console.log(`[BACKUP] Rotación: eliminado respaldo antiguo ${f.name}`);
        });
      }
    }
  } catch (err) {
    console.error("[BACKUP] Error en respaldo automático:", err.message);
  }
}

module.exports = {
  initDatabase,
  getDb,
  getDbPath,
  backupDatabase,
};

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
  return isDev
    ? path.join(__dirname, "../../fast-pos-dev.db")
    : path.join(app.getPath("userData"), "fast-pos.db");
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

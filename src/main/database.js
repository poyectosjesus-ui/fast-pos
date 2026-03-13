const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");
const fs = require("fs");

/**
 * FAST-POS DATABASE ENGINE
 * Fuente de la Verdad Nativa (Fast-POS 1.1)
 */

let db = null;

/**
 * Inicializa la base de datos SQLite con configuraciones de robustez (WAL, Foreign Keys).
 */
function initDatabase() {
  const isDev = process.env.NODE_ENV === "development";
  const dbPath = isDev 
    ? path.join(__dirname, "../../fast-pos-dev.db") 
    : path.join(app.getPath("userData"), "fast-pos.db");

  console.log(`[DB] Iniciando base de datos en: ${dbPath}`);

  // Asegurar que el directorio existe
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  try {
    db = new Database(dbPath, { verbose: isDev ? console.log : null });
    
    // Configuración de performance y seguridad
    db.pragma("journal_mode = WAL"); // Write-Ahead Logging para concurrencia
    db.pragma("foreign_keys = ON");  // Integridad referencial habilitada
    
    console.log("[DB] Conexión establecida exitosamente (Modo WAL)");
    
    // Crear tablas iniciales si no existen
    createTables();
    
    return db;
  } catch (err) {
    console.error("[DB] Error crítico al conectar:", err.message);
    throw err;
  }
}

/**
 * Define el esquema físico de la base de datos basado en schema.ts
 */
function createTables() {
  const schema = `
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
  `;

  try {
    db.exec(schema);
    console.log("[DB] Esquema de tablas verificado/creado.");
  } catch (err) {
    console.error("[DB] Error al crear tablas:", err.message);
    throw err;
  }
}

function getDb() {
  if (!db) return initDatabase();
  return db;
}

/**
 * Crea un respaldo físico del archivo de base de datos.
 */
function backupDatabase() {
  const isDev = process.env.NODE_ENV === "development";
  if (isDev) return; // No respaldar en desarrollo para evitar basura

  try {
    const dbPath = path.join(app.getPath("userData"), "fast-pos.db");
    const backupDir = path.join(app.getPath("userData"), "backups");
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDir, `fast-pos-auto-${timestamp}.db`);

    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[BACKUP] Respaldo automático creado en: ${backupPath}`);
      
      // Limpiar backups antiguos (mantener los últimos 5)
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith("fast-pos-auto-"))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length > 5) {
        files.slice(5).forEach(f => {
          fs.unlinkSync(path.join(backupDir, f.name));
          console.log(`[BACKUP] Eliminado respaldo antiguo: ${f.name}`);
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
  backupDatabase
};

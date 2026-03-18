const path = require('path');
const fs = require('fs');
const https = require('https');
const xlsx = require('xlsx');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { app } = require('electron');

const DEMO_DIR = path.join(__dirname, '../demos/boutique');
const IMAGES_DIR = path.join(DEMO_DIR, 'images');
const DB_PATH = path.join(DEMO_DIR, 'demo_boutique.fastpos.db');
const EXCEL_PATH = path.join(__dirname, '../inventario_boutique.xlsx');

// Asegurar la existencia de los directorios estáticos
if (!fs.existsSync(DEMO_DIR)) fs.mkdirSync(DEMO_DIR, { recursive: true });
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

function uuidv4() { return crypto.randomUUID(); }

// Motor simple de descarga de recursos URL que salva directamente al disco
function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, response => {
      // Manejar redirectes http nativamente si son necesarios
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
         downloadImage(response.headers.location, dest).then(resolve).catch(reject);
         return;
      }
      if (response.statusCode !== 200) {
         reject(new Error(`Failed with status code: ${response.statusCode}`));
         return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Simulador esquemático independiente para el Demo
function initDemoDB(dbPath) {
  const db = new Database(dbPath);
  
  db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        allowFractions INTEGER NOT NULL DEFAULT 0,
        isSystem INTEGER NOT NULL DEFAULT 0
      );
      INSERT OR IGNORE INTO units (id, name, symbol, allowFractions, isSystem) VALUES ('PIECE', 'Pieza', 'Pza', 0, 1);

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
        taxRate INTEGER NOT NULL DEFAULT 1600,
        taxIncluded INTEGER NOT NULL DEFAULT 1,
        unitType TEXT NOT NULL DEFAULT 'PIECE',
        costPrice INTEGER NOT NULL DEFAULT 0,
        allowNegativeStock INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT
      );
  `);
  
  return db;
}

async function run() {
  console.log('[DEMO] Construyendo base de datos aislada...');
  
  // Limpiar rastros de Demos fallidos previamente
  if (fs.existsSync(DB_PATH)) {
    console.log('[DEMO] 🗑️ Borrando base de datos de demo anterior...');
    fs.unlinkSync(DB_PATH);
  }
  
  const db = initDemoDB(DB_PATH);
  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  const uniqueCategories = new Set(rows.map(r => r["Categoría"]).filter(Boolean));
  const categoryMap = {};

  const insertCategoryStmt = db.prepare('INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)');
  const insertProductStmt = db.prepare(`
    INSERT INTO products (
      id, categoryId, name, price, stock, sku, isVisible, 
      image, createdAt, updatedAt, taxRate, taxIncluded, 
      unitType, costPrice, allowNegativeStock
    ) VALUES (
      ?, ?, ?, ?, ?, ?, 1, 
      ?, ?, ?, 1600, 1, 
      'PIECE', ?, 1
    )
  `);

  console.log(`[DEMO] Insertando ${uniqueCategories.size} categorías maestras...`);
  db.transaction(() => {
    for (const catName of uniqueCategories) {
      const newId = uuidv4();
      const now = Date.now();
      insertCategoryStmt.run(newId, catName, now, now);
      categoryMap[catName] = newId;
    }
  })();

  const total = rows.length;
  let current = 0;

  for (const item of rows) {
    const prodName = item["Producto"];
    if (!prodName) continue;
    current++;

    const id = uuidv4();
    const catId = categoryMap[item["Categoría"]] || null;
    const imgUrl = item["Link Imagen"] || null;
    let localImageName = null;
    
    // Descargar activo multimedia
    if (imgUrl && imgUrl.startsWith('http')) {
      localImageName = `${id}.jpg`;
      const localPath = path.join(IMAGES_DIR, localImageName);
      process.stdout.write(`\r[DEMO] Descargando contenido multimedia en búfer local ${current}/${total}...`);
      try {
        await downloadImage(imgUrl, localPath);
      } catch (err) {
         console.warn(`\n[DEMO-WARN] Falló descarga de la imagen remota ${imgUrl}`, err.message);
         localImageName = null;
      }
    }

    const sku = "BTQ-" + Math.floor(Math.random() * 1000000).toString();
    const pVenta = item["Precio Venta (MXN)"] ? Math.round(Number(item["Precio Venta (MXN)"]) * 100) : 0;
    const pCompra = item["Precio Compra (MXN)"] ? Math.round(Number(item["Precio Compra (MXN)"]) * 100) : 0;
    const stock = item["Stock"] ? Number(item["Stock"]) : 0;
    const now = Date.now();

    insertProductStmt.run(
      id, catId, prodName, pVenta, stock, sku,
      localImageName, now, now, pCompra
    );
  }
  
  console.log(`\n\n[DEMO] ✅ Demo generada exitosamente en /demos/boutique/`);
}

app.whenReady().then(() => {
  run().then(() => {
    app.quit();
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
});

const { app } = require('electron');
const path = require('path');
const xlsx = require('xlsx');
const crypto = require('crypto');

app.name = 'fast-pos'; // Emparejar UserData Path

app.whenReady().then(() => {
  try {
    // Forzar entorno dev para apuntar a fast-pos-dev.db
    process.env.NODE_ENV = 'development';
    
    // Conectar a la base de datos oficial
    const { initDatabase } = require('../src/main/database.js');
    console.log(`[SEED] Inicializando motor SQLite central...`);
    const db = initDatabase();

    const excelPath = path.join(__dirname, '../inventario_boutique.xlsx');
    console.log(`[SEED] Leyendo archivo catálogo: ${excelPath}`);
    
    // Configurar uuid fallback v4
    function uuidv4() {
      return crypto.randomUUID();
    }

    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`[SEED] Se encontraron ${rows.length} productos en el documento Excel.`);

    // BEGIN TRANSACCIÓN
    const transaction = db.transaction(() => {
      // OBTENER O CREAR CATEGORÍAS
      const uniqueCategories = new Set(rows.map(r => r["Categoría"]).filter(Boolean));
      const categoryMap = {}; // name -> id

      console.log(`[SEED] Sincronizando ${uniqueCategories.size} categorías...`);
      
      const getCategoryStmt = db.prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE');
      const insertCategoryStmt = db.prepare('INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)');
      
      for (const catName of uniqueCategories) {
        const row = getCategoryStmt.get(catName);
        if (row) {
          categoryMap[catName] = row.id;
        } else {
          const newId = uuidv4();
          const now = Date.now();
          insertCategoryStmt.run(newId, catName, now, now);
          categoryMap[catName] = newId;
        }
      }

      // INSERTAR PRODUCTOS
      console.log(`[SEED] Volcando productos a la base de datos...`);
      
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
      
      let insertedCount = 0;

      for (const item of rows) {
        const prodName = item["Producto"];
        if (!prodName) continue;

        // Comprobar si existe por nombre
        const existing = db.prepare('SELECT id FROM products WHERE name = ? COLLATE NOCASE').get(prodName);
        if (existing) {
          console.log(` -> Ignorado (Ya existe): ${prodName}`);
          continue;
        }

        const id = uuidv4();
        const catId = categoryMap[item["Categoría"]] || null;
        const img = item["Link Imagen"] || null;
        const sku = "BTQ-" + Math.floor(Math.random() * 1000000).toString(); // Fallback para productos sin SKU de Boutique
        
        // Transformar precios a centavos para SQLite
        const pVenta = item["Precio Venta (MXN)"] ? Math.round(Number(item["Precio Venta (MXN)"]) * 100) : 0;
        const pCompra = item["Precio Compra (MXN)"] ? Math.round(Number(item["Precio Compra (MXN)"]) * 100) : 0;
        const stock = item["Stock"] ? Number(item["Stock"]) : 0;
        
        const now = Date.now();

        insertProductStmt.run(
          id, catId, prodName, pVenta, stock, sku,
          img, now, now, pCompra
        );
        
        insertedCount++;
      }
      
      console.log(`[SEED] TRANSACCIÓN EXITOSA: ${insertedCount} productos insertados frescos.`);
    });
    
    // Ejecutar la transaccion SQL
    transaction();

    // Log a Auditoría Global
    console.log(`[SEED] Registrando entrada forense de importación...`);
    const stmtAudit = db.prepare("INSERT INTO audit_logs (id, userId, userName, action, details, createdAt) VALUES (?, ?, ?, ?, ?, ?)");
    stmtAudit.run(uuidv4(), 'SYSTEM', 'System Engine', 'FACTORY_SEED_EXCEL', 'Importación de Boutique completada con XLSX.', Date.now());

    console.log(`\n================================`);
    console.log(`✅ ¡MIGRACIÓN DE INVENTARIO TERMINADA!`);
    console.log(`================================\n`);
    app.quit();

  } catch (err) {
    console.error(`[SEED ERROR] Ocurrió un fallo fatal migrando datos:`, err);
    process.exit(1);
  }
});

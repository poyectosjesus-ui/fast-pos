const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

app.name = 'fast-pos';

function uuidv4() { return crypto.randomUUID(); }

app.whenReady().then(() => {
  try {
    process.env.NODE_ENV = 'development';
    
    // 1. LIMPIAR BASE DE DATOS FÍSICAMENTE (Evita corrupción con WAL activo)
    console.log(`[SEED] Formateando entorno dev local (Borrando archivos DB)...`);
    const devDbPath = path.join(__dirname, '../fast-pos-dev.db');
    try {
      if (fs.existsSync(devDbPath)) fs.unlinkSync(devDbPath);
      if (fs.existsSync(devDbPath + '-wal')) fs.unlinkSync(devDbPath + '-wal');
      if (fs.existsSync(devDbPath + '-shm')) fs.unlinkSync(devDbPath + '-shm');
    } catch (e) {
      console.warn("⚠️ No se pudo borrar el archivo (quizás está en uso). Intentando sobrescribir...");
    }
    
    // Conectar a la base de datos oficial y dejar que se reconstruya
    const { initDatabase } = require('../src/main/database.js');
    console.log(`[SEED] Inicializando motor SQLite central (Aplicando migraciones v1 -> v13)...`);
    const db = initDatabase();

    // 2. CONFIGURAR SETTINGS
    console.log(`[SEED] Configurando Información Corporativa de Papelería...`);
    const insertSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    insertSetting.run("store_name", "Papelería El Estudiante");
    insertSetting.run("store_phone", "55 1234 5678");
    insertSetting.run("store_address", "Av. Universidad #412, Centro");
    insertSetting.run("setup_completed", "true");
    insertSetting.run("license_key", "LIFETIME-DEMO-MODE");
    insertSetting.run("store_tax_id", "XAXX010101000");

    // 3. CREAR USUARIOS Y CLIENTES
    console.log(`[SEED] Creado Usuarios (Cajeros) y Clientes (Fiado)...`);
    const cashierId = uuidv4();
    db.prepare("INSERT INTO users (id, name, pin, role, isActive, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(
      cashierId, 'Alejandro (Cajero)', bcrypt.hashSync('0000', 10), 'CASHIER', 1, Date.now()
    );

    const client1Id = uuidv4();
    const client2Id = uuidv4();
    const insertCustomer = db.prepare("INSERT INTO customers (id, name, phone, isActive, createdAt, updatedAt) VALUES (?, ?, ?, 1, ?, ?)");
    insertCustomer.run(client1Id, "María José (Vecina)", "55 9876 5432", Date.now(), Date.now());
    insertCustomer.run(client2Id, "Escuela Primaria Sor Juana", "55 5555 4444", Date.now(), Date.now());

    // 4. CREAR CATÁLOGO DE PAPELERÍA (40 Productos / 5 Categorías)
    console.log(`[SEED] Inyectando catálogo de Papelería...`);
    
    const categoriesData = [
      { id: uuidv4(), name: 'Cuadernos y Libretas' },
      { id: uuidv4(), name: 'Escritura' },
      { id: uuidv4(), name: 'Papelería Escolar' },
      { id: uuidv4(), name: 'Oficina y Archivo' },
      { id: uuidv4(), name: 'Artículos de Arte' }
    ];

    const insertCategory = db.prepare("INSERT INTO categories (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)");
    for (const cat of categoriesData) {
      insertCategory.run(cat.id, cat.name, Date.now(), Date.now());
    }

    const rawProducts = [
      // Cuadernos
      { cat: 0, n: 'Cuaderno Profesional Raya Norma 100hj', p: 4500, c: 3000 },
      { cat: 0, n: 'Cuaderno Profesional Cuadro Chico Scribe', p: 4000, c: 2800 },
      { cat: 0, n: 'Libreta Francesa Raya 100hj', p: 2500, c: 1500 },
      { cat: 0, n: 'Cuaderno Italiana Cuadro Grande', p: 2200, c: 1400 },
      { cat: 0, n: 'Blocks Esquelas', p: 3000, c: 2000 },
      { cat: 0, n: 'Carpeta Panorámica 1 Pulgada Blanca', p: 6500, c: 4500 },
      { cat: 0, n: 'Paquete de Hojas de Carpeta Rayada', p: 3500, c: 2200 },
      { cat: 0, n: 'Libreta Moleskine Negra', p: 25000, c: 16000 },

      // Escritura
      { cat: 1, n: 'Pluma BIC Cristal Azul (Pza)', p: 800, c: 400 },
      { cat: 1, n: 'Pluma BIC Cristal Negra (Pza)', p: 800, c: 400 },
      { cat: 1, n: 'Lápiz Mirado No. 2 (Pza)', p: 600, c: 300 },
      { cat: 1, n: 'Marcador para Pizarrón Magistral Negro', p: 2800, c: 1800 },
      { cat: 1, n: 'Marcatextos Stabilo Boss Amarillo', p: 2200, c: 1400 },
      { cat: 1, n: 'Marcador Sharpie Fino Negro', p: 1800, c: 1100 },
      { cat: 1, n: 'Set de Plumas de Gel Gelly Roll', p: 12000, c: 8000 },
      { cat: 1, n: 'Corrector Líquido Pelikan Tipo Pluma', p: 2400, c: 1500 },

      // Escolar
      { cat: 2, n: 'Pegamento Blanco Resistol 850 40g', p: 1800, c: 1200 },
      { cat: 2, n: 'Pritt Lápiz Adhesivo 11g', p: 2200, c: 1300 },
      { cat: 2, n: 'Tijeras Escolares Punta Roma Barrilito', p: 2500, c: 1400 },
      { cat: 2, n: 'Compás de Precisión Maped', p: 4500, c: 2800 },
      { cat: 2, n: 'Regla de Plástico Flexible 30cm', p: 1200, c: 600 },
      { cat: 2, n: 'Goma de Borrar Factis Blanca', p: 500, c: 200 },
      { cat: 2, n: 'Sacapuntas Maped con Depósito', p: 1500, c: 800 },
      { cat: 2, n: 'Paquete 100 Hojas Blancas Bond Carta', p: 4500, c: 2500 },
      
      // Oficina
      { cat: 3, n: 'Caja Broches Baco No. 2', p: 3500, c: 2000 },
      { cat: 3, n: 'Engrapadora de Tira Completa ACCO', p: 14500, c: 9000 },
      { cat: 3, n: 'Caja Grapas Estándar x5000', p: 4200, c: 2500 },
      { cat: 3, n: 'Post-it Block Notas Amarillas 3x3', p: 2600, c: 1500 },
      { cat: 3, n: 'Folders Tamaño Carta Color Paja (Pza)', p: 300, c: 100 },
      { cat: 3, n: 'Caja de Clips Mariposa Jumbo', p: 2800, c: 1600 },
      { cat: 3, n: 'Protectores de Hojas Transparentes x10', p: 1800, c: 900 },
      { cat: 3, n: 'Perforadora de 2 Orificios ACCO', p: 16500, c: 11000 },

      // Arte
      { cat: 4, n: 'Caja Colores Prismacolor Junior x12', p: 8500, c: 5500 },
      { cat: 4, n: 'Pintura Acrílica Politec 100ml Blanca', p: 4200, c: 2400 },
      { cat: 4, n: 'Set Pinceles Nylon x5 Surtidos', p: 6000, c: 3500 },
      { cat: 4, n: 'Bloc de Dibujo Marquilla', p: 4500, c: 2800 },
      { cat: 4, n: 'Gis Pastel Pentel Caja x12', p: 11500, c: 7000 },
      { cat: 4, n: 'Plastilina PlayDoh Bote Indiv.', p: 2500, c: 1500 },
      { cat: 4, n: 'Cartulina Blanca (Pza)', p: 800, c: 400 },
      { cat: 4, n: 'Papel Crepé (Rollo)', p: 600, c: 300 },
    ];

    const insertProduct = db.prepare(`
      INSERT INTO products (
        id, categoryId, name, price, stock, sku, isVisible, 
        image, createdAt, updatedAt, taxRate, taxIncluded, 
        unitType, costPrice, allowNegativeStock
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 1, 
        NULL, ?, ?, 1600, 1, 
        'PIECE', ?, 1
      )
    `);

    const productMap = [];

    db.transaction(() => {
      for (let i = 0; i < rawProducts.length; i++) {
        const item = rawProducts[i];
        const id = uuidv4();
        const catId = categoriesData[item.cat].id;
        const now = Date.now();
        const sku = `PPL-${1000 + i}`;
        const stock = Math.floor(Math.random() * 50) + 10;
        insertProduct.run(id, catId, item.n, item.p, stock, sku, now, now, item.c);
        
        productMap.push({ id, name: item.n, price: item.p, cost: item.c });
      }
    })();

    // 5. MAQUINA DEL TIEMPO (Ventas y Auditoría de los últimos 60 días)
    console.log(`[SEED] Retrocediendo el reloj 60 días en el tiempo para generar ventas orgánicas...`);
    
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, subtotal, tax, total, status, paymentMethod, paymentStatus, source, userId, customerId, createdAt)
      VALUES (?, ?, ?, ?, 'COMPLETED', ?, 'PAID', ?, ?, ?, ?)
    `);

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (orderId, productId, name, price, quantity, subtotal, taxRate, taxIncluded, discountAmount, costPrice)
      VALUES (?, ?, ?, ?, ?, ?, 1600, 1, 0, ?)
    `);

    const insertCash = db.prepare(`
      INSERT INTO cash_movements (id, type, amount, concept, userId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const users = ['usr-admin-default', cashierId];
    const methods = ['CASH', 'CASH', 'CASH', 'CARD', 'TRANSFER', 'CASH'];
    const sources = ['COUNTER', 'COUNTER', 'COUNTER', 'WHATSAPP', 'COUNTER'];
    
    // Inyectar fondo de inicio masivo de 60 días atómico
    db.transaction(() => {
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      
      for (let d = 60; d >= 0; d--) {
        const simDate = new Date(hoy.getTime() - d * 24 * 60 * 60 * 1000);
        // Randomizar un poco la hora de apertura a las 8 AM ~ 9 AM
        const dayStartMs = simDate.setHours(8, Math.floor(Math.random() * 59), 0, 0);
        
        // 1. Apertura de Caja
        insertCash.run(uuidv4(), 'OPENING', 50000, 'Fondo Fijo Diario (Día ' + d + ' atrás)', users[1], dayStartMs);

        // 2. Generar Ventas del Día
        const numVentas = Math.floor(Math.random() * 15) + 5; // 5 a 20 ventas
        let dailyCashSales = 0;

        for (let v = 0; v < numVentas; v++) {
          const orderId = uuidv4();
          // Distribuir ventas entre las 9 AM y 6 PM
          const saleTimeMs = dayStartMs + (Math.random() * 9 * 60 * 60 * 1000);
          
          const u = users[Math.floor(Math.random() * users.length)];
          const meth = methods[Math.floor(Math.random() * methods.length)];
          const src = sources[Math.floor(Math.random() * sources.length)];
          
          let totalOrder = 0;
          let costOrder = 0;
          let subOrder = 0;
          const itemsToInsert = [];

          // Artículos
          const linesCount = Math.floor(Math.random() * 5) + 1;
          for (let l = 0; l < linesCount; l++) {
            const p = productMap[Math.floor(Math.random() * productMap.length)];
            const qty = Math.floor(Math.random() * 3) + 1;
            const subtotal = p.price * qty;
            
            itemsToInsert.push({ pId: p.id, pName: p.name, pPrice: p.price, qty, subtotal, pCost: p.cost });
            
            totalOrder += subtotal;
            subOrder += Math.round(subtotal / 1.16); // Estimado sin IVA
            costOrder += p.cost * qty;
          }

          if (meth === 'CASH') dailyCashSales += totalOrder;

          let cid = null;
          // De vez en cuando es Fiado si compran mucho
          let actualMeth = meth;
          if (Math.random() > 0.9 && meth === 'CASH') {
             actualMeth = 'CREDIT';
             cid = Math.random() > 0.5 ? client1Id : client2Id;
             dailyCashSales -= totalOrder; // Restar efectivo de la caja
          }

          insertOrder.run(orderId, subOrder, totalOrder - subOrder, totalOrder, actualMeth, src, u, cid, saleTimeMs);
          
          for (const it of itemsToInsert) {
             insertOrderItem.run(orderId, it.pId, it.pName, it.pPrice, it.qty, it.subtotal, it.pCost * it.qty);
          }
        }

        // 3. Corte de Caja
        const dayEndMs = simDate.setHours(19, Math.floor(Math.random() * 30), 0, 0);
        insertCash.run(uuidv4(), 'IN', dailyCashSales, 'Ventas en Efectivo Módulos', users[1], dayEndMs);
      }
    })();

    console.log(`\n================================`);
    console.log(`✅ ¡MÁQUINA DEL TIEMPO Completada!`);
    console.log(`   Se generaron 60 días de transacciones.`);
    console.log(`================================\n`);
    app.quit();

  } catch (err) {
    console.error(`[SEED ERROR] Ocurrió un fallo fatal migrando datos:`, err);
    process.exit(1);
  }
});

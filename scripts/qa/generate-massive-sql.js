const { v4: uuidv4 } = require('uuid');

const numProducts = 1500;
const numOrders = 2500;
const daysHistory = 30;

const categoryId1 = uuidv4();
const categoryId2 = uuidv4();
const categoryId3 = uuidv4();

const now = Date.now();
const oneDayMs = 24 * 60 * 60 * 1000;

console.log('BEGIN TRANSACTION;');

// 0. Cleanup
console.log(`DELETE FROM order_items WHERE name LIKE 'QA Masivo %';`);
console.log(`DELETE FROM orders WHERE id NOT IN (SELECT orderId FROM order_items);`);
console.log(`DELETE FROM products WHERE name LIKE 'QA Masivo %';`);
console.log(`DELETE FROM categories WHERE name LIKE '%(QA)%';`);
console.log(`DELETE FROM cash_movements WHERE concept = 'Fondo inicial QA';`);

// 1. Categories
console.log(`INSERT INTO categories (id, name, createdAt, updatedAt) VALUES ('${categoryId1}', 'Ropa Dama (QA)', ${now}, ${now});`);
console.log(`INSERT INTO categories (id, name, createdAt, updatedAt) VALUES ('${categoryId2}', 'Accesorios (QA)', ${now}, ${now});`);
console.log(`INSERT INTO categories (id, name, createdAt, updatedAt) VALUES ('${categoryId3}', 'Calzado (QA)', ${now}, ${now});`);

const categories = [categoryId1, categoryId2, categoryId3];

// 2. Products
const productIds = [];
const productsInfo = [];
for (let i = 0; i < numProducts; i++) {
  const id = uuidv4();
  const cat = categories[i % categories.length];
  const cost = Math.floor(Math.random() * 50) * 100 + 1000; // $10 to $60
  const price = cost + Math.floor(Math.random() * 80) * 100 + 2000; // Markup
  
  productIds.push(id);
  productsInfo.push({ id, name: `Producto Masivo #${i}`, price, cost });

  console.log(`INSERT INTO products (id, categoryId, name, price, costPrice, stock, sku, unitType, isVisible, taxRate, taxIncluded, createdAt, updatedAt) VALUES ('${id}', '${cat}', 'QA Masivo #${i}', ${price}, ${cost}, 999, 'QAM-${i}', 'PIECE', 1, 1600, 1, ${now}, ${now});`);
}

// 4. Cash movements
for(let d = 0; d <= daysHistory; d++) {
    const dayStart = now - (d * oneDayMs);
    const morning = dayStart - (10 * 60 * 60 * 1000); // 10am
    console.log(`INSERT INTO cash_movements (id, userId, type, amount, concept, createdAt) VALUES ('${uuidv4()}', (SELECT id FROM users LIMIT 1), 'OPENING', 100000, 'Fondo inicial QA', ${morning});`);
}

const paymentMethods = ['CASH', 'CASH', 'CARD', 'TRANSFER'];
const sources = ['COUNTER', 'COUNTER', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK'];

// 5. Orders and Items
for (let i = 0; i < numOrders; i++) {
  const orderId = uuidv4();
  const diffMs = Math.floor(Math.random() * daysHistory * oneDayMs);
  const orderDate = now - diffMs;
  
  const numItems = Math.floor(Math.random() * 6) + 1;
  let subtotal = 0;
  
  for (let j = 0; j < numItems; j++) {
    const p = productsInfo[Math.floor(Math.random() * productsInfo.length)];
    const qty = Math.floor(Math.random() * 3) + 1;
    const itemSubtotal = p.price * qty;
    subtotal += itemSubtotal;
    
    console.log(`INSERT INTO order_items (orderId, productId, name, price, costPrice, quantity, subtotal, taxRate, taxIncluded) VALUES ('${orderId}', '${p.id}', '${p.name}', ${p.price}, ${p.cost}, ${qty}, ${itemSubtotal}, 1600, 1);`);
  }
  
  const hasDiscount = Math.random() > 0.9;
  const discount = hasDiscount ? Math.floor(subtotal * 0.1) : 0;
  const finalSubtotal = subtotal - discount;
  const tax = Math.floor(finalSubtotal * 0.16); 
  
  const pm = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
  const src = sources[Math.floor(Math.random() * sources.length)];
  
  console.log(`INSERT INTO orders (id, userId, subtotal, tax, total, status, paymentMethod, source, createdAt) VALUES ('${orderId}', (SELECT id FROM users LIMIT 1), ${finalSubtotal}, ${tax}, ${finalSubtotal}, 'COMPLETED', '${pm}', '${src}', ${orderDate});`);
}

console.log('COMMIT;');

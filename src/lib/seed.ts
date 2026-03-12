import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { calcTax } from './constants';

/**
 * Función auxiliar para convertir una URL de imagen a Base64 comprimido
 * Esto permite que el seed traiga imágenes "reales" de internet.
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Error cargando imagen para seed:", url);
    return ""; // Fallback a sin imagen
  }
}

/**
 * SEED CURADO (20 Productos Reales) (Fase 15)
 * Borra los datos actuales y carga un catálogo profesional con imágenes de Unsplash.
 */
export async function seedDemoData(progressCallback?: (msg: string) => void) {
  progressCallback?.("Limpiando base de datos para demostración...");
  await db.products.clear();
  await db.categories.clear();
  await db.orders.clear();

  const demoCategories = [
    { id: uuidv4(), name: "Cafetería" },
    { id: uuidv4(), name: "Panadería" },
    { id: uuidv4(), name: "Bebidas" }
  ];

  progressCallback?.("Creando categorías curadas...");
  await db.categories.bulkAdd(demoCategories.map(c => ({ 
    id: c.id, name: c.name, createdAt: Date.now(), updatedAt: Date.now() 
  })));

  const demoProducts = [
    { name: "Espresso Doble", cat: "Cafetería", price: 4500, sku: "CAF-001", img: "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=400&q=80" },
    { name: "Capuccino Latte", cat: "Cafetería", price: 5500, sku: "CAF-002", img: "https://images.unsplash.com/photo-1536939459926-301728717817?w=400&q=80" },
    { name: "Croissant Mantequilla", cat: "Panadería", price: 3500, sku: "PAN-001", img: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80" },
    { name: "Muffin Arándanos", cat: "Panadería", price: 3800, sku: "PAN-002", img: "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80" },
    { name: "Jugo Naranja Natural", cat: "Bebidas", price: 4200, sku: "BEB-001", img: "https://images.unsplash.com/photo-1557800636-894a64c1696f?w=400&q=80" },
    { name: "Té Matcha Especial", cat: "Cafetería", price: 6200, sku: "CAF-003", img: "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?w=400&q=80" },
    { name: "Bagel de Queso", cat: "Panadería", price: 4800, sku: "PAN-003", img: "https://images.unsplash.com/photo-1585476108011-15555fc62947?w=400&q=80" },
    { name: "Agua Mineral 500ml", cat: "Bebidas", price: 2000, sku: "BEB-002", img: "https://images.unsplash.com/photo-1560023907-5f339617ea30?w=400&q=80" },
    { name: "Smoothie Tropical", cat: "Bebidas", price: 7500, sku: "BEB-003", img: "https://images.unsplash.com/photo-1502741224143-90386d7cd8c9?w=400&q=80" },
    { name: "Brownie de Chocolate", cat: "Panadería", price: 3200, sku: "PAN-004", img: "https://images.unsplash.com/photo-1461023058943-07fcbebc6d7a?w=400&q=80" },
    { name: "Flat White", cat: "Cafetería", price: 5200, sku: "CAF-004", img: "https://images.unsplash.com/photo-1459755486867-b55449bb39ff?w=400&q=80" },
    { name: "Pay de Limón", cat: "Panadería", price: 5800, sku: "PAN-005", img: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?w=400&q=80" },
    { name: "Refresco de Cola", cat: "Bebidas", price: 3000, sku: "BEB-004", img: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400&q=80" },
    { name: "Cookie Chispas", cat: "Panadería", price: 2500, sku: "PAN-006", img: "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=400&q=80" },
    { name: "Donas Pack x2", cat: "Panadería", price: 4200, sku: "PAN-007", img: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&q=80" },
    { name: "Vino Tinto (Copa)", cat: "Bebidas", price: 12000, sku: "BEB-005", img: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&q=80" },
    { name: "Sandwich Prosciutto", cat: "Panadería", price: 9500, sku: "PAN-008", img: "https://images.unsplash.com/photo-1559466273-d95e72debaf8?w=400&q=80" },
    { name: "Frappé Chocolate", cat: "Cafetería", price: 7200, sku: "CAF-006", img: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=400&q=80" },
    { name: "Kombucha Frutos", cat: "Bebidas", price: 8500, sku: "BEB-006", img: "https://images.unsplash.com/photo-1594411124403-12d8a4f9aeee?w=400&q=80" },
    { name: "Cheesecake Berries", cat: "Panadería", price: 6500, sku: "PAN-009", img: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&q=80" }
  ];

  progressCallback?.("Procesando imágenes reales (Downloading 20 items)...");
  const products: any[] = [];
  for (const item of demoProducts) {
    const categoryId = demoCategories.find(c => c.name === item.cat)?.id;
    const base64Img = await urlToBase64(item.img);
    
    products.push({
      id: uuidv4(),
      categoryId,
      name: item.name,
      sku: item.sku,
      price: item.price,
      image: base64Img,
      stock: 50,
      isVisible: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    progressCallback?.(`Cargado: ${item.name}...`);
  }
  await db.products.bulkAdd(products);

  // 3. Ventas Históricas
  progressCallback?.("Generando historial de ventas distribuido...");
  const orders: any[] = [];
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;

  for (let i = 0; i < 40; i++) {
    // Escalonar: algunas hoy, otras hace 1-7 días
    const daysBack = Math.floor(Math.random() * 8); // 0 a 7 días atrás
    const randomTime = now - (daysBack * dayInMs) - (Math.floor(Math.random() * dayInMs * 0.5));
    
    const itemsCount = Math.floor(Math.random() * 3) + 1;
    const orderItems: any[] = [];
    let subtotal = 0;

    for (let j = 0; j < itemsCount; j++) {
      const prod = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 2) + 1;
      const itemSubtotal = prod.price * qty;
      orderItems.push({
        productId: prod.id, name: prod.name, sku: prod.sku,
        price: prod.price, quantity: qty, subtotal: itemSubtotal
      });
      subtotal += itemSubtotal;
    }

    const tax = calcTax(subtotal);
    orders.push({
      id: uuidv4(), status: 'COMPLETED',
      paymentMethod: Math.random() > 0.3 ? 'CASH' : 'CARD',
      subtotal, tax, total: subtotal + tax,
      items: orderItems, createdAt: randomTime
    });
  }
  await db.orders.bulkAdd(orders);

  progressCallback?.("¡Demo Lista! Ya puedes descargar tu respaldo en Ajustes.");
  return { success: true };
}

/**
 * Genera un conjunto masivo de datos para pruebas de estrés.
 */
export async function generateMassiveData(progressCallback?: (msg: string) => void) {
  progressCallback?.("Iniciando generación de datos masivos...");
  try {
    const categoryNames = ["Electrónica", "Bebidas", "Snacks", "Hogar"];
    const categories = categoryNames.map(name => ({
      id: uuidv4(), name, createdAt: Date.now(), updatedAt: Date.now()
    }));
    await db.categories.bulkAdd(categories);

    const products: any[] = [];
    for (let i = 1; i <= 1000; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      products.push({
        id: uuidv4(), categoryId: category.id,
        name: `Producto de Estrés #${i}`,
        sku: `STRESS-${i}`, stock: 100, price: 1000 + (i * 10),
        isVisible: true, createdAt: Date.now(), updatedAt: Date.now()
      });
    }
    await db.products.bulkAdd(products);

    progressCallback?.("Cargado masivo completo (+1000 items).");
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

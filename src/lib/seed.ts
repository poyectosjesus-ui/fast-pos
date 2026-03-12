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
    { id: uuidv4(), name: "Vestidos y Ropa" },
    { id: uuidv4(), name: "Calzado" },
    { id: uuidv4(), name: "Accesorios y Lujo" }
  ];

  progressCallback?.("Creando categorías de moda...");
  await db.categories.bulkAdd(demoCategories.map(c => ({ 
    id: c.id, name: c.name, createdAt: Date.now(), updatedAt: Date.now() 
  })));

  const demoProducts = [
    { name: "Vestido Gala Seda", cat: "Vestidos y Ropa", price: 125000, sku: "MOD-001", img: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80" },
    { name: "Zapatos Tacón Aguja", cat: "Calzado", price: 85000, sku: "ZAP-001", img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80" },
    { name: "Bolso Cuero Italiano", cat: "Accesorios y Lujo", price: 150000, sku: "ACC-001", img: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80" },
    { name: "Chaqueta Denim Premium", cat: "Vestidos y Ropa", price: 45000, sku: "MOD-002", img: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&q=80" },
    { name: "Reloj Oro Rosa", cat: "Accesorios y Lujo", price: 210000, sku: "ACC-002", img: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&q=80" },
    { name: "Gafas de Sol Design", cat: "Accesorios y Lujo", price: 25000, sku: "ACC-003", img: "https://images.unsplash.com/photo-1511499767390-945c2329bc75?w=400&q=80" },
    { name: "Sneakers Urban White", cat: "Calzado", price: 62000, sku: "ZAP-002", img: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&q=80" },
    { name: "Falda Plisada Floral", cat: "Vestidos y Ropa", price: 32000, sku: "MOD-003", img: "https://images.unsplash.com/photo-1583496661160-fb5889a053f1?w=400&q=80" },
    { name: "Perfume Signature 50ml", cat: "Accesorios y Lujo", price: 95000, sku: "ACC-004", img: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80" },
    { name: "Pañuelo Seda Estampado", cat: "Accesorios y Lujo", price: 15000, sku: "ACC-005", img: "https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400&q=80" },
    { name: "Blusa Lino Blanca", cat: "Vestidos y Ropa", price: 28000, sku: "MOD-004", img: "https://images.unsplash.com/photo-1564584285871-9b1eb827a5fc?w=400&q=80" },
    { name: "Botas Cuero Vintage", cat: "Calzado", price: 110000, sku: "ZAP-003", img: "https://images.unsplash.com/photo-1520639889457-393275713807?w=400&q=80" },
    { name: "Cinturón Piel Slim", cat: "Accesorios y Lujo", price: 12000, sku: "ACC-006", img: "https://images.unsplash.com/photo-1624222247344-550fb8ecf7c4?w=400&q=80" },
    { name: "Abrigo Lana Invierno", cat: "Vestidos y Ropa", price: 185000, sku: "MOD-005", img: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=400&q=80" },
    { name: "Sandalias Resort Gold", cat: "Calzado", price: 42000, sku: "ZAP-004", img: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&q=80" },
    { name: "Pendientes Diamante Sim", cat: "Accesorios y Lujo", price: 55000, sku: "ACC-007", img: "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=400&q=80" },
    { name: "Pantalón Sastre Negro", cat: "Vestidos y Ropa", price: 52000, sku: "MOD-006", img: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&q=80" },
    { name: "Cartera Clutch Noche", cat: "Accesorios y Lujo", price: 38000, sku: "ACC-008", img: "https://images.unsplash.com/photo-1566150192880-3067c096389c?w=400&q=80" },
    { name: "Sweater Cashmere", cat: "Vestidos y Ropa", price: 78000, sku: "MOD-007", img: "https://images.unsplash.com/photo-1556905081-8a713a18ef58?w=400&q=80" },
    { name: "Sombrero Ala Ancha", cat: "Accesorios y Lujo", price: 18000, sku: "ACC-009", img: "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?w=400&q=80" }
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

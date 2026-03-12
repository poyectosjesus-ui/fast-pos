import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { calcTax } from './constants';

/**
 * Genera un conjunto masivo de datos para pruebas de estrés.
 * - +1000 Productos distribuidos en 10 categorías.
 * - +1000 Órdenes distribuidas en los últimos 30 días.
 */
export async function generateMassiveData(progressCallback?: (msg: string) => void) {
  progressCallback?.("Iniciando generación de datos masivos...");

  try {
    // 1. Crear Categorías
    progressCallback?.("Creando 10 categorías base...");
    const categoryNames = [
      "Electrónica", "Limpieza", "Bebidas", "Snacks", 
      "Lácteos", "Panadería", "Frutas y Verduras", 
      "Farmacia", "Hogar", "Mascotas"
    ];
    
    const categories = categoryNames.map(name => ({
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
    
    await db.categories.bulkAdd(categories);

    // 2. Crear 1000+ Productos
    progressCallback?.("Generando 1000 productos...");
    const products: any[] = [];
    for (let i = 1; i <= 1000; i++) {
      const category = categories[Math.floor(Math.random() * categories.length)];
      const price = Math.floor(Math.random() * 50000) + 1000; // 10.00 a 500.00
      
      products.push({
        id: uuidv4(),
        categoryId: category.id,
        name: `Producto de Prueba #${i.toString().padStart(4, '0')}`,
        sku: `TEST-${i.toString().padStart(4, '0')}`,
        stock: Math.floor(Math.random() * 200) + 10,
        price,
        isVisible: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    await db.products.bulkAdd(products);

    // 3. Crear 1000+ Órdenes
    progressCallback?.("Generando 1200 ventas simuladas...");
    const orders: any[] = [];
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    for (let i = 1; i <= 1200; i++) {
      // Simular ventas en los últimos 30 días
      const randomTime = now - (Math.floor(Math.random() * 30) * dayInMs) - (Math.floor(Math.random() * dayInMs));
      
      // Cada orden tiene entre 1 y 5 productos aleatorios
      const itemsCount = Math.floor(Math.random() * 5) + 1;
      const orderItems: any[] = [];
      let subtotal = 0;

      for (let j = 0; j < itemsCount; j++) {
        const prod = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        const price = prod.price;
        const itemSubtotal = price * qty;
        
        orderItems.push({
          productId: prod.id,
          name: prod.name,
          sku: prod.sku,
          price,
          quantity: qty,
          subtotal: itemSubtotal
        });
        subtotal += itemSubtotal;
      }

      const tax = calcTax(subtotal);
      const total = subtotal + tax;

      orders.push({
        id: uuidv4(),
        status: 'PAID',
        paymentMethod: Math.random() > 0.5 ? 'CASH' : 'CARD',
        subtotal,
        tax,
        total,
        items: orderItems,
        createdAt: randomTime
      });
    }
    await db.orders.bulkAdd(orders);

    progressCallback?.("¡Éxito! Base de datos poblada masivamente.");
    return { success: true, productCount: 1000, orderCount: 1200 };
  } catch (error) {
    console.error("Error en Seeding:", error);
    return { success: false, error: String(error) };
  }
}

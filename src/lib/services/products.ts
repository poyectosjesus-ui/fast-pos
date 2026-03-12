import { db } from '../db';
import { Product, ProductSchema } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export const ProductService = {
  /**
   * Obtiene todos los productos del catálogo.
   */
  async getAll(): Promise<Product[]> {
    return await db.products.toArray();
  },

  /**
   * Crea un producto validando integridad (Zod) y unicidad (SKU)
   */
  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    // Transacción atómica en la tabla 'products' para evitar colisión de SKU 
    // por clicks simultáneos o promesas asíncronas concurrentes.
    return await db.transaction('rw', db.products, async () => {
      const parsed = ProductSchema.parse({
        ...data,
        id: uuidv4(), // Epoch y UUID siempre obligatorios (Normativa 5)
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      // Regla de Negocio: SKU debe ser único
      const allItems = await db.products.toArray();
      const existingSku = allItems.find(p => p.sku === parsed.sku);
      
      if (existingSku) {
        // Mensaje Semántico Controlado (Normativa 4)
        throw new Error(`El código SKU '${parsed.sku}' ya pertenece al producto: ${existingSku.name}.`);
      }

      await db.products.add(parsed);
      return parsed;
    });
  },

  /**
   * Actualiza el producto protegiendo el SKU de posibles duplicidades.
   */
  async update(id: string, data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    return await db.transaction('rw', db.products, async () => {
      const existing = await db.products.get(id);
      if (!existing) {
          throw new Error(`Inconsistencia: El producto asociado no fue encontrado en la base local.`);
      }
      
      // Validar si el SKU cambió. Si cambió, verificar que el nuevo no esté usado por OTRO producto.
      if (data.sku !== existing.sku) {
         const allItems = await db.products.toArray();
         const isSkuTaken = allItems.some(p => p.sku === data.sku && p.id !== id);
         
         if(isSkuTaken) {
             throw new Error(`El nuevo código SKU '${data.sku}' ya está asignado a otro ítem del inventario.`);
         }
      }

      const updated = { ...existing, ...data, updatedAt: Date.now() };
      const parsed = ProductSchema.parse(updated);
      
      await db.products.put(parsed);
      return parsed;
    });
  },

  /**
   * Borrado Físico. 
   * Nota Lógica (Normativa 1): El historial de ventas (Orders > OrderItems) guardará 
   * una snapshot de este producto as-is. Borrarlo del catálogo aquí NO afecta ventas pasadas.
   */
  async delete(id: string): Promise<void> {
    await db.products.delete(id);
  }
};

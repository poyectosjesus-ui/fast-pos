import { db } from '../db';
import { Product, ProductSchema } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export const ProductService = {
  /**
   * Obtiene todos los productos, filtrando opcionalmente por visibilidad.
   * Por defecto, el Dashboard de Inventario los trae todos.
   */
  async getAll(onlyVisible: boolean = false): Promise<Product[]> {
    if (onlyVisible) {
      return await db.products.filter(p => p.isVisible !== false).toArray();
    }
    return await db.products.toArray();
  },

  /**
   * Búsqueda centralizada de productos por Nombre o SKU.
   * Al vivir aquí (servicio), cualquier pantalla puede reutilizarla sin duplicar lógica.
   * La búsqueda ignora mayúsculas/minúsculas para mejorar la experiencia del cajero.
   * 
   * @param query - Texto libre o código de barras enviado por el scanner físico
   * @param onlyVisible - Si true, excluye los productos ocultos del POS
   */
  async search(query: string, onlyVisible: boolean = false): Promise<Product[]> {
    const normalized = query.trim().toLowerCase();
    
    if (!normalized) {
      return this.getAll(onlyVisible);
    }
    
    return await db.products.filter(p => {
      const matchesName = p.name.toLowerCase().includes(normalized);
      const matchesSku = p.sku.toLowerCase().includes(normalized);
      const visibilityOk = onlyVisible ? p.isVisible !== false : true;
      return (matchesName || matchesSku) && visibilityOk;
    }).toArray();
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
   * Actualización atómica rápida exclusiva para cambios numéricos de stock.
   */
  async adjustStock(id: string, newStock: number): Promise<void> {
    if (newStock < 0) throw new Error("Inventario no puede ser menor a cero.");
    await db.transaction('rw', db.products, async () => {
       const existing = await db.products.get(id);
       if (!existing) throw new Error("Producto extraviado en la base de datos local.");
       
       const updated = { ...existing, stock: newStock, updatedAt: Date.now() };
       const parsed = ProductSchema.parse(updated);
       await db.products.put(parsed);
    });
  },

  /**
   * Actualización atómica rápida exclusiva para visibilidad.
   */
  async toggleVisibility(id: string, isVisible: boolean): Promise<void> {
    await db.transaction('rw', db.products, async () => {
       const existing = await db.products.get(id);
       if (!existing) throw new Error("Producto no encontrado.");
       
       const updated = { ...existing, isVisible, updatedAt: Date.now() };
       const parsed = ProductSchema.parse(updated);
       await db.products.put(parsed);
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

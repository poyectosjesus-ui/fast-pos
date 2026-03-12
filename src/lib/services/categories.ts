import { db } from '../db';
import { Category, CategorySchema } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export const CategoryService = {
  /**
   * Obtiene todas las categorías ordenadas alfabéticamente.
   * Usado para popular los Selects en la UI de Productos.
   */
  async getAll(): Promise<Category[]> {
    return await db.categories.orderBy('name').toArray();
  },

  /**
   * Crea una categoría con validación "Zero Trust" vía Zod.
   */
  async create(name: string): Promise<Category> {
    // Zero Trust: Validamos la entrada cruda antes de intentar insertarla en BD
    const parsed = CategorySchema.parse({
      id: uuidv4(), // Obligatorio UUID v4 para escenarios offline-first y evitar colisiones
      name,
      createdAt: Date.now(), // Epoch Timestamp (Integer) para evitar problemas de timezone
      updatedAt: Date.now(),
    });
    
    await db.categories.add(parsed);
    return parsed;
  },

  /**
   * Actualiza el nombre de una categoría manteniendo el resto de propiedades intactas.
   */
  async update(id: string, name: string): Promise<Category> {
    // Transacción Read-Write para garantizar consistencia entre lectura y guardado
    return await db.transaction('rw', db.categories, async () => {
      const existing = await db.categories.get(id);
      
      // Mensaje Semántico: Nada de undefined. Explicamos claramente al Frontend.
      if (!existing) {
         throw new Error(`Inconsistencia Lógica: No se encontró la categoría con ID ${id} para actualizar.`);
      }
      
      const updated = { ...existing, name, updatedAt: Date.now() };
      const parsed = CategorySchema.parse(updated);
      
      await db.categories.put(parsed);
      return parsed;
    });
  },

  /**
   * Elimina una categoría aplicando Integridad Referencial Estricta.
   * Uso de Transacción Atómica: Bloquea la DB para asegurar que nadie agregue 
   * productos a la categoría en el milisegundo entre la comprobación y el borrado.
   */
  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.categories, db.products, async () => {
      // 1. Verificamos asociación para no dejar productos "huérfanos"
      const productsCount = await db.products.where('categoryId').equals(id).count();
      
      if (productsCount > 0) {
        // Mensaje Semántico que la UI puede mostrar directamente al usuario final en un Toast.
        throw new Error(`Integridad Rota: Imposible eliminar. Tienes ${productsCount} producto(s) asignados a esta familia.`);
      }
      
      // 2. Si la validación pasa, se elimina. Si falla, Dexie hace Rollback automático.
      await db.categories.delete(id);
    });
  }
};

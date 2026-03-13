import { db } from '../db';
import { Category, CategorySchema } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export const CategoryService = {
  /**
   * Obtiene todas las categorías ordenadas alfabéticamente.
   * Usado para popular los Selects en la UI de Productos.
   */
  async getAll(): Promise<Category[]> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return await (window as any).electronAPI.getAllCategories();
    }
    return await db.categories.orderBy('name').toArray();
  },

  async create(name: string): Promise<Category> {
    const parsed = CategorySchema.parse({
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.createCategory(parsed);
      if (!result.success) throw new Error(result.error || "Error al crear categoría nativa.");
    } else {
      await db.categories.add(parsed);
    }
    return parsed;
  },

  async update(id: string, name: string): Promise<Category> {
    const updatedAt = Date.now();
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.updateCategory({ id, name, updatedAt });
      if (!result.success) throw new Error(result.error || "Error al actualizar categoría nativa.");
      
      const all = await this.getAll();
      const cat = all.find(c => c.id === id);
      if (!cat) throw new Error("Categoría no encontrada tras actualizar.");
      return cat;
    } else {
      return await db.transaction('rw', db.categories, async () => {
        const existing = await db.categories.get(id);
        if (!existing) throw new Error(`Inconsistencia Lógica: No se encontró la categoría.`);
        const updated = { ...existing, name, updatedAt };
        const parsed = CategorySchema.parse(updated);
        await db.categories.put(parsed);
        return parsed;
      });
    }
  },

  async delete(id: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // Validación de integridad rápida en el frontend (más descriptiva para el usuario)
      const products = await (window as any).electronAPI.getAllProducts();
      const children = products.filter((p: any) => p.categoryId === id);
      
      if (children.length > 0) {
        throw new Error(`Integridad Rota: Imposible eliminar. Tienes ${children.length} producto(s) asignados a esta familia.`);
      }

      const result = await (window as any).electronAPI.deleteCategory(id);
      if (!result.success) throw new Error(result.error || "Error al eliminar categoría nativa.");
    } else {
      await db.transaction('rw', db.categories, db.products, async () => {
        const productsCount = await db.products.where('categoryId').equals(id).count();
        if (productsCount > 0) throw new Error(`Integridad Rota: Imposible eliminar.`);
        await db.categories.delete(id);
      });
    }
  }
};

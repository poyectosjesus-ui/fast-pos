import { db } from '../db';
import { Product, ProductSchema } from '../schema';
import { v4 as uuidv4 } from 'uuid';

export const ProductService = {
  /**
   * Obtiene todos los productos, filtrando opcionalmente por visibilidad.
   * Por defecto, el Dashboard de Inventario los trae todos.
   */
  async getAll(onlyVisible: boolean = false): Promise<Product[]> {
    if (typeof window === 'undefined' || !(window as any).electronAPI) {
      // Fallback para SSR o entorno no-electron si fuera necesario
      return [];
    }

    const products = await (window as any).electronAPI.getAllProducts();
    
    if (onlyVisible) {
      return products.filter((p: Product) => p.isVisible !== false);
    }
    return products;
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
    const parsed = ProductSchema.parse({
      ...data,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.createProduct(parsed);
      if (!result.success) {
        throw new Error(result.error || "No se pudo crear el producto en la base nativa.");
      }
    } else {
      // Fallback para desarrollo/testing no-electron
      await db.products.add(parsed);
    }
    
    return parsed;
  },

  /**
   * Actualiza el producto protegiendo el SKU de posibles duplicidades.
   */
  async update(id: string, data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const updatedAt = Date.now();
    
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.updateProduct({
        ...data,
        id,
        updatedAt
      });
      if (!result.success) {
        throw new Error(result.error || "Error al actualizar el producto nativo.");
      }
      return { id, ...data, updatedAt } as Product;
    } else {
      return await db.transaction('rw', db.products, async () => {
        const existing = await db.products.get(id);
        if (!existing) throw new Error(`Inconsistencia: El producto no fue encontrado.`);
        
        const updated = { ...existing, ...data, updatedAt };
        const parsed = ProductSchema.parse(updated);
        await db.products.put(parsed);
        return parsed;
      });
    }
  },

  async adjustStock(id: string, newStock: number): Promise<void> {
    if (newStock < 0) throw new Error("Inventario no puede ser menor a cero.");
    
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const all = await this.getAll();
      const existing = all.find(p => p.id === id);
      if (!existing) throw new Error("Producto no encontrado.");

      const { categoryName, ...productData } = existing as any;
      await this.update(id, { ...productData, stock: newStock });
    } else {
      await db.transaction('rw', db.products, async () => {
        const existing = await db.products.get(id);
        if (!existing) throw new Error("Producto extraviado.");
        const updated = { ...existing, stock: newStock, updatedAt: Date.now() };
        await db.products.put(ProductSchema.parse(updated));
      });
    }
  },

  async toggleVisibility(id: string, isVisible: boolean): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const all = await this.getAll();
      const existing = all.find(p => p.id === id);
      if (!existing) throw new Error("Producto no encontrado.");

      const { categoryName, ...productData } = existing as any;
      await this.update(id, { ...productData, isVisible });
    } else {
      await db.transaction('rw', db.products, async () => {
        const existing = await db.products.get(id);
        if (!existing) throw new Error("Producto no encontrado.");
        const updated = { ...existing, isVisible, updatedAt: Date.now() };
        await db.products.put(ProductSchema.parse(updated));
      });
    }
  },

  async delete(id: string): Promise<void> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.deleteProduct(id);
      if (!result.success) throw new Error(result.error || "No se pudo eliminar.");
    } else {
      await db.products.delete(id);
    }
  }
};

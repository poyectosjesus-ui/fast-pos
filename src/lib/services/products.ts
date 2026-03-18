/**
 * PRODUCT SERVICE — Fast-POS 2.0
 *
 * Responsabilidad: CRUD de productos a través de electronAPI → SQLite.
 *   Sin Dexie. Sin efectos secundarios fuera de IPC.
 * Fuente de Verdad: ARCHITECTURE.md §2.2, CODING_STANDARDS.md §4
 *
 * REGLA: Precios en CENTAVOS (integer). Nunca floats.
 */

import { Product, ProductSchema } from '../schema';
import { v4 as uuidv4 } from 'uuid';
import { AuditService } from './audit';

// Helper tipado para evitar `any` en cada método
function getAPI() {
  if (typeof window === 'undefined') return null;
  return (window as any).electronAPI ?? null;
}

export const ProductService = {
  /**
   * Obtiene todos los productos desde SQLite.
   * Si `onlyVisible=true`, filtra los ocultos (no visibles en el POS).
   */
  async getAll(onlyVisible = false): Promise<Product[]> {
    const api = getAPI();
    if (!api) return [];
    const products = (await api.getAllProducts()) as Product[];
    return onlyVisible ? products.filter(p => p.isVisible !== false) : products;
  },

  /**
   * Búsqueda en memoria por Nombre o SKU.
   * Carga todos los productos y filtra localmente (seguro para catálogos medianos).
   */
  async search(query: string, onlyVisible = false): Promise<Product[]> {
    const all = await this.getAll(onlyVisible);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  },

  /**
   * Crea un producto nuevo en SQLite.
   * Valida con Zod antes de enviar al Main Process.
   */
  async create(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    const api = getAPI();
    if (!api) throw new Error('Fuera del entorno Electron.');

    const parsed = ProductSchema.parse({
      ...data,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const result = await api.createProduct(parsed) as { success: boolean; error?: string };
    if (!result.success) {
      throw new Error(result.error ?? 'No se pudo guardar el producto.');
    }
    return parsed;
  },

  /**
   * Actualiza un producto existente en SQLite.
   */
  async update(id: string, data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>, userId?: string): Promise<Product> {
    const api = getAPI();
    if (!api) throw new Error('Fuera del entorno Electron.');

    const allProducts = await this.getAll();
    const existing = allProducts.find((p) => p.id === id);

    const updatedAt = Date.now();
    const result = await api.updateProduct({ ...data, id, updatedAt, userId }) as { success: boolean; error?: string };
    if (!result.success) {
      throw new Error(result.error ?? 'No se pudo actualizar el producto.');
    }

    // Auditoría Detallada (Extraer deltas)
    const changes: Record<string, { from: any; to: any }> = {};
    if (existing) {
      if (existing.name !== data.name) changes.name = { from: existing.name, to: data.name };
      if (existing.price !== data.price) changes.price = { from: existing.price, to: data.price };
      if (existing.costPrice !== data.costPrice) changes.costPrice = { from: existing.costPrice, to: data.costPrice };
      if (existing.sku !== data.sku) changes.sku = { from: existing.sku, to: data.sku };
      if (existing.stock !== data.stock) changes.stock = { from: existing.stock, to: data.stock };
      if (existing.isVisible !== data.isVisible) changes.isVisible = { from: existing.isVisible ? 'Sí' : 'No', to: data.isVisible ? 'Sí' : 'No' };
    }

    await AuditService.log(
      userId || "SYSTEM",
      "Admin", // Remplazar por userName desde la UI más adelante
      "UPDATE_PRODUCT",
      { 
        id, 
        name: data.name, 
        hasChanges: Object.keys(changes).length > 0,
        changes 
      }
    );

    return { id, ...data, updatedAt } as Product;
  },

  /** Ajusta el stock de un producto usando `update()`. */
  async adjustStock(id: string, newStock: number, userId?: string): Promise<void> {
    if (newStock < 0) throw new Error('El inventario no puede ser negativo.');
    const all = await this.getAll();
    const existing = all.find(p => p.id === id);
    if (!existing) throw new Error('Producto no encontrado.');
    await this.update(id, { ...existing, stock: newStock }, userId);
  },

  /** Cambia la visibilidad de un producto en el POS. */
  async toggleVisibility(id: string, isVisible: boolean, userId?: string): Promise<void> {
    const all = await this.getAll();
    const existing = all.find(p => p.id === id);
    if (!existing) throw new Error('Producto no encontrado.');
    await this.update(id, { ...existing, isVisible }, userId);
  },

  /** Elimina un producto permanentemente. */
  async delete(id: string, userId?: string): Promise<void> {
    const api = getAPI();
    if (!api) throw new Error('Fuera del entorno Electron.');
    const result = await api.deleteProduct({ productId: id, userId }) as { success: boolean; error?: string };
    if (!result.success) throw new Error(result.error ?? 'No se pudo eliminar.');

    // Auditoría
    await AuditService.log(
      userId || "SYSTEM",
      "Admin",
      "DELETE_PRODUCT",
      { id }
    );
  },
};

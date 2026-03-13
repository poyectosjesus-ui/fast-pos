/**
 * OrderService — Motor de Cierre de Venta
 *
 * FUENTE DE VERDAD: motor_ventas_plan.md — Sección 3.3
 *
 * Esta es la operación más crítica del sistema.
 * Todo el flujo de cobro ocurre en una sola transacción atómica de Dexie.
 * Si cualquier paso falla, TODOS los cambios se revierten (Rollback).
 */

import { db } from '../db';
import { Order, OrderSchema } from '../schema';
import { CartItem } from '@/store/useCartStore';
import { calcTax } from '../constants';
import { v4 as uuidv4 } from 'uuid';

interface CheckoutInput {
  items: CartItem[];
  paymentMethod: 'CASH' | 'CARD';
}

interface CheckoutResult {
  success: boolean;
  order?: Order;
  error?: string;
}

export const OrderService = {
  /**
   * Cierra la venta de forma atómica.
   *
   * FLUJO (motor_ventas_plan.md § 3.3):
   * 1. Verificar stock actual de CADA ítem contra la DB (no contra el carrito)
   * 2. Restar stock de cada producto
   * 3. Crear el registro de la Orden
   * 4. Si cualquier paso falla: Rollback automático de Dexie
   */
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const { items, paymentMethod } = input;

    if (items.length === 0) {
      return { success: false, error: 'El carrito está vacío. Agrega artículos antes de cobrar.' };
    }

    // Preparar Orden (SNAPSHOT)
    const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
    const tax = calcTax(subtotal);
    const total = subtotal + tax;

    const newOrder: Order = OrderSchema.parse({
      id: uuidv4(),
      items: items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.subtotal,
      })),
      subtotal,
      tax,
      total,
      status: 'COMPLETED',
      paymentMethod,
      createdAt: Date.now(),
    });

    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        // La transacción atómica ocurre en el Main Process (Robustez 1.1)
        const result = await (window as any).electronAPI.checkout(newOrder);
        
        if (!result.success) {
          return { success: false, error: result.error || "Falla en transacción nativa." };
        }
        return { success: true, order: newOrder };
      } else {
        // Fallback Dexie para entornzo PWA/Desarrollo
        await db.transaction('rw', db.products, db.orders, async () => {
          for (const item of items) {
             const p = await db.products.get(item.productId);
             if(!p || p.stock < item.quantity) throw new Error(`Stock insuficiente para ${item.name}`);
             await db.products.update(item.productId, { stock: p.stock - item.quantity, updatedAt: Date.now() });
          }
          await db.orders.add(newOrder);
        });
        return { success: true, order: newOrder };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Error al procesar el cobro.' };
    }
  },

  /** Obtiene el historial de órdenes */
  async getAll(): Promise<Order[]> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      return await (window as any).electronAPI.getOrderHistory();
    }
    return await db.orders.orderBy('createdAt').reverse().toArray();
  },

  /** 
   * Búsqueda avanzada de órdenes con filtros (Fase 12.2)
   */
  async searchOrders(params: {
    status?: 'COMPLETED' | 'CANCELLED' | 'ALL';
    paymentMethod?: 'CASH' | 'CARD' | 'ALL';
    limit: number;
    offset: number;
  }): Promise<{ items: Order[]; total: number }> {
    let collection = db.orders.orderBy('createdAt').reverse();

    if (params.status && params.status !== 'ALL') {
      collection = collection.filter(o => o.status === params.status);
    }

    if (params.paymentMethod && params.paymentMethod !== 'ALL') {
      collection = collection.filter(o => o.paymentMethod === params.paymentMethod);
    }

    const total = await collection.count();
    const items = await collection
      .offset(params.offset)
      .limit(params.limit)
      .toArray();

    return { items, total };
  },

  async getOverallStats(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
  }> {
    const all = await this.getAll();
    const completed = all.filter(o => o.status === 'COMPLETED');
    const totalRevenue = completed.reduce((acc, o) => acc + o.total, 0);
    const totalOrders = completed.length;
    const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return { totalRevenue, totalOrders, avgTicket };
  },

  async getStatsForDay(date: Date = new Date()): Promise<{
    totalNet: number;
    totalWithTax: number;
    cashTotal: number;
    cardTotal: number;
    orderCount: number;
    avgTicket: number;
    todayOrders: Order[];
  }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const all = await this.getAll();
    const todayOrders = all.filter(o => 
      o.createdAt >= startOfDay.getTime() && 
      o.createdAt <= endOfDay.getTime() &&
      o.status === 'COMPLETED'
    );

    if (todayOrders.length === 0) {
      return { totalNet: 0, totalWithTax: 0, cashTotal: 0, cardTotal: 0, orderCount: 0, avgTicket: 0, todayOrders: [] };
    }

    const totalNet = todayOrders.reduce((acc, o) => acc + o.subtotal, 0);
    const totalWithTax = todayOrders.reduce((acc, o) => acc + o.total, 0);
    const cashTotal = todayOrders.filter(o => o.paymentMethod === 'CASH').reduce((acc, o) => acc + o.total, 0);
    const cardTotal = todayOrders.filter(o => o.paymentMethod === 'CARD').reduce((acc, o) => acc + o.total, 0);
    const orderCount = todayOrders.length;
    const avgTicket = Math.round(totalWithTax / orderCount);

    return { totalNet, totalWithTax, cashTotal, cardTotal, orderCount, avgTicket, todayOrders };
  },

  /**
   * Calcula el Top-N de productos más vendidos en el día (por monto generado).
   * CA-4.2.1: Los datos se derivan de las órdenes ya filtradas, sin nueva consulta a DB.
   * CA-4.2.3: Retorna también el stock actual para detectar artículos en riesgo.
   *
   * @param orders     - Lista de órdenes del día (resultado de getStatsForDay)
   * @param limit      - Cuántos productos traer en el ranking (default: 5)
   */
  async getTopProducts(
    orders: Order[],
    limit: number = 5
  ): Promise<Array<{ productId: string; name: string; unitsSold: number; revenue: number; currentStock: number }>> {
    // Agregamos todos los ítems de todas las órdenes en un mapa por productId
    const aggregation = new Map<string, { name: string; unitsSold: number; revenue: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = aggregation.get(item.productId);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          aggregation.set(item.productId, {
            name: item.name,
            unitsSold: item.quantity,
            revenue: item.subtotal,
          });
        }
      }
    }

    // Ordenamos por monto generado (revenue) de mayor a menor y tomamos el top N
    const sorted = Array.from(aggregation.entries())
      .map(([productId, data]) => ({ productId, ...data, currentStock: 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    // CA-4.2.3: Enriquecemos con el stock actual para detectar artículos en riesgo
    for (const item of sorted) {
      const product = await db.products.get(item.productId);
      item.currentStock = product?.stock ?? 0;
    }

    return sorted;
  },

  /**
   * CA-4.3.3: Anular Venta (Void Order).
   * Operación atómica que marca la orden como CANCELLED y devuelve
   * todas las unidades de los productos al inventario (stock).
   *
   * @param orderId   - El UUID de la orden a anular
   */
  async voidOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db.transaction('rw', db.products, db.orders, async () => {
        const order = await db.orders.get(orderId);

        if (!order) {
          throw new Error('El ticket no existe o ya fue eliminado.');
        }

        if (order.status === 'CANCELLED') {
          throw new Error('Esta venta ya había sido anulada previamente.');
        }

        // 1. Devolver el inventario de cada artículo
        for (const item of order.items) {
          const product = await db.products.get(item.productId);
          if (product) {
            await db.products.update(item.productId, {
              stock: product.stock + item.quantity,
              updatedAt: Date.now(),
            });
          }
        }

        // 2. Marcar la orden como cancelada
        await db.orders.update(orderId, {
          status: 'CANCELLED',
        });
      });

      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error desconocido al anular el ticket.';
      return { success: false, error: message };
    }
  },
};

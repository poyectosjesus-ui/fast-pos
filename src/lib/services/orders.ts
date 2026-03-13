/**
 * OrderService — Motor de Cierre de Venta
 *
 * Responsabilidad: Todas las operaciones de órdenes pasan por electronAPI → SQLite.
 * Fuente de Verdad: ARCHITECTURE.md §2.3, CODING_STANDARDS.md §5
 *
 * NOTA: Este servicio es 100% Electron. No hay fallback Dexie.
 */

import { Order, OrderSchema } from '../schema';
import { CartItem } from '@/store/useCartStore';
import { calculateCartTax } from '@/lib/services/tax';
import { v4 as uuidv4 } from 'uuid';

// Helper tipado para acceder a electronAPI
function getAPI() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI ?? null;
}

interface CheckoutInput {
  items: CartItem[];
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'WHATSAPP' | 'ONLINE' | 'OTHER';
  source?: 'LOCAL' | 'ONLINE';
}

interface CheckoutResult {
  success: boolean;
  order?: Order;
  error?: string;
}

export const OrderService = {
  /**
   * Cierra la venta de forma atómica.
   * La transacción ocurre en el Main Process (ipc-handlers.js → SQLite).
   *
   * FLUJO:
   * 1. Armar el snapshot de la orden
   * 2. Validar con Zod antes de enviar al Main
   * 3. El Main verifica stock y descuenta (atómicamente en SQLite)
   * 4. Si falla: devuelve { success: false, error }
   */
  async checkout(input: CheckoutInput): Promise<CheckoutResult> {
    const { items, paymentMethod } = input;
    const api = getAPI();

    if (items.length === 0) {
      return { success: false, error: 'El carrito está vacío. Agrega artículos antes de cobrar.' };
    }

    // EPIC-002: Cálculo de IVA correcto por producto con calculateCartTax()
    const { subtotal, tax, total } = calculateCartTax(
      items.map(i => ({
        price: i.price,
        quantity: i.quantity,
        taxRate: i.taxRate,
        taxIncluded: i.taxIncluded,
      }))
    );

    const newOrder: Order = OrderSchema.parse({
      id: uuidv4(),
      items: items.map(i => ({
        productId: i.productId,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        subtotal: i.subtotal,
        taxRate: i.taxRate,
        taxIncluded: i.taxIncluded,
      })),
      subtotal,
      tax,
      total,
      status: 'COMPLETED',
      paymentMethod,
      source: input.source ?? 'LOCAL',
      createdAt: Date.now(),
    });


    if (!api) {
      return { success: false, error: 'No disponible fuera de Electron.' };
    }

    const result = await api.checkout(newOrder) as { success: boolean; error?: string };
    if (!result.success) {
      return { success: false, error: result.error || 'Falla en transacción nativa.' };
    }
    return { success: true, order: newOrder };
  },

  /** Obtiene el historial de órdenes desde SQLite */
  async getAll(): Promise<Order[]> {
    const api = getAPI();
    if (!api) return [];
    return (await api.getOrderHistory()) as Order[];
  },

  /** Obtiene una única orden por su ID */
  async getById(id: string): Promise<Order | null> {
    const api = getAPI();
    if (!api) return null;
    return (await api.getOrderById(id)) as Order | null;
  },

  /**
   * Búsqueda de órdenes con filtros y paginación (en memoria, sobre el historial completo).
   * Para volúmenes grandes (>10k órdenes), migrar a handler SQL con LIMIT/OFFSET en EPIC-003.
   */
  async searchOrders(params: {
    status?: 'COMPLETED' | 'CANCELLED' | 'ALL';
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'WHATSAPP' | 'ONLINE' | 'OTHER' | 'ALL';
    source?: 'LOCAL' | 'ONLINE' | 'ALL';
    limit: number;
    offset: number;
  }): Promise<{ items: Order[]; total: number }> {
    const all = await this.getAll();

    let filtered = [...all].sort((a, b) => b.createdAt - a.createdAt);

    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter(o => o.status === params.status);
    }
    if (params.paymentMethod && params.paymentMethod !== 'ALL') {
      filtered = filtered.filter(o => o.paymentMethod === params.paymentMethod);
    }
    if (params.source && params.source !== 'ALL') {
      filtered = filtered.filter(o => o.source === params.source);
    }

    const total = filtered.length;
    const items = filtered.slice(params.offset, params.offset + params.limit);
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
   * CA-4.2.1: Top-N de productos más vendidos en el día (por monto generado).
   * CA-4.2.3: Incluye stock actual para detectar artículos en riesgo.
   */
  async getTopProducts(
    orders: Order[],
    limit: number = 5
  ): Promise<Array<{ productId: string; name: string; unitsSold: number; revenue: number; currentStock: number }>> {
    const api = getAPI();
    const aggregation = new Map<string, { name: string; unitsSold: number; revenue: number }>();

    for (const order of orders) {
      for (const item of order.items) {
        const existing = aggregation.get(item.productId);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += item.subtotal;
        } else {
          aggregation.set(item.productId, { name: item.name, unitsSold: item.quantity, revenue: item.subtotal });
        }
      }
    }

    const sorted = Array.from(aggregation.entries())
      .map(([productId, data]) => ({ productId, ...data, currentStock: 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    // Enriquecer con stock actual
    if (api) {
      const allProducts = (await api.getAllProducts()) as Array<{ id: string; stock: number }>;
      for (const item of sorted) {
        const found = allProducts.find(p => p.id === item.productId);
        item.currentStock = found?.stock ?? 0;
      }
    }

    return sorted;
  },

  /**
   * CA-4.3.3: Anular Venta — operación atómica via electronAPI.
   * El Main Process devuelve el stock automáticamente.
   */
  async voidOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    const api = getAPI();
    if (!api) return { success: false, error: 'No disponible fuera de Electron.' };
    const result = await api.voidOrder(orderId) as { success: boolean; error?: string };
    return result;
  },
};

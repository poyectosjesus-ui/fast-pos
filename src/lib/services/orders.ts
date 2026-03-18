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
import { AuditService } from '@/lib/services/audit';

// Helper tipado para acceder a electronAPI
function getAPI() {
  if (typeof window === 'undefined') return null;
  return window.electronAPI ?? null;
}

interface CheckoutInput {
  items: CartItem[];
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT' | 'OTHER';
  /** Sprint-1 E2: Canal de venta. Por defecto COUNTER (mostrador). */
  source?: 'COUNTER' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'OTHER';
  userId?: string | null;
  customerId?: string | null;
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

    if (!input.userId) {
      return { success: false, error: 'Sesión expirada o cajero no identificado. Actualiza la página.' };
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
      source: input.source || 'COUNTER',
      userId: input.userId,
      customerId: input.customerId || null,
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
   * Búsqueda de órdenes con filtros y paginación 
   * (Migrado a push-down SQL nativo en EPIC-003 para soportar >10k órdenes sin lags)
   */
  async searchOrders(params: {
    status?: 'COMPLETED' | 'CANCELLED' | 'ALL';
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'WHATSAPP' | 'ONLINE' | 'OTHER' | 'ALL';
    source?: 'COUNTER' | 'WHATSAPP' | 'INSTAGRAM' | 'FACEBOOK' | 'OTHER' | 'ALL';
    startDate?: number;
    endDate?: number;
    limit: number;
    offset: number;
  }): Promise<{ items: Order[]; total: number }> {
    const api = getAPI();
    if (!api) return { items: [], total: 0 };
    return (await api.searchOrdersPaginated(params)) as { items: Order[]; total: number };
  },

  async getOverallStats(): Promise<{
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
  }> {
    const api = getAPI();
    if (!api) return { totalRevenue: 0, totalOrders: 0, avgTicket: 0 };
    return await api.getOverallStats();
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

    const api = getAPI();
    if (!api) {
      return { totalNet: 0, totalWithTax: 0, cashTotal: 0, cardTotal: 0, orderCount: 0, avgTicket: 0, todayOrders: [] };
    }

    const todayOrders = (await api.getOrdersByDateRange(startOfDay.getTime(), endOfDay.getTime())) as Order[];

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
   * CA-4.2.1: Top-N de productos más vendidos (Nuevos Filtros de Dueño)
   */
  async getTopProducts(
    startDate: number,
    endDate: number,
    limit: number = 5
  ): Promise<Array<{ productId: string; name: string; unitsSold: number; revenue: number; currentStock: number }>> {
    const api = getAPI();
    if (!api) return [];
    
    const result = await (api as any).getTopProducts({ startDate, endDate, limit });
    if (result && result.success && result.data) {
       return result.data;
    }
    return [];
  },

  /**
   * CA-4.3.3: Anular Venta — operación atómica via electronAPI.
   * El Main Process devuelve el stock automáticamente.
   */
  async voidOrder(orderId: string, userId?: string, userName?: string): Promise<{ success: boolean; error?: string }> {
    const api = getAPI();
    if (!api) return { success: false, error: 'No disponible fuera de Electron.' };
    
    // Extraer metadata del ticket para el Tracker antes de anular (Lectura)
    let total = 0;
    let itemCount = 0;
    try {
      const resp = await this.searchOrders({ offset: 0, limit: 100 });
      const target = resp.items.find((o: any) => o.id === orderId);
      if (target) {
        total = target.total;
        itemCount = target.items?.reduce((acc: number, i: any) => acc + i.quantity, 0) || 0;
      }
    } catch (e) { console.warn("No se pudo pre-cargar metadata", e); }

    const result = await (api as any).voidOrder({ orderId, userId }) as { success: boolean; error?: string };
    
    // Inyectar auditoría forense si la anulación fue exitosa
    if (result.success) {
       await AuditService.log(
         userId || 'SYSTEM', 
         userName || 'Desconocido', 
         'VOID_ORDER', 
         { orderId, total, itemCount }
       );
    }
    
    return result;
  },

  /**
   * Obtiene estadísticas de rentabilidad real (Premium).
   */
  async getProfitStats(startDate: number, endDate: number): Promise<{
    success: boolean;
    summary: { revenue: number; cost: number; profit: number; orderCount: number };
    dailyData: { date: string; revenue: number; cost: number }[];
    error?: string;
  }> {
    const api = getAPI();
    if (!api) throw new Error('Fuera de Electron');
    return await api.getProfitStats({ startDate, endDate });
  },

  /**
   * Obtiene el resumen rápido de KPIs para el día de hoy (Épica 2.2).
   */
  async getDaySummary(): Promise<{
    success: boolean;
    data?: {
      totalRevenue: number;
      netProfit: number;
      ticketCount: number;
    };
    error?: string;
  }> {
    const api = getAPI();
    if (!api) throw new Error('Fuera de Electron');
    return await api.getSummary();
  },

  async getAdvancedAnalytics(params?: { startDate?: number; endDate?: number }) {
    const api = getAPI();
    if (!api) return { success: false, error: "Native API not found" };
    return await api.getAdvancedAnalytics(params || {});
  }
};

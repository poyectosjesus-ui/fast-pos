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

    try {
      const order = await db.transaction('rw', db.products, db.orders, async () => {
        // PASO 1: Verificación de stock en tiempo real (CA-3.3.2)
        // Se consulta el estado ACTUAL de la DB, no el carrito (que puede estar viejo)
        for (const item of items) {
          const product = await db.products.get(item.productId);

          if (!product) {
            // Backend Guideline 4: Mensaje semántico y controlado
            throw new Error(`El artículo "${item.name}" ya no existe en el catálogo. Puede haber sido eliminado.`);
          }

          if (product.stock < item.quantity) {
            throw new Error(
              `No hay suficiente inventario para "${product.name}". ` +
              `Tienes ${item.quantity} en el carrito, pero solo quedan ${product.stock} en almacén.`
            );
          }
        }

        // PASO 2: Descontar stock de cada producto (operación atómica)
        for (const item of items) {
          const product = await db.products.get(item.productId)!;
          await db.products.update(item.productId, {
            stock: product!.stock - item.quantity,
            updatedAt: Date.now(),
          });
        }

        // PASO 3: Calcular totales con centavos (Normativa Backend 2)
        const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0);
        const tax = calcTax(subtotal);
        const total = subtotal + tax;

        // PASO 4: Crear registro de la Orden con snapshot completo
        const newOrder: Order = OrderSchema.parse({
          id: uuidv4(),           // CA-3.3.5: UUID v4 único por orden
          items: items.map(i => ({
            productId: i.productId,
            name: i.name,         // Snapshot del nombre al momento de la venta
            price: i.price,       // Snapshot del precio
            quantity: i.quantity,
            subtotal: i.subtotal,
          })),
          subtotal,
          tax,
          total,
          status: 'COMPLETED',
          paymentMethod,
          createdAt: Date.now(), // Epoch Timestamp (Backend Guideline)
        });

        await db.orders.add(newOrder);
        return newOrder;
      });

      return { success: true, order };
    } catch (error: unknown) {
      // Backend Guideline 4: Trazabilidad. Capturamos y retornamos el mensaje
      // semántico para que la UI lo muestre directamente al cajero en un Toast.
      const message = error instanceof Error
        ? error.message
        : 'Ocurrió un problema al procesar el cobro. Por favor intenta de nuevo.';
      return { success: false, error: message };
    }
  },

  /** Obtiene el historial de órdenes ordenado del más reciente al más antiguo */
  async getAll(): Promise<Order[]> {
    return await db.orders.orderBy('createdAt').reverse().toArray();
  },
};

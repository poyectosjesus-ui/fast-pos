/**
 * Store del Carrito de Venta Activo
 *
 * FUENTE DE VERDAD: motor_ventas_plan.md — Sección 3.1
 *
 * Responsabilidad: Gestionar en memoria los ítems de la venta en curso.
 * Los datos son temporales (sessionStorage) y se limpian al cerrar la ventana,
 * evitando "carritos fantasma" al día siguiente.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calcTax } from '@/lib/constants';

/** 
 * Estructura de un ítem en el carrito.
 * Todos los campos monetarios en CENTAVOS (Normativa Backend 2).
 * Los campos name/sku/price son SNAPSHOTS tomados cuando se agrega el producto
 * para que un cambio posterior en el catálogo no altere una venta en curso.
 */
export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: number;     // centavos, snapshot al momento de agregar
  quantity: number;  // CA-3.1.2: nunca supera el stock disponible
  subtotal: number;  // price × quantity, recalculado en cada mutación
}

interface CartState {
  items: CartItem[];

  /**
   * Agrega un ítem o incrementa su cantidad si ya existe.
   * CA-3.1.1: No duplica filas.
   * CA-3.1.3: Requiere currentStock para validar sobre-venta.
   */
  addItem: (product: {
    id: string;
    name: string;
    sku: string;
    price: number;
    stock: number;
  }) => { success: boolean; message?: string };

  /**
   * Cambia la cantidad de un ítem validando el stock disponible.
   * CA-3.1.4: Si la nueva cantidad es 0, elimina la fila.
   */
  setQuantity: (productId: string, quantity: number, maxStock: number) => void;

  /** Elimina completamente un ítem del carrito */
  removeItem: (productId: string) => void;

  /** Limpia completo el carrito. CA-3.1.5: llamar tras cierre exitoso */
  clearCart: () => void;

  /** Totales calculados en tiempo real. Fuente de Verdad: motor_ventas_plan.md */
  getSubtotal: () => number;
  getTaxAmount: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const { items } = get();
        const existing = items.find(i => i.productId === product.id);
        const currentQty = existing?.quantity ?? 0;

        // CA-3.1.2 y CA-3.1.3: Bloquear sobre-venta
        if (currentQty >= product.stock) {
          if (product.stock === 0) {
            return { success: false, message: `"${product.name}" ya no tiene existencias disponibles.` };
          }
          return { success: false, message: `Solo quedan ${product.stock} unidades de "${product.name}" en almacén.` };
        }

        if (existing) {
          // CA-3.1.1: Incrementar cantidad de la fila existente
          set({
            items: items.map(i =>
              i.productId === product.id
                ? { ...i, quantity: i.quantity + 1, subtotal: i.price * (i.quantity + 1) }
                : i
            ),
          });
        } else {
          // Primera vez que se agrega: crear snapshot inmutable del producto
          set({
            items: [...items, {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              price: product.price,
              quantity: 1,
              subtotal: product.price,
            }],
          });
        }
        return { success: true };
      },

      setQuantity: (productId, quantity, maxStock) => {
        // CA-3.1.4: Cantidad 0 o negativa elimina la fila
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        // CA-3.1.3: No superar el stock disponible
        const clampedQty = Math.min(quantity, maxStock);
        set({
          items: get().items.map(i =>
            i.productId === productId
              ? { ...i, quantity: clampedQty, subtotal: i.price * clampedQty }
              : i
          ),
        });
      },

      removeItem: (productId) => {
        set({ items: get().items.filter(i => i.productId !== productId) });
      },

      clearCart: () => set({ items: [] }),

      // Fuente de cálculo: motor_ventas_plan.md — Tabla de Definiciones
      getSubtotal: () => get().items.reduce((acc, i) => acc + i.subtotal, 0),

      getTaxAmount: () => calcTax(get().getSubtotal()),

      getTotal: () => get().getSubtotal() + get().getTaxAmount(),
    }),
    {
      name: 'fast-pos-cart',
      // CA-3.1.6: sessionStorage para evitar carritos fantasma al día siguiente
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

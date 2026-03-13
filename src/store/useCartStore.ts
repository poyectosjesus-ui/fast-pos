/**
 * CART STORE — Fast-POS 2.0
 *
 * Responsabilidad: Gestionar en memoria los ítems de la venta en curso.
 * Fuente de Verdad: ARCHITECTURE.md §2.1, CODING_STANDARDS.md §4
 *
 * Los datos son temporales (sessionStorage) y se limpian al cerrar la ventana,
 * evitando "carritos fantasma" al día siguiente.
 *
 * REGLA: Todo monto monetario en CENTAVOS (integer). Nunca floats.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { calculateCartTax, type CartItemForTax } from '@/lib/services/tax';

/**
 * Ítem en el carrito.
 * Todos los campos monetarios en CENTAVOS.
 * Los campos son SNAPSHOTS tomados cuando se agrega el producto,
 * para que un cambio posterior en el catálogo no altere una venta en curso.
 */
export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  price: number;        // centavos, snapshot al momento de agregar
  quantity: number;     // nunca supera el stock disponible
  subtotal: number;     // price × quantity, recalculado en cada mutación
  taxRate: number;      // puntos básicos, snapshot (ej: 1600 = 16%)
  taxIncluded: boolean; // snapshot del modo de IVA al agregar
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
    taxRate: number;
    taxIncluded: boolean;
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

  /** Totales con desglose de IVA correcto por producto — EPIC-002 */
  getCartTotals: () => { subtotal: number; tax: number; total: number };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product) => {
        const { items } = get();
        const existing = items.find(i => i.productId === product.id);
        const currentQty = existing?.quantity ?? 0;

        // Bloquear sobre-venta
        if (currentQty >= product.stock) {
          if (product.stock === 0) {
            return { success: false, message: `"${product.name}" ya no tiene existencias disponibles.` };
          }
          return { success: false, message: `Solo quedan ${product.stock} unidades de "${product.name}" en almacén.` };
        }

        if (existing) {
          // Incrementar cantidad de la fila existente
          set({
            items: items.map(i =>
              i.productId === product.id
                ? { ...i, quantity: i.quantity + 1, subtotal: i.price * (i.quantity + 1) }
                : i
            ),
          });
        } else {
          // Primera vez: crear snapshot inmutable del producto (incluyendo IVA)
          set({
            items: [...items, {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              price: product.price,
              quantity: 1,
              subtotal: product.price,
              taxRate: product.taxRate ?? 1600,
              taxIncluded: product.taxIncluded ?? true,
            }],
          });
        }
        return { success: true };
      },

      setQuantity: (productId, quantity, maxStock) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
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

      /**
       * Calcula el desglose de IVA del carrito completo.
       * Usa calculateCartTax() del TaxService (función pura).
       * Fuente de Verdad: EPIC-002 / TASK-002-004
       */
      getCartTotals: () => {
        const taxItems: CartItemForTax[] = get().items.map(i => ({
          price: i.price,
          quantity: i.quantity,
          taxRate: i.taxRate,
          taxIncluded: i.taxIncluded,
        }));
        return calculateCartTax(taxItems);
      },
    }),
    {
      name: 'fast-pos-cart',
      // sessionStorage para evitar carritos fantasma al día siguiente
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

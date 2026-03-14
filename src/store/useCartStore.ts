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
  unitType: string; // ID de la unidad en catalog (Ej: "PIECE", "KILO")
  allowFractions: boolean; // Snapshot que dictamina si se muestran UI modales para decimales
  discountAmount: number; // Descuento en centavos de la partida completa
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
    unitType?: string;
    allowFractions?: boolean;
  }, allowNegativeStock?: boolean, quantityOverride?: number) => { success: boolean; message?: string };

  /**
   * Cambia la cantidad de un ítem validando el stock disponible.
   * CA-3.1.4: Si la nueva cantidad es 0, elimina la fila.
   */
  setQuantity: (productId: string, quantity: number, maxStock: number, allowNegativeStock?: boolean) => void;

  /** Cambia el descuento de un ítem */
  setItemDiscount: (productId: string, discount: number) => void;

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

      addItem: (product, allowNegativeStock = false, quantityOverride = 0) => {
        const { items } = get();
        const existing = items.find(i => i.productId === product.id);
        const currentQty = existing?.quantity ?? 0;

        // Cantidad a agregar (1 por defecto, o la del modal fraccionario)
        const amountToAdd = quantityOverride > 0 ? quantityOverride : 1;
        const newTotalQty = currentQty + amountToAdd;

        // --- Bloquear sobre-venta solo si no hay permiso de stock negativo ---
        // Para productos fraccionarios la comparación es la misma (> en lugar de >=)
        // para permitir "exactamente usar todo el stock" (ej: 30 kg exactos)
        if (!allowNegativeStock && newTotalQty > product.stock) {
          if (product.stock <= 0) {
            return { success: false, message: `"${product.name}" no tiene existencias disponibles.` };
          }
          const remaining = product.stock - currentQty;
          return {
            success: false,
            message: `Solo quedan ${product.stock} unidades de "${product.name}" en almacén. (ya agregaste ${currentQty})`
          };
        }

        if (existing) {
          // Actualizar cantidad y subtotal correctamente (FIX: i.price * nuevaQty)
          set({
            items: items.map(i =>
              i.productId === product.id
                ? { ...i, quantity: newTotalQty, subtotal: (i.price * newTotalQty) - i.discountAmount }
                : i
            ),
          });
        } else {
          // Primera vez: snapshot inmutable del producto
          set({
            items: [...items, {
              productId: product.id,
              name: product.name,
              sku: product.sku,
              price: product.price,
              quantity: amountToAdd,
              subtotal: product.price * amountToAdd,
              taxRate: product.taxRate ?? 1600,
              taxIncluded: product.taxIncluded ?? true,
              unitType: product.unitType ?? 'PIECE',
              allowFractions: product.allowFractions ?? false,
              discountAmount: 0,
            }],
          });
        }
        return { success: true };
      },

      setQuantity: (productId, quantity, maxStock, allowNegativeStock = false) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        const clampedQty = allowNegativeStock ? quantity : Math.min(quantity, maxStock);
        set({
          items: get().items.map(i =>
            i.productId === productId
              ? { ...i, quantity: clampedQty, subtotal: (i.price * clampedQty) - i.discountAmount }
              : i
          ),
        });
      },

      setItemDiscount: (productId, discount) => {
        set({
          items: get().items.map(i =>
            i.productId === productId
              ? { ...i, discountAmount: discount, subtotal: (i.price * i.quantity) - discount }
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
          discountAmount: i.discountAmount,
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

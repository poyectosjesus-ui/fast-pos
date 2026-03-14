/**
 * TAX SERVICE — Fast-POS 2.0
 *
 * Responsabilidad: Cálculo puro de impuestos (IVA) en centavos.
 *   Sin efectos secundarios. Sin llamadas a DB. Fácilmente testeable.
 * Fuente de Verdad: ACCEPTANCE_CRITERIA.md §CA-TAX, ARCHITECTURE.md §2.2
 *
 * REGLA MATEMÁTICA CRÍTICA:
 *   - Todos los valores son ENTEROS en centavos.
 *   - Nunca se usa float. Se usa Math.round() en la operación final.
 *   - taxRate en puntos básicos: 1600 = 16.00%, 800 = 8.00%, 0 = exento.
 */

import type { TaxCalculation } from "@/lib/schema";

// ─────────────────────────────────────────────
// calculateItemTax
// ─────────────────────────────────────────────

/**
 * Calcula el desglose de IVA de un producto.
 *
 * @param price       - Precio en centavos (INTEGER)
 * @param taxRate     - Tasa en puntos básicos (ej: 1600 = 16%)
 * @param taxIncluded - true: el precio ya incluye IVA | false: IVA se agrega al precio
 * @returns           - { basePrice, taxAmount, total } todos en centavos
 *
 * @example
 *  // Producto $100 incluye IVA 16%:
 *  calculateItemTax(10000, 1600, true)
 *  // → { basePrice: 8621, taxAmount: 1379, total: 10000 }
 *
 *  // Producto $100 + IVA 16%:
 *  calculateItemTax(10000, 1600, false)
 *  // → { basePrice: 10000, taxAmount: 1600, total: 11600 }
 *
 *  // Producto exento:
 *  calculateItemTax(10000, 0, false)
 *  // → { basePrice: 10000, taxAmount: 0, total: 10000 }
 */
export function calculateItemTax(
  price: number,
  taxRate: number,
  taxIncluded: boolean
): TaxCalculation {
  if (price < 0) throw new Error("El precio no puede ser negativo.");
  if (taxRate < 0) throw new Error("La tasa de IVA no puede ser negativa.");

  if (taxRate === 0) {
    return { basePrice: price, taxAmount: 0, total: price };
  }

  if (taxIncluded) {
    // El precio ya incluye IVA → extraer el IVA
    // Fórmula: basePrice = round(total × 10000 / (10000 + taxRate))
    const basePrice = Math.round((price * 10000) / (10000 + taxRate));
    const taxAmount = price - basePrice;
    return { basePrice, taxAmount, total: price };
  } else {
    // El precio es la base → agregarle el IVA
    // Fórmula: taxAmount = round(price × taxRate / 10000)
    const taxAmount = Math.round((price * taxRate) / 10000);
    return { basePrice: price, taxAmount, total: price + taxAmount };
  }
}

// ─────────────────────────────────────────────
// calculateCartTax
// ─────────────────────────────────────────────

/** Ítem mínimo del carrito para el cálculo fiscal */
export interface CartItemForTax {
  price: number;        // Precio unitario en centavos
  quantity: number;
  taxRate: number;      // Puntos básicos
  taxIncluded: boolean;
  discountAmount?: number; // Descuento TOTAL de la partida en centavos (SNAPSHOT)
}

/**
 * Calcula los totales del carrito completo, desglosando el IVA.
 *
 * @param items - Ítems del carrito (precio en centavos, tasa en puntos básicos)
 * @returns     - { subtotal, tax, total } todos en centavos
 *
 * @example
 *  calculateCartTax([
 *    { price: 10000, quantity: 1, taxRate: 1600, taxIncluded: true }, // $100 incl IVA
 *    { price: 5000,  quantity: 1, taxRate: 0,    taxIncluded: false }, // $50 exento
 *  ])
 *  // → { subtotal: 13621, tax: 1379, total: 15000 }
 */
export function calculateCartTax(items: CartItemForTax[]): {
  subtotal: number;
  tax: number;
  total: number;
} {
  let subtotal = 0;
  let tax = 0;
  let total = 0;

  for (const item of items) {
    const disc = item.discountAmount || 0;
    // El cálculo del IVA se basa en el total de la partida tras descontar
    const lineTotal = (item.price * item.quantity) - disc;
    
    // Obtenemos el desglose para el monto final de la partida
    // Si la partida es exenta o el monto es 0, calc manejará el caso
    const calc = calculateItemTax(lineTotal, item.taxRate, item.taxIncluded);
    
    subtotal += calc.basePrice;
    tax      += calc.taxAmount;
    total    += calc.total;
  }

  return { subtotal, tax, total };
}

// ─────────────────────────────────────────────
// Helpers de formato (para UI — no para cálculo)
// ─────────────────────────────────────────────

/**
 * Convierte centavos a string con formato de moneda.
 * @example formatCents(9950, "$") → "$99.50"
 */
export function formatCents(cents: number, symbol = "$"): string {
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

/**
 * Convierte un porcentaje (ej: 16.0) a puntos básicos (1600).
 * @example pctToRate(16.0) → 1600
 */
export function pctToRate(pct: number): number {
  return Math.round(pct * 100);
}

/**
 * Convierte puntos básicos (1600) a porcentaje (16.0).
 * @example rateToPercent(1600) → 16.0
 */
export function rateToPercent(rate: number): number {
  return rate / 100;
}

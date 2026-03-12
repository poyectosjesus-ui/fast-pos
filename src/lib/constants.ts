/**
 * Constantes Globales del Sistema POS
 *
 * REGLA: Ningún archivo del sistema debe hardcodear estos valores.
 * Cambiar aquí actualiza todo el sistema automáticamente.
 * Fuente de Verdad: motor_ventas_plan.md
 */

/** Tasa de IVA vigente (México: 16%). Ejemplo: 0.16 */
export const TAX_RATE = 0.16;

/** Nombre del negocio que aparece en tickets y cabeceras */
export const BUSINESS_NAME = "Fast POS";

/** Umbral de stock bajo. Si stock <= este valor, se muestra alerta visual en el catálogo */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Calcula el impuesto aplicado sobre un subtotal en centavos.
 * Siempre usa Math.round para evitar centavos partidos.
 */
export function calcTax(subtotalCents: number): number {
  return Math.round(subtotalCents * TAX_RATE);
}

/**
 * Formatea centavos enteros a string de moneda legible para la UI.
 * Ejemplo: 1550 -> "$15.50"
 */
export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

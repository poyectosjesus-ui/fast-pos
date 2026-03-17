/**
 * SCHEMA — Fast-POS 2.0
 *
 * Responsabilidad: Fuente única de verdad para todos los tipos de la app.
 * Fuente de Verdad: ARCHITECTURE.md §3.3, CODING_STANDARDS.md §3
 *
 * REGLA: Todo monto monetario en CENTAVOS (integer). Nunca floats.
 * REGLA: taxRate en puntos básicos: 1600 = 16.00%, 800 = 8.00%, 0 = exento.
 */

import { z } from "zod";

// ── CATEGORÍAS ───────────────────────────────────────────────────────────────

export const CategorySchema = z.object({
  id: z.string().uuid("El ID de la categoría debe ser un UUID válido"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// ── PRODUCTOS ────────────────────────────────────────────────────────────────

export const ProductSchema = z.object({
  id: z.string().uuid("El ID del producto debe ser un UUID válido"),
  categoryId: z.string().uuid("El producto debe pertenecer a una categoría válida"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
  /** Precio de venta en centavos (entero). NUNCA float. Ej: $99.50 → 9950 */
  price: z.number().int().nonnegative("El precio no puede ser negativo"),
  /** Precio de compra/costo en centavos (entero). Usado para calcular márgenes. Opciónal: 0 si no se define. */
  costPrice: z.number().int().nonnegative("El costo no puede ser negativo").default(0),
  stock: z.number().nonnegative("El stock no puede ser negativo"),
  /** Permitir vendor aun si el stock es 0 (negocios bajo pedido/elaboración propia) */
  allowNegativeStock: z.boolean().default(false),
  sku: z.string().min(3, "El SKU debe tener al menos 3 caracteres").trim(),
  unitType: z.string().default("PIECE"),
  isVisible: z.boolean().default(true),
  /** Nombre de archivo de imagen (ej: "uuid.webp"). Almacenado en bucket local. */
  image: z.string().optional(),
  /** IVA en puntos básicos: 1600 = 16.00%, 800 = 8.00%, 0 = exento */
  taxRate: z.number().int().nonnegative("La tasa no puede ser negativa").default(1600),
  /** true: el precio capturado YA incluye IVA | false: el IVA se AGREGA al precio */
  taxIncluded: z.boolean().default(true),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// ── ÍTEMS DE ORDEN ───────────────────────────────────────────────────────────

export const OrderItemSchema = z.object({
  productId: z.string().refine(
    (val) => val.startsWith("VGEN-") || z.string().uuid().safeParse(val).success,
    { message: "El ID debe ser un UUID válido o empezar con VGEN-" }
  ),
  name: z.string(),
  price: z.number().int().nonnegative("Precio unitario en centavos"),
  quantity: z.number().positive("La cantidad debe ser mayor a 0"),
  subtotal: z.number().int().nonnegative("Subtotal en centavos"),
  /** Snapshot del IVA al momento de la venta — para auditoría fiscal */
  taxRate: z.number().int().nonnegative().default(1600),
  taxIncluded: z.boolean().default(true),
});

// ── ÓRDENES DE VENTA ─────────────────────────────────────────────────────────

export const OrderSchema = z.object({
  id: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1, "La orden debe tener al menos un ítem"),
  subtotal: z.number().int().nonnegative("Subtotal sin IVA, en centavos"),
  tax: z.number().int().nonnegative("IVA total en centavos"),
  total: z.number().int().nonnegative("Total (subtotal + IVA) en centavos"),
  status: z.enum(["COMPLETED", "CANCELLED"]),
  /** Método de cobro del negocio */
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
  /** Sprint-1 E2: Canal de venta — COUNTER (mostrador) | WHATSAPP | INSTAGRAM | FACEBOOK | OTHER */
  source: z.enum(["COUNTER", "WHATSAPP", "INSTAGRAM", "FACEBOOK", "OTHER"]).default("COUNTER"),

  /** ID del usuario que realizó la venta */
  userId: z.string().uuid().nullable().optional(),
  createdAt: z.number(),
});

// ── MOVIMIENTOS DE CAJA ──────────────────────────────────────────────────────

export const CashMovementSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["OPENING", "IN", "OUT"]),
  amount: z.number().int().positive("El monto debe ser positivo y en centavos"),
  concept: z.string().min(2, "Ingresa un concepto"),
  userId: z.string().min(1),
  createdAt: z.number(),
});

// ── CONFIGURACIÓN FISCAL ──────────────────────────────────────────────────────

/** Configuración global del IVA del negocio (leída de `settings` en SQLite) */
export const TaxConfigSchema = z.object({
  taxName: z.string().default("IVA"),
  /** Tasa por defecto en puntos básicos (1600 = 16%) */
  defaultTaxRate: z.number().int().nonnegative().default(1600),
  currencySymbol: z.string().default("$"),
});

// ── RESULTADO DE CÁLCULO DE IMPUESTO ─────────────────────────────────────────

/** Resultado de `calculateItemTax()` — todos los valores en centavos */
export const TaxCalculationSchema = z.object({
  basePrice: z.number().int().nonnegative(),  // Precio sin IVA
  taxAmount: z.number().int().nonnegative(),  // Monto del IVA
  total: z.number().int().nonnegative(),      // Precio total (base + IVA)
});

// ── TIPOS TYPESCRIPT (inferidos de Zod) ───────────────────────────────────────

export type Category       = z.infer<typeof CategorySchema>;
export type Product        = z.infer<typeof ProductSchema>;
export type OrderItem      = z.infer<typeof OrderItemSchema>;
export type Order          = z.infer<typeof OrderSchema>;
export type TaxConfig      = z.infer<typeof TaxConfigSchema>;
export type TaxCalculation = z.infer<typeof TaxCalculationSchema>;
export type CashMovement   = z.infer<typeof CashMovementSchema>;

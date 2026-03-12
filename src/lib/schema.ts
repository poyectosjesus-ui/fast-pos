import { z } from "zod";

// --- CATEGORÍAS ---
export const CategorySchema = z.object({
  id: z.string().uuid("El ID de la categoría debe ser un UUID válido"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// --- PRODUCTOS ---
export const ProductSchema = z.object({
  id: z.string().uuid("El ID del producto debe ser un UUID válido"),
  categoryId: z.string().uuid("El producto debe pertenecer a una categoría válida"),
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").trim(),
  // Trabajaremos con centavos (entero) para evitar el problema de precisión en coma flotante de JS
  price: z.number().int().nonnegative("El precio no puede ser negativo (valor representará centavos)"),
  stock: z.number().int().nonnegative("El stock no puede ser negativo"),
  sku: z.string().min(3, "El SKU debe tener al menos 3 caracteres").trim(),
  image: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

// --- ÍTEMS DE ORDEN ---
export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  price: z.number().int().nonnegative("Precio unitario en centavos"),
  quantity: z.number().int().positive("La cantidad debe ser mayor a 0"),
  subtotal: z.number().int().nonnegative("Subtotal en centavos"),
});

// --- ÓRDENES DE VENTA ---
export const OrderSchema = z.object({
  id: z.string().uuid(),
  items: z.array(OrderItemSchema).min(1, "La orden debe tener al menos un ítem"),
  subtotal: z.number().int().nonnegative("Subtotal en centavos"),
  tax: z.number().int().nonnegative("Impuestos en centavos"),
  total: z.number().int().nonnegative("Total en centavos"),
  status: z.enum(["COMPLETED", "CANCELLED"]),
  paymentMethod: z.enum(["CASH", "CARD"]),
  createdAt: z.number(),
});

// Inferir automáticamente los tipos de TypeScript desde Zod, 
// este será el "single source of truth" o fuente de la verdad para toda la app.
export type Category = z.infer<typeof CategorySchema>;
export type Product = z.infer<typeof ProductSchema>;
export type OrderItem = z.infer<typeof OrderItemSchema>;
export type Order = z.infer<typeof OrderSchema>;

export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
  sku: string;
};

export const MOCK_PRODUCTS: Product[] = [
  { id: "1", name: "Café Americano", price: 35.0, category: "Bebidas", sku: "BEB-001" },
  { id: "2", name: "Latte Macchiato", price: 55.0, category: "Bebidas", sku: "BEB-002" },
  { id: "3", name: "Matcha Frapuccino", price: 75.0, category: "Bebidas", sku: "BEB-003" },
  { id: "4", name: "Croissant Clásico", price: 45.0, category: "Panadería", sku: "PAN-001" },
  { id: "5", name: "Pastel de Zanahoria", price: 65.0, category: "Postres", sku: "POS-001" },
  { id: "6", name: "Sandwich de Pavo", price: 85.0, category: "Comida", sku: "COM-001" },
  { id: "7", name: "Té Chai", price: 50.0, category: "Bebidas", sku: "BEB-004" },
  { id: "8", name: "Bagel con Queso Crema", price: 55.0, category: "Panadería", sku: "PAN-002" },
];

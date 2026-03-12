import Dexie, { type EntityTable } from 'dexie';
import { Category, Product, Order } from './schema';

const db = new Dexie('FastPOSDatabase') as Dexie & {
  categories: EntityTable<Category, 'id'>;
  products: EntityTable<Product, 'id'>;
  orders: EntityTable<Order, 'id'>;
};

// Declaración el esquema de la base de datos IndexedDB.
// Solo se indexan los campos que se utilizarán en búsquedas y ordenamientos (WHERE clauses).
// 'id' es la primary key (Primary Key, autoincremental si usas ++id, pero usaremos UUIDs fijos)
db.version(1).stores({
  categories: 'id, name, createdAt',
  products: 'id, categoryId, name, sku, createdAt',
  orders: 'id, status, paymentMethod, createdAt', 
});

export { db };

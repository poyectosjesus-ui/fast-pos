export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  currentDebt?: number;
  lastCreditDate?: number;
  createdAt: number;
  updatedAt: number;
}

export const CustomerService = {
  /**
   * Obtiene todos los clientes ordenados por mayor deuda actual (currentDebt).
   */
  getAll: async (): Promise<Customer[]> => {
    try {
      if (!window.electronAPI) throw new Error("Entorno web no soporta sqlite");
      const res = await window.electronAPI.customers.getAll();
      if (!res.success) throw new Error(res.error);
      return res.customers || [];
    } catch (e: any) {
      console.error("[CustomerService] getAll err:", e);
      return [];
    }
  },

  /**
   * Crea un nuevo cliente.
   */
  create: async (data: { name: string; phone?: string; address?: string; userId: string }): Promise<string> => {
    try {
      if (!window.electronAPI) throw new Error("API no disponible");
      const res = await window.electronAPI.customers.create(data);
      if (!res.success) throw new Error(res.error);
      return res.id || "";
    } catch (e: any) {
      console.error("[CustomerService] create err:", e);
      throw e;
    }
  },

  /**
   * Actualiza los datos de un cliente existente.
   */
  update: async (data: { id: string; name: string; phone?: string; address?: string; userId: string }): Promise<void> => {
    try {
      if (!window.electronAPI) throw new Error("API no disponible");
      const res = await window.electronAPI.customers.update(data);
      if (!res.success) throw new Error(res.error);
    } catch (e: any) {
      console.error("[CustomerService] update err:", e);
      throw e;
    }
  },

  /**
   * Registra un abono a la deuda (Cash In).
   */
  registerPayment: async (data: {
    customerId: string;
    amount: number;
    paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
    userId: string;
  }): Promise<string> => {
    try {
      if (!window.electronAPI) throw new Error("API no disponible");
      const res = await window.electronAPI.customers.registerPayment(data);
      if (!res.success) throw new Error(res.error);
      return res.paymentId || "";
    } catch (e: any) {
      console.error("[CustomerService] registerPayment err:", e);
      throw e;
    }
  }
};

export {};

declare global {
  interface Window {
    electronAPI?: {
      // ── Base de Datos
      checkDbReady: () => Promise<{ success: boolean; engine?: string; error?: string }>;
      getDbStatus: () => Promise<{ success: boolean; path: string; size: string; schemaVersion: string; mode: string; counts: { products: number; categories: number; orders: number }; error?: string }>;
      exportSqlite: () => Promise<{ success: boolean; canceled?: boolean; path?: string }>;
      importSqlite: () => Promise<{ success: boolean; canceled?: boolean; requireRestart?: boolean }>;

      // ── Configuración Global
      getSetting: (key: string) => Promise<{ success: boolean; value: string | null; error?: string }>;
      getAllSettings: () => Promise<{ success: boolean; config?: Record<string, string>; error?: string }>;
      setSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>;
      setBulkSettings: (entries: Record<string, string>) => Promise<{ success: boolean; error?: string }>;

      // ── Setup
      completeSetup: (data: any) => Promise<{ success: boolean; error?: string }>;

      // ── Categorías
      getAllCategories: () => Promise<any[]>;
      createCategory: (category: any) => Promise<{ success: boolean; error?: string }>;
      updateCategory: (category: any) => Promise<{ success: boolean; error?: string }>;
      deleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;

      // ── Productos
      getAllProducts: () => Promise<any[]>;
      createProduct: (product: any) => Promise<{ success: boolean; error?: string }>;
      updateProduct: (product: any) => Promise<{ success: boolean; error?: string }>;
      deleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>;

      // ── Órdenes / Ventas
      checkout: (order: any) => Promise<{ success: boolean; error?: string }>;
      getOrderHistory: () => Promise<any[]>;
      getOrderById: (id: string) => Promise<any | null>;
      voidOrder: (id: string) => Promise<{ success: boolean; error?: string }>;

      // ── Imágenes
      saveImage: (base64: string, filename: string) => Promise<{ success: boolean; url?: string; error?: string }>;
      getImageUrl: (filename: string) => Promise<{ success: boolean; url?: string; error?: string }>;
      deleteImage: (filename: string) => Promise<{ success: boolean; error?: string }>;

      // ── Módulo de Reportes (Corte Z)
      generateZReportPdf: (dateString: string) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;

      // ── Ticket / Impresión
      getPrinters: () => Promise<any[]>;
      printTicket: (orderId: string, printerName?: string, silent?: boolean) => Promise<{ success: boolean; error?: string }>;
      printTicketToPdf: (orderId: string) => Promise<{ success: boolean; path?: string; error?: string }>;

      // ── Autenticación / Usuarios
      login: (userId: string, pin: string) => Promise<{ success: boolean; user?: { id: string; name: string; role: string; isActive: number }; error?: string }>;
      getAllUsers: () => Promise<{ success: boolean; users?: any[]; error?: string }>;
      createUser: (user: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      updateUser: (user: any) => Promise<{ success: boolean; error?: string }>;
      deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;

      // ── Licencia
      validateLicense: (key: string) => Promise<{ isValid: boolean; error?: string }>;

      // ── Unidades de Medida
      getAllUnits: () => Promise<any[]>;
      createUnit: (unit: any) => Promise<{ success: boolean; id?: string; error?: string }>;
      deleteUnit: (id: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

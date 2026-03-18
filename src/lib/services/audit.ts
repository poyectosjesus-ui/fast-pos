export interface AuditLogItem {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details?: string | null;
  createdAt: number;
}

export interface AuditHistoryParams {
  page?: number;
  limit?: number;
  searchTerm?: string;
  startDate?: number;
  endDate?: number;
  action?: string;
}

export interface AuditHistoryResponse {
  success: boolean;
  items: AuditLogItem[];
  total: number;
  page: number;
  totalPages: number;
  error?: string;
}

export class AuditService {
  /**
   * Registra una acción en la base de datos de manera inmutable
   */
  static async log(userId: string, userName: string, action: string, details?: any) {
    if (typeof window === "undefined" || !(window as any).electronAPI) return;

    try {
      await (window as any).electronAPI.logAuditAction({
        userId,
        userName,
        action,
        details
      });
    } catch (err) {
      console.warn("[AuditService] Falló el registro de auditoría en background:", err);
    }
  }

  /**
   * Obtiene la cronología de auditoría para el panel del administrador
   */
  static async getHistory(params: AuditHistoryParams): Promise<AuditHistoryResponse> {
    if (typeof window === "undefined" || !(window as any).electronAPI) {
      return { success: false, items: [], total: 0, page: 1, totalPages: 0, error: "No Desktop API" };
    }

    try {
      const response = await (window as any).electronAPI.getAuditHistory(params);
      if (!response.success) {
        throw new Error(response.error || "Error al obtener historial de auditoría");
      }
      return response;
    } catch (error: any) {
      console.error("[AuditService.getHistory] Error:", error);
      return { success: false, items: [], total: 0, page: 1, totalPages: 0, error: error.message };
    }
  }
}

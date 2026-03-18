/**
 * Utilidades de Formateo de Auditoría
 * 
 * Contiene los métodos puros para interpretar payloads JSON (Action Details) 
 * provenientes de Base de Datos y presentarlos como textos enriquecidos legibles
 * en la interfaz de Auditoría.
 */

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-MX", { 
    style: "currency", 
    currency: "MXN" 
  }).format(amount);
}

export function formatProductUpdate(data: any): string {
  // Manejo del nuevo formato enriquecido con "deltas"
  if (data.hasChanges && data.changes) {
    const mods = Object.entries(data.changes).map(([field, vals]: [string, any]) => {
      const f = field === "price" ? "Precio" : 
                field === "costPrice" ? "Costo" : 
                field === "name" ? "Nombre" : 
                field === "sku" ? "SKU" : 
                field === "stock" ? "Inventario" : 
                field === "isVisible" ? "Visibilidad" : field;
      
      let vFrom = vals.from;
      let vTo = vals.to;

      if (field === "price" || field === "costPrice") {
        vFrom = formatCurrency((vals.from || 0) / 100);
        vTo = formatCurrency((vals.to || 0) / 100);
      }
      
      return `${f}: ${vFrom} ➔ ${vTo}`;
    }).join(" | ");
    
    return `Producto "${data.name}" modificado. ${mods}`;
  }
  
  // Fallback legacy
  return `Producto modificado: ${data.name || data.id}. (Sin cambios monitoreados o edición menor).`;
}

export function formatProductDelete(data: any): string {
  return `Producto con ID interno ${data.id?.substring(0,8)}... eliminado con éxito.`;
}

export function formatCashMovement(data: any): string {
  const amount = formatCurrency(data.amount || 0);
  return `Monto reportado: ${amount}. Concepto: ${data.concept || "No especificado"}.`;
}

export function formatOrderVoid(data: any): string {
  const ticketId = data.orderId?.split("-")[0] || data.orderId;
  const voidAmount = data.total ? formatCurrency(data.total / 100) : "Desconocido";
  const returnedItems = data.itemCount ? `${data.itemCount} art.` : "N/D";
  
  return `Anulación de Ticket: #${ticketId.toUpperCase()}. Monto devuelto: ${voidAmount}. Inventario restaurado: ${returnedItems}`;
}

/**
 * Método orquestador principal
 * Recibe la acción y el JSON devuelto de la DB, decide el método aplicar y retorna un string.
 */
export function parseAuditDetails(action: string, detailsJson?: string | null): string {
  if (!detailsJson) return "Sin detalles extra.";
  
  try {
    const data = JSON.parse(detailsJson);
    
    switch (action) {
      case "UPDATE_PRODUCT":
        return formatProductUpdate(data);
      case "DELETE_PRODUCT":
        return formatProductDelete(data);
      case "CASH_MOVE_IN":
      case "CASH_MOVE_OUT":
        return formatCashMovement(data);
      case "VOID_ORDER":
        return formatOrderVoid(data);
      default:
        return "Operación sobreentidades grabada."; // Fallback humano si el json existe pero no mapea
    }
  } catch {
    return detailsJson; // Si falla el parseo, escupimos el string original
  }
}

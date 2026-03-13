"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderService } from "@/lib/services/orders";
import { Order } from "@/lib/schema";
import { formatCurrency } from "@/lib/constants";
import { Suspense } from "react";

/**
 * Plantilla HTML estricta para impresión Térmica (80mm) y PDF.
 * Cumple con EPIC-004: UI_DESIGN_SYSTEM.md (font-mono, max 48 chars ancho).
 */
function TicketContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTicketData() {
      if (!orderId) {
        setError("Falta el ID del ticket.");
        return;
      }
      try {
        // 1. Obtener la Orden
        const fetchedOrder = await OrderService.getById(orderId);
        if (!fetchedOrder) {
          setError("Ticket no encontrado.");
          return;
        }
        setOrder(fetchedOrder);

        // 2. Obtener la Configuración del Negocio
        const winApi = (window as unknown as { electronAPI?: Record<string, Function> }).electronAPI;
        if (typeof window !== "undefined" && winApi) {
          const apiSettings = (await winApi.getAllSettings!()) as { success: boolean; config?: Record<string, string> };
          const settingsMap = apiSettings.success ? (apiSettings.config || {}) : {};
          setSettings(settingsMap);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError("Error al cargar ticket: " + msg);
      }
    }

    fetchTicketData();
  }, [orderId]);

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-center font-mono">
        <p className="text-destructive font-bold">{error}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center p-8 text-center font-mono text-muted-foreground">
        Cargando recibo...
      </div>
    );
  }

  const businessName = settings["businessName"] || "MI NEGOCIO";
  const taxId = settings["taxId"] || "RFC: XAXX010101000";
  const address = settings["address"] || "DIRECCIÓN NO CONFIGURADA";
  const phone = settings["phone"] || "TEL: 000-000-0000";

  const dateStr = new Date(order.createdAt).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="ticket-container w-[80mm] mx-auto bg-white text-black p-4 font-mono text-[12px] leading-tight print:p-0">
      {/* ── HEADER ── */}
      <div className="text-center mb-6">
        <h1 className="text-lg font-black uppercase tracking-widest">{businessName}</h1>
        <p className="uppercase mt-1">{taxId}</p>
        <p className="text-[10px] mt-1 whitespace-pre-line">{address}</p>
        <p className="text-[10px] mt-1">{phone}</p>
      </div>

      {/* ── META INFO ── */}
      <div className="border-y border-dashed border-black/50 py-2 mb-4">
        <div className="flex justify-between">
          <span>TICKET:</span>
          <span>{order.id.split("-")[0].toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>FECHA:</span>
          <span>{dateStr}</span>
        </div>
        <div className="flex justify-between">
          <span>ESTADO:</span>
          <span className="font-bold">{order.status === "COMPLETED" ? "PAGADO" : "CANCELADO / NULO"}</span>
        </div>
        <div className="flex justify-between">
          <span>PAGO:</span>
          <span>{order.paymentMethod === "CASH" ? "EFECTIVO" : "TARJETA"}</span>
        </div>
      </div>

      {/* ── ITEMS ── */}
      <table className="w-full mb-4">
        <thead>
          <tr className="border-b border-black/30">
            <th className="text-left font-bold pb-1 w-[15%]">CANT</th>
            <th className="text-left font-bold pb-1 w-[55%]">DESCRIPCIÓN</th>
            <th className="text-right font-bold pb-1 w-[30%]">IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={index}>
              <td className="align-top pt-2 pr-1">{item.quantity}</td>
              <td className="align-top pt-2 pr-1 leading-snug">
                {item.name}
                {/* 
                  Si queremos ser muy precisos, podríamos mostrar 
                  if (item.taxRate > 0) que el item tiene cierto IVA. 
                  (Mantenido simple por limpieza) 
                */}
              </td>
              <td className="align-top pt-2 text-right">
                {formatCurrency(item.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── TOTALES ── */}
      <div className="border-t border-dashed border-black/50 pt-2 mb-6">
        <div className="flex justify-between text-[11px] mb-1">
          <span>SUBTOTAL:</span>
          <span>{formatCurrency(order.subtotal)}</span>
        </div>
        {order.tax > 0 && (
          <div className="flex justify-between text-[11px] mb-1">
            <span>IMPUESTOS (IVA):</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black mt-2 pt-1 border-t border-black/30">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="text-center text-[10px] mt-8 mb-4">
        <p className="font-bold">¡GRACIAS POR SU COMPRA!</p>
        <p className="mt-2 text-black/70">Este recibo no es un CFDI.</p>
        <p className="mt-1 text-black/70">Software punto de venta: Fast-POS</p>
      </div>
      
      {/* Sello de fin para corte de papel de la impresora térmica */}
      <div className="text-center text-[8px] text-black/30 mt-8 mb-4">--- FIN DE TICKET ---</div>
      
      {/* 
        Inyectamos CSS de impresión crítico para forzar a Chromium a 
        mantener el estilo, márgenes en 0 y prevenir que dibuje 
        headers/footers web en el PDF o imprima colores pálidos.
      */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body {
            width: 80mm;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .ticket-container {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
          /* Forzar impresión de colores exactos y fondos */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
}

export default function TicketPage() {
  return (
    <Suspense fallback={<div className="font-mono text-center p-10 text-xs">Preparando...</div>}>
      <TicketContent />
    </Suspense>
  );
}

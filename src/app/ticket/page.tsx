"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderService } from "@/lib/services/orders";
import { Order } from "@/lib/schema";
import { formatCurrency } from "@/lib/constants";
import { Suspense } from "react";

/**
 * Plantilla HTML estricta para impresión Térmica (80mm) y PDF.
 * EPIC-004: Ticket de venta con datos de la empresa y branding.
 * EPIC-008 / FASE 8: Lee configuraciones de branding desde settings tabla en SQLite.
 *
 * CLAVES CORRECTAS de settings:
 *  store_name, store_address, store_phone, store_tax_id
 *  store_footer_message, store_policies
 *  store_whatsapp, store_instagram, store_facebook, store_website
 */

const PAYMENT_LABELS: Record<string, string> = {
  CASH:     "EFECTIVO",
  CARD:     "TARJETA",
  TRANSFER: "TRANSFERENCIA",
  WHATSAPP: "WHATSAPP / LINK",
  ONLINE:   "PAGO EN LÍNEA",
  OTHER:    "OTRO MÉTODO",
};

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
        const fetchedOrder = await OrderService.getById(orderId);
        if (!fetchedOrder) {
          setError("Ticket no encontrado.");
          return;
        }
        setOrder(fetchedOrder);

        const winApi = (window as unknown as { electronAPI?: Record<string, Function> }).electronAPI;
        if (typeof window !== "undefined" && winApi) {
          const apiSettings = (await winApi.getAllSettings!()) as {
            success: boolean;
            config?: Record<string, string>;
          };
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

  // ── Datos del negocio (claves exactas de la tabla settings) ──
  const businessName    = settings["store_name"]           || "MI NEGOCIO";
  const taxId           = settings["store_tax_id"]         || "";
  const address         = settings["store_address"]        || "";
  const phone           = settings["store_phone"]          || "";
  const footerMessage   = settings["store_footer_message"] || "¡Gracias por su compra!";
  const policies        = settings["store_policies"]       || "";
  const whatsapp        = settings["store_whatsapp"]       || "";
  const instagram       = settings["store_instagram"]      || "";
  const facebook        = settings["store_facebook"]       || "";
  const website         = settings["store_website"]        || "";
  const taxName         = settings["tax_name"]             || "IVA";

  const dateStr = new Date(order.createdAt).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod;

  // Mostrar redes sociales si hay al menos una
  const hasSocials = whatsapp || instagram || facebook || website;

  return (
    <div className="ticket-container w-[80mm] mx-auto bg-white text-black p-4 font-mono text-[12px] leading-tight print:p-0">
      {/* ── HEADER ── */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-black uppercase tracking-widest">{businessName}</h1>
        {taxId && <p className="uppercase mt-1 text-[10px]">RFC: {taxId}</p>}
        {address && <p className="text-[10px] mt-1 whitespace-pre-line">{address}</p>}
        {phone && <p className="text-[10px] mt-1">Tel: {phone}</p>}
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
          <span className="font-bold">
            {order.status === "COMPLETED" ? "PAGADO" : "CANCELADO / NULO"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>PAGO:</span>
          <span>{paymentLabel}</span>
        </div>
        {(order as any).userName && (
          <div className="flex justify-between border-t border-black/10 mt-1 pt-1 italic text-[10px]">
             <span>LE ATENDIÓ:</span>
             <span className="uppercase">{(order as any).userName}</span>
          </div>
        )}
        {order.source !== "COUNTER" && order.source !== "OTHER" && (
          <div className="flex justify-between text-[10px] mt-0.5">
            <span>ORIGEN:</span>
            <span className="uppercase">{order.source}</span>
          </div>
        )}
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
              <td className="align-top pt-2 pr-1 leading-snug">{item.name}</td>
              <td className="align-top pt-2 text-right">{formatCurrency(item.subtotal)}</td>
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
            <span>IMPUESTOS ({taxName}):</span>
            <span>{formatCurrency(order.tax)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-black mt-2 pt-1 border-t border-black/30">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* ── FOOTER — Branding configurable ── */}
      <div className="text-center text-[10px] mt-6 mb-2">
        {footerMessage && (
          <p className="font-bold whitespace-pre-line">{footerMessage}</p>
        )}
        {policies && (
          <p className="mt-2 text-black/60 whitespace-pre-line text-[9px]">{policies}</p>
        )}
      </div>

      {/* ── REDES SOCIALES ── */}
      {hasSocials && (
        <div className="border-t border-dashed border-black/30 pt-2 mt-2 text-center text-[9px] text-black/60 space-y-0.5">
          {whatsapp && <p>📱 WhatsApp: {whatsapp}</p>}
          {instagram && <p>📷 Instagram: {instagram}</p>}
          {facebook && <p>👍 Facebook: {facebook}</p>}
          {website && <p>🌐 {website}</p>}
        </div>
      )}

      <div className="text-center text-[8px] text-black/30 mt-6 mb-4">--- FIN DE TICKET ---</div>

      {/* CSS de impresión crítico */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* @page controla el tamaño del PDF cuando preferCSSPageSize: true */
        @page {
          size: 80mm auto;
          margin: 0;
        }
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

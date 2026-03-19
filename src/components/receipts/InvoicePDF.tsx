"use client";

import { Order } from "@/lib/schema";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const PAYMENT_LABELS: Record<string, string> = {
  CASH:     "EFECTIVO",
  CARD:     "TARJETA",
  TRANSFER: "TRANSFERENCIA",
  WHATSAPP: "WHATSAPP / LINK",
  ONLINE:   "PAGO EN LÍNEA",
  OTHER:    "OTRO MÉTODO",
};

interface InvoicePDFProps {
  order: Order;
  settings: Record<string, string>;
}

export function InvoicePDF({ order, settings }: InvoicePDFProps) {
  // ── Datos corporativos ──
  const businessName    = settings["store_name"]           || "Empresa S.A de C.V.";
  const taxId           = settings["store_tax_id"]         || "RFC GENÉRICO";
  const address         = settings["store_address"]        || "Dirección no especificada";
  const phone           = settings["store_phone"]          || "N/A";
  const footerMessage   = settings["store_footer_message"] || "Agradecemos su preferencia.";
  const policies        = settings["store_policies"]       || "";
  const whatsapp        = settings["store_whatsapp"]       || "";
  const website         = settings["store_website"]        || "";
  const email           = settings["store_email"]          || "";
  const taxName         = settings["tax_name"]             || "IVA";

  const dateStr = format(new Date(order.createdAt), "dd 'de' MMMM, yyyy - HH:mm", { locale: es });
  const paymentLabel = PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod;

  const orderIdShort = order.id.split("-")[0].toUpperCase();

  return (
    <div className="pdf-container mx-auto bg-white text-slate-800 p-8 sm:p-12 text-sm leading-relaxed shadow-2xl print:shadow-none min-h-[297mm]">
      {/* HEADER COMPLETO A4 */}
      <header className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-primary/20 pb-8 mb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">
            {businessName}
          </h1>
          <p className="text-xs uppercase font-bold text-slate-500 tracking-widest mt-1">
            Receptor / RFC: {taxId}
          </p>
          <div className="text-sm mt-3 text-slate-600 max-w-sm">
            <p className="whitespace-pre-line">{address}</p>
            {phone !== "N/A" && <p className="mt-1">📞 {phone}</p>}
            {email && <p className="mt-1">✉️ {email}</p>}
          </div>
        </div>

        <div className="mt-6 sm:mt-0 text-left sm:text-right">
          <h2 className="text-4xl font-black text-slate-200 uppercase tracking-tighter mix-blend-multiply">
            {order.status === "COMPLETED" ? "NOTA" : "ANULADA"}
          </h2>
          <div className="mt-4 bg-slate-50 border border-slate-100 p-4 rounded-xl inline-block text-left">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Folio Operación</p>
            <p className="text-xl font-mono font-bold text-slate-800">#{orderIdShort}</p>
            <p className="text-[10px] text-slate-500 mt-2 font-medium">{dateStr}</p>
          </div>
        </div>
      </header>

      {/* METADATA CAJA */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
          <p className="text-[10px] uppercase font-bold tracking-widest text-primary/70 mb-1">Método de Pago</p>
          <p className="font-semibold text-primary">{paymentLabel}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Estado</p>
          <p className="font-semibold text-slate-700">
             {order.status === "COMPLETED" ? "Liquidado" : "Cancelado"}
          </p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Atendido Por</p>
          <p className="font-semibold text-slate-700 uppercase">{(order as any).userName || 'Cajero Estándar'}</p>
        </div>
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">Cliente</p>
          <p className="font-semibold text-slate-700 uppercase">{(order as any).customerName || 'Mostrador / General'}</p>
        </div>
      </section>

      {/* TABLA DE PRODUCTOS A4 */}
      <section className="mb-8">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-800 text-slate-800 text-xs uppercase tracking-wider">
              <th className="py-3 font-black w-[10%]">Cant.</th>
              <th className="py-3 font-black w-[50%]">Descripción del Artículo</th>
              <th className="py-3 font-black text-right w-[20%]">P. Unitario</th>
              <th className="py-3 font-black text-right w-[20%]">Importe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item, idx) => {
              const unitPrice = item.subtotal / item.quantity;
              return (
                <tr key={idx} className="group">
                  <td className="py-3 align-top font-semibold">{item.quantity}</td>
                  <td className="py-3 align-top pr-4">
                    <p className="font-medium text-slate-800">{item.name}</p>
                  </td>
                  <td className="py-3 align-top text-right text-slate-500 tabular-nums">
                    {formatCurrency(unitPrice)}
                  </td>
                  <td className="py-3 align-top text-right font-medium tabular-nums">
                    {formatCurrency(item.subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* TOTALES */}
      <section className="flex flex-col items-end border-t border-slate-200 pt-6 mt-6">
        <div className="w-full sm:w-1/2 lg:w-1/3">
          <div className="flex justify-between py-2 text-slate-600">
            <span className="font-medium">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
          </div>
          {order.tax > 0 && (
            <div className="flex justify-between py-2 text-slate-600">
              <span className="font-medium">Impuestos ({taxName})</span>
              <span className="tabular-nums">{formatCurrency(order.tax)}</span>
            </div>
          )}
          <div className="flex justify-between py-4 text-xl font-black text-slate-800 border-t-2 border-slate-800 mt-2">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatCurrency(order.total)}</span>
          </div>
        </div>
      </section>

      {/* FOOTER CORPORATIVO */}
      <footer className="mt-16 pt-8 border-t border-slate-100 text-slate-500 text-xs text-center flex flex-col items-center">
        {footerMessage && (
          <p className="font-bold text-slate-700 whitespace-pre-line mb-3 text-base">{footerMessage}</p>
        )}
        {policies && (
          <p className="whitespace-pre-line max-w-2xl text-[10px] leading-relaxed mb-6">{policies}</p>
        )}
        
        <div className="flex flex-wrap gap-4 justify-center items-center mt-auto opacity-70">
          {whatsapp && <span className="flex items-center gap-1">📱 {whatsapp}</span>}
          {website && <span className="flex items-center gap-1">🌐 {website}</span>}
          <span className="flex items-center gap-1">🔒 Emisión digital en Fast-POS 2.0</span>
        </div>
      </footer>

      {/* Estilos A4 Exclusivos */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: A4 portrait;
          margin: 10mm;
        }
        @media print {
          html, body {
            width: 210mm;
            height: 100%;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .pdf-container {
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
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

"use client";

import { Order } from "@/lib/schema";
import { formatCurrency } from "@/lib/constants";

const PAYMENT_LABELS: Record<string, string> = {
  CASH:     "EFECTIVO",
  CARD:     "TARJETA",
  TRANSFER: "TRANSFERENCIA",
  WHATSAPP: "WHATSAPP / LINK",
  ONLINE:   "PAGO EN LÍNEA",
  OTHER:    "OTRO MÉTODO",
};

interface ThermalTicketProps {
  order: Order;
  settings: Record<string, string>;
}

export function ThermalTicket({ order, settings }: ThermalTicketProps) {
  // ── Configuraciones Globales ──
  const paperSize       = settings["receiptPaperSize"]     || "80mm";
  const format          = settings["receiptFormat"]        || "graphic";
  const is58            = paperSize === "58mm";
  const WIDTH_MM        = is58 ? "58mm" : "80mm";
  const MAX_CHARS       = is58 ? 32 : 48;

  // ── Datos del negocio ──
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
  const hasSocials = whatsapp || instagram || facebook || website;

  // ─────────────────────────────────────────────────────────
  // MOTOR FORMATO TEXTO PURO (ASCII / ESC-POS Compliant)
  // ─────────────────────────────────────────────────────────
  if (format === "text") {
    const lines: string[] = [];
    const addCenter = (txt: string) => lines.push(txt.substring(0, MAX_CHARS).padStart(Math.floor((MAX_CHARS + txt.length) / 2)).padEnd(MAX_CHARS));
    const addLeft = (txt: string) => lines.push(txt.substring(0, MAX_CHARS).padEnd(MAX_CHARS));
    const addSep = () => lines.push("-".repeat(MAX_CHARS));
    const addSplit = (left: string, right: string) => {
      const lenL = left.length;
      const lenR = right.length;
      if (lenL + lenR + 1 > MAX_CHARS) return addLeft(left.substring(0, MAX_CHARS));
      const space = " ".repeat(MAX_CHARS - lenL - lenR);
      lines.push(left + space + right);
    };

    addCenter(businessName.toUpperCase());
    if (taxId) addCenter(`RFC: ${taxId}`);
    if (address) address.split(/\n|\\n/).forEach(l => addCenter(l));
    if (phone) addCenter(`Tel: ${phone}`);
    addLeft("");

    addSplit("TICKET:", order.id.split("-")[0].toUpperCase());
    addSplit("FECHA:", dateStr);
    addSplit("ESTADO:", order.status === "COMPLETED" ? "PAGADO" : "CANCELADO / NULO");
    addSplit("PAGO:", paymentLabel);
    
    if ((order as any).userName) addSplit("ATENDIÓ:", String((order as any).userName).toUpperCase());
    if ((order as any).customerName) addSplit("CLIENTE:", String((order as any).customerName).toUpperCase());
    if (order.source && order.source !== "COUNTER" && order.source !== "OTHER") addSplit("ORIGEN:", order.source.toUpperCase());
    addLeft("");

    addSep();
    // Headers 58mm: CANT(3) DES(18) IMP(9) = 30 + 2 spaces = 32
    // Headers 80mm: CANT(4) DES(32) IMP(10) = 46 + 2 spaces = 48
    const cantW = is58 ? 3 : 4;
    const impW = is58 ? 9 : 10;
    const descW = MAX_CHARS - cantW - impW - 2;
    lines.push("CANT".substring(0, cantW).padEnd(cantW) + " " + "DESCRIPCIÓN".substring(0, descW).padEnd(descW) + " " + "IMPORTE".substring(0, impW).padStart(impW));
    addSep();

    order.items.forEach(item => {
      const q = String(item.quantity).substring(0, cantW).padEnd(cantW);
      const sub = formatCurrency(item.subtotal).substring(0, impW).padStart(impW);
      let n = item.name.substring(0, descW).padEnd(descW);
      lines.push(q + " " + n + " " + sub);
    });
    addSep();

    addSplit("SUBTOTAL:", formatCurrency(order.subtotal));
    if (order.tax > 0) addSplit(`IMPUESTO (${taxName}):`, formatCurrency(order.tax));
    addLeft("");
    addSplit("TOTAL:", formatCurrency(order.total));
    addLeft("");

    if (footerMessage) footerMessage.split(/\n|\\n/).forEach(l => addCenter(l));
    if (policies) policies.split(/\n|\\n/).forEach(l => addCenter(l));
    addLeft("");

    if (hasSocials) {
      addSep();
      if (whatsapp) addCenter(`WhatsApp: ${whatsapp}`);
      if (instagram) addCenter(`Instagram: ${instagram}`);
      if (facebook) addCenter(`Facebook: ${facebook}`);
      if (website) addCenter(website);
    }

    addLeft("");
    addCenter("--- FIN DE TICKET ---");
    addLeft("");

    return (
      <div className={`ticket-container mx-auto bg-white text-black p-4 print:p-0`} style={{ width: WIDTH_MM }}>
        <pre className={`font-mono leading-tight whitespace-pre-wrap ${is58 ? "text-[12px]" : "text-[14px]"} tracking-tighter m-0`}>
          {lines.join("\n")}
        </pre>
        <style dangerouslySetInnerHTML={{ __html: `
          @page { size: ${WIDTH_MM} auto; margin: 0; }
          @media print {
            html, body { width: ${WIDTH_MM}; margin: 0 !important; padding: 0 !important; background: white !important; }
            .ticket-container { width: 100% !important; max-width: ${WIDTH_MM} !important; margin: 0 !important; padding: 4mm !important; }
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: black !important; }
            pre { font-family: 'Courier New', Courier, monospace !important; }
          }
        `}} />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  // MOTOR FORMATO GRÁFICO (El original HTML enriquecido)
  // ─────────────────────────────────────────────────────────
  return (
    <div className={`ticket-container mx-auto bg-white text-black p-4 font-mono text-[12px] leading-tight print:p-0`} style={{ width: WIDTH_MM }}>
      {/* ── HEADER ── */}
      <div className="text-center mb-4">
        <h1 className="text-lg font-black uppercase tracking-widest leading-none">{businessName}</h1>
        {taxId && <p className="uppercase mt-1 text-[10px]">RFC: {taxId}</p>}
        {address && <p className="text-[10px] mt-1 whitespace-pre-line">{address}</p>}
        {phone && <p className="text-[10px] mt-1">Tel: {phone}</p>}
      </div>

      {/* ── META INFO ── */}
      <div className="border-y border-dashed border-black py-2 mb-4">
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
          <div className="flex justify-between border-t border-black/20 mt-1 pt-1 italic text-[10px]">
             <span>ATENDIÓ:</span>
             <span className="uppercase">{(order as any).userName}</span>
          </div>
        )}
        {(order as any).customerName && (
          <div className="flex justify-between mt-0.5 italic text-[10px]">
             <span>CLIENTE:</span>
             <span className="uppercase">{(order as any).customerName}</span>
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
          <tr className="border-b border-black">
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
      <div className="border-y border-dashed border-black py-2 mb-6">
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
        <div className="flex justify-between text-sm font-black mt-2 pt-1 border-t border-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="text-center text-[10px] my-4">
        {footerMessage && (
          <p className="font-bold whitespace-pre-line leading-tight">{footerMessage}</p>
        )}
        {policies && (
          <p className="mt-2 text-black/80 whitespace-pre-line text-[9px] leading-tight">{policies}</p>
        )}
      </div>

      {/* ── SOCIALS ── */}
      {hasSocials && (
        <div className="border-t border-dashed border-black py-2 text-center text-[10px] font-bold space-y-0.5">
          {whatsapp && <p>WhatsApp: {whatsapp}</p>}
          {instagram && <p>Instagram: {instagram}</p>}
          {facebook && <p>Facebook: {facebook}</p>}
          {website && <p>{website}</p>}
        </div>
      )}

      <div className="text-center text-[10px] font-bold mt-4 mb-2">--- FIN DE TICKET ---</div>

      {/* Estilos Criticos Térmicos Inyectados Ocultos */}
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: ${WIDTH_MM} auto;
          margin: 0;
        }
        @media print {
          html, body {
            width: ${WIDTH_MM};
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          .ticket-container {
            width: 100% !important;
            max-width: ${WIDTH_MM} !important;
            margin: 0 !important;
            padding: 4mm !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: black !important;
          }
        }
      `}} />
    </div>
  );
}

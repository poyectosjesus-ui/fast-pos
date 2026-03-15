"use client";

/**
 * BarcodeLabelDialog — Generador de Etiquetas con Código de Barras / QR
 *
 * Genera etiquetas profesionales con:
 * - Code 128 (estándar industrial, uso interno — 100% legal sin registro)
 * - QR Code (información del producto)
 * Permite imprimir 1, 4 o 12 etiquetas por hoja (modos de impresión).
 *
 * ¿Es legal? SÍ.
 * Code128 y QR son formatos abiertos para uso interno.
 * EAN-13 de GS1 solo se requiere para vender en cadenas (Walmart, OXXO, etc.)
 */

import { useEffect, useRef, useState, useCallback } from "react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Barcode, QrCode, Printer, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/constants";
import { toast } from "sonner";
import type { Product } from "@/lib/schema";

interface BarcodeLabelDialogProps {
  open: boolean;
  product: Product | null;
  businessName?: string;
  onClose: () => void;
}

type LabelType = "barcode" | "qr";
type LabelSize = "1" | "4" | "12";

const LABEL_SIZES: { value: LabelSize; label: string }[] = [
  { value: "1",  label: "1 etiqueta — Prueba" },
  { value: "4",  label: "4 etiquetas — Carta 2×2" },
  { value: "12", label: "12 etiquetas — Carta 3×4" },
];

export function BarcodeLabelDialog({
  open,
  product,
  businessName = "Fast-POS",
  onClose,
}: BarcodeLabelDialogProps) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [labelType, setLabelType] = useState<LabelType>("barcode");
  const [labelSize, setLabelSize] = useState<LabelSize>("4");
  const [customPrice, setCustomPrice] = useState<string>("");

  // Código a usar: SKU del producto (limpio, sin espacios)
  const code = product?.sku?.replace(/\s/g, "") ?? "";
  const displayPrice = customPrice
    ? parseFloat(customPrice)
    : product?.price ?? 0;

  // Generar barcode Code128
  const renderBarcode = useCallback(() => {
    if (!barcodeRef.current || !code || labelType !== "barcode") return;
    try {
      JsBarcode(barcodeRef.current, code, {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 11,
        margin: 6,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (err) {
      console.error("Error generando barcode:", err);
    }
  }, [code, labelType]);

  // Generar QR
  const renderQR = useCallback(async () => {
    if (!code || labelType !== "qr") return;
    try {
      const qrContent = JSON.stringify({
        sku: code,
        name: product?.name,
        price: displayPrice,
        brand: businessName,
      });
      const dataUrl = await QRCode.toDataURL(qrContent, {
        width: 160,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error("Error generando QR:", err);
    }
  }, [code, labelType, product?.name, displayPrice, businessName]);

  useEffect(() => {
    if (!open || !product) return;
    setCustomPrice(String(product.price / 100));
    if (labelType === "barcode") renderBarcode();
    else renderQR();
  }, [open, product, labelType, renderBarcode, renderQR]);

  // Copiar SKU al portapapeles
  const handleCopySku = () => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado", { description: code });
  };

  // Imprimir etiquetas
  const handlePrint = () => {
    const count = parseInt(labelSize);
    const priceFormatted = formatCurrency(displayPrice);
    const productName = product?.name ?? "";

    let labelsHtml = "";
    for (let i = 0; i < count; i++) {
      if (labelType === "barcode") {
        const svgEl = barcodeRef.current;
        const svgHtml = svgEl ? svgEl.outerHTML : "";
        labelsHtml += `
          <div class="label">
            <p class="brand">${businessName}</p>
            <p class="product-name">${productName}</p>
            <div class="barcode-wrap">${svgHtml}</div>
            <p class="price">${priceFormatted}</p>
          </div>`;
      } else {
        labelsHtml += `
          <div class="label">
            <p class="brand">${businessName}</p>
            <p class="product-name">${productName}</p>
            <img src="${qrDataUrl}" class="qr-img" alt="QR" />
            <p class="sku">${code}</p>
            <p class="price">${priceFormatted}</p>
          </div>`;
      }
    }

    const gridCols = count === 1 ? 1 : count === 4 ? 2 : 3;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Etiquetas — ${productName}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; background: #fff; }
          .grid {
            display: grid;
            grid-template-columns: repeat(${gridCols}, 1fr);
            gap: 4px;
            padding: 12px;
          }
          .label {
            border: 1px dashed #ccc;
            padding: 8px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-height: ${count === 12 ? "80px" : "100px"};
            page-break-inside: avoid;
          }
          .brand { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
          .product-name { font-size: ${count === 12 ? "9px" : "11px"}; font-weight: bold; margin-bottom: 4px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .barcode-wrap svg { max-width: 100%; height: auto; }
          .qr-img { width: ${count === 12 ? "60px" : "80px"}; height: auto; margin: 4px 0; }
          .sku { font-size: 8px; color: #444; font-family: monospace; margin-top: 2px; }
          .price { font-size: ${count === 12 ? "10px" : "13px"}; font-weight: 900; color: #000; margin-top: 4px; }
          @media print {
            body { margin: 0; }
            .grid { padding: 6px; gap: 3px; }
          }
        </style>
      </head>
      <body>
        <div class="grid">${labelsHtml}</div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5 text-primary" />
            Generar Etiqueta
          </DialogTitle>
          <DialogDescription>
            Crea e imprime etiquetas con código de barras o QR para <strong>{product.name}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tipo de código */}
          <div className="flex gap-2">
            <button
              onClick={() => setLabelType("barcode")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all",
                labelType === "barcode"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
              )}
            >
              <Barcode className="h-4 w-4" />
              Code 128
            </button>
            <button
              onClick={() => setLabelType("qr")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition-all",
                labelType === "qr"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/60"
              )}
            >
              <QrCode className="h-4 w-4" />
              Código QR
            </button>
          </div>

          {/* Preview */}
          <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-white dark:bg-zinc-950 min-h-[160px]">
            {/* Nombre negocio */}
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              {businessName}
            </p>
            <p className="text-sm font-bold text-center leading-tight max-w-[200px]">
              {product.name}
            </p>

            {labelType === "barcode" ? (
              <svg ref={barcodeRef} className="max-w-full" />
            ) : qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="QR" className="w-24 h-24" />
                <p className="text-[10px] font-mono text-muted-foreground">{code}</p>
              </>
            ) : (
              <div className="w-24 h-24 bg-muted/30 rounded animate-pulse" />
            )}

            <p className="text-lg font-black text-primary">
              {formatCurrency(displayPrice)}
            </p>
          </div>

          <Separator />

          {/* Configuración */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Precio en etiqueta</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  className="pl-7"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Cantidad a imprimir</Label>
              <Select
                value={labelSize}
                onValueChange={(v) => setLabelSize(v as LabelSize)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_SIZES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* SKU copiable */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Código SKU</p>
              <p className="font-mono font-bold text-sm truncate">{code}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopySku}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Pie legal */}
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            Code 128 y QR son formatos abiertos para uso interno — sin registro requerido.
            Para vender en cadenas comerciales (Walmart, OXXO) se requiere EAN-13 de GS1 México.
          </p>

          {/* Acciones */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir {labelSize} etiqueta{parseInt(labelSize) > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

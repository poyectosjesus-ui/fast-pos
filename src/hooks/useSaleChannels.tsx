/**
 * useSaleChannels — Fast-POS 2.0
 *
 * Hook que lee la configuración de canales de venta desde las settings
 * del negocio y expone:
 *   - `channels`: lista de canales habilitados (con label e icono)
 *   - `defaultChannel`: canal por defecto para el checkout
 *   - `loading`: mientras se leen las settings
 *
 * Settings relevantes:
 *   - `enabled_channels` — CSV: "COUNTER,WHATSAPP"  (default: "COUNTER")
 *   - `default_channel`  — string: "COUNTER"        (default: "COUNTER")
 *
 * Sprint-1 E2 — Configuración dinámica de canales de venta.
 * Fuente de Verdad: ARCHITECTURE.md §2.1
 */

"use client";

import { useEffect, useState } from "react";
import { Store, MessageCircle, Camera, MoreHorizontal } from "lucide-react";

export type SaleSource = "COUNTER" | "WHATSAPP" | "INSTAGRAM" | "OTHER";

export interface SaleChannel {
  id: SaleSource;
  label: string;
  icon: React.ReactNode;
  color: string;
}

/** Catálogo completo de canales disponibles */
export const ALL_SALE_CHANNELS: SaleChannel[] = [
  { id: "COUNTER",   label: "Mostrador",  icon: <Store          className="h-4 w-4" />, color: "slate"   },
  { id: "WHATSAPP",  label: "WhatsApp",   icon: <MessageCircle  className="h-4 w-4" />, color: "emerald" },
  { id: "INSTAGRAM", label: "Instagram",  icon: <Camera         className="h-4 w-4" />, color: "pink"    },
  { id: "OTHER",     label: "Otro canal", icon: <MoreHorizontal className="h-4 w-4" />, color: "orange"  },
];

interface UseSaleChannelsResult {
  channels: SaleChannel[];
  defaultChannel: SaleSource;
  loading: boolean;
}

/**
 * Lee los canales habilitados y el canal por defecto desde las settings.
 * Si no hay settings guardadas, devuelve solo "COUNTER" como canal único.
 */
export function useSaleChannels(): UseSaleChannelsResult {
  const [channels, setChannels] = useState<SaleChannel[]>([ALL_SALE_CHANNELS[0]]);
  const [defaultChannel, setDefaultChannel] = useState<SaleSource>("COUNTER");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const api = typeof window !== "undefined"
      ? (window as Window & { electronAPI?: any }).electronAPI
      : null;

    if (!api) {
      setLoading(false);
      return;
    }

    api.getAllSettings()
      .then((res: any) => {
        const cfg: Record<string, string> = res?.success ? (res.config ?? {}) : {};

        // Leer canales habilitados (CSV)
        const rawEnabled = cfg["enabled_channels"] || "COUNTER";
        const enabledIds = rawEnabled.split(",").map((s: string) => s.trim()) as SaleSource[];
        const enabled = ALL_SALE_CHANNELS.filter(ch => enabledIds.includes(ch.id));

        // Si el usuario borró todos, mostrar al menos Mostrador
        const finalChannels = enabled.length > 0 ? enabled : [ALL_SALE_CHANNELS[0]];

        // Canal por defecto
        const rawDefault = (cfg["default_channel"] || "COUNTER") as SaleSource;
        const def = finalChannels.find(ch => ch.id === rawDefault)
          ? rawDefault
          : finalChannels[0].id;

        setChannels(finalChannels);
        setDefaultChannel(def);
      })
      .catch(() => {
        // Fallback silencioso
      })
      .finally(() => setLoading(false));
  }, []);

  return { channels, defaultChannel, loading };
}

import { DANGER_STOCK_LEVEL, WARNING_STOCK_LEVEL } from "@/lib/constants";

export type InventoryStatus = "success" | "warning" | "danger" | "out";

export interface InventoryStyle {
  status: InventoryStatus;
  borderClass: string;
  bgClass: string;
  textClass: string;
  badgeClass: string;
  label: string;
}

export function getInventoryStyle(stock: number, allowNegativeStock: boolean = false): InventoryStyle {
  if (stock <= 0 && !allowNegativeStock) {
    return {
      status: "out",
      borderClass: "border-destructive/50",
      bgClass: "bg-destructive/10",
      textClass: "text-destructive",
      badgeClass: "bg-destructive text-destructive-foreground",
      label: "Sin stock",
    };
  }

  if (stock <= DANGER_STOCK_LEVEL) {
    return {
      status: "danger",
      borderClass: "border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
      bgClass: "bg-red-50 dark:bg-red-950/20",
      textClass: "text-red-600 dark:text-red-400",
      badgeClass: "bg-red-500 text-white animate-pulse",
      label: "Crítico",
    };
  }

  if (stock <= WARNING_STOCK_LEVEL) {
    return {
      status: "warning",
      borderClass: "border-amber-400",
      bgClass: "bg-amber-50 dark:bg-amber-950/20",
      textClass: "text-amber-600 dark:text-amber-400",
      badgeClass: "bg-amber-400 text-amber-950",
      label: "Bajo",
    };
  }

  return {
    status: "success",
    borderClass: "border-border hover:border-emerald-500/50",
    bgClass: "bg-card",
    textClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-500 text-white",
    label: "Normal",
  };
}

"use client";

/**
 * MetricCard — Tarjeta de Métrica para el Dashboard de Analítica
 *
 * FUENTE DE VERDAD: analitica_plan.md — Sección 4.1
 *
 * Diseño "Claridad y Acción": cada número viene acompañado de su contexto
 * para que un cajero o un dueño de negocio entienda de inmediato qué significa.
 */

import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  /** Nombre humano de la métrica. Ej: "Lo que llevas vendido" */
  title: string;
  /** El número formateado a mostrar. Ej: "$1,250.00" */
  value: string;
  /** Descripción contextual: explica QUÉ significa ese número en el negocio */
  description: string;
  /** Ícono de Lucide que represente visualmente la métrica */
  icon: LucideIcon;
  /** Variante de color para el acento visual de la tarjeta */
  variant?: "emerald" | "blue" | "amber" | "violet" | "rose";
  /** Texto de tendencia o sub-dato. Ej: "↑ vs ayer" */
  trend?: string;
  /** Si la tendencia es positiva (verde) o negativa (roja) */
  trendPositive?: boolean;
}

const variantStyles = {
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    accent: "border-l-emerald-500",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  blue: {
    icon: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    accent: "border-l-blue-500",
    value: "text-blue-700 dark:text-blue-300",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accent: "border-l-amber-500",
    value: "text-amber-700 dark:text-amber-300",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    accent: "border-l-violet-500",
    value: "text-violet-700 dark:text-violet-300",
  },
  rose: {
    icon: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    accent: "border-l-rose-500",
    value: "text-rose-700 dark:text-rose-300",
  },
};

export function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "emerald",
  trend,
  trendPositive,
}: MetricCardProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-sm",
        "border-l-4 transition-shadow hover:shadow-md",
        styles.accent
      )}
    >
      {/* Cabecera: ícono + título */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground leading-tight">{title}</p>
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      {/* Valor principal */}
      <div>
        <p className={cn("text-2xl font-black tracking-tight", styles.value)}>{value}</p>
        {/* CA-4.1.2: Ayuda contextual obligatoria bajo cada número */}
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>

      {/* Tendencia opcional */}
      {trend && (
        <p className={cn(
          "text-xs font-semibold",
          trendPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
        )}>
          {trend}
        </p>
      )}
    </div>
  );
}

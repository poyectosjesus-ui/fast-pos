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
    icon: "bg-primary/10 text-primary",
    accent: "border-l-primary",
    value: "text-foreground",
  },
  blue: {
    icon: "bg-card-foreground/10 text-card-foreground",
    accent: "border-l-card-foreground",
    value: "text-foreground",
  },
  amber: {
    icon: "bg-secondary/20 text-secondary-foreground",
    accent: "border-l-secondary",
    value: "text-foreground",
  },
  violet: {
    icon: "bg-accent/20 text-accent-foreground",
    accent: "border-l-accent",
    value: "text-foreground",
  },
  rose: {
    icon: "bg-destructive/10 text-destructive",
    accent: "border-l-destructive",
    value: "text-foreground",
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
          trendPositive ? "text-primary" : "text-destructive"
        )}>
          {trend}
        </p>
      )}
    </div>
  );
}

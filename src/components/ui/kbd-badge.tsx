"use client";

import { useEffect, useState } from "react";
import { formatComboForDisplay, ShortcutAction, useShortcutStore } from "@/store/useShortcutStore";
import { cn } from "@/lib/utils";

interface KbdBadgeProps {
  action: ShortcutAction;
  className?: string;
  variant?: "outline" | "solid" | "ghost";
}

export function KbdBadge({ action, className, variant = "outline" }: KbdBadgeProps) {
  const [isMac, setIsMac] = useState(false);
  const [mounted, setMounted] = useState(false);
  const shortcuts = useShortcutStore((state) => state.shortcuts);

  useEffect(() => {
    // Evitar errores de hidratación detectando cliente
    setMounted(true);
    setIsMac(typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac"));
  }, []);

  if (!mounted) {
    // Placeholder invisible para no brincar UI
    return <kbd className={cn("inline-flex h-5 min-w-[20px] opacity-0", className)} />;
  }

  const combo = shortcuts[action];
  if (!combo || combo.length === 0) return null;

  const displayString = formatComboForDisplay(combo, isMac);

  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 transition-all",
        variant === "outline" && "bg-muted/50 text-muted-foreground border-border/70",
        variant === "solid" && "bg-primary/20 text-primary border-primary/30",
        variant === "ghost" && "bg-transparent text-muted-foreground border-transparent opacity-60",
        className
      )}
    >
      {/* 
        Para botones como "⌘ P", formatComboForDisplay ya devuelve algo como "⌘ + P"
        o "Cmd + P" según Mac/Win 
      */}
      <span className="text-xs">{displayString}</span>
    </kbd>
  );
}

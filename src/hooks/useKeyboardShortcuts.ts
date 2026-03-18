"use client";

import { useEffect } from "react";
import { useShortcutStore, isComboMatch } from "@/store/useShortcutStore";

interface ShortcutHandlers {
  onSearch?: () => void;
  onPay?: () => void;
  onClearCart?: () => void;
  onDiscount?: () => void;
  onQuickSale?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const shortcuts = useShortcutStore((state) => state.shortcuts);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input o textarea (A MENOS que sea un atajo complejo con Ctrl/Cmd)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const isComplex = e.ctrlKey || e.metaKey || e.altKey;

      // Evaluamos Atajos
      if (isComboMatch(e, shortcuts.FOCUS_SEARCH)) {
        if (!isComplex && isInput && e.key.length === 1) return; // Si es solo una letra y estoy en un input, ignorar
        e.preventDefault();
        handlers.onSearch?.();
        return;
      }

      if (isComboMatch(e, shortcuts.PAY_ORDER)) {
        if (!isComplex && isInput && e.key.length === 1) return;
        e.preventDefault();
        handlers.onPay?.();
        return;
      }

      if (isComboMatch(e, shortcuts.CLEAR_CART)) {
        if (!isComplex && isInput && e.key.length === 1) return;
        e.preventDefault();
        handlers.onClearCart?.();
        return;
      }

      if (isComboMatch(e, shortcuts.ADD_DISCOUNT)) {
        if (!isComplex && isInput && e.key.length === 1) return;
        e.preventDefault();
        handlers.onDiscount?.();
        return;
      }

      if (isComboMatch(e, shortcuts.QUICK_SALE)) {
        if (!isComplex && isInput && e.key.length === 1) return;
        e.preventDefault();
        handlers.onQuickSale?.();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, handlers]);
}

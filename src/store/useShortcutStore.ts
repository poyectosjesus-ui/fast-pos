import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ShortcutAction = "FOCUS_SEARCH" | "PAY_ORDER" | "CLEAR_CART" | "ADD_DISCOUNT" | "QUICK_SALE";

// Combinación de teclas, ej: ["Meta", "p"] para Cmd+P, ["Control", "p"] para Ctrl+P
export type KeyCombo = string[];

interface ShortcutState {
  shortcuts: Record<ShortcutAction, KeyCombo>;
  setShortcut: (action: ShortcutAction, combo: KeyCombo) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SHORTCUTS: Record<ShortcutAction, KeyCombo> = {
  FOCUS_SEARCH: ["F3"],
  PAY_ORDER: ["F4"],
  CLEAR_CART: ["F8"],
  ADD_DISCOUNT: ["F9"],
  QUICK_SALE: ["F10"],
};

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set) => ({
      shortcuts: DEFAULT_SHORTCUTS,
      setShortcut: (action, combo) =>
        set((state) => ({
          shortcuts: { ...state.shortcuts, [action]: combo },
        })),
      resetToDefaults: () =>
        set(() => ({
          shortcuts: DEFAULT_SHORTCUTS,
        })),
    }),
    {
      name: "fastpos-shortcuts-v1",
    }
  )
);

// Utilidad para extraer el símbolo del OS
export function formatComboForDisplay(combo: KeyCombo, isMac: boolean = false): string {
  if (!combo || combo.length === 0) return "";
  
  return combo
    .map((key) => {
      // Modificadores Mac
      if (isMac) {
        if (key === "Meta") return "⌘";
        if (key === "Alt") return "⌥";
        if (key === "Shift") return "⇧";
        if (key === "Control") return "⌃";
      } else {
        // Modificadores Windows/Linux
        if (key === "Meta") return "Win";
        if (key === "Alt") return "Alt";
        if (key === "Shift") return "Mayús";
        if (key === "Control") return "Ctrl";
      }

      // Limpieza de letras (mostrar en mayúscula)
      if (key.length === 1) return key.toUpperCase();
      
      // Teclas especiales
      if (key === "Escape") return "Esc";
      if (key === "Enter") return "↵";
      if (key === "Backspace") return "⌫";
      
      return key;
    })
    .join(" + ");
}

// Utilidad para checar si un KeyboardEvent coincide con un KeyCombo
export function isComboMatch(e: KeyboardEvent, combo: KeyCombo): boolean {
  if (!combo || combo.length === 0) return false;

  // Extraemos los modificadores esperados
  const needsMeta = combo.includes("Meta");
  const needsCtrl = combo.includes("Control");
  const needsAlt = combo.includes("Alt");
  const needsShift = combo.includes("Shift");

  // Si los modificadores no coinciden exactamente, fallamos temprano
  if (
    e.metaKey !== needsMeta ||
    e.ctrlKey !== needsCtrl ||
    e.altKey !== needsAlt ||
    e.shiftKey !== needsShift
  ) {
    return false;
  }

  // Comparamos la tecla principal (ignoramos Case porque Shift ya fue revisado)
  const mainKey = combo.find((k) => !["Meta", "Control", "Alt", "Shift"].includes(k));
  if (!mainKey) return true; // Si el combo era solo modificadores (raro)

  return e.key.toLowerCase() === mainKey.toLowerCase();
}

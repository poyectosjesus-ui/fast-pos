/**
 * CASH SERVICE — Fast-POS 2.0
 *
 * Responsabilidad: Puente entre React UI y el backend IPC para el manejo de efectivo.
 * Permite registrar aperturas de caja, entradas y salidas de dinero.
 *
 * Fuente de Verdad: ARCHITECTURE.md §2, CODING_STANDARDS.md §4
 */

import { v4 as uuidv4 } from "uuid";
import { CashMovement, CashMovementSchema } from "../schema";
import { AuditService } from "./audit";

function getAPI() {
  if (typeof window === "undefined") return null;
  return (window as any).electronAPI ?? null;
}

export const CashService = {
  /**
   * Registra un nuevo movimiento de caja.
   * Valida via Zod antes de enviar al proceso Main.
   *
   * @param movement Datos del movimiento sin ID ni Timestamp (generados aquí)
   * @returns El movimiento completo validado o lanza un throw
   */
  async registerMovement(
    movement: Omit<CashMovement, "id" | "createdAt">
  ): Promise<CashMovement> {
    const api = getAPI();
    if (!api) throw new Error("Entorno de escritorio (Electron) no detectado");

    const newMovement = CashMovementSchema.parse({
      ...movement,
      id: uuidv4(),
      createdAt: Date.now(),
    });

    const result = await api.registerMovement(newMovement);
    if (!result.success) {
      throw new Error(result.error ?? "No se pudo registrar el movimiento de caja");
    }

    // Auditoría
    await AuditService.log(
      movement.userId || "SYSTEM",
      "Cajero", // Por defecto, hasta que enlazemos de la UI
      `CASH_MOVE_${movement.type}`,
      { amount: movement.amount, concept: movement.concept }
    );

    return newMovement;
  },

  /**
   * Obtiene todos los movimientos realizados en el día (aperturas, retiros, ingresos).
   */
  async getTodayMovements(): Promise<CashMovement[]> {
    const api = getAPI();
    if (!api) return [];

    const result = await api.getTodayMovements();
    if (!result.success) {
      console.error("[CashService] Error al obtener movimientos:", result.error);
      return [];
    }

    return result.movements || [];
  },

  /**
   * Obtiene el balance total en caja del día.
   * Sumatoria matemática: Fondo + Ventas Efectivo + Ingresos - Egresos.
   */
  async getTodayBalance(): Promise<{
    opening: number;
    cashIn: number;
    cashOut: number;
    cashSales: number;
    expectedBalance: number;
  }> {
    const api = getAPI();
    if (!api) {
      return { opening: 0, cashIn: 0, cashOut: 0, cashSales: 0, expectedBalance: 0 };
    }

    const result = await api.getTodayBalance();
    if (!result.success || !result.balance) {
      console.error("[CashService] Error al obtener el balance del día:", result.error);
      return { opening: 0, cashIn: 0, cashOut: 0, cashSales: 0, expectedBalance: 0 };
    }

    return result.balance;
  },

  /**
   * Determina si la caja del usuario ya ha sido abierta el día de hoy.
   */
  async isRegisterOpen(): Promise<boolean> {
    const balance = await this.getTodayBalance();
    return balance.opening > 0;
  }
};

import type { Tono } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";

/** Saldo del mes con una persona: positivo = le debés; negativo = cobró de más (adelantado). */
export function textoSaldo(saldo: number): { titulo: string; texto: string; tono: Tono } {
  if (saldo > 0) return { titulo: "Le debés", texto: `Le debés ${formatPesos(saldo)}`, tono: "warn" };
  if (saldo < 0) return { titulo: "Adelantado", texto: `Adelantado ${formatPesos(-saldo)}`, tono: "info" };
  return { titulo: "Saldo", texto: "Al día", tono: "ok" };
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

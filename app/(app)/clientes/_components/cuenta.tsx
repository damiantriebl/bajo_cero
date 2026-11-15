// Piezas de presentación de la cuenta de un cliente (sirven en Server y Client Components).
import { Badge } from "@/components/ui/base";
import type { Tono } from "@/lib/etiquetas";
import { partesAR, formatFechaCorta } from "@/lib/fechas";

type EstadoCuenta = "saldo" | "al_dia" | "presupuesto" | "sin_trabajos";

/** 146 → "N.º 0146" */
export function numeroTrabajo(numero: number): string {
  return `N.º ${String(numero).padStart(4, "0")}`;
}

/** "14 nov 2026" */
export function fechaConAnio(d: Date): string {
  return `${formatFechaCorta(d)} ${partesAR(d).anio}`;
}

export const ESTADO_CUENTA: Record<EstadoCuenta, { label: string; tono: Tono }> = {
  saldo: { label: "Con saldo", tono: "warn" },
  al_dia: { label: "Al día", tono: "ok" },
  presupuesto: { label: "Presupuesto enviado", tono: "info" },
  sin_trabajos: { label: "Sin trabajos", tono: "neutral" },
};

export function EstadoCuentaBadge({ estado }: { estado: EstadoCuenta }) {
  const { label, tono } = ESTADO_CUENTA[estado];
  return <Badge tono={tono}>{label}</Badge>;
}

/** Primer valor de un searchParam (`?a=1&a=2` → "1"). */
export function primero(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

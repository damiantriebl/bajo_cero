// Reglas de negocio puras (sin acceso a datos). Las usan todas las pantallas
// para que "cuánto falta pagar" se calcule siempre igual.
import type { Insumo } from "@/lib/generated/prisma/client";

type ConPrecio = { cantidad: number; precioUnitario: number };
type ConMonto = { monto: number };

/** Total de un presupuesto (suma de sus ítems). */
export function totalItems(items: ConPrecio[]): number {
  return Math.round(items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0));
}

export function sumaMontos(filas: ConMonto[]): number {
  return filas.reduce((acc, f) => acc + f.monto, 0);
}

/** Saldo = total − cobrado (nunca negativo para mostrar "falta"). */
export function saldo(total: number, cobrado: number): number {
  return Math.max(0, total - cobrado);
}

/** Fracción 0–1 cobrada, para barras de progreso. */
export function avanceCobro(total: number, cobrado: number): number {
  if (total <= 0) return cobrado > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, cobrado / total));
}

/** Costo de insumos consumidos (movimientos CONSUMO tienen cantidad negativa). */
export function costoConsumos(movs: { cantidad: number; costoUnitario: number | null }[]): number {
  return Math.round(movs.reduce((acc, m) => acc + Math.abs(m.cantidad) * (m.costoUnitario ?? 0), 0));
}

export type Rentabilidad = {
  precio: number;
  insumos: number;
  personal: number;
  ganancia: number;
  margen: number; // 0–1
};

export function rentabilidad(precio: number, insumos: number, personal: number): Rentabilidad {
  const ganancia = precio - insumos - personal;
  return { precio, insumos, personal, ganancia, margen: precio > 0 ? ganancia / precio : 0 };
}

export type EstadoStock = "bajo" | "ok" | "sin_stock";

export function estadoStock(insumo: Pick<Insumo, "stock" | "stockMinimo">): EstadoStock {
  if (insumo.stock <= 0) return "sin_stock";
  if (insumo.stock < insumo.stockMinimo) return "bajo";
  return "ok";
}

/** Cuánto pedir para volver al doble del mínimo. */
export function cantidadAPedir(insumo: Pick<Insumo, "stock" | "stockMinimo">): number {
  return Math.max(0, Math.ceil(insumo.stockMinimo * 2 - insumo.stock));
}

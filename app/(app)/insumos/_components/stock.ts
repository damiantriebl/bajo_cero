// Textos de stock y unidades para insumos y compras (sirve en server y client).
import type { EstadoStock } from "@/lib/calculos";
import type { Tono } from "@/lib/etiquetas";
import { UNIDAD } from "@/lib/etiquetas";
import { formatNumero, formatPesos } from "@/lib/formato";
import type { TipoMovimiento, Unidad } from "@/lib/generated/prisma/enums";

export const ESTADO_STOCK: Record<EstadoStock, { label: string; tono: Tono }> = {
  sin_stock: { label: "Sin stock", tono: "danger" },
  bajo: { label: "Stock bajo", tono: "warn" },
  ok: { label: "Hay stock", tono: "ok" },
};

export const TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  COMPRA: "Compra",
  CONSUMO: "Consumo",
  AJUSTE: "Ajuste",
};

/** Abreviatura que corresponde a la cantidad: "1 par", "2 pares", "6 m". */
export function abreviatura(n: number, unidad: Unidad): string {
  const u = UNIDAD[unidad];
  return Math.abs(n) === 1 && u.corta === u.varios ? u.uno : u.corta;
}

/** 6 → "6 m"; 2,5 → "2,5 kg" */
export function cantidadUnidad(n: number, unidad: Unidad): string {
  const signo = n < 0 ? "−" : "";
  return `${signo}${formatNumero(Math.abs(n))} ${abreviatura(n, unidad)}`;
}

/** Siempre con signo: "+10 m", "−2 m". */
export function cantidadConSigno(n: number, unidad: Unidad): string {
  return `${n < 0 ? "−" : "+"}${formatNumero(Math.abs(n))} ${abreviatura(n, unidad)}`;
}

/** "$ 7.500 el metro", "$ 9.500 la unidad" */
export function precioPorUnidad(monto: number, unidad: Unidad): string {
  const articulo = unidad === "UNIDAD" ? "la" : "el";
  return `${formatPesos(monto)} ${articulo} ${UNIDAD[unidad].uno}`;
}

/** Margen sobre el precio de venta (igual que la rentabilidad de los trabajos). */
export function margen(costo: number, precioVenta: number | null): number | null {
  if (!precioVenta || precioVenta <= 0) return null;
  return (precioVenta - costo) / precioVenta;
}

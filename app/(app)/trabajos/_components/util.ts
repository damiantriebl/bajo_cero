// Formatos propios de trabajos y presupuestos (sirven en Server y Client Components).
import { formatDiaRelativo, formatHora, partesAR } from "@/lib/fechas";
import { formatNumero } from "@/lib/formato";

/** 146 → "0146" */
export const numeroCorto = (n: number) => String(n).padStart(4, "0");

/** 146 → "N.º 0146" */
export const numeroTrabajo = (n: number) => `N.º ${numeroCorto(n)}`;

/** 4, "m" → "4 m" · 1, null → "1" */
export function cantidadConUnidad(cantidad: number, unidad: string | null): string {
  return unidad ? `${formatNumero(cantidad)} ${unidad}` : formatNumero(cantidad);
}

/** "Hoy 09:00", "Mañana 15:00", "16 nov 09:00" */
export function diaYHora(d: Date, hoy: Date): string {
  return `${formatDiaRelativo(d, hoy)} ${formatHora(d)}`;
}

/** Igual que diaYHora pero para usar en medio de una frase: "hoy 09:00". */
export function diaYHoraEnFrase(d: Date, hoy: Date): string {
  const t = diaYHora(d, hoy);
  return /^(Hoy|Mañana|Ayer)/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

const lista = new Intl.ListFormat("es", { type: "conjunction" });

/** ["Diego", "Nico"] → "Diego y Nico" */
export const unirNombres = (nombres: string[]) => lista.format(nombres);

/** true si las dos fechas caen en el mismo año (hora argentina). */
export const mismoAnio = (a: Date, b: Date) => partesAR(a).anio === partesAR(b).anio;

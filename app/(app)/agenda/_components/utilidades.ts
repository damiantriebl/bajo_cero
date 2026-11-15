// Ayudas puras de la agenda (sirven en Server y Client Components y en las server actions).
import type { Visita } from "@/lib/data/agenda";
import { TZ, diasHasta, formatFechaLarga } from "@/lib/fechas";

/** Duraciones que se pueden elegir para un turno, en minutos. */
export const DURACIONES = [
  { minutos: 60, label: "1 h" },
  { minutos: 90, label: "1 h 30" },
  { minutos: 120, label: "2 h" },
  { minutos: 180, label: "3 h" },
  { minutos: 240, label: "4 h" },
  { minutos: 480, label: "Día completo (8 h)" },
] as const;

export const DURACION_POR_DEFECTO = 120;

export function esDuracionValida(minutos: number): boolean {
  return DURACIONES.some((d) => d.minutos === minutos);
}

/** La duración más larga de la lista que entra en `minutos` (mínimo 1 h). */
export function duracionQueEntra(minutos: number): number {
  return [...DURACIONES].reverse().find((d) => d.minutos <= minutos)?.minutos ?? DURACIONES[0].minutos;
}

/** ["Diego", "Nico", "Juan"] → "Diego, Nico y Juan" */
export function unirNombres(nombres: string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? "";
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

/** 147 → "N.º 0147" */
export function numeroTrabajo(numero: number): string {
  return `N.º ${String(numero).padStart(4, "0")}`;
}

/** 1 → "1 visita", 3 → "3 visitas", 0 → "sin visitas" */
export function textoVisitas(n: number): string {
  if (n === 0) return "sin visitas";
  return n === 1 ? "1 visita" : `${n} visitas`;
}

/** 420 → "7 h", 90 → "1 h 30", 45 → "45 min" */
export function textoDuracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export function minutosEntre(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 60_000);
}

const fMesLargo = new Intl.DateTimeFormat("es-AR", { timeZone: TZ, month: "long" });

/** "noviembre" */
export function nombreMes(d: Date): string {
  return fMesLargo.format(d);
}

/** "hoy", "mañana" o "el lunes 16" (para usar dentro de una frase). */
export function diaEnFrase(fecha: Date, hoy: Date): string {
  const n = diasHasta(fecha, hoy);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  const [diaSemana, numero] = formatFechaLarga(fecha).split(" ");
  return `el ${diaSemana.toLowerCase()} ${numero}`;
}

/** "Hoy", "Mañana" o "Lunes 16" (para empezar una línea). */
export function diaCorto(fecha: Date, hoy: Date): string {
  const t = diaEnFrase(fecha, hoy).replace(/^el /, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Clave del horario elegido: si el servidor avisa que se superpone y el
 * usuario reenvía sin cambiar nada, se agenda igual.
 */
export function claveHorario(d: { fecha: string; hora: string; duracion: string; tecnicos: string[]; extra?: string }) {
  return [d.extra ?? "", d.fecha, d.hora, d.duracion, [...d.tecnicos].sort().join(",")].join("|");
}

export type Vista = "dia" | "semana";

/** Link a la agenda (la vista "semana" es la de siempre y no va en la URL). */
export function hrefAgenda(vista: Vista, dia: string): string {
  return vista === "dia" ? `/agenda?vista=dia&dia=${dia}` : `/agenda?dia=${dia}`;
}

/** Link al formulario de turno nuevo con datos ya elegidos. */
export function hrefNuevoTurno(d: { fecha?: string; hora?: string; duracion?: number; trabajo?: string } = {}): string {
  const q = new URLSearchParams();
  if (d.trabajo) q.set("trabajo", d.trabajo);
  if (d.fecha) q.set("fecha", d.fecha);
  if (d.hora) q.set("hora", d.hora);
  if (d.duracion) q.set("duracion", String(d.duracion));
  const s = q.toString();
  return s ? `/agenda/nuevo?${s}` : "/agenda/nuevo";
}

export type ItemLinea = { tipo: "visita"; visita: Visita } | { tipo: "libre"; desde: Date; hasta: Date };

/** Huecos de al menos 1 h entre visitas (sin contar canceladas) que todavía no pasaron. */
export function lineaDeTiempo(visitas: Visita[], ahora: Date): ItemLinea[] {
  const items: ItemLinea[] = [];
  let finHasta: Date | null = null;
  for (const visita of visitas) {
    const activa = visita.estado !== "CANCELADO";
    if (activa && finHasta && minutosEntre(finHasta, visita.inicio) >= 60 && visita.inicio > ahora) {
      items.push({ tipo: "libre", desde: finHasta, hasta: visita.inicio });
    }
    items.push({ tipo: "visita", visita });
    if (activa && (!finHasta || visita.fin > finHasta)) finHasta = visita.fin;
  }
  return items;
}

// Fechas en hora de Argentina (UTC−3 fijo, sin horario de verano).
// El servidor (Vercel) corre en UTC: SIEMPRE usar estas funciones para
// armar, comparar y mostrar fechas, nunca getHours()/setHours() directos.

export const TZ = "America/Argentina/Buenos_Aires";
const OFFSET_HORAS = 3; // AR = UTC−3
const DIA_MS = 86_400_000;

export type FechaAR = { anio: number; mes: number; dia: number }; // mes 0–11

/** Construye un instante a partir de una fecha/hora de Argentina. */
export function fechaAR(anio: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  return new Date(Date.UTC(anio, mes, dia, hora + OFFSET_HORAS, minuto));
}

/** Partes de calendario (en Argentina) de un instante. */
export function partesAR(d: Date): FechaAR & { hora: number; minuto: number; diaSemana: number } {
  const local = new Date(d.getTime() - OFFSET_HORAS * 3_600_000);
  return {
    anio: local.getUTCFullYear(),
    mes: local.getUTCMonth(),
    dia: local.getUTCDate(),
    hora: local.getUTCHours(),
    minuto: local.getUTCMinutes(),
    diaSemana: local.getUTCDay(), // 0 = domingo
  };
}

/** 00:00 en Argentina del día de `d`. */
export function inicioDia(d: Date): Date {
  const p = partesAR(d);
  return fechaAR(p.anio, p.mes, p.dia);
}

export function finDia(d: Date): Date {
  return new Date(inicioDia(d).getTime() + DIA_MS - 1);
}

export function sumarDias(d: Date, dias: number): Date {
  return new Date(d.getTime() + dias * DIA_MS);
}

export function sumarMeses(d: Date, meses: number): Date {
  const p = partesAR(d);
  return fechaAR(p.anio, p.mes + meses, Math.min(p.dia, 28), p.hora, p.minuto);
}

/** Lunes 00:00 de la semana de `d`. */
export function inicioSemana(d: Date): Date {
  const p = partesAR(d);
  const desdeLunes = (p.diaSemana + 6) % 7;
  return sumarDias(fechaAR(p.anio, p.mes, p.dia), -desdeLunes);
}

export function inicioMes(d: Date): Date {
  const p = partesAR(d);
  return fechaAR(p.anio, p.mes, 1);
}

export function finMes(d: Date): Date {
  const p = partesAR(d);
  return new Date(fechaAR(p.anio, p.mes + 1, 1).getTime() - 1);
}

export function mismoDia(a: Date, b: Date): boolean {
  const pa = partesAR(a);
  const pb = partesAR(b);
  return pa.anio === pb.anio && pa.mes === pb.mes && pa.dia === pb.dia;
}

export function entre(d: Date, desde: Date, hasta: Date): boolean {
  const t = d.getTime();
  return t >= desde.getTime() && t <= hasta.getTime();
}

/** Días de calendario entre hoy y `d` (negativo si ya pasó). */
export function diasHasta(d: Date, hoy: Date): number {
  return Math.round((inicioDia(d).getTime() - inicioDia(hoy).getTime()) / DIA_MS);
}

// ───────── Formularios: <input type="date"> y <input type="time"> ─────────

/** "2026-11-16" → fecha AR (00:00). */
export function parseFechaInput(valor: string, hora = "00:00"): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  const h = /^(\d{1,2}):(\d{2})$/.exec(hora);
  if (!m || !h) return null;
  return fechaAR(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(h[1]), Number(h[2]));
}

/** Fecha → "2026-11-16" (para value de <input type="date">). */
export function aInputFecha(d: Date): string {
  const p = partesAR(d);
  return `${p.anio}-${String(p.mes + 1).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}

/** Fecha → "09:00" (para value de <input type="time">). */
export function aInputHora(d: Date): string {
  const p = partesAR(d);
  return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
}

// ───────── Mostrar ─────────

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-AR", { timeZone: TZ, ...opts });

const fHora = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
const fCorta = fmt({ day: "numeric", month: "short" });
const fLarga = fmt({ weekday: "long", day: "numeric", month: "long" });
const fCompleta = fmt({ day: "numeric", month: "long", year: "numeric" });
const fMes = fmt({ month: "long", year: "numeric" });
const fMesCorto = fmt({ month: "short" });
const fDiaSemanaCorto = fmt({ weekday: "short" });

const sinPunto = (s: string) => s.replace(".", "");
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "09:00" */
export const formatHora = (d: Date) => fHora.format(d);
/** "16 nov" */
export const formatFechaCorta = (d: Date) => sinPunto(fCorta.format(d));
/** "Lunes 16 de noviembre" */
export const formatFechaLarga = (d: Date) => mayus(fLarga.format(d).replace(",", ""));
/** "16 de noviembre de 2026" */
export const formatFechaCompleta = (d: Date) => fCompleta.format(d);
/** "Noviembre 2026" */
export const formatMes = (d: Date) => mayus(fMes.format(d).replace(" de ", " "));
/** "Nov" */
export const formatMesCorto = (d: Date) => mayus(sinPunto(fMesCorto.format(d)).slice(0, 3));
/** "LUN" */
export const formatDiaSemanaCorto = (d: Date) => sinPunto(fDiaSemanaCorto.format(d)).toUpperCase().slice(0, 3);

/** "Hoy", "Mañana", "Ayer" o "16 nov" */
export function formatDiaRelativo(d: Date, hoy: Date): string {
  const n = diasHasta(d, hoy);
  if (n === 0) return "Hoy";
  if (n === 1) return "Mañana";
  if (n === -1) return "Ayer";
  return formatFechaCorta(d);
}

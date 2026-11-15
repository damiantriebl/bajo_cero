import "server-only";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { EstadoTrabajo, EstadoTurno, TipoTrabajo } from "@/lib/generated/prisma/enums";
import { ahora, leerDb } from "@/lib/db";
import { aInputFecha, finDia, inicioDia, inicioSemana, mismoDia, parseFechaInput, sumarDias } from "@/lib/fechas";
import { saldo, sumaMontos, totalItems } from "@/lib/calculos";

// Consultas de la agenda (turnero). Devuelven objetos ya armados para la pantalla.

/** Una visita (turno) con su trabajo, cliente y técnicos. */
export type Visita = {
  id: string;
  inicio: Date;
  fin: Date;
  estado: EstadoTurno;
  notas: string | null;
  tecnicos: { id: string; nombre: string }[];
  trabajo: { id: string; numero: number; titulo: string; tipo: TipoTrabajo; estado: EstadoTrabajo };
  cliente: { id: string; nombre: string; telefono: string | null };
  /** Dirección del trabajo o, si no tiene, la del cliente. */
  direccion: string | null;
};

export type DiaAgenda = {
  /** "2026-11-16" */
  iso: string;
  fecha: Date;
  esHoy: boolean;
  /** Todas las visitas del día (incluye canceladas), por hora. */
  visitas: Visita[];
  /** Visitas que no están canceladas. */
  cantidad: number;
};

export type TrabajoSinFecha = {
  id: string;
  numero: number;
  titulo: string;
  estado: EstadoTrabajo;
  cliente: string;
  total: number;
  cobrado: number;
  saldo: number;
};

export type Agenda = {
  ahora: Date;
  hoyIso: string;
  /** Día elegido. */
  dia: DiaAgenda;
  /** Lunes a sábado (y domingo si tiene visitas o es el día elegido). */
  semana: DiaAgenda[];
  anterior: { dia: string; semana: string };
  siguiente: { dia: string; semana: string };
  sinFecha: TrabajoSinFecha[];
};

const AGENDABLES: EstadoTrabajo[] = ["APROBADO", "EN_CURSO"];
const CERRADOS: EstadoTrabajo[] = ["COBRADO", "CANCELADO"];

// ───────── Ayudas internas de lib/data (también las usa lib/data/inicio.ts) ─────────

/** Técnicos en el orden en que se cargaron. */
export const ORDEN_EMPLEADOS = [{ createdAt: "asc" }, { nombre: "asc" }] satisfies Prisma.EmpleadoOrderByWithRelationInput[];

/** Visitas por hora (y, a igual hora, por orden de carga). */
export const ORDEN_VISITAS = [{ inicio: "asc" }, { createdAt: "asc" }] satisfies Prisma.TurnoOrderByWithRelationInput[];

/** Lo que hay que leer de un turno para armar una `Visita`. */
export const SELECT_VISITA = {
  id: true,
  inicio: true,
  fin: true,
  estado: true,
  notas: true,
  tecnicos: { select: { id: true, nombre: true }, orderBy: ORDEN_EMPLEADOS },
  trabajo: {
    select: {
      id: true,
      numero: true,
      titulo: true,
      tipo: true,
      estado: true,
      direccion: true,
      cliente: { select: { id: true, nombre: true, telefono: true, direccion: true } },
    },
  },
} satisfies Prisma.TurnoSelect;

type TurnoVisita = Prisma.TurnoGetPayload<{ select: typeof SELECT_VISITA }>;

/** Arma una visita a partir de un turno leído con `SELECT_VISITA`. */
export function aVisita(t: TurnoVisita): Visita {
  const { trabajo } = t;
  const { cliente } = trabajo;
  return {
    id: t.id,
    inicio: t.inicio,
    fin: t.fin,
    estado: t.estado,
    notas: t.notas,
    tecnicos: t.tecnicos,
    trabajo: { id: trabajo.id, numero: trabajo.numero, titulo: trabajo.titulo, tipo: trabajo.tipo, estado: trabajo.estado },
    cliente: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono },
    direccion: trabajo.direccion ?? cliente.direccion,
  };
}

/** Trabajos aprobados o en curso sin ninguna visita (no cancelada) de hoy en adelante. */
export function whereSinFecha(hoy: Date): Prisma.TrabajoWhereInput {
  return {
    estado: { in: AGENDABLES },
    turnos: { none: { inicio: { gte: inicioDia(hoy) }, estado: { not: "CANCELADO" } } },
  };
}

/** Trabajos que esperan fecha, con lo presupuestado y lo cobrado. */
async function trabajosSinFecha(prisma: PrismaClient, hoy: Date): Promise<TrabajoSinFecha[]> {
  const trabajos = await prisma.trabajo.findMany({
    where: whereSinFecha(hoy),
    select: {
      id: true,
      numero: true,
      titulo: true,
      estado: true,
      cliente: { select: { nombre: true } },
      items: { select: { cantidad: true, precioUnitario: true } },
      cobros: { select: { monto: true } },
    },
    orderBy: { numero: "asc" },
  });
  return trabajos.map((t) => {
    const total = totalItems(t.items);
    const cobrado = sumaMontos(t.cobros);
    return {
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      estado: t.estado,
      cliente: t.cliente.nombre,
      total,
      cobrado,
      saldo: saldo(total, cobrado),
    };
  });
}

function armarDia(visitas: Visita[], fecha: Date, hoy: Date): DiaAgenda {
  const delDia = visitas.filter((v) => mismoDia(v.inicio, fecha));
  return {
    iso: aInputFecha(fecha),
    fecha,
    esHoy: mismoDia(fecha, hoy),
    visitas: delDia,
    cantidad: delDia.filter((v) => v.estado !== "CANCELADO").length,
  };
}

// ───────── Consultas ─────────

/** Semana del día elegido (`"2026-11-16"`; si falta o no es válido, hoy). */
export async function obtenerAgenda(dia?: string): Promise<Agenda> {
  const prisma = await leerDb();
  const momento = ahora();
  const hoy = inicioDia(momento);
  const elegido = (dia && parseFechaInput(dia)) || hoy;
  const elegidoIso = aInputFecha(elegido);

  const lunes = inicioSemana(elegido);
  const domingo = sumarDias(lunes, 6);

  const [turnos, sinFecha] = await Promise.all([
    prisma.turno.findMany({
      where: { inicio: { gte: lunes, lte: finDia(domingo) } },
      select: SELECT_VISITA,
      orderBy: ORDEN_VISITAS,
    }),
    trabajosSinFecha(prisma, hoy),
  ]);
  const visitas = turnos.map(aVisita);

  const semana = Array.from({ length: 7 }, (_, i) => armarDia(visitas, sumarDias(lunes, i), hoy)).filter(
    (d, i) => i < 6 || d.cantidad > 0 || d.iso === elegidoIso,
  );
  const diaElegido = semana.find((d) => d.iso === elegidoIso) ?? armarDia(visitas, elegido, hoy);

  return {
    ahora: momento,
    hoyIso: aInputFecha(hoy),
    dia: diaElegido,
    semana,
    anterior: { dia: aInputFecha(sumarDias(elegido, -1)), semana: aInputFecha(sumarDias(elegido, -7)) },
    siguiente: { dia: aInputFecha(sumarDias(elegido, 1)), semana: aInputFecha(sumarDias(elegido, 7)) },
    sinFecha,
  };
}

/** Detalle de una visita, o null si no existe. */
export async function obtenerVisita(id: string): Promise<{ visita: Visita; ahora: Date } | null> {
  const prisma = await leerDb();
  const turno = await prisma.turno.findUnique({ where: { id }, select: SELECT_VISITA });
  return turno ? { visita: aVisita(turno), ahora: ahora() } : null;
}

export type OpcionesTurno = {
  hoyIso: string;
  /** Trabajos que se pueden agendar (ni cobrados ni cancelados), primero los que esperan fecha. */
  trabajos: { id: string; numero: number; cliente: string; titulo: string; sinFecha: boolean }[];
  tecnicos: { id: string; nombre: string; puesto: string }[];
};

/** Lo que necesita el formulario de turno nuevo. */
export async function obtenerOpcionesTurno(): Promise<OpcionesTurno> {
  const prisma = await leerDb();
  const hoy = inicioDia(ahora());

  const [abiertos, esperanFecha, tecnicos] = await Promise.all([
    prisma.trabajo.findMany({
      where: { estado: { notIn: CERRADOS } },
      select: { id: true, numero: true, titulo: true, cliente: { select: { nombre: true } } },
      orderBy: { numero: "desc" },
    }),
    prisma.trabajo.findMany({ where: whereSinFecha(hoy), select: { id: true } }),
    prisma.empleado.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, puesto: true },
      orderBy: ORDEN_EMPLEADOS,
    }),
  ]);

  const esperan = new Set(esperanFecha.map((t) => t.id));
  const trabajos = abiertos
    .map((t) => ({
      id: t.id,
      numero: t.numero,
      cliente: t.cliente.nombre,
      titulo: t.titulo,
      sinFecha: esperan.has(t.id),
    }))
    .sort((a, b) => Number(b.sinFecha) - Number(a.sinFecha) || b.numero - a.numero);

  return { hoyIso: aInputFecha(hoy), trabajos, tecnicos };
}

import "server-only";
import type { Turno } from "@/lib/generated/prisma/client";
import type { EstadoTrabajo, EstadoTurno, TipoTrabajo } from "@/lib/generated/prisma/enums";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
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

/** Arma las visitas de una lista de turnos, ordenadas por hora. */
export function armarVisitas(s: Store, turnos: Turno[]): Visita[] {
  const visitas: Visita[] = [];
  for (const t of [...turnos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    const trabajo = s.trabajos.find((x) => x.id === t.trabajoId);
    const cliente = trabajo && s.clientes.find((c) => c.id === trabajo.clienteId);
    if (!trabajo || !cliente) continue;
    const ids = new Set(s.turnoTecnicos.filter((x) => x.turnoId === t.id).map((x) => x.empleadoId));
    visitas.push({
      id: t.id,
      inicio: t.inicio,
      fin: t.fin,
      estado: t.estado,
      notas: t.notas,
      tecnicos: s.empleados.filter((e) => ids.has(e.id)).map((e) => ({ id: e.id, nombre: e.nombre })),
      trabajo: { id: trabajo.id, numero: trabajo.numero, titulo: trabajo.titulo, tipo: trabajo.tipo, estado: trabajo.estado },
      cliente: { id: cliente.id, nombre: cliente.nombre, telefono: cliente.telefono },
      direccion: trabajo.direccion ?? cliente.direccion,
    });
  }
  return visitas;
}

/** Turnos que empiezan en el día (Argentina) de `dia`. */
export function turnosDelDia(s: Store, dia: Date): Turno[] {
  const desde = inicioDia(dia).getTime();
  const hasta = finDia(dia).getTime();
  return s.turnos.filter((t) => t.inicio.getTime() >= desde && t.inicio.getTime() <= hasta);
}

/** Trabajos aprobados o en curso sin ninguna visita de hoy en adelante. */
export function trabajosSinFecha(s: Store, hoy: Date): TrabajoSinFecha[] {
  const desde = inicioDia(hoy).getTime();
  return s.trabajos
    .filter((t) => AGENDABLES.includes(t.estado))
    .filter((t) => !s.turnos.some((x) => x.trabajoId === t.id && x.estado !== "CANCELADO" && x.inicio.getTime() >= desde))
    .map((t) => {
      const total = totalItems(s.items.filter((i) => i.trabajoId === t.id));
      const cobrado = sumaMontos(s.cobros.filter((c) => c.trabajoId === t.id));
      return {
        id: t.id,
        numero: t.numero,
        titulo: t.titulo,
        estado: t.estado,
        cliente: s.clientes.find((c) => c.id === t.clienteId)?.nombre ?? "",
        total,
        cobrado,
        saldo: saldo(total, cobrado),
      };
    })
    .sort((a, b) => a.numero - b.numero);
}

function armarDia(s: Store, fecha: Date, hoy: Date): DiaAgenda {
  const visitas = armarVisitas(s, turnosDelDia(s, fecha));
  return {
    iso: aInputFecha(fecha),
    fecha,
    esHoy: mismoDia(fecha, hoy),
    visitas,
    cantidad: visitas.filter((v) => v.estado !== "CANCELADO").length,
  };
}

// ───────── Consultas ─────────

/** Semana del día elegido (`"2026-11-16"`; si falta o no es válido, hoy). */
export async function obtenerAgenda(dia?: string): Promise<Agenda> {
  const s = await leerStore();
  const momento = ahora();
  const hoy = inicioDia(momento);
  const elegido = (dia && parseFechaInput(dia)) || hoy;
  const elegidoIso = aInputFecha(elegido);

  const lunes = inicioSemana(elegido);
  const semana = Array.from({ length: 7 }, (_, i) => armarDia(s, sumarDias(lunes, i), hoy)).filter(
    (d, i) => i < 6 || d.cantidad > 0 || d.iso === elegidoIso,
  );
  const diaElegido = semana.find((d) => d.iso === elegidoIso) ?? armarDia(s, elegido, hoy);

  return {
    ahora: momento,
    hoyIso: aInputFecha(hoy),
    dia: diaElegido,
    semana,
    anterior: { dia: aInputFecha(sumarDias(elegido, -1)), semana: aInputFecha(sumarDias(elegido, -7)) },
    siguiente: { dia: aInputFecha(sumarDias(elegido, 1)), semana: aInputFecha(sumarDias(elegido, 7)) },
    sinFecha: trabajosSinFecha(s, hoy),
  };
}

/** Detalle de una visita, o null si no existe. */
export async function obtenerVisita(id: string): Promise<{ visita: Visita; ahora: Date } | null> {
  const s = await leerStore();
  const turno = s.turnos.find((t) => t.id === id);
  const visita = turno ? armarVisitas(s, [turno])[0] : undefined;
  return visita ? { visita, ahora: ahora() } : null;
}

export type OpcionesTurno = {
  hoyIso: string;
  /** Trabajos que se pueden agendar (ni cobrados ni cancelados), primero los que esperan fecha. */
  trabajos: { id: string; numero: number; cliente: string; titulo: string; sinFecha: boolean }[];
  tecnicos: { id: string; nombre: string; puesto: string }[];
};

/** Lo que necesita el formulario de turno nuevo. */
export async function obtenerOpcionesTurno(): Promise<OpcionesTurno> {
  const s = await leerStore();
  const hoy = inicioDia(ahora());
  const esperan = new Set(trabajosSinFecha(s, hoy).map((t) => t.id));
  const trabajos = s.trabajos
    .filter((t) => !CERRADOS.includes(t.estado))
    .map((t) => ({
      id: t.id,
      numero: t.numero,
      cliente: s.clientes.find((c) => c.id === t.clienteId)?.nombre ?? "",
      titulo: t.titulo,
      sinFecha: esperan.has(t.id),
    }))
    .sort((a, b) => Number(b.sinFecha) - Number(a.sinFecha) || b.numero - a.numero);

  return {
    hoyIso: aInputFecha(hoy),
    trabajos,
    tecnicos: s.empleados.filter((e) => e.activo).map((e) => ({ id: e.id, nombre: e.nombre, puesto: e.puesto })),
  };
}

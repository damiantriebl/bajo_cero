"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { Prisma } from "@/lib/generated/prisma/client";
import type { EstadoTurno } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { ORDEN_EMPLEADOS, ORDEN_VISITAS } from "@/lib/data/agenda";
import { datosDe, erroresDeZod, zTexto, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import { aInputFecha, formatFechaLarga, formatHora, parseFechaInput } from "@/lib/fechas";
import { DURACIONES, claveHorario, unirNombres } from "./_components/utilidades";

// ───────── Validación ─────────

const zHorario = z.object({
  fecha: z.string({ error: "Elegí una fecha" }).regex(/^\d{4}-\d{2}-\d{2}$/, "Elegí una fecha"),
  hora: z
    .string({ error: "Poné la hora" })
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Poné la hora"),
  duracion: z
    .string({ error: "Elegí la duración" })
    .refine((v) => DURACIONES.some((d) => String(d.minutos) === v), "Elegí la duración")
    .transform(Number),
});

const zNuevoTurno = zHorario.extend({
  trabajoId: zTexto("Elegí el trabajo"),
  estado: z.enum(["A_CONFIRMAR", "CONFIRMADO"], { error: "Elegí cómo queda el turno" }),
  notas: zTextoOpcional,
});

const zReprogramar = zHorario.extend({ turnoId: zTexto("Falta el turno") });

// ───────── Ayudas ─────────

/** Técnicos tildados que existen y están activos. */
async function tecnicosElegidos(formData: FormData): Promise<string[]> {
  const ids = [...new Set(formData.getAll("tecnicos").filter((v): v is string => typeof v === "string" && v !== ""))];
  if (ids.length === 0) return [];
  const empleados = await db().empleado.findMany({
    where: { id: { in: ids }, activo: true },
    select: { id: true },
    orderBy: ORDEN_EMPLEADOS,
  });
  return empleados.map((e) => e.id);
}

/** Primer turno (no cancelado) que se pisa con el horario y comparte algún técnico. */
async function buscarSuperposicion(d: { inicio: Date; fin: Date; tecnicos: string[]; excluir?: string }): Promise<string | null> {
  if (d.tecnicos.length === 0) return null;
  const turno = await db().turno.findFirst({
    where: {
      ...(d.excluir ? { id: { not: d.excluir } } : {}),
      estado: { not: "CANCELADO" },
      inicio: { lt: d.fin },
      fin: { gt: d.inicio },
      tecnicos: { some: { id: { in: d.tecnicos } } },
    },
    select: {
      inicio: true,
      fin: true,
      tecnicos: {
        where: { id: { in: d.tecnicos } },
        select: { nombre: true },
        orderBy: ORDEN_EMPLEADOS,
      },
      trabajo: { select: { cliente: { select: { nombre: true } } } },
    },
    orderBy: ORDEN_VISITAS,
  });
  if (!turno) return null;

  const comunes = turno.tecnicos.map((t) => t.nombre);
  const verbo = comunes.length > 1 ? "tienen" : "tiene";
  return `${unirNombres(comunes)} ya ${verbo} una visita de ${formatHora(turno.inicio)} a ${formatHora(turno.fin)} (${
    turno.trabajo.cliente.nombre
  }).`;
}

/**
 * Errores de Prisma que puede provocar el usuario (p. ej. alguien borró el
 * trabajo o un técnico mientras se completaba el formulario).
 */
function esFaltaDeRegistro(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    (e.code === "P2025" || e.code === "P2018" || e.code === "P2003")
  );
}

function actualizarPantallas() {
  // La agenda se ve en el inicio, en la ficha del trabajo y del cliente: refrescar todo.
  revalidatePath("/", "layout");
}

// ───────── Turno nuevo ─────────

export async function crearTurno(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const datos = datosDe(formData);
  const r = zNuevoTurno.safeParse(datos);
  if (!r.success) return erroresDeZod(r.error);

  const { fecha, hora, duracion, trabajoId, estado, notas } = r.data;

  const [trabajo, tecnicos] = await Promise.all([
    db().trabajo.findUnique({ where: { id: trabajoId }, select: { estado: true } }),
    tecnicosElegidos(formData),
  ]);
  if (!trabajo || trabajo.estado === "COBRADO" || trabajo.estado === "CANCELADO") {
    return { error: "Revisá los campos marcados.", errores: { trabajoId: "Elegí un trabajo que no esté cobrado ni cancelado" } };
  }

  const inicio = parseFechaInput(fecha, hora);
  if (!inicio) return { error: "Revisá los campos marcados.", errores: { fecha: "Elegí una fecha" } };
  const fin = new Date(inicio.getTime() + duracion * 60_000);

  // Si se pisa con otra visita, avisar una vez; si reenvía igual, se agenda.
  const clave = claveHorario({ fecha: datos.fecha, hora: datos.hora, duracion: datos.duracion, tecnicos, extra: trabajoId });
  if (datos.confirmar !== clave) {
    const choque = await buscarSuperposicion({ inicio, fin, tecnicos });
    if (choque) return { error: choque, errores: { confirmar: clave } };
  }

  try {
    await db().turno.create({
      data: {
        trabajo: { connect: { id: trabajoId } },
        inicio,
        fin,
        estado,
        notas,
        tecnicos: { connect: tecnicos.map((id) => ({ id })) },
      },
      select: { id: true },
    });
  } catch (e) {
    if (esFaltaDeRegistro(e)) {
      return { error: "El trabajo o alguno de los técnicos ya no existe. Recargá la página y probá de nuevo." };
    }
    throw e;
  }

  actualizarPantallas();
  redirect(`/agenda?dia=${aInputFecha(inicio)}`);
}

// ───────── Reprogramar ─────────

export async function reprogramarTurno(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const datos = datosDe(formData);
  const r = zReprogramar.safeParse(datos);
  if (!r.success) return erroresDeZod(r.error);

  const { turnoId, fecha, hora, duracion } = r.data;
  const turno = await db().turno.findUnique({
    where: { id: turnoId },
    select: { estado: true, tecnicos: { select: { id: true } } },
  });
  if (!turno) return { error: "Esta visita ya no existe." };
  if (turno.estado === "REALIZADO") return { error: "La visita ya se hizo: agendá una nueva." };

  const inicio = parseFechaInput(fecha, hora);
  if (!inicio) return { error: "Revisá los campos marcados.", errores: { fecha: "Elegí una fecha" } };
  const fin = new Date(inicio.getTime() + duracion * 60_000);
  const tecnicos = turno.tecnicos.map((t) => t.id);

  const clave = claveHorario({ fecha: datos.fecha, hora: datos.hora, duracion: datos.duracion, tecnicos, extra: turnoId });
  if (datos.confirmar !== clave) {
    const choque = await buscarSuperposicion({ inicio, fin, tecnicos, excluir: turnoId });
    if (choque) return { error: choque, errores: { confirmar: clave } };
  }

  // Un horario nuevo hay que volver a confirmarlo con el cliente.
  // El filtro por estado evita pisar una visita que se marcó realizada mientras tanto.
  const { count } = await db().turno.updateMany({
    where: { id: turnoId, estado: { not: "REALIZADO" } },
    data: { inicio, fin, estado: "A_CONFIRMAR" },
  });
  if (count === 0) {
    return { error: "Esta visita cambió recién (se borró o ya se hizo). Recargá la página para verla." };
  }

  actualizarPantallas();
  refresh();
  return { ok: `Listo: quedó para el ${formatFechaLarga(inicio).toLowerCase()} a las ${formatHora(inicio)}.` };
}

// ───────── Cambios de estado (botones) ─────────

async function cambiarEstado(id: string, estado: EstadoTurno, desde: EstadoTurno[]) {
  // Solo cambia si el turno sigue en uno de los estados de origen (si no existe, no hace nada).
  await db().turno.updateMany({ where: { id, estado: { in: desde } }, data: { estado } });
  actualizarPantallas();
  refresh();
}

export async function confirmarTurno(id: string) {
  await cambiarEstado(id, "CONFIRMADO", ["A_CONFIRMAR"]);
}

export async function marcarRealizado(id: string) {
  await cambiarEstado(id, "REALIZADO", ["A_CONFIRMAR", "CONFIRMADO"]);
}

export async function cancelarTurno(id: string) {
  await cambiarEstado(id, "CANCELADO", ["A_CONFIRMAR", "CONFIRMADO"]);
}

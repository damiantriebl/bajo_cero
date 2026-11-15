"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import type { EstadoTurno } from "@/lib/generated/prisma/enums";
import { storeParaAcciones, type Store } from "@/lib/mock/store";
import { nuevoTurno } from "@/lib/mock/fabricas";
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
function tecnicosElegidos(s: Store, formData: FormData): string[] {
  const ids = new Set(formData.getAll("tecnicos").filter((v): v is string => typeof v === "string"));
  return s.empleados.filter((e) => e.activo && ids.has(e.id)).map((e) => e.id);
}

/** Primer turno (no cancelado) que se pisa con el horario y comparte algún técnico. */
function buscarSuperposicion(
  s: Store,
  d: { inicio: Date; fin: Date; tecnicos: string[]; excluir?: string },
): string | null {
  if (d.tecnicos.length === 0) return null;
  const turno = s.turnos
    .filter((t) => t.id !== d.excluir && t.estado !== "CANCELADO")
    .filter((t) => t.inicio < d.fin && t.fin > d.inicio)
    .find((t) => s.turnoTecnicos.some((x) => x.turnoId === t.id && d.tecnicos.includes(x.empleadoId)));
  if (!turno) return null;

  const comunes = s.turnoTecnicos
    .filter((x) => x.turnoId === turno.id && d.tecnicos.includes(x.empleadoId))
    .map((x) => s.empleados.find((e) => e.id === x.empleadoId)?.nombre)
    .filter((n): n is string => Boolean(n));
  const trabajo = s.trabajos.find((t) => t.id === turno.trabajoId);
  const cliente = trabajo && s.clientes.find((c) => c.id === trabajo.clienteId);
  const verbo = comunes.length > 1 ? "tienen" : "tiene";
  return `${unirNombres(comunes)} ya ${verbo} una visita de ${formatHora(turno.inicio)} a ${formatHora(turno.fin)}${
    cliente ? ` (${cliente.nombre})` : ""
  }.`;
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

  const s = storeParaAcciones();
  const { fecha, hora, duracion, trabajoId, estado, notas } = r.data;

  const trabajo = s.trabajos.find((t) => t.id === trabajoId);
  if (!trabajo || trabajo.estado === "COBRADO" || trabajo.estado === "CANCELADO") {
    return { error: "Revisá los campos marcados.", errores: { trabajoId: "Elegí un trabajo que no esté cobrado ni cancelado" } };
  }

  const inicio = parseFechaInput(fecha, hora);
  if (!inicio) return { error: "Revisá los campos marcados.", errores: { fecha: "Elegí una fecha" } };
  const fin = new Date(inicio.getTime() + duracion * 60_000);
  const tecnicos = tecnicosElegidos(s, formData);

  // Si se pisa con otra visita, avisar una vez; si reenvía igual, se agenda.
  const clave = claveHorario({ fecha: datos.fecha, hora: datos.hora, duracion: datos.duracion, tecnicos, extra: trabajoId });
  if (datos.confirmar !== clave) {
    const choque = buscarSuperposicion(s, { inicio, fin, tecnicos });
    if (choque) return { error: choque, errores: { confirmar: clave } };
  }

  const turno = nuevoTurno({ trabajoId, inicio, fin, estado, notas });
  s.turnos.push(turno);
  tecnicos.forEach((empleadoId) => s.turnoTecnicos.push({ turnoId: turno.id, empleadoId }));

  actualizarPantallas();
  redirect(`/agenda?dia=${aInputFecha(inicio)}`);
}

// ───────── Reprogramar ─────────

export async function reprogramarTurno(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const datos = datosDe(formData);
  const r = zReprogramar.safeParse(datos);
  if (!r.success) return erroresDeZod(r.error);

  const s = storeParaAcciones();
  const { turnoId, fecha, hora, duracion } = r.data;
  const turno = s.turnos.find((t) => t.id === turnoId);
  if (!turno) return { error: "Esta visita ya no existe." };
  if (turno.estado === "REALIZADO") return { error: "La visita ya se hizo: agendá una nueva." };

  const inicio = parseFechaInput(fecha, hora);
  if (!inicio) return { error: "Revisá los campos marcados.", errores: { fecha: "Elegí una fecha" } };
  const fin = new Date(inicio.getTime() + duracion * 60_000);
  const tecnicos = s.turnoTecnicos.filter((x) => x.turnoId === turno.id).map((x) => x.empleadoId);

  const clave = claveHorario({ fecha: datos.fecha, hora: datos.hora, duracion: datos.duracion, tecnicos, extra: turnoId });
  if (datos.confirmar !== clave) {
    const choque = buscarSuperposicion(s, { inicio, fin, tecnicos, excluir: turno.id });
    if (choque) return { error: choque, errores: { confirmar: clave } };
  }

  turno.inicio = inicio;
  turno.fin = fin;
  // Un horario nuevo hay que volver a confirmarlo con el cliente.
  if (turno.estado !== "A_CONFIRMAR") turno.estado = "A_CONFIRMAR";

  actualizarPantallas();
  refresh();
  return { ok: `Listo: quedó para el ${formatFechaLarga(inicio).toLowerCase()} a las ${formatHora(inicio)}.` };
}

// ───────── Cambios de estado (botones) ─────────

async function cambiarEstado(id: string, estado: EstadoTurno, desde: EstadoTurno[]) {
  const s = storeParaAcciones();
  const turno = s.turnos.find((t) => t.id === id);
  if (turno && desde.includes(turno.estado)) turno.estado = estado;
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

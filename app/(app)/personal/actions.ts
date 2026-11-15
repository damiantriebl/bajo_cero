"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { MedioPago } from "@/lib/generated/prisma/enums";
import { finDia, formatFechaCorta, inicioDia } from "@/lib/fechas";
import {
  datosDe,
  erroresDeZod,
  zEnum,
  zFecha,
  zPesos,
  zPesosOpcional,
  zTexto,
  zTextoOpcional,
  type EstadoForm,
} from "@/lib/forms";
import type { EstadoConValores } from "../gastos/_components/estado-form";

/** Código de error de Prisma (P2003, P2025…) o null si es otro tipo de error. */
function codigoPrisma(e: unknown): string | null {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null;
}

// ───────── Alta y edición ─────────

const esquemaEmpleado = z.object({
  nombre: zTexto("Escribí el nombre"),
  puesto: zTexto("Escribí el puesto (técnico, ayudante…)"),
  telefono: zTextoOpcional,
  jornal: zPesosOpcional,
});

export async function crearEmpleado(_prev: EstadoConValores, formData: FormData): Promise<EstadoConValores> {
  const valores = datosDe(formData);
  const r = esquemaEmpleado.safeParse(valores);
  if (!r.success) return { ...erroresDeZod(r.error), valores };

  const e = await db().empleado.create({
    data: { ...r.data, jornal: r.data.jornal ?? 0 },
    select: { id: true },
  });
  // El nombre aparece en Gastos, Más y en los formularios.
  revalidatePath("/", "layout");
  redirect(`/personal/${e.id}`);
}

export async function actualizarEmpleado(
  id: string,
  _prev: EstadoConValores,
  formData: FormData,
): Promise<EstadoConValores> {
  const valores = datosDe(formData);
  const r = esquemaEmpleado.safeParse(valores);
  if (!r.success) return { ...erroresDeZod(r.error), valores };

  try {
    await db().empleado.update({
      where: { id },
      data: { ...r.data, jornal: r.data.jornal ?? 0, activo: formData.get("activo") === "on" },
      select: { id: true },
    });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return { error: "Esta persona ya no existe.", valores };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/personal/${id}`);
}

// ───────── Jornadas (días trabajados) ─────────

const esquemaJornada = z.object({
  fecha: zFecha(),
  monto: zPesos("Poné cuánto se le paga por ese día"),
  horas: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 24), "Poné entre 0 y 24 horas"),
  trabajoId: zTextoOpcional,
  notas: zTextoOpcional,
});

export async function cargarJornada(
  empleadoId: string,
  _prev: EstadoConValores,
  formData: FormData,
): Promise<EstadoConValores> {
  const valores = datosDe(formData);
  const r = esquemaJornada.safeParse(valores);
  if (!r.success) return { ...erroresDeZod(r.error), valores };

  const prisma = db();
  const d = r.data;
  const [empleado, trabajo] = await Promise.all([
    prisma.empleado.findUnique({ where: { id: empleadoId }, select: { id: true } }),
    d.trabajoId ? prisma.trabajo.findUnique({ where: { id: d.trabajoId }, select: { id: true } }) : null,
  ]);
  if (!empleado) return { error: "Esta persona ya no existe.", valores };
  if (d.trabajoId && !trabajo) {
    return { error: "Revisá los campos marcados.", errores: { trabajoId: "Ese trabajo ya no existe" }, valores };
  }

  const yaCargada = {
    error: "Revisá los campos marcados.",
    errores: { fecha: "Ya hay una jornada cargada ese día" },
    valores,
  };

  // Una jornada por día y por persona: se verifica y se inserta en una transacción
  // Serializable. Si dos envíos llegan juntos, Postgres aborta uno (P2034) y se
  // reintenta: el reintento ya ve la jornada del otro y avisa que está repetida.
  const insertarSiNoHay = () =>
    prisma.$transaction(
      async (tx) => {
        const repetida = await tx.jornada.findFirst({
          where: { empleadoId, fecha: { gte: inicioDia(d.fecha), lte: finDia(d.fecha) } },
          select: { id: true },
        });
        if (repetida) return false;
        await tx.jornada.create({
          data: {
            empleadoId,
            fecha: d.fecha,
            monto: d.monto,
            horas: d.horas,
            trabajoId: trabajo?.id ?? null,
            notas: d.notas,
          },
          select: { id: true },
        });
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  let creada: boolean | null = null;
  for (let intento = 1; creada === null; intento++) {
    try {
      creada = await insertarSiNoHay();
    } catch (e) {
      const codigo = codigoPrisma(e);
      if (codigo === "P2034" && intento < 3) continue;
      if (codigo === "P2034") return { error: "Hubo otro cambio al mismo tiempo. Probá de nuevo.", valores };
      if (codigo === "P2003") return { error: "La persona o el trabajo elegido ya no existe.", valores };
      throw e;
    }
  }
  if (!creada) return yaCargada;

  revalidatePath("/", "layout");
  refresh();
  return { ok: `Jornada del ${formatFechaCorta(d.fecha)} cargada.` };
}

export async function eliminarJornada(id: string): Promise<EstadoForm> {
  try {
    await db().jornada.delete({ where: { id }, select: { id: true } });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return { error: "Esa jornada ya no existe." };
    throw e;
  }
  revalidatePath("/", "layout");
  refresh();
  return { ok: "Jornada borrada." };
}

// ───────── Pagos y adelantos (gasto PERSONAL) ─────────

const esquemaPago = z.object({
  concepto: z.enum(["PAGO", "ADELANTO"], { error: "Elegí si es un pago o un adelanto" }),
  monto: zPesos(),
  medio: zEnum(MedioPago, "Elegí cómo le pagaste"),
  fecha: zFecha(),
});

export async function registrarPago(
  empleadoId: string,
  _prev: EstadoConValores,
  formData: FormData,
): Promise<EstadoConValores> {
  const valores = datosDe(formData);
  const r = esquemaPago.safeParse(valores);
  if (!r.success) return { ...erroresDeZod(r.error), valores };

  const prisma = db();
  const e = await prisma.empleado.findUnique({ where: { id: empleadoId }, select: { nombre: true } });
  if (!e) return { error: "Esta persona ya no existe.", valores };
  const { concepto, monto, medio, fecha } = r.data;

  try {
    await prisma.gasto.create({
      data: {
        categoria: "PERSONAL",
        descripcion: `${concepto === "PAGO" ? "Pago" : "Adelanto"} a ${e.nombre}`,
        monto,
        medio,
        fecha,
        empleadoId,
      },
      select: { id: true },
    });
  } catch (err) {
    if (codigoPrisma(err) === "P2003") return { error: "Esta persona ya no existe.", valores };
    throw err;
  }

  revalidatePath("/", "layout");
  refresh();
  return { ok: `${concepto === "PAGO" ? "Pago" : "Adelanto"} del ${formatFechaCorta(fecha)} registrado.` };
}

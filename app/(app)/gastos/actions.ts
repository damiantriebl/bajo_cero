"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { CategoriaGasto, MedioPago } from "@/lib/generated/prisma/enums";
import { aInputFecha } from "@/lib/fechas";
import { datosDe, erroresDeZod, zEnum, zFecha, zPesos, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import type { EstadoConValores } from "./_components/estado-form";

/** Código de error de Prisma (P2003, P2025…) o null si es otro tipo de error. */
function codigoPrisma(e: unknown): string | null {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null;
}

const esquemaGasto = z.object({
  categoria: zEnum(CategoriaGasto, "Elegí en qué fue el gasto"),
  descripcion: zTextoOpcional,
  monto: zPesos(),
  fecha: zFecha(),
  medio: zEnum(MedioPago, "Elegí cómo pagaste"),
  empleadoId: zTextoOpcional,
  trabajoId: zTextoOpcional,
  notas: zTextoOpcional,
});

export async function crearGasto(_prev: EstadoConValores, formData: FormData): Promise<EstadoConValores> {
  const valores = datosDe(formData);
  const r = esquemaGasto.safeParse(valores);
  if (!r.success) return { ...erroresDeZod(r.error), valores };

  const prisma = db();
  const d = r.data;
  const errores: Record<string, string> = {};

  const esPersonal = d.categoria === "PERSONAL";
  const [empleado, trabajo] = await Promise.all([
    esPersonal && d.empleadoId
      ? prisma.empleado.findUnique({ where: { id: d.empleadoId }, select: { id: true, nombre: true } })
      : null,
    d.trabajoId ? prisma.trabajo.findUnique({ where: { id: d.trabajoId }, select: { id: true } }) : null,
  ]);
  if (esPersonal && !empleado) errores.empleadoId = "Elegí a quién le pagaste";
  if (d.trabajoId && !trabajo) errores.trabajoId = "Ese trabajo ya no existe";

  let descripcion = d.descripcion;
  if (!descripcion) {
    if (empleado) descripcion = `Pago a ${empleado.nombre}`;
    else errores.descripcion = "Escribí en qué se gastó";
  }

  if (Object.keys(errores).length > 0 || !descripcion) {
    return { error: "Revisá los campos marcados.", errores, valores };
  }

  try {
    await prisma.gasto.create({
      data: {
        categoria: d.categoria,
        descripcion,
        monto: d.monto,
        fecha: d.fecha,
        medio: d.medio,
        empleadoId: empleado?.id ?? null,
        trabajoId: trabajo?.id ?? null,
        notas: d.notas,
      },
      select: { id: true },
    });
  } catch (e) {
    // La persona o el trabajo se borraron entre la verificación y el alta.
    if (codigoPrisma(e) === "P2003") {
      return { error: "La persona o el trabajo elegido ya no existe. Revisá y probá de nuevo.", valores };
    }
    throw e;
  }

  // Cambia totales de Gastos, Reportes, Personal, Más e Inicio.
  revalidatePath("/", "layout");
  redirect(`/gastos?mes=${aInputFecha(d.fecha).slice(0, 7)}`);
}

export async function eliminarGasto(id: string): Promise<EstadoForm> {
  const prisma = db();
  const gasto = await prisma.gasto.findUnique({ where: { id }, select: { fecha: true, compraId: true } });
  if (!gasto) return { error: "Ese gasto ya no existe." };
  if (gasto.compraId) return { error: "Este gasto es una compra a un proveedor: se borra desde Proveedores." };

  // compraId: null también en el borrado, por si se asoció a una compra mientras tanto.
  // deleteMany devuelve 0 (en vez de tirar P2025) si otro ya lo borró.
  const { count } = await prisma.gasto.deleteMany({ where: { id, compraId: null } });
  if (count === 0) return { error: "Ese gasto ya no existe." };

  revalidatePath("/", "layout");
  redirect(`/gastos?mes=${aInputFecha(gasto.fecha).slice(0, 7)}`);
}

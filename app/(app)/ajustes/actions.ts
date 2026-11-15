"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { EMPRESA_DEFECTO } from "@/lib/empresa-defecto";
import { Prisma } from "@/lib/generated/prisma/client";
import { datosDe, erroresDeZod, zTexto, zTextoOpcional } from "@/lib/forms";
import type { EstadoConValores } from "../gastos/_components/estado-form";

const esquemaEmpresa = z.object({
  razonSocial: zTexto("Escribí la razón social"),
  nombreFantasia: zTexto("Escribí el nombre de fantasía"),
  cuit: zTextoOpcional.refine((v) => v === null || v.replace(/\D/g, "").length === 11, "El CUIT tiene 11 números"),
  telefono: zTextoOpcional,
  email: zTextoOpcional.refine((v) => v === null || z.email().safeParse(v).success, "Revisá el email"),
  direccion: zTextoOpcional,
  condicionesPresupuesto: zTextoOpcional,
  garantia: zTextoOpcional,
  validezPresupuestoDias: z
    .string({ error: "Poné cuántos días vale el presupuesto" })
    .trim()
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v >= 1 && v <= 365, "Poné entre 1 y 365 días"),
});

/** "20123456789" o "20-12345678-9" → "20-12345678-9". */
function formatoCuit(cuit: string): string {
  const d = cuit.replace(/\D/g, "");
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export async function guardarEmpresa(_prev: EstadoConValores, formData: FormData): Promise<EstadoConValores> {
  const valores = datosDe(formData);
  const r = esquemaEmpresa.safeParse(valores);
  if (!r.success) return { ...erroresDeZod(r.error), valores };

  const d = r.data;
  const datos = {
    ...d,
    cuit: d.cuit ? formatoCuit(d.cuit) : null,
    // Respetar los saltos de línea de Windows/Android como "\n".
    condicionesPresupuesto: d.condicionesPresupuesto?.replace(/\r\n/g, "\n") ?? null,
  };

  // Producción arranca sin la fila "empresa": la primera vez se crea, después se actualiza.
  let empresa: { cuit: string | null };
  try {
    empresa = await db().empresa.upsert({
      where: { id: EMPRESA_DEFECTO.id },
      create: { id: EMPRESA_DEFECTO.id, ...datos },
      update: datos,
      select: { cuit: true },
    });
  } catch (e) {
    // Dos guardados a la vez la primera vez: el segundo choca con la fila recién creada.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Se guardó otro cambio al mismo tiempo. Probá de nuevo.", valores };
    }
    throw e;
  }

  refresh();
  return {
    ok: "Guardado. Los próximos presupuestos ya salen con estos datos.",
    valores: { ...valores, cuit: empresa.cuit ?? "" },
  };
}

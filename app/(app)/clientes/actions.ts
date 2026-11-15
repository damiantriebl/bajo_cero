"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { TipoCliente, TipoEquipo } from "@/lib/generated/prisma/enums";
import { db } from "@/lib/db";
import { sumarMeses } from "@/lib/fechas";
import {
  datosDe,
  erroresDeZod,
  zEnum,
  zFechaOpcional,
  zTexto,
  zTextoOpcional,
  type EstadoForm,
} from "@/lib/forms";

const CLIENTE_NO_ENCONTRADO = "No encontramos este cliente. Puede que se haya borrado.";

/**
 * Errores de Prisma que puede provocar el usuario (registro borrado mientras
 * editaba, referencia que ya no existe). Devuelve el mensaje o null si es otro error.
 */
function mensajeDeError(e: unknown, noEncontrado: string): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  // P2025: registro no encontrado. P2003: la referencia (cliente) ya no existe.
  if (e.code === "P2025" || e.code === "P2003") return noEncontrado;
  if (e.code === "P2002") return "Ya hay un registro con esos datos.";
  return null;
}

// ───────── Clientes ─────────

const esquemaCliente = z.object({
  nombre: zTexto("Escribí el nombre del cliente"),
  tipo: zEnum(TipoCliente, "Elegí si es particular, empresa o consorcio"),
  telefono: zTextoOpcional,
  email: zTextoOpcional.refine((v) => v === null || z.email().safeParse(v).success, "Revisá el email"),
  direccion: zTextoOpcional,
  localidad: zTextoOpcional,
  cuit: zTextoOpcional
    .refine((v) => v === null || v.replace(/\D/g, "").length === 11, "El CUIT tiene 11 números")
    .transform((v) => {
      if (v === null) return null;
      const d = v.replace(/\D/g, "");
      return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
    }),
  notas: zTextoOpcional,
});

export async function crearCliente(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaCliente.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  let id: string;
  try {
    ({ id } = await db().cliente.create({ data: r.data, select: { id: true } }));
  } catch (e) {
    const mensaje = mensajeDeError(e, CLIENTE_NO_ENCONTRADO);
    if (mensaje) return { error: mensaje };
    throw e;
  }

  revalidatePath("/clientes");
  redirect(`/clientes/${id}`);
}

export async function editarCliente(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaCliente.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  try {
    // updatedAt lo pone Prisma (@updatedAt). Si el cliente no existe: P2025.
    await db().cliente.update({ where: { id }, data: r.data, select: { id: true } });
  } catch (e) {
    const mensaje = mensajeDeError(e, CLIENTE_NO_ENCONTRADO);
    if (mensaje) return { error: mensaje };
    throw e;
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

// ───────── Equipos del cliente ─────────

const esquemaEquipo = z
  .object({
    tipo: zEnum(TipoEquipo, "Elegí el tipo de equipo"),
    marca: zTextoOpcional,
    modelo: zTextoOpcional,
    frigorias: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? Number(v.replace(/\D/g, "")) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0), "Poné las frigorías en números, por ejemplo 3000"),
    ubicacion: zTextoOpcional,
    fechaInstalacion: zFechaOpcional,
    proximoMantenimiento: zFechaOpcional,
    notas: zTextoOpcional,
  })
  .refine(
    (d) => !d.fechaInstalacion || !d.proximoMantenimiento || d.proximoMantenimiento >= d.fechaInstalacion,
    { message: "El mantenimiento tiene que ser después de la instalación", path: ["proximoMantenimiento"] },
  );

export async function crearEquipo(clienteId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaEquipo.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const cliente = await db().cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) return { error: CLIENTE_NO_ENCONTRADO };

  const d = r.data;
  try {
    await db().equipo.create({
      data: {
        clienteId,
        ...d,
        // Sin fecha de mantenimiento: a un año de la instalación.
        proximoMantenimiento: d.proximoMantenimiento ?? (d.fechaInstalacion ? sumarMeses(d.fechaInstalacion, 12) : null),
      },
      select: { id: true },
    });
  } catch (e) {
    // Por si el cliente se borró entre la verificación y el alta (P2003).
    const mensaje = mensajeDeError(e, CLIENTE_NO_ENCONTRADO);
    if (mensaje) return { error: mensaje };
    throw e;
  }

  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}`);
}

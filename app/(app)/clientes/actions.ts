"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TipoCliente, TipoEquipo } from "@/lib/generated/prisma/enums";
import { nuevoCliente, nuevoEquipo } from "@/lib/mock/fabricas";
import { storeParaAcciones } from "@/lib/mock/store";
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

  const s = storeParaAcciones();
  const cliente = nuevoCliente(r.data);
  s.clientes.push(cliente);

  revalidatePath("/clientes");
  redirect(`/clientes/${cliente.id}`);
}

export async function editarCliente(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaCliente.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const s = storeParaAcciones();
  const cliente = s.clientes.find((c) => c.id === id);
  if (!cliente) return { error: "No encontramos este cliente. Puede que se haya borrado." };

  Object.assign(cliente, r.data, { updatedAt: new Date() });

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

  const s = storeParaAcciones();
  if (!s.clientes.some((c) => c.id === clienteId)) {
    return { error: "No encontramos este cliente. Puede que se haya borrado." };
  }

  const d = r.data;
  s.equipos.push(
    nuevoEquipo({
      clienteId,
      ...d,
      // Sin fecha de mantenimiento: a un año de la instalación.
      proximoMantenimiento: d.proximoMantenimiento ?? (d.fechaInstalacion ? sumarMeses(d.fechaInstalacion, 12) : null),
    }),
  );

  revalidatePath(`/clientes/${clienteId}`);
  redirect(`/clientes/${clienteId}`);
}

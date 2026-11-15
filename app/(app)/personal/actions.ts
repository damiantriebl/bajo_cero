"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { storeParaAcciones } from "@/lib/mock/store";
import { nuevaJornada, nuevoEmpleado, nuevoGasto } from "@/lib/mock/fabricas";
import { MedioPago } from "@/lib/generated/prisma/enums";
import { formatFechaCorta, mismoDia } from "@/lib/fechas";
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

  const e = nuevoEmpleado({ ...r.data, jornal: r.data.jornal ?? 0 });
  storeParaAcciones().empleados.push(e);
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

  const e = storeParaAcciones().empleados.find((x) => x.id === id);
  if (!e) return { error: "Esta persona ya no existe.", valores };
  Object.assign(e, { ...r.data, jornal: r.data.jornal ?? 0, activo: formData.get("activo") === "on" });
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

  const s = storeParaAcciones();
  const d = r.data;
  if (!s.empleados.some((e) => e.id === empleadoId)) return { error: "Esta persona ya no existe.", valores };
  if (d.trabajoId && !s.trabajos.some((t) => t.id === d.trabajoId)) {
    return { error: "Revisá los campos marcados.", errores: { trabajoId: "Ese trabajo ya no existe" }, valores };
  }
  if (s.jornadas.some((j) => j.empleadoId === empleadoId && mismoDia(j.fecha, d.fecha))) {
    return {
      error: "Revisá los campos marcados.",
      errores: { fecha: "Ya hay una jornada cargada ese día" },
      valores,
    };
  }

  s.jornadas.push(nuevaJornada({ empleadoId, ...d }));
  refresh();
  return { ok: `Jornada del ${formatFechaCorta(d.fecha)} cargada.` };
}

export async function eliminarJornada(id: string): Promise<EstadoForm> {
  const s = storeParaAcciones();
  const i = s.jornadas.findIndex((j) => j.id === id);
  if (i === -1) return { error: "Esa jornada ya no existe." };
  s.jornadas.splice(i, 1);
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

  const s = storeParaAcciones();
  const e = s.empleados.find((x) => x.id === empleadoId);
  if (!e) return { error: "Esta persona ya no existe.", valores };
  const { concepto, monto, medio, fecha } = r.data;

  s.gastos.push(
    nuevoGasto({
      categoria: "PERSONAL",
      descripcion: `${concepto === "PAGO" ? "Pago" : "Adelanto"} a ${e.nombre}`,
      monto,
      medio,
      fecha,
      empleadoId,
    }),
  );
  refresh();
  return { ok: `${concepto === "PAGO" ? "Pago" : "Adelanto"} del ${formatFechaCorta(fecha)} registrado.` };
}

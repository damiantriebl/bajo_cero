"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { storeParaAcciones } from "@/lib/mock/store";
import { nuevoGasto } from "@/lib/mock/fabricas";
import { CategoriaGasto, MedioPago } from "@/lib/generated/prisma/enums";
import { aInputFecha } from "@/lib/fechas";
import { datosDe, erroresDeZod, zEnum, zFecha, zPesos, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import type { EstadoConValores } from "./_components/estado-form";

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

  const s = storeParaAcciones();
  const d = r.data;
  const errores: Record<string, string> = {};

  const esPersonal = d.categoria === "PERSONAL";
  const empleado = esPersonal && d.empleadoId ? s.empleados.find((e) => e.id === d.empleadoId) : undefined;
  if (esPersonal && !empleado) errores.empleadoId = "Elegí a quién le pagaste";

  if (d.trabajoId && !s.trabajos.some((t) => t.id === d.trabajoId)) errores.trabajoId = "Ese trabajo ya no existe";

  let descripcion = d.descripcion;
  if (!descripcion) {
    if (empleado) descripcion = `Pago a ${empleado.nombre}`;
    else errores.descripcion = "Escribí en qué se gastó";
  }

  if (Object.keys(errores).length > 0 || !descripcion) {
    return { error: "Revisá los campos marcados.", errores, valores };
  }

  s.gastos.push(
    nuevoGasto({
      categoria: d.categoria,
      descripcion,
      monto: d.monto,
      fecha: d.fecha,
      medio: d.medio,
      empleadoId: empleado?.id ?? null,
      trabajoId: d.trabajoId,
      notas: d.notas,
    }),
  );

  redirect(`/gastos?mes=${aInputFecha(d.fecha).slice(0, 7)}`);
}

export async function eliminarGasto(id: string): Promise<EstadoForm> {
  const s = storeParaAcciones();
  const i = s.gastos.findIndex((g) => g.id === id);
  if (i === -1) return { error: "Ese gasto ya no existe." };
  const gasto = s.gastos[i];
  if (gasto.compraId) return { error: "Este gasto es una compra a un proveedor: se borra desde Proveedores." };
  s.gastos.splice(i, 1);
  redirect(`/gastos?mes=${aInputFecha(gasto.fecha).slice(0, 7)}`);
}

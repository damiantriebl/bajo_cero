"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MedioPago } from "@/lib/generated/prisma/enums";
import { saldoDeTrabajo } from "@/lib/data/cobros";
import { nuevoCobro } from "@/lib/mock/fabricas";
import { storeParaAcciones } from "@/lib/mock/store";
import { finDia, mismoDia } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";
import { datosDe, erroresDeZod, zEnum, zFecha, zPesos, zTexto, zTextoOpcional, type EstadoForm } from "@/lib/forms";

const esquemaCobro = z.object({
  clienteId: zTexto("Elegí el cliente"),
  trabajoId: zTextoOpcional,
  monto: zPesos("Poné cuánto te pagó"),
  fecha: zFecha("Elegí la fecha del cobro"),
  medio: zEnum(MedioPago, "Elegí cómo te pagó"),
  concepto: zTextoOpcional,
  notas: zTextoOpcional,
});

export async function registrarCobro(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaCobro.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const d = r.data;

  const s = storeParaAcciones();
  const ahora = new Date();

  const cliente = s.clientes.find((c) => c.id === d.clienteId);
  if (!cliente) return { errores: { clienteId: "Elegí un cliente de la lista" }, error: "Revisá los campos marcados." };

  if (d.fecha.getTime() > finDia(ahora).getTime()) {
    return { errores: { fecha: "La fecha no puede ser posterior a hoy" }, error: "Revisá los campos marcados." };
  }

  const trabajo = d.trabajoId ? s.trabajos.find((t) => t.id === d.trabajoId) : undefined;
  if (d.trabajoId) {
    if (!trabajo || trabajo.clienteId !== cliente.id) {
      return { errores: { trabajoId: "Ese trabajo no es de este cliente" }, error: "Revisá los campos marcados." };
    }
    if (trabajo.estado === "CANCELADO") {
      return { errores: { trabajoId: "Ese trabajo está cancelado" }, error: "Revisá los campos marcados." };
    }
    const { falta } = saldoDeTrabajo(s, trabajo.id);
    if (d.monto > falta) {
      const mensaje =
        falta === 0
          ? "Este trabajo ya está pagado. Si es otro pago, cargalo sin trabajo asociado."
          : `Al trabajo le faltan ${formatPesos(falta)}. Revisá el monto.`;
      return { errores: { monto: mensaje }, error: "Revisá los campos marcados." };
    }
  }

  s.cobros.push(
    nuevoCobro(
      {
        clienteId: cliente.id,
        trabajoId: trabajo?.id ?? null,
        monto: d.monto,
        // Si es de hoy, guarda también la hora.
        fecha: mismoDia(d.fecha, ahora) ? ahora : d.fecha,
        medio: d.medio,
        concepto: d.concepto,
        notas: d.notas,
      },
      ahora,
    ),
  );

  // Trabajo terminado y pagado del todo: pasa a Cobrado.
  if (trabajo && trabajo.estado === "TERMINADO" && saldoDeTrabajo(s, trabajo.id).falta === 0) {
    trabajo.estado = "COBRADO";
    trabajo.updatedAt = ahora;
  }

  revalidatePath("/", "layout");
  redirect(`/clientes/${cliente.id}`);
}

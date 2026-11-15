"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/lib/generated/prisma/client";
import { MedioPago, type EstadoTrabajo } from "@/lib/generated/prisma/enums";
import { saldoDeTrabajo } from "@/lib/data/cobros";
import { db } from "@/lib/db";
import { saldo } from "@/lib/calculos";
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

const REVISAR = "Revisá los campos marcados.";

/** Errores de Prisma que puede provocar el usuario. Devuelve el mensaje o null si es otro error. */
function mensajeDeError(e: unknown): string | null {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return null;
  // P2003/P2025: el cliente o el trabajo se borró mientras se cargaba el cobro.
  if (e.code === "P2003" || e.code === "P2025") return "No encontramos el cliente o el trabajo. Puede que se haya borrado.";
  // P2034: choque con otro cambio simultáneo; P2028: la transacción no pudo empezar o se cortó.
  if (e.code === "P2034" || e.code === "P2028") return "No pudimos guardar el cobro. Probá de nuevo.";
  return null;
}

export async function registrarCobro(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaCobro.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const d = r.data;

  const ahora = new Date();

  let rechazo: EstadoForm;
  try {
    // Todo en una transacción: validar el saldo, guardar el cobro y, si corresponde,
    // pasar el trabajo a Cobrado. Si algo falla no queda nada a medias.
    rechazo = await db().$transaction(
      async (tx): Promise<EstadoForm> => {
        const cliente = await tx.cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } });
        if (!cliente) return { errores: { clienteId: "Elegí un cliente de la lista" }, error: REVISAR };

        if (d.fecha.getTime() > finDia(ahora).getTime()) {
          return { errores: { fecha: "La fecha no puede ser posterior a hoy" }, error: REVISAR };
        }

        let trabajo: { id: string; clienteId: string; estado: EstadoTrabajo } | null = null;
        let saldoPrevio = { total: 0, pagado: 0 };
        if (d.trabajoId) {
          // Bloquea la fila del trabajo hasta el final de la transacción: si se cargan
          // dos cobros a la vez al mismo trabajo, el segundo espera y valida contra
          // el saldo ya actualizado (así nunca se cobra de más).
          await tx.$queryRaw`SELECT "id" FROM "Trabajo" WHERE "id" = ${d.trabajoId} FOR UPDATE`;
          trabajo = await tx.trabajo.findUnique({
            where: { id: d.trabajoId },
            select: { id: true, clienteId: true, estado: true },
          });
          if (!trabajo || trabajo.clienteId !== cliente.id) {
            return { errores: { trabajoId: "Ese trabajo no es de este cliente" }, error: REVISAR };
          }
          if (trabajo.estado === "CANCELADO") {
            return { errores: { trabajoId: "Ese trabajo está cancelado" }, error: REVISAR };
          }
          const { total, pagado, falta } = await saldoDeTrabajo(tx, trabajo.id);
          if (d.monto > falta) {
            const mensaje =
              falta === 0
                ? "Este trabajo ya está pagado. Si es otro pago, cargalo sin trabajo asociado."
                : `Al trabajo le faltan ${formatPesos(falta)}. Revisá el monto.`;
            return { errores: { monto: mensaje }, error: REVISAR };
          }
          saldoPrevio = { total, pagado };
        }

        await tx.cobro.create({
          data: {
            clienteId: cliente.id,
            trabajoId: trabajo?.id ?? null,
            monto: d.monto,
            // Si es de hoy, guarda también la hora.
            fecha: mismoDia(d.fecha, ahora) ? ahora : d.fecha,
            medio: d.medio,
            concepto: d.concepto,
            notas: d.notas,
          },
          select: { id: true },
        });

        // Trabajo terminado y pagado del todo: pasa a Cobrado. El saldo nuevo sale
        // del leído arriba más este cobro (la fila está bloqueada, nadie más cobró).
        if (trabajo && trabajo.estado === "TERMINADO" && saldo(saldoPrevio.total, saldoPrevio.pagado + d.monto) === 0) {
          await tx.trabajo.update({ where: { id: trabajo.id }, data: { estado: "COBRADO" }, select: { id: true } });
        }

        return null;
      },
      // Margen por si la base de Neon estaba suspendida y tarda en despertar.
      { maxWait: 10_000, timeout: 15_000 },
    );
  } catch (e) {
    const mensaje = mensajeDeError(e);
    if (mensaje) return { error: mensaje };
    throw e;
  }
  if (rechazo) return rechazo;

  revalidatePath("/", "layout");
  redirect(`/clientes/${d.clienteId}`);
}

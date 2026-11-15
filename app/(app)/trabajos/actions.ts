"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { EstadoTrabajo, TipoTrabajo, type Unidad } from "@/lib/generated/prisma/enums";
import { datosDe, erroresDeZod, zCantidad, zEnum, zFechaOpcional, zTexto, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import { saldo, totalItems } from "@/lib/calculos";
import { formatNumero } from "@/lib/formato";
import { UNIDAD } from "@/lib/etiquetas";
import { transicionValida } from "./_components/flujo";

// ───────── Esquemas ─────────

const zItem = z.object({
  descripcion: z.string({ error: "Escribí qué se cobra" }).trim().min(1, "Escribí qué se cobra"),
  cantidad: z.number({ error: "Poné una cantidad" }).positive("La cantidad tiene que ser mayor a cero"),
  unidad: z
    .string()
    .trim()
    .max(20, "Unidad demasiado larga")
    .nullable()
    .transform((v) => (v ? v : null)),
  precioUnitario: z
    .number({ error: "Poné el precio" })
    .int("El precio va sin centavos")
    .min(0, "El precio no puede ser negativo"),
  insumoId: z.string().nullable(),
});

/** Los ítems llegan como JSON en un campo oculto del formulario. */
const zItems = z
  .string({ error: "Agregá al menos un ítem" })
  .transform((v, ctx) => {
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "No pudimos leer los ítems. Probá de nuevo." });
      return z.NEVER;
    }
  })
  .pipe(z.array(zItem).min(1, "Agregá al menos un ítem").max(100, "Demasiados ítems"));

const zDatosTrabajo = z.object({
  titulo: zTexto("Poné un título, por ejemplo: Instalación split 3000 fg"),
  tipo: zEnum(TipoTrabajo, "Elegí el tipo de trabajo"),
  direccion: zTextoOpcional,
  descripcion: zTextoOpcional,
  condiciones: zTextoOpcional,
  validoHasta: zFechaOpcional,
  items: zItems,
});

const zNuevoTrabajo = zDatosTrabajo.extend({ clienteId: zTexto("Elegí el cliente") });

/** Como erroresDeZod, pero además marca cada campo de cada ítem: "items.0.descripcion". */
function erroresTrabajo(error: z.ZodError): NonNullable<EstadoForm> {
  const r = erroresDeZod(error);
  const errores = { ...r.errores };
  for (const issue of error.issues) {
    if (issue.path[0] === "items" && issue.path.length > 2) {
      const clave = issue.path.join(".");
      errores[clave] ??= issue.message;
    }
  }
  return { ...r, errores };
}

type ItemValidado = z.infer<typeof zItem>;

// ───────── Ayudas ─────────

/** Código de error de Prisma (P2003, P2025…) o `undefined` si es otro error. */
function codigoPrisma(e: unknown): string | undefined {
  return e instanceof Prisma.PrismaClientKnownRequestError ? e.code : undefined;
}

const TRABAJO_NO_EXISTE: EstadoForm = { error: "Este trabajo ya no existe." };
const CLIENTE_NO_EXISTE: EstadoForm = {
  error: "Revisá los campos marcados.",
  errores: { clienteId: "Ese cliente ya no existe. Elegí otro." },
};
const MATERIAL_NO_EXISTE: EstadoForm = {
  error: "Revisá los campos marcados.",
  errores: { insumoId: "Ese material ya no existe." },
};

/** De los insumos que mencionan los ítems, los que existen (un ítem con un insumo borrado queda sin insumo). */
async function insumosExistentes(items: ItemValidado[]): Promise<Set<string>> {
  const ids = [...new Set(items.flatMap((i) => (i.insumoId ? [i.insumoId] : [])))];
  if (ids.length === 0) return new Set();
  const filas = await db().insumo.findMany({ where: { id: { in: ids } }, select: { id: true } });
  return new Set(filas.map((f) => f.id));
}

/** Filas de ItemTrabajo en el orden del formulario. */
function filasItems(items: ItemValidado[], insumos: Set<string>) {
  return items.map((it, orden) => ({
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    unidad: it.unidad,
    precioUnitario: it.precioUnitario,
    insumoId: it.insumoId && insumos.has(it.insumoId) ? it.insumoId : null,
    orden,
  }));
}

/** Stock con 3 decimales como máximo (evita restos de punto flotante: 0,30000000004). */
const redondearStock = (n: number) => Math.round(n * 1000) / 1000;

// ───────── Presupuesto: crear y editar ─────────

export async function crearTrabajo(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zNuevoTrabajo.safeParse(datosDe(formData));
  if (!r.success) return erroresTrabajo(r.error);
  const d = r.data;

  const [cliente, insumos] = await Promise.all([
    db().cliente.findUnique({ where: { id: d.clienteId }, select: { id: true } }),
    insumosExistentes(d.items),
  ]);
  if (!cliente) return CLIENTE_NO_EXISTE;

  let id: string;
  try {
    // El número de presupuesto (autoincremental) y la fecha los pone la base.
    const trabajo = await db().trabajo.create({
      data: {
        clienteId: d.clienteId,
        titulo: d.titulo,
        tipo: d.tipo,
        direccion: d.direccion,
        descripcion: d.descripcion,
        condiciones: d.condiciones,
        validoHasta: d.validoHasta,
        items: { create: filasItems(d.items, insumos) },
      },
      select: { id: true },
    });
    id = trabajo.id;
  } catch (e) {
    // Se borró el cliente (o un insumo) entre la verificación y el alta.
    if (codigoPrisma(e) === "P2003") {
      return { error: "El cliente o un material de los ítems ya no existe. Recargá la página y probá de nuevo." };
    }
    throw e;
  }

  redirect(`/trabajos/${id}`);
}

export async function editarTrabajo(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zDatosTrabajo.safeParse(datosDe(formData));
  if (!r.success) return erroresTrabajo(r.error);
  const d = r.data;

  const insumos = await insumosExistentes(d.items);
  try {
    await db().$transaction(async (tx) => {
      // Si el trabajo no existe, update tira P2025 y no se toca nada.
      await tx.trabajo.update({
        where: { id },
        data: {
          titulo: d.titulo,
          tipo: d.tipo,
          direccion: d.direccion,
          descripcion: d.descripcion,
          condiciones: d.condiciones,
          validoHasta: d.validoHasta,
        },
        select: { id: true },
      });
      await tx.itemTrabajo.deleteMany({ where: { trabajoId: id } });
      await tx.itemTrabajo.createMany({ data: filasItems(d.items, insumos).map((f) => ({ ...f, trabajoId: id })) });
    });
  } catch (e) {
    const codigo = codigoPrisma(e);
    if (codigo === "P2025") return TRABAJO_NO_EXISTE;
    if (codigo === "P2003") return { error: "Un material de los ítems ya no existe. Recargá la página y probá de nuevo." };
    throw e;
  }

  redirect(`/trabajos/${id}`);
}

// ───────── Estado ─────────

const zEstado = zEnum(EstadoTrabajo);

/** Avanza (o cancela) un trabajo. Si el cambio no corresponde, solo refresca la pantalla. */
export async function cambiarEstado(id: string, destino: string): Promise<void> {
  const e = zEstado.safeParse(destino);
  if (e.success) {
    const [trabajo, cobros] = await Promise.all([
      db().trabajo.findUnique({
        where: { id },
        select: { estado: true, items: { select: { cantidad: true, precioUnitario: true } } },
      }),
      db().cobro.aggregate({ where: { trabajoId: id }, _sum: { monto: true } }),
    ]);
    const cobrado = cobros._sum.monto ?? 0;
    if (trabajo && transicionValida(trabajo.estado, e.data, saldo(totalItems(trabajo.items), cobrado))) {
      const ahora = new Date();
      // Solo si sigue en el estado que se validó (dos toques seguidos no saltean pasos).
      await db().trabajo.updateMany({
        where: { id, estado: trabajo.estado },
        data: {
          estado: e.data,
          ...(e.data === "APROBADO" && { fechaAprobado: ahora }),
          ...(e.data === "TERMINADO" && { fechaTerminado: ahora }),
        },
      });
    }
  }
  refresh();
}

// ───────── Materiales usados ─────────

const zMaterial = z.object({
  insumoId: zTexto("Elegí el material"),
  cantidad: zCantidad("Poné cuánto usaste"),
});

/** Descuenta el material del stock (puede quedar negativo) y lo carga como costo del trabajo. */
export async function registrarMaterial(trabajoId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zMaterial.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const { insumoId, cantidad } = r.data;

  const [trabajo, existe] = await Promise.all([
    db().trabajo.findUnique({ where: { id: trabajoId }, select: { id: true } }),
    db().insumo.findUnique({ where: { id: insumoId }, select: { id: true } }),
  ]);
  if (!trabajo) return TRABAJO_NO_EXISTE;
  if (!existe) return MATERIAL_NO_EXISTE;

  let insumo: { nombre: string; unidad: Unidad; stock: number };
  try {
    insumo = await db().$transaction(async (tx) => {
      // El update bloquea la fila hasta el commit: el costo que se copia es el
      // vigente y nadie más mueve este stock en el medio.
      const actualizado = await tx.insumo.update({
        where: { id: insumoId },
        data: { stock: { decrement: cantidad } },
        select: { nombre: true, unidad: true, stock: true, costoUnitario: true },
      });
      const stock = redondearStock(actualizado.stock);
      if (stock !== actualizado.stock) {
        await tx.insumo.update({ where: { id: insumoId }, data: { stock }, select: { id: true } });
      }
      await tx.movimientoStock.create({
        data: { insumoId, tipo: "CONSUMO", cantidad: -cantidad, costoUnitario: actualizado.costoUnitario, trabajoId },
        select: { id: true },
      });
      return { nombre: actualizado.nombre, unidad: actualizado.unidad, stock };
    });
  } catch (e) {
    const codigo = codigoPrisma(e);
    if (codigo === "P2025") return MATERIAL_NO_EXISTE;
    if (codigo === "P2003") return TRABAJO_NO_EXISTE;
    throw e;
  }

  refresh();
  const u = UNIDAD[insumo.unidad].corta;
  if (insumo.stock < 0) {
    return {
      ok: `Listo. Ojo: el stock de ${insumo.nombre} quedó en ${formatNumero(insumo.stock)} ${u}. Revisalo en Insumos.`,
    };
  }
  return { ok: `Listo: ${formatNumero(cantidad)} ${u} de ${insumo.nombre}.` };
}

// ───────── Checklist ─────────

export async function alternarPaso(pasoId: string): Promise<void> {
  // NOT en la base: un solo viaje y no se pisa con otro toque al mismo tiempo.
  // Si el paso ya no existe no cambia ninguna fila.
  await db().$executeRaw`UPDATE "ChecklistItem" SET hecho = NOT hecho WHERE id = ${pasoId}`;
  refresh();
}

const zPaso = z.object({ texto: zTexto("Escribí el paso").max(200, "Máximo 200 letras") });

export async function agregarPaso(trabajoId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zPaso.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const [trabajo, ultimo] = await Promise.all([
    db().trabajo.findUnique({ where: { id: trabajoId }, select: { id: true } }),
    db().checklistItem.aggregate({ where: { trabajoId }, _max: { orden: true } }),
  ]);
  if (!trabajo) return TRABAJO_NO_EXISTE;

  try {
    await db().checklistItem.create({
      data: { trabajoId, texto: r.data.texto, orden: (ultimo._max.orden ?? -1) + 1 },
      select: { id: true },
    });
  } catch (e) {
    if (codigoPrisma(e) === "P2003") return TRABAJO_NO_EXISTE;
    throw e;
  }

  refresh();
  return null;
}

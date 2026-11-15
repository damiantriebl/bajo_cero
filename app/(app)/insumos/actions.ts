"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { Unidad } from "@/lib/generated/prisma/enums";
import { datosDe, erroresDeZod, zCantidad, zEnum, zPesosOpcional, zTexto, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import { cantidadUnidad } from "./_components/stock";

const REVISAR = "Revisá los campos marcados.";
const NO_EXISTE = "Este insumo ya no existe.";

/** Cantidad que puede quedar vacía (→ 0). Acepta "2,5" o "2.5". */
const zCantidadOCero = (mensaje: string) =>
  z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t === "" ? 0 : Number(t.replace(",", "."));
    })
    .refine((v) => Number.isFinite(v) && v >= 0, mensaje);

const camposInsumo = {
  nombre: zTexto("Escribí el nombre del insumo"),
  categoria: zTextoOpcional,
  unidad: zEnum(Unidad, "Elegí la unidad"),
  stockMinimo: zCantidadOCero("Poné un número (0 o más)"),
  costoUnitario: zPesosOpcional,
  precioVenta: zPesosOpcional,
  proveedorId: zTextoOpcional,
};

const esquemaNuevo = z.object({ ...camposInsumo, stock: zCantidadOCero("Poné un número (0 o más)") });
const esquemaEditar = z.object(camposInsumo);

/** Evita errores de coma flotante al sumar cantidades (2,5 + 0,1…). */
const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Código de un error conocido de Prisma (P2002, P2003, P2025…) o null. */
const codigoPrisma = (e: unknown) => (e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null);

/** Error del proveedor elegido (no existe o lo borraron mientras se cargaba el formulario). */
const PROVEEDOR_INVALIDO: EstadoForm = { error: REVISAR, errores: { proveedorId: "Elegí un proveedor de la lista" } };

/** El proveedor elegido existe y no hay otro insumo activo con el mismo nombre (sin importar mayúsculas). */
async function validarReferencias(d: { nombre: string; proveedorId: string | null }, idActual?: string): Promise<EstadoForm> {
  const [proveedor, repetido] = await Promise.all([
    d.proveedorId ? db().proveedor.findUnique({ where: { id: d.proveedorId }, select: { id: true } }) : null,
    db().insumo.findFirst({
      where: {
        activo: true,
        nombre: { equals: d.nombre.trim(), mode: "insensitive" },
        ...(idActual && { id: { not: idActual } }),
      },
      select: { id: true },
    }),
  ]);
  if (d.proveedorId && !proveedor) return PROVEEDOR_INVALIDO;
  if (repetido) return { error: REVISAR, errores: { nombre: "Ya tenés un insumo con ese nombre" } };
  return null;
}

export async function crearInsumo(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaNuevo.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const d = r.data;
  const problema = await validarReferencias(d);
  if (problema) return problema;

  const stock = redondear(d.stock);
  const costoUnitario = d.costoUnitario ?? 0;
  let id: string;
  try {
    // Una sola escritura anidada (atómica): el insumo y, si arranca con stock, su movimiento.
    const insumo = await db().insumo.create({
      data: {
        nombre: d.nombre,
        categoria: d.categoria,
        unidad: d.unidad,
        stock,
        stockMinimo: redondear(d.stockMinimo),
        costoUnitario,
        precioVenta: d.precioVenta,
        proveedorId: d.proveedorId,
        // El stock inicial queda en el historial para que la suma de movimientos cierre.
        movimientos: stock > 0 ? { create: { tipo: "AJUSTE", cantidad: stock, costoUnitario, notas: "Stock inicial" } } : undefined,
      },
      select: { id: true },
    });
    id = insumo.id;
  } catch (e) {
    if (codigoPrisma(e) === "P2003") return PROVEEDOR_INVALIDO;
    throw e;
  }

  revalidatePath("/insumos");
  redirect(`/insumos/${id}`);
}

export async function editarInsumo(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaEditar.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const d = r.data;

  const [existe, problema] = await Promise.all([
    db().insumo.findUnique({ where: { id }, select: { id: true } }),
    validarReferencias(d, id),
  ]);
  if (!existe) return { error: NO_EXISTE };
  if (problema) return problema;

  try {
    await db().insumo.update({
      where: { id },
      data: {
        nombre: d.nombre,
        categoria: d.categoria,
        unidad: d.unidad,
        stockMinimo: redondear(d.stockMinimo),
        costoUnitario: d.costoUnitario ?? 0,
        precioVenta: d.precioVenta,
        proveedorId: d.proveedorId,
      },
      select: { id: true },
    });
  } catch (e) {
    const codigo = codigoPrisma(e);
    if (codigo === "P2025") return { error: NO_EXISTE };
    if (codigo === "P2003") return PROVEEDOR_INVALIDO;
    throw e;
  }

  revalidatePath("/insumos");
  redirect(`/insumos/${id}`);
}

const esquemaAjuste = z.object({
  sentido: z.enum(["sumar", "restar"], { error: "Elegí si sumás o restás" }),
  cantidad: zCantidad("Poné cuánto"),
  motivo: zTexto("Contá el motivo (conteo, rotura, devolución…)"),
});

/** Ajuste manual: MovimientoStock AJUSTE con cantidad con signo. */
export async function ajustarStock(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaAjuste.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const { sentido, cantidad, motivo } = r.data;
  const cambio = redondear(sentido === "sumar" ? cantidad : -cantidad);

  let resultado: EstadoForm;
  try {
    // Serializable: si dos ajustes del mismo insumo se cruzan, uno falla (P2034) en vez de
    // dejar el stock bajo cero. El control de "no alcanza" lee el stock dentro de la transacción.
    resultado = await db().$transaction(
      async (tx): Promise<EstadoForm> => {
        const insumo = await tx.insumo.findUnique({ where: { id }, select: { stock: true, unidad: true, costoUnitario: true } });
        if (!insumo) return { error: NO_EXISTE };
        if (redondear(insumo.stock + cambio) < 0) {
          return {
            error: REVISAR,
            errores: { cantidad: `Hay ${cantidadUnidad(insumo.stock, insumo.unidad)}: no podés restar más que eso` },
          };
        }

        await tx.movimientoStock.create({
          data: { insumoId: id, tipo: "AJUSTE", cantidad: cambio, costoUnitario: insumo.costoUnitario, notas: motivo },
          select: { id: true },
        });
        const actualizado = await tx.insumo.update({
          where: { id },
          data: { stock: { increment: cambio } },
          select: { stock: true },
        });
        return { ok: `Listo: ahora hay ${cantidadUnidad(redondear(actualizado.stock), insumo.unidad)}.` };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (e) {
    const codigo = codigoPrisma(e);
    if (codigo === "P2025") return { error: NO_EXISTE };
    if (codigo === "P2034") return { error: "Justo se modificó el stock de este insumo. Probá de nuevo." };
    throw e;
  }

  if (resultado?.ok) {
    revalidatePath("/insumos");
    refresh();
  }
  return resultado;
}

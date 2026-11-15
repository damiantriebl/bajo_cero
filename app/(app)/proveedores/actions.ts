"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { MedioPago } from "@/lib/generated/prisma/enums";
import { totalItems } from "@/lib/calculos";
import { mismoDia } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";
import {
  datosDe,
  erroresDeZod,
  zCantidad,
  zEnum,
  zFecha,
  zFechaOpcional,
  zPesos,
  zTexto,
  zTextoOpcional,
  type EstadoForm,
} from "@/lib/forms";

const REVISAR = "Revisá los campos marcados.";
const NO_EXISTE = "Este proveedor ya no existe.";
const NOMBRE_REPETIDO: EstadoForm = { error: REVISAR, errores: { nombre: "Ya tenés un proveedor con ese nombre" } };

/** Si la fecha elegida es hoy, guardamos la hora actual para que quede ordenada. */
const conHora = (fecha: Date, ahora: Date) => (mismoDia(fecha, ahora) ? ahora : fecha);

const redondear = (n: number) => Math.round(n * 1000) / 1000;

/** Código de un error conocido de Prisma (P2002, P2003, P2025…) o null. */
const codigoPrisma = (e: unknown) => (e instanceof Prisma.PrismaClientKnownRequestError ? e.code : null);

// ───────── Alta y edición ─────────

const esquemaProveedor = z.object({
  nombre: zTexto("Escribí el nombre del proveedor"),
  rubro: zTextoOpcional,
  contacto: zTextoOpcional,
  telefono: zTextoOpcional,
  email: zTextoOpcional.refine((v) => v === null || z.email().safeParse(v).success, "Revisá el email"),
  cuit: zTextoOpcional.refine((v) => v === null || v.replace(/\D/g, "").length === 11, "El CUIT tiene 11 números"),
  direccion: zTextoOpcional,
  notas: zTextoOpcional,
});

/** ¿Hay otro proveedor con el mismo nombre (sin importar mayúsculas)? */
async function nombreRepetido(nombre: string, idActual?: string): Promise<boolean> {
  const otro = await db().proveedor.findFirst({
    where: {
      nombre: { equals: nombre.trim(), mode: "insensitive" },
      ...(idActual && { id: { not: idActual } }),
    },
    select: { id: true },
  });
  return otro !== null;
}

export async function crearProveedor(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaProveedor.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  if (await nombreRepetido(r.data.nombre)) return NOMBRE_REPETIDO;

  const proveedor = await db().proveedor.create({ data: r.data, select: { id: true } });

  revalidatePath("/proveedores");
  redirect(`/proveedores/${proveedor.id}`);
}

export async function editarProveedor(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaProveedor.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const [existe, repetido] = await Promise.all([
    db().proveedor.findUnique({ where: { id }, select: { id: true } }),
    nombreRepetido(r.data.nombre, id),
  ]);
  if (!existe) return { error: NO_EXISTE };
  if (repetido) return NOMBRE_REPETIDO;

  try {
    await db().proveedor.update({ where: { id }, data: r.data, select: { id: true } });
  } catch (e) {
    if (codigoPrisma(e) === "P2025") return { error: NO_EXISTE };
    throw e;
  }

  revalidatePath("/proveedores");
  redirect(`/proveedores/${id}`);
}

// ───────── Pagos ─────────

const esquemaPago = z.object({
  monto: zPesos(),
  fecha: zFecha(),
  medio: zEnum(MedioPago, "Elegí cómo pagaste"),
  notas: zTextoOpcional,
});

/**
 * Pago a un proveedor. No genera Gasto: el gasto ya se registró con la compra.
 * El formulario no elige factura, así que queda "a cuenta" (sin compraId) y se
 * imputa a las compras más viejas primero.
 */
export async function registrarPago(proveedorId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaPago.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const proveedor = await db().proveedor.findUnique({ where: { id: proveedorId }, select: { id: true } });
  if (!proveedor) return { error: NO_EXISTE };

  try {
    await db().pagoProveedor.create({
      data: { proveedorId, monto: r.data.monto, fecha: conHora(r.data.fecha, new Date()), medio: r.data.medio, notas: r.data.notas },
      select: { id: true },
    });
  } catch (e) {
    if (codigoPrisma(e) === "P2003") return { error: NO_EXISTE };
    throw e;
  }

  revalidatePath("/proveedores");
  refresh();
  return { ok: `Pago de ${formatPesos(r.data.monto)} registrado.` };
}

// ───────── Compras ─────────

/** Cada fila del editor de ítems (llega como JSON en el campo oculto "items"). */
const esquemaItem = z
  .object({
    insumoId: z
      .string()
      .nullish()
      .transform((v) => v || null),
    descripcion: z
      .string()
      .nullish()
      .transform((v) => (v ?? "").trim()),
    cantidad: zCantidad("Poné la cantidad"),
    precioUnitario: zPesos("Poné el precio"),
  })
  .refine((i) => i.insumoId || i.descripcion, { message: "Elegí un insumo o escribí qué compraste", path: ["descripcion"] });

const esquemaItems = z.array(esquemaItem).min(1, "Agregá al menos un ítem");

const esquemaCompra = z
  .object({
    fecha: zFecha("Elegí la fecha de la compra"),
    numeroFactura: zTextoOpcional,
    vencimiento: zFechaOpcional,
    pagada: z
      .string()
      .optional()
      .transform((v) => v === "on"),
    medio: zEnum(MedioPago, "Elegí cómo pagaste").optional(),
    notas: zTextoOpcional,
  })
  .refine((d) => !d.pagada || d.medio, { message: "Elegí cómo pagaste", path: ["medio"] })
  .refine((d) => !d.vencimiento || d.vencimiento.getTime() >= d.fecha.getTime(), {
    message: "No puede vencer antes de la fecha de compra",
    path: ["vencimiento"],
  });

/**
 * Carga una compra en UNA transacción: Compra + ítems; por cada ítem con insumo,
 * MovimientoStock COMPRA (+stock y nuevo costo); un Gasto MATERIALES por el total;
 * y si se pagó en el momento, el PagoProveedor por el total atado a la compra.
 */
export async function cargarCompra(proveedorId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const datos = datosDe(formData);
  const r = esquemaCompra.safeParse(datos);

  let crudo: unknown;
  try {
    crudo = JSON.parse(datos.items ?? "[]");
  } catch {
    crudo = null;
  }
  const ri = esquemaItems.safeParse(crudo);

  if (!r.success || !ri.success) {
    const estado = r.success ? { errores: {} as Record<string, string>, error: REVISAR } : erroresDeZod(r.error);
    const errores = { ...(estado.errores ?? {}) };
    if (!ri.success) {
      for (const issue of ri.error.issues) {
        const clave = issue.path.length ? `items.${issue.path.join(".")}` : "items";
        errores[clave] ??= issue.message;
      }
    }
    return { errores, error: estado.error ?? REVISAR };
  }

  const items = ri.data;
  const idsInsumos = [...new Set(items.map((i) => i.insumoId).filter((id): id is string => id !== null))];
  const [proveedor, insumos] = await Promise.all([
    db().proveedor.findUnique({ where: { id: proveedorId }, select: { nombre: true } }),
    idsInsumos.length > 0 ? db().insumo.findMany({ where: { id: { in: idsInsumos } }, select: { id: true, nombre: true } }) : [],
  ]);
  if (!proveedor) return { error: NO_EXISTE };

  const nombreInsumo = new Map(insumos.map((i) => [i.id, i.nombre]));
  for (const [n, item] of items.entries()) {
    if (item.insumoId && !nombreInsumo.has(item.insumoId)) {
      return { error: REVISAR, errores: { [`items.${n}.insumoId`]: "Ese insumo ya no existe: elegí otro" } };
    }
  }

  const d = r.data;
  const fecha = conHora(d.fecha, new Date());
  const total = totalItems(items);
  const conInsumo = items.filter((i): i is typeof i & { insumoId: string } => i.insumoId !== null);

  // Un update por insumo: si aparece en varias filas se suman las cantidades y queda el último precio.
  const porInsumo = new Map<string, { cantidad: number; precioUnitario: number }>();
  for (const i of conInsumo) {
    const previo = porInsumo.get(i.insumoId);
    porInsumo.set(i.insumoId, { cantidad: (previo?.cantidad ?? 0) + i.cantidad, precioUnitario: i.precioUnitario });
  }

  try {
    await db().$transaction(
      async (tx) => {
        await tx.compra.create({
          data: {
            proveedorId,
            fecha,
            total,
            numeroFactura: d.numeroFactura,
            vencimiento: d.pagada ? null : d.vencimiento,
            notas: d.notas,
            items: {
              createMany: {
                data: items.map((i) => ({
                  descripcion: i.descripcion || (i.insumoId && nombreInsumo.get(i.insumoId)) || "Ítem",
                  cantidad: i.cantidad,
                  precioUnitario: i.precioUnitario,
                  insumoId: i.insumoId,
                })),
              },
            },
            ...(conInsumo.length > 0 && {
              movimientos: {
                createMany: {
                  data: conInsumo.map((i) => ({
                    insumoId: i.insumoId,
                    tipo: "COMPRA" as const,
                    cantidad: i.cantidad,
                    costoUnitario: i.precioUnitario,
                    fecha,
                  })),
                },
              },
            }),
            gasto: {
              create: {
                categoria: "MATERIALES",
                descripcion: `Compra a ${proveedor.nombre}`,
                monto: total,
                fecha,
                proveedorId,
                medio: d.pagada && d.medio ? d.medio : "TRANSFERENCIA",
              },
            },
            ...(d.pagada &&
              d.medio && {
                pagos: {
                  create: {
                    proveedorId,
                    monto: total,
                    fecha,
                    medio: d.medio,
                    notas: d.numeroFactura ? `Factura ${d.numeroFactura}` : "Pagada al comprar",
                  },
                },
              }),
          },
          select: { id: true },
        });

        for (const [insumoId, c] of porInsumo) {
          await tx.insumo.update({
            where: { id: insumoId },
            data: { stock: { increment: redondear(c.cantidad) }, costoUnitario: c.precioUnitario },
            select: { id: true },
          });
        }
      },
      // Varias escrituras seguidas: margen por si la base está "despertando" (Neon).
      { maxWait: 10_000, timeout: 20_000 },
    );
  } catch (e) {
    const codigo = codigoPrisma(e);
    if (codigo === "P2025") return { error: "Uno de los insumos ya no existe. Revisá los ítems y probá de nuevo." };
    if (codigo === "P2003") return { error: "El proveedor o alguno de los insumos ya no existe. Revisá y probá de nuevo." };
    throw e;
  }

  revalidatePath("/proveedores");
  revalidatePath("/insumos");
  redirect(`/proveedores/${proveedorId}`);
}

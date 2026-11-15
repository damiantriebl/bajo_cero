"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { storeParaAcciones } from "@/lib/mock/store";
import { nuevaCompra, nuevoGasto, nuevoItemCompra, nuevoMovimiento, nuevoPagoProveedor, nuevoProveedor } from "@/lib/mock/fabricas";
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

/** Si la fecha elegida es hoy, guardamos la hora actual para que quede ordenada. */
const conHora = (fecha: Date, ahora: Date) => (mismoDia(fecha, ahora) ? ahora : fecha);

const redondear = (n: number) => Math.round(n * 1000) / 1000;

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

function nombreRepetido(nombre: string, idActual?: string): boolean {
  const n = nombre.trim().toLowerCase();
  return storeParaAcciones().proveedores.some((p) => p.id !== idActual && p.nombre.trim().toLowerCase() === n);
}

export async function crearProveedor(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaProveedor.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  if (nombreRepetido(r.data.nombre)) return { error: REVISAR, errores: { nombre: "Ya tenés un proveedor con ese nombre" } };

  const proveedor = nuevoProveedor(r.data, new Date());
  storeParaAcciones().proveedores.push(proveedor);

  revalidatePath("/proveedores");
  redirect(`/proveedores/${proveedor.id}`);
}

export async function editarProveedor(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaProveedor.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const proveedor = storeParaAcciones().proveedores.find((p) => p.id === id);
  if (!proveedor) return { error: "Este proveedor ya no existe." };
  if (nombreRepetido(r.data.nombre, id)) return { error: REVISAR, errores: { nombre: "Ya tenés un proveedor con ese nombre" } };

  Object.assign(proveedor, r.data);

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

/** Pago a un proveedor. No genera Gasto: el gasto ya se registró con la compra. */
export async function registrarPago(proveedorId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaPago.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const s = storeParaAcciones();
  if (!s.proveedores.some((p) => p.id === proveedorId)) return { error: "Este proveedor ya no existe." };

  const ahora = new Date();
  s.pagosProveedor.push(
    nuevoPagoProveedor({ proveedorId, monto: r.data.monto, fecha: conHora(r.data.fecha, ahora), medio: r.data.medio, notas: r.data.notas }, ahora),
  );

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
 * Carga una compra: Compra + ítems; por cada ítem con insumo, MovimientoStock COMPRA
 * (+stock y nuevo costo); un Gasto MATERIALES por el total; y si se pagó en el
 * momento, el PagoProveedor por el total.
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

  const s = storeParaAcciones();
  const proveedor = s.proveedores.find((p) => p.id === proveedorId);
  if (!proveedor) return { error: "Este proveedor ya no existe." };

  const items = ri.data;
  for (const [n, item] of items.entries()) {
    if (item.insumoId && !s.insumos.some((i) => i.id === item.insumoId)) {
      return { error: REVISAR, errores: { [`items.${n}.insumoId`]: "Ese insumo ya no existe: elegí otro" } };
    }
  }

  const d = r.data;
  const ahora = new Date();
  const fecha = conHora(d.fecha, ahora);
  const total = totalItems(items);

  const compra = nuevaCompra(
    { proveedorId, fecha, total, numeroFactura: d.numeroFactura, vencimiento: d.pagada ? null : d.vencimiento, notas: d.notas },
    ahora,
  );
  s.compras.push(compra);

  for (const item of items) {
    const insumo = item.insumoId ? s.insumos.find((i) => i.id === item.insumoId) : undefined;
    s.itemsCompra.push(
      nuevoItemCompra({
        compraId: compra.id,
        descripcion: item.descripcion || insumo?.nombre || "Ítem",
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        insumoId: insumo?.id ?? null,
      }),
    );
    if (insumo) {
      s.movimientos.push(
        nuevoMovimiento(
          { insumoId: insumo.id, tipo: "COMPRA", cantidad: item.cantidad, costoUnitario: item.precioUnitario, compraId: compra.id, fecha },
          ahora,
        ),
      );
      insumo.stock = redondear(insumo.stock + item.cantidad);
      insumo.costoUnitario = item.precioUnitario;
    }
  }

  s.gastos.push(
    nuevoGasto(
      {
        categoria: "MATERIALES",
        descripcion: `Compra a ${proveedor.nombre}`,
        monto: total,
        fecha,
        proveedorId,
        compraId: compra.id,
        medio: d.pagada && d.medio ? d.medio : "TRANSFERENCIA",
      },
      ahora,
    ),
  );

  if (d.pagada && d.medio) {
    s.pagosProveedor.push(
      nuevoPagoProveedor(
        { proveedorId, compraId: compra.id, monto: total, fecha, medio: d.medio, notas: d.numeroFactura ? `Factura ${d.numeroFactura}` : "Pagada al comprar" },
        ahora,
      ),
    );
  }

  revalidatePath("/proveedores");
  revalidatePath("/insumos");
  redirect(`/proveedores/${proveedorId}`);
}

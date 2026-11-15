"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { storeParaAcciones } from "@/lib/mock/store";
import { nuevoInsumo, nuevoMovimiento } from "@/lib/mock/fabricas";
import { Unidad } from "@/lib/generated/prisma/enums";
import { datosDe, erroresDeZod, zCantidad, zEnum, zPesosOpcional, zTexto, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import { cantidadUnidad } from "./_components/stock";

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

const mismoNombre = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function validarReferencias(d: { nombre: string; proveedorId: string | null }, idActual?: string): EstadoForm {
  const s = storeParaAcciones();
  if (d.proveedorId && !s.proveedores.some((p) => p.id === d.proveedorId)) {
    return { error: "Revisá los campos marcados.", errores: { proveedorId: "Elegí un proveedor de la lista" } };
  }
  if (s.insumos.some((i) => i.activo && i.id !== idActual && mismoNombre(i.nombre, d.nombre))) {
    return { error: "Revisá los campos marcados.", errores: { nombre: "Ya tenés un insumo con ese nombre" } };
  }
  return null;
}

export async function crearInsumo(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaNuevo.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const d = r.data;
  const problema = validarReferencias(d);
  if (problema) return problema;

  const s = storeParaAcciones();
  const ahora = new Date();
  const insumo = nuevoInsumo(
    {
      nombre: d.nombre,
      categoria: d.categoria,
      unidad: d.unidad,
      stock: redondear(d.stock),
      stockMinimo: redondear(d.stockMinimo),
      costoUnitario: d.costoUnitario ?? 0,
      precioVenta: d.precioVenta,
      proveedorId: d.proveedorId,
    },
    ahora,
  );
  s.insumos.push(insumo);
  // El stock inicial queda en el historial para que la suma de movimientos cierre.
  if (insumo.stock > 0) {
    s.movimientos.push(
      nuevoMovimiento(
        { insumoId: insumo.id, tipo: "AJUSTE", cantidad: insumo.stock, costoUnitario: insumo.costoUnitario, notas: "Stock inicial", fecha: ahora },
        ahora,
      ),
    );
  }

  revalidatePath("/insumos");
  redirect(`/insumos/${insumo.id}`);
}

export async function editarInsumo(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = esquemaEditar.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);
  const d = r.data;

  const s = storeParaAcciones();
  const insumo = s.insumos.find((i) => i.id === id);
  if (!insumo) return { error: "Este insumo ya no existe." };
  const problema = validarReferencias(d, id);
  if (problema) return problema;

  insumo.nombre = d.nombre;
  insumo.categoria = d.categoria;
  insumo.unidad = d.unidad;
  insumo.stockMinimo = redondear(d.stockMinimo);
  insumo.costoUnitario = d.costoUnitario ?? 0;
  insumo.precioVenta = d.precioVenta;
  insumo.proveedorId = d.proveedorId;

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

  const s = storeParaAcciones();
  const insumo = s.insumos.find((i) => i.id === id);
  if (!insumo) return { error: "Este insumo ya no existe." };

  const cambio = sentido === "sumar" ? cantidad : -cantidad;
  const nuevoStock = redondear(insumo.stock + cambio);
  if (nuevoStock < 0) {
    return {
      error: "Revisá los campos marcados.",
      errores: { cantidad: `Hay ${cantidadUnidad(insumo.stock, insumo.unidad)}: no podés restar más que eso` },
    };
  }

  const ahora = new Date();
  s.movimientos.push(
    nuevoMovimiento(
      { insumoId: id, tipo: "AJUSTE", cantidad: redondear(cambio), costoUnitario: insumo.costoUnitario, notas: motivo, fecha: ahora },
      ahora,
    ),
  );
  insumo.stock = nuevoStock;

  revalidatePath("/insumos");
  refresh();
  return { ok: `Listo: ahora hay ${cantidadUnidad(nuevoStock, insumo.unidad)}.` };
}

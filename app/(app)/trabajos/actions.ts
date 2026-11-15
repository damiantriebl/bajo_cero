"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { siguienteNumeroTrabajo, storeParaAcciones, type Store } from "@/lib/mock/store";
import { nuevoChecklistItem, nuevoItemTrabajo, nuevoMovimiento, nuevoTrabajo } from "@/lib/mock/fabricas";
import { EstadoTrabajo, TipoTrabajo } from "@/lib/generated/prisma/enums";
import { datosDe, erroresDeZod, zCantidad, zEnum, zFechaOpcional, zTexto, zTextoOpcional, type EstadoForm } from "@/lib/forms";
import { saldo, sumaMontos, totalItems } from "@/lib/calculos";
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

function guardarItems(s: Store, trabajoId: string, items: ItemValidado[]) {
  const insumos = new Set(s.insumos.map((i) => i.id));
  items.forEach((it, orden) =>
    s.items.push(
      nuevoItemTrabajo({
        trabajoId,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        unidad: it.unidad,
        precioUnitario: it.precioUnitario,
        insumoId: it.insumoId && insumos.has(it.insumoId) ? it.insumoId : null,
        orden,
      }),
    ),
  );
}

// ───────── Presupuesto: crear y editar ─────────

export async function crearTrabajo(_prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zNuevoTrabajo.safeParse(datosDe(formData));
  if (!r.success) return erroresTrabajo(r.error);
  const d = r.data;

  const s = storeParaAcciones();
  if (!s.clientes.some((c) => c.id === d.clienteId)) {
    return { error: "Revisá los campos marcados.", errores: { clienteId: "Ese cliente ya no existe. Elegí otro." } };
  }

  const ahora = new Date();
  const trabajo = nuevoTrabajo(
    {
      clienteId: d.clienteId,
      numero: siguienteNumeroTrabajo(s),
      titulo: d.titulo,
      tipo: d.tipo,
      direccion: d.direccion,
      descripcion: d.descripcion,
      condiciones: d.condiciones,
      validoHasta: d.validoHasta,
      fechaPresupuesto: ahora,
    },
    ahora,
  );
  s.trabajos.push(trabajo);
  guardarItems(s, trabajo.id, d.items);

  redirect(`/trabajos/${trabajo.id}`);
}

export async function editarTrabajo(id: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zDatosTrabajo.safeParse(datosDe(formData));
  if (!r.success) return erroresTrabajo(r.error);
  const d = r.data;

  const s = storeParaAcciones();
  const trabajo = s.trabajos.find((t) => t.id === id);
  if (!trabajo) return { error: "Este trabajo ya no existe." };

  Object.assign(trabajo, {
    titulo: d.titulo,
    tipo: d.tipo,
    direccion: d.direccion,
    descripcion: d.descripcion,
    condiciones: d.condiciones,
    validoHasta: d.validoHasta,
    updatedAt: new Date(),
  });
  s.items = s.items.filter((i) => i.trabajoId !== id);
  guardarItems(s, id, d.items);

  redirect(`/trabajos/${id}`);
}

// ───────── Estado ─────────

const zEstado = zEnum(EstadoTrabajo);

/** Avanza (o cancela) un trabajo. Si el cambio no corresponde, solo refresca la pantalla. */
export async function cambiarEstado(id: string, destino: string): Promise<void> {
  const s = storeParaAcciones();
  const trabajo = s.trabajos.find((t) => t.id === id);
  const e = zEstado.safeParse(destino);
  if (trabajo && e.success) {
    const total = totalItems(s.items.filter((i) => i.trabajoId === id));
    const cobrado = sumaMontos(s.cobros.filter((c) => c.trabajoId === id));
    if (transicionValida(trabajo.estado, e.data, saldo(total, cobrado))) {
      const ahora = new Date();
      trabajo.estado = e.data;
      trabajo.updatedAt = ahora;
      if (e.data === "APROBADO") trabajo.fechaAprobado = ahora;
      if (e.data === "TERMINADO") trabajo.fechaTerminado = ahora;
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

  const s = storeParaAcciones();
  if (!s.trabajos.some((t) => t.id === trabajoId)) return { error: "Este trabajo ya no existe." };
  const insumo = s.insumos.find((i) => i.id === r.data.insumoId);
  if (!insumo) return { error: "Revisá los campos marcados.", errores: { insumoId: "Ese material ya no existe." } };

  const ahora = new Date();
  const cantidad = r.data.cantidad;
  s.movimientos.push(
    nuevoMovimiento(
      { insumoId: insumo.id, tipo: "CONSUMO", cantidad: -cantidad, costoUnitario: insumo.costoUnitario, trabajoId, fecha: ahora },
      ahora,
    ),
  );
  insumo.stock = Math.round((insumo.stock - cantidad) * 1000) / 1000;

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
  const s = storeParaAcciones();
  const paso = s.checklist.find((c) => c.id === pasoId);
  if (paso) paso.hecho = !paso.hecho;
  refresh();
}

const zPaso = z.object({ texto: zTexto("Escribí el paso").max(200, "Máximo 200 letras") });

export async function agregarPaso(trabajoId: string, _prev: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const r = zPaso.safeParse(datosDe(formData));
  if (!r.success) return erroresDeZod(r.error);

  const s = storeParaAcciones();
  if (!s.trabajos.some((t) => t.id === trabajoId)) return { error: "Este trabajo ya no existe." };
  const orden = s.checklist.filter((c) => c.trabajoId === trabajoId).reduce((max, c) => Math.max(max, c.orden + 1), 0);
  s.checklist.push(nuevoChecklistItem({ trabajoId, texto: r.data.texto, orden }));

  refresh();
  return null;
}

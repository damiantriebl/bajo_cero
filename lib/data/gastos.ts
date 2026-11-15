import "server-only";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { aInputFecha } from "@/lib/fechas";
import { sumaMontos } from "@/lib/calculos";
import { CATEGORIA_GASTO, MEDIO_PAGO } from "@/lib/etiquetas";
import type { CategoriaGasto, EstadoTrabajo, MedioPago } from "@/lib/generated/prisma/enums";
import { delPeriodo, porCategoria, resolverMes, type CategoriaResumen, type MesInfo } from "./reportes";

export type GastoFila = {
  id: string;
  fecha: Date;
  descripcion: string;
  categoria: CategoriaGasto;
  categoriaLabel: string;
  medioLabel: string;
  monto: number;
};

export type GastosDelMes = {
  mes: MesInfo;
  total: number;
  cobrado: number;
  /** cobrado − gastado (puede ser negativo). */
  quedan: number;
  porCategoria: CategoriaResumen[];
  /** Filtro activo (?categoria=), si es válido. */
  categoria: CategoriaGasto | null;
  /** Gastos del mes (ya filtrados por categoría), del más nuevo al más viejo. */
  gastos: GastoFila[];
  totalFiltrado: number;
};

export function esCategoria(v: string | undefined): v is CategoriaGasto {
  return v !== undefined && Object.hasOwn(CATEGORIA_GASTO, v);
}

export async function gastosDelMes(clave: string | undefined, categoria: string | undefined): Promise<GastosDelMes> {
  const s = await leerStore();
  const { info, desde, hasta } = resolverMes(clave, ahora());
  const delMes = delPeriodo(s.gastos, desde, hasta);
  const total = sumaMontos(delMes);
  const cobrado = sumaMontos(delPeriodo(s.cobros, desde, hasta));
  const filtro = esCategoria(categoria) ? categoria : null;

  const gastos = delMes
    .filter((g) => !filtro || g.categoria === filtro)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
    .map((g) => ({
      id: g.id,
      fecha: g.fecha,
      descripcion: g.descripcion,
      categoria: g.categoria,
      categoriaLabel: CATEGORIA_GASTO[g.categoria],
      medioLabel: MEDIO_PAGO[g.medio],
      monto: g.monto,
    }));

  return {
    mes: info,
    total,
    cobrado,
    quedan: cobrado - total,
    porCategoria: porCategoria(delMes),
    categoria: filtro,
    gastos,
    totalFiltrado: sumaMontos(gastos),
  };
}

export type GastoDetalle = {
  id: string;
  fecha: Date;
  /** "2026-11" para volver al listado del mes. */
  mesClave: string;
  descripcion: string;
  categoria: CategoriaGasto;
  categoriaLabel: string;
  medio: MedioPago;
  medioLabel: string;
  monto: number;
  notas: string | null;
  empleado: { id: string; nombre: string } | null;
  trabajo: { id: string; numero: number; titulo: string } | null;
  proveedor: { id: string; nombre: string } | null;
  /** Gasto generado por una compra a proveedor: se maneja desde Proveedores. */
  esCompra: boolean;
};

export async function detalleGasto(id: string): Promise<GastoDetalle | null> {
  const s = await leerStore();
  const g = s.gastos.find((x) => x.id === id);
  if (!g) return null;
  const empleado = g.empleadoId ? s.empleados.find((e) => e.id === g.empleadoId) : undefined;
  const trabajo = g.trabajoId ? s.trabajos.find((t) => t.id === g.trabajoId) : undefined;
  const proveedor = g.proveedorId ? s.proveedores.find((p) => p.id === g.proveedorId) : undefined;
  return {
    id: g.id,
    fecha: g.fecha,
    mesClave: aInputFecha(g.fecha).slice(0, 7),
    descripcion: g.descripcion,
    categoria: g.categoria,
    categoriaLabel: CATEGORIA_GASTO[g.categoria],
    medio: g.medio,
    medioLabel: MEDIO_PAGO[g.medio],
    monto: g.monto,
    notas: g.notas,
    empleado: empleado ? { id: empleado.id, nombre: empleado.nombre } : null,
    trabajo: trabajo ? { id: trabajo.id, numero: trabajo.numero, titulo: trabajo.titulo } : null,
    proveedor: proveedor ? { id: proveedor.id, nombre: proveedor.nombre } : null,
    esCompra: g.compraId !== null,
  };
}

// ───────── Opciones para formularios ─────────

const ESTADOS_ACTIVOS: EstadoTrabajo[] = ["APROBADO", "EN_CURSO", "TERMINADO"];

export type OpcionTrabajo = { id: string; label: string };

/** Trabajos a los que se les puede asociar un gasto o una jornada. */
export function trabajosActivos(s: Store): OpcionTrabajo[] {
  return s.trabajos
    .filter((t) => ESTADOS_ACTIVOS.includes(t.estado))
    .sort((a, b) => b.numero - a.numero)
    .map((t) => {
      const cliente = s.clientes.find((c) => c.id === t.clienteId)?.nombre ?? "Cliente";
      return { id: t.id, label: `#${t.numero} · ${cliente} · ${t.titulo}` };
    });
}

export type OpcionesGasto = {
  empleados: { id: string; nombre: string }[];
  trabajos: OpcionTrabajo[];
  /** Hoy en Argentina, para el value de <input type="date">. */
  hoy: string;
};

export async function opcionesNuevoGasto(): Promise<OpcionesGasto> {
  const s = await leerStore();
  return {
    empleados: s.empleados.filter((e) => e.activo).map((e) => ({ id: e.id, nombre: e.nombre })),
    trabajos: trabajosActivos(s),
    hoy: aInputFecha(ahora()),
  };
}

import "server-only";
import { ahora, leerDb } from "@/lib/db";
import { aInputFecha } from "@/lib/fechas";
import { sumaMontos } from "@/lib/calculos";
import { CATEGORIA_GASTO, MEDIO_PAGO } from "@/lib/etiquetas";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { CategoriaGasto, EstadoTrabajo, MedioPago } from "@/lib/generated/prisma/enums";
import { enRango, gastosPorCategoria, resolverMes, type CategoriaResumen, type MesInfo } from "./reportes";

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
  const prisma = await leerDb();
  const { info, desde, hasta } = resolverMes(clave, ahora());
  const delMes = enRango(desde, hasta);
  const filtro = esCategoria(categoria) ? categoria : null;

  const [porCategoria, cobros, filas] = await Promise.all([
    gastosPorCategoria(prisma, desde, hasta),
    prisma.cobro.aggregate({ where: { fecha: delMes }, _sum: { monto: true } }),
    prisma.gasto.findMany({
      where: { fecha: delMes, categoria: filtro ?? undefined },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      select: { id: true, fecha: true, descripcion: true, categoria: true, medio: true, monto: true },
    }),
  ]);

  const total = sumaMontos(porCategoria);
  const cobrado = cobros._sum.monto ?? 0;
  const gastos = filas.map((g) => ({
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
    porCategoria,
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
  const prisma = await leerDb();
  const g = await prisma.gasto.findUnique({
    where: { id },
    select: {
      id: true,
      fecha: true,
      descripcion: true,
      categoria: true,
      medio: true,
      monto: true,
      notas: true,
      compraId: true,
      empleado: { select: { id: true, nombre: true } },
      trabajo: { select: { id: true, numero: true, titulo: true } },
      proveedor: { select: { id: true, nombre: true } },
    },
  });
  if (!g) return null;
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
    empleado: g.empleado,
    trabajo: g.trabajo,
    proveedor: g.proveedor,
    esCompra: g.compraId !== null,
  };
}

// ───────── Opciones para formularios ─────────

const ESTADOS_ACTIVOS: EstadoTrabajo[] = ["APROBADO", "EN_CURSO", "TERMINADO"];

export type OpcionTrabajo = { id: string; label: string };

/** Trabajos a los que se les puede asociar un gasto o una jornada. */
export async function trabajosActivos(prisma: PrismaClient): Promise<OpcionTrabajo[]> {
  const trabajos = await prisma.trabajo.findMany({
    where: { estado: { in: ESTADOS_ACTIVOS } },
    orderBy: { numero: "desc" },
    select: { id: true, numero: true, titulo: true, cliente: { select: { nombre: true } } },
  });
  return trabajos.map((t) => ({ id: t.id, label: `#${t.numero} · ${t.cliente.nombre} · ${t.titulo}` }));
}

export type OpcionesGasto = {
  empleados: { id: string; nombre: string }[];
  trabajos: OpcionTrabajo[];
  /** Hoy en Argentina, para el value de <input type="date">. */
  hoy: string;
};

export async function opcionesNuevoGasto(): Promise<OpcionesGasto> {
  const prisma = await leerDb();
  const [empleados, trabajos] = await Promise.all([
    prisma.empleado.findMany({ where: { activo: true }, select: { id: true, nombre: true } }),
    trabajosActivos(prisma),
  ]);
  return {
    empleados: empleados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    trabajos,
    hoy: aInputFecha(ahora()),
  };
}

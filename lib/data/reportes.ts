import "server-only";
import { ahora, leerDb } from "@/lib/db";
import {
  fechaAR,
  finDia,
  finMes,
  formatMes,
  formatMesCorto,
  inicioDia,
  inicioMes,
  partesAR,
  sumarDias,
  sumarMeses,
} from "@/lib/fechas";
import { costoConsumos, estadoStock, rentabilidad, sumaMontos, totalItems } from "@/lib/calculos";
import { CATEGORIA_GASTO, MEDIO_PAGO, TIPO_TRABAJO } from "@/lib/etiquetas";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { CategoriaGasto, TipoTrabajo } from "@/lib/generated/prisma/enums";
import { datosEmpresa } from "./empresa";

// ───────────────────────── Período (mes elegido con ?mes=YYYY-MM) ─────────────────────────

export type MesInfo = {
  /** "2026-11" */
  clave: string;
  /** "Noviembre 2026" */
  label: string;
  /** Para frases: "noviembre" (o "diciembre 2025" si es de otro año). */
  nombre: string;
  /** "Nov" */
  corto: string;
  anterior: { clave: string; label: string };
  /** null cuando el mes elegido es el actual (no hay meses futuros). */
  siguiente: { clave: string; label: string } | null;
  esActual: boolean;
  /** Últimos 12 meses (del más nuevo al más viejo) para el selector. */
  opciones: { clave: string; label: string }[];
};

export type Periodo = { info: MesInfo; desde: Date; hasta: Date };

const claveDe = (d: Date) => {
  const p = partesAR(d);
  return `${p.anio}-${String(p.mes + 1).padStart(2, "0")}`;
};

function inicioDeClave(clave: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(clave ?? "");
  if (!m) return null;
  const mes = Number(m[2]);
  const anio = Number(m[1]);
  if (mes < 1 || mes > 12 || anio < 2000) return null;
  return fechaAR(anio, mes - 1, 1);
}

/** Resuelve el mes pedido (por defecto, el actual en Argentina; nunca uno futuro). */
export function resolverMes(clave: string | undefined, hoy: Date): Periodo {
  const actual = inicioMes(hoy);
  let desde = inicioDeClave(clave) ?? actual;
  if (desde.getTime() > actual.getTime()) desde = actual;
  const anioActual = partesAR(hoy).anio;

  const etiqueta = (d: Date) => {
    const largo = formatMes(d); // "Noviembre 2026"
    return partesAR(d).anio === anioActual ? largo.split(" ")[0] : largo;
  };
  const item = (d: Date) => ({ clave: claveDe(d), label: formatMes(d) });

  const opciones = Array.from({ length: 12 }, (_, i) => item(sumarMeses(actual, -i)));
  if (!opciones.some((o) => o.clave === claveDe(desde))) opciones.push(item(desde));

  const esActual = desde.getTime() === actual.getTime();
  const nombre = etiqueta(desde);

  return {
    desde,
    hasta: finMes(desde),
    info: {
      clave: claveDe(desde),
      label: formatMes(desde),
      nombre: nombre.charAt(0).toLowerCase() + nombre.slice(1),
      corto: formatMesCorto(desde),
      anterior: item(sumarMeses(desde, -1)),
      siguiente: esActual ? null : item(sumarMeses(desde, 1)),
      esActual,
      opciones,
    },
  };
}

/** Solo la info del mes (para el selector del encabezado). */
export async function infoMes(clave: string | undefined): Promise<MesInfo> {
  await leerDb();
  return resolverMes(clave, ahora()).info;
}

// ───────────────────────── Ayudas compartidas por lib/data ─────────────────────────

/** Filtro de Prisma para un campo DateTime dentro del período (bordes incluidos). */
export const enRango = (desde: Date, hasta: Date) => ({ gte: desde, lte: hasta });

export type CategoriaResumen = { categoria: CategoriaGasto; label: string; monto: number; fraccion: number };

/** Gastos agrupados por categoría, de mayor a menor. */
export function porCategoria(gastos: { categoria: CategoriaGasto; monto: number }[]): CategoriaResumen[] {
  const total = sumaMontos(gastos);
  const mapa = new Map<CategoriaGasto, number>();
  for (const g of gastos) mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.monto);
  return [...mapa.entries()]
    .map(([categoria, monto]) => ({
      categoria,
      label: CATEGORIA_GASTO[categoria],
      monto,
      fraccion: total > 0 ? monto / total : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

/** Gastos del período agrupados por categoría en la base (SUM … GROUP BY categoria). */
export async function gastosPorCategoria(prisma: PrismaClient, desde: Date, hasta: Date): Promise<CategoriaResumen[]> {
  const grupos = await prisma.gasto.groupBy({
    by: ["categoria"],
    where: { fecha: enRango(desde, hasta) },
    _sum: { monto: true },
  });
  return porCategoria(grupos.map((g) => ({ categoria: g.categoria, monto: g._sum.monto ?? 0 })));
}

/**
 * Lo que falta cobrar hoy de los trabajos aprobados en adelante (no depende del mes).
 * Por trabajo: max(0, total de ítems redondeado − cobrado), igual que totalItems/saldo
 * de lib/calculos. Se calcula en la base para no traer el historial de ítems y cobros.
 */
export async function totalPorCobrar(prisma: PrismaClient): Promise<number> {
  const [fila] = await prisma.$queryRaw<{ total: number }[]>`
    WITH trabajos AS (
      SELECT "id" FROM "Trabajo" WHERE "estado" IN ('APROBADO', 'EN_CURSO', 'TERMINADO', 'COBRADO')
    ), precios AS (
      SELECT i."trabajoId" AS id, ROUND(SUM(i."cantidad" * i."precioUnitario")::numeric) AS total
      FROM "ItemTrabajo" i JOIN trabajos t ON t."id" = i."trabajoId"
      GROUP BY i."trabajoId"
    ), cobrado AS (
      SELECT c."trabajoId" AS id, SUM(c."monto") AS cobrado
      FROM "Cobro" c JOIN trabajos t ON t."id" = c."trabajoId"
      GROUP BY c."trabajoId"
    )
    SELECT COALESCE(SUM(GREATEST(0, p.total - COALESCE(c.cobrado, 0))), 0)::float8 AS total
    FROM precios p LEFT JOIN cobrado c ON c.id = p.id`;
  return Number(fila?.total ?? 0);
}

// ───────────────────────── Reporte del mes ─────────────────────────

export type ReporteMes = {
  mes: MesInfo;
  cobrado: number;
  gastos: number;
  ganancia: number;
  porCobrar: number;
  ultimos6: { clave: string; corto: string; label: string; cobrado: number; gastos: number }[];
  trabajosPorTipo: { tipo: TipoTrabajo; label: string; cantidad: number }[];
  trabajosTotal: number;
  gastosPorCategoria: CategoriaResumen[];
  rentabilidad: {
    id: string;
    numero: number;
    titulo: string;
    cliente: string;
    precio: number;
    insumos: number;
    personal: number;
    ganancia: number;
    margen: number;
  }[];
  rentabilidadTotal: { precio: number; insumos: number; personal: number; ganancia: number; margen: number };
  topClientes: { id: string; nombre: string; cobrado: number; cobros: number }[];
};

/** Suma montos por mes ("2026-11") en hora de Argentina. */
function porMes(filas: { fecha: Date; monto: number }[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const f of filas) {
    const clave = claveDe(f.fecha);
    mapa.set(clave, (mapa.get(clave) ?? 0) + f.monto);
  }
  return mapa;
}

async function topClientesDe(prisma: PrismaClient, desde: Date, hasta: Date): Promise<ReporteMes["topClientes"]> {
  const grupos = await prisma.cobro.groupBy({
    by: ["clienteId"],
    where: { fecha: enRango(desde, hasta) },
    _sum: { monto: true },
    _count: { _all: true },
    orderBy: [{ _sum: { monto: "desc" } }, { clienteId: "asc" }],
    take: 5,
  });
  if (grupos.length === 0) return [];
  const clientes = await prisma.cliente.findMany({
    where: { id: { in: grupos.map((g) => g.clienteId) } },
    select: { id: true, nombre: true },
  });
  const nombres = new Map(clientes.map((c) => [c.id, c.nombre]));
  return grupos.map((g) => ({
    id: g.clienteId,
    nombre: nombres.get(g.clienteId) ?? "Cliente",
    cobrado: g._sum.monto ?? 0,
    cobros: g._count._all,
  }));
}

async function armarReporte(prisma: PrismaClient, { info, desde, hasta }: Periodo): Promise<ReporteMes> {
  const delMes = enRango(desde, hasta);
  // Serie de 6 meses: una consulta por tabla con el rango completo, se agrupa por mes acá.
  const desde6 = inicioMes(sumarMeses(desde, -5));

  const [cobros6, gastos6, categorias, tipos, terminados, topClientes, porCobrar] = await Promise.all([
    prisma.cobro.findMany({ where: { fecha: enRango(desde6, hasta) }, select: { fecha: true, monto: true } }),
    prisma.gasto.findMany({ where: { fecha: enRango(desde6, hasta) }, select: { fecha: true, monto: true } }),
    gastosPorCategoria(prisma, desde, hasta),
    // Trabajos del mes: los que tuvieron al menos una visita (turno no cancelado)
    // que empezó en el mes, o que se terminaron en el mes. Cada trabajo cuenta una
    // sola vez y los trabajos cancelados no cuentan.
    prisma.trabajo.groupBy({
      by: ["tipo"],
      where: {
        estado: { not: "CANCELADO" },
        OR: [{ turnos: { some: { estado: { not: "CANCELADO" }, inicio: delMes } } }, { fechaTerminado: delMes }],
      },
      _count: { _all: true },
    }),
    // Rentabilidad: trabajos terminados (o ya cobrados) con fecha de terminado en el mes.
    prisma.trabajo.findMany({
      where: { estado: { in: ["TERMINADO", "COBRADO"] }, fechaTerminado: delMes },
      orderBy: [{ fechaTerminado: "desc" }, { numero: "desc" }],
      select: {
        id: true,
        numero: true,
        titulo: true,
        cliente: { select: { nombre: true } },
        items: { select: { cantidad: true, precioUnitario: true } },
        movimientos: { where: { tipo: "CONSUMO" }, select: { cantidad: true, costoUnitario: true } },
        jornadas: { select: { monto: true } },
      },
    }),
    topClientesDe(prisma, desde, hasta),
    totalPorCobrar(prisma),
  ]);

  const cobradoPorMes = porMes(cobros6);
  const gastadoPorMes = porMes(gastos6);
  const ultimos6 = Array.from({ length: 6 }, (_, i) => {
    const d = sumarMeses(desde, i - 5);
    const clave = claveDe(d);
    return {
      clave,
      corto: formatMesCorto(d),
      label: formatMes(d),
      cobrado: cobradoPorMes.get(clave) ?? 0,
      gastos: gastadoPorMes.get(clave) ?? 0,
    };
  });
  const cobrado = cobradoPorMes.get(info.clave) ?? 0;
  const gastos = gastadoPorMes.get(info.clave) ?? 0;

  const trabajosPorTipo = tipos
    .map((t) => ({ tipo: t.tipo, label: TIPO_TRABAJO[t.tipo], cantidad: t._count._all }))
    .sort((a, b) => b.cantidad - a.cantidad || a.label.localeCompare(b.label, "es"));

  const rent = terminados.map((t) => ({
    id: t.id,
    numero: t.numero,
    titulo: t.titulo,
    cliente: t.cliente.nombre,
    ...rentabilidad(totalItems(t.items), costoConsumos(t.movimientos), sumaMontos(t.jornadas)),
  }));
  const rentabilidadTotal = rentabilidad(
    sumaMontos(rent.map((r) => ({ monto: r.precio }))),
    sumaMontos(rent.map((r) => ({ monto: r.insumos }))),
    sumaMontos(rent.map((r) => ({ monto: r.personal }))),
  );

  return {
    mes: info,
    cobrado,
    gastos,
    ganancia: cobrado - gastos,
    porCobrar,
    ultimos6,
    trabajosPorTipo,
    trabajosTotal: sumaMontos(trabajosPorTipo.map((t) => ({ monto: t.cantidad }))),
    gastosPorCategoria: categorias,
    rentabilidad: rent,
    rentabilidadTotal,
    topClientes,
  };
}

export async function reporteDelMes(clave: string | undefined): Promise<ReporteMes> {
  const prisma = await leerDb();
  return armarReporte(prisma, resolverMes(clave, ahora()));
}

// ───────────────────────── Movimientos (Excel y cierre) ─────────────────────────

export type Movimiento = {
  id: string;
  fecha: Date;
  tipo: "Cobro" | "Gasto";
  /** Categoría del gasto o concepto del cobro. */
  rubro: string;
  detalle: string;
  medio: string;
  monto: number;
};

async function movimientosDe(
  prisma: PrismaClient,
  desde: Date,
  hasta: Date,
): Promise<{ cobros: Movimiento[]; gastos: Movimiento[] }> {
  const delMes = enRango(desde, hasta);
  const orden = [{ fecha: "asc" }, { createdAt: "asc" }, { id: "asc" }] as const;
  const [cobros, gastos] = await Promise.all([
    prisma.cobro.findMany({
      where: { fecha: delMes },
      orderBy: [...orden],
      select: {
        id: true,
        fecha: true,
        monto: true,
        medio: true,
        concepto: true,
        cliente: { select: { nombre: true } },
        trabajo: { select: { numero: true, titulo: true } },
      },
    }),
    prisma.gasto.findMany({
      where: { fecha: delMes },
      orderBy: [...orden],
      select: { id: true, fecha: true, categoria: true, descripcion: true, medio: true, monto: true },
    }),
  ]);
  return {
    cobros: cobros.map(
      (c): Movimiento => ({
        id: c.id,
        fecha: c.fecha,
        tipo: "Cobro",
        rubro: c.concepto ?? "Cobro",
        detalle: c.trabajo ? `${c.cliente.nombre} · #${c.trabajo.numero} ${c.trabajo.titulo}` : c.cliente.nombre,
        medio: MEDIO_PAGO[c.medio],
        monto: c.monto,
      }),
    ),
    gastos: gastos.map(
      (g): Movimiento => ({
        id: g.id,
        fecha: g.fecha,
        tipo: "Gasto",
        rubro: CATEGORIA_GASTO[g.categoria],
        detalle: g.descripcion,
        medio: MEDIO_PAGO[g.medio],
        monto: g.monto,
      }),
    ),
  };
}

export async function movimientosDelMes(
  clave: string | undefined,
): Promise<{ mes: MesInfo; cobros: Movimiento[]; gastos: Movimiento[]; cobrado: number; gastado: number }> {
  const prisma = await leerDb();
  const { info, desde, hasta } = resolverMes(clave, ahora());
  const { cobros, gastos } = await movimientosDe(prisma, desde, hasta);
  return { mes: info, cobros, gastos, cobrado: sumaMontos(cobros), gastado: sumaMontos(gastos) };
}

export type CierreMes = ReporteMes & {
  cobros: Movimiento[];
  gastosDetalle: Movimiento[];
  empresa: { nombre: string; razonSocial: string; cuit: string | null; telefono: string | null; email: string | null };
  generado: Date;
};

export async function cierreDelMes(clave: string | undefined): Promise<CierreMes> {
  const prisma = await leerDb();
  const hoy = ahora();
  const periodo = resolverMes(clave, hoy);
  const [reporte, { cobros, gastos }, empresa] = await Promise.all([
    armarReporte(prisma, periodo),
    movimientosDe(prisma, periodo.desde, periodo.hasta),
    datosEmpresa(),
  ]);
  return {
    ...reporte,
    cobros,
    gastosDetalle: gastos,
    empresa: {
      nombre: empresa.nombreFantasia,
      razonSocial: empresa.razonSocial,
      cuit: empresa.cuit,
      telefono: empresa.telefono,
      email: empresa.email,
    },
    generado: hoy,
  };
}

// ───────────────────────── Resumen para el menú "Más" ─────────────────────────

export type ResumenMenu = {
  mes: MesInfo;
  trabajosEnCurso: number;
  presupuestosPorVencer: number;
  insumosBajos: number;
  deudaProveedores: number;
  gastosMes: number;
  cobradoMes: number;
  empleadosActivos: string[];
};

export async function resumenMenu(): Promise<ResumenMenu> {
  const prisma = await leerDb();
  const hoy = ahora();
  const { info, desde, hasta } = resolverMes(undefined, hoy);
  const delMes = enRango(desde, hasta);

  const [trabajosEnCurso, presupuestosPorVencer, insumos, compras, pagos, gastosMes, cobradoMes, empleados] =
    await Promise.all([
      prisma.trabajo.count({ where: { estado: "EN_CURSO" } }),
      // Vencen entre hoy y dentro de 3 días (días de calendario en Argentina).
      prisma.trabajo.count({
        where: { estado: "PRESUPUESTO", validoHasta: enRango(inicioDia(hoy), finDia(sumarDias(hoy, 3))) },
      }),
      // Tabla chica: se trae entera (activos) y se compara con la misma regla de lib/calculos.
      prisma.insumo.findMany({ where: { activo: true }, select: { stock: true, stockMinimo: true } }),
      prisma.compra.groupBy({ by: ["proveedorId"], _sum: { total: true } }),
      prisma.pagoProveedor.groupBy({ by: ["proveedorId"], _sum: { monto: true } }),
      prisma.gasto.aggregate({ where: { fecha: delMes }, _sum: { monto: true } }),
      prisma.cobro.aggregate({ where: { fecha: delMes }, _sum: { monto: true } }),
      prisma.empleado.findMany({ where: { activo: true }, select: { nombre: true } }),
    ]);

  // Deuda por proveedor (comprado − pagado, nunca negativa) y después el total.
  const pagadoA = new Map(pagos.map((p) => [p.proveedorId, p._sum.monto ?? 0]));
  const deudaProveedores = compras.reduce(
    (acc, c) => acc + Math.max(0, (c._sum.total ?? 0) - (pagadoA.get(c.proveedorId) ?? 0)),
    0,
  );

  return {
    mes: info,
    trabajosEnCurso,
    presupuestosPorVencer,
    insumosBajos: insumos.filter((i) => estadoStock(i) !== "ok").length,
    deudaProveedores,
    gastosMes: gastosMes._sum.monto ?? 0,
    cobradoMes: cobradoMes._sum.monto ?? 0,
    empleadosActivos: empleados.map((e) => e.nombre).sort((a, b) => a.localeCompare(b, "es")),
  };
}

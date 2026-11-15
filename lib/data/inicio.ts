import "server-only";
import { Prisma, type PrismaClient } from "@/lib/generated/prisma/client";
import type { CategoriaGasto, EstadoTrabajo, EstadoTurno, TipoEquipo, Unidad } from "@/lib/generated/prisma/enums";
import { ahora, leerDb } from "@/lib/db";
import { diasHasta, finDia, finMes, inicioDia, inicioMes, partesAR, sumarDias, sumarMeses } from "@/lib/fechas";
import { estadoStock, saldo, sumaMontos } from "@/lib/calculos";
import { ORDEN_VISITAS, SELECT_VISITA, aVisita, whereSinFecha, type Visita } from "./agenda";

// Datos del inicio (tablero): visitas de hoy, números del mes y avisos.

export type CuentaPorCobrar = {
  trabajoId: string;
  numero: number;
  titulo: string;
  estado: EstadoTrabajo;
  /** Aprobado y sin visita de hoy en adelante. */
  faltaAgendar: boolean;
  clienteId: string;
  cliente: string;
  total: number;
  cobrado: number;
  saldo: number;
};

export type Alerta =
  | { tipo: "stock"; insumoId: string; nombre: string; stock: number; stockMinimo: number; unidad: Unidad }
  | { tipo: "presupuesto"; trabajoId: string; numero: number; titulo: string; cliente: string; dias: number }
  | {
      tipo: "mantenimiento";
      clienteId: string;
      cliente: string;
      equipos: { tipo: TipoEquipo; frigorias: number | null; ubicacion: string | null }[];
      /** Días hasta el mantenimiento más próximo (negativo si ya pasó). */
      dias: number;
    }
  | { tipo: "pago"; proveedorId: string; proveedor: string; saldo: number; facturas: number; dias: number };

export type MesResumen = { mes: Date; cobrado: number; gastos: number };

export type DatosInicio = {
  ahora: Date;
  /** Visitas de hoy que no están canceladas. */
  visitasHoy: Visita[];
  /** La próxima visita pendiente (en curso o por empezar), hoy o más adelante. */
  proxima: Visita | null;
  /** Las demás visitas pendientes del mismo día que `proxima`. */
  despues: Visita[];
  /** Próximo día después de hoy con visitas. */
  siguienteDia: { fecha: Date; cantidad: number } | null;
  /** Trabajos aprobados o en curso que esperan fecha. */
  sinFecha: number;
  mes: {
    inicio: Date;
    cobrado: number;
    cobros: number;
    gastos: number;
    ganancia: number;
    /** Categoría con más gasto en el mes y su parte (0–1). */
    mayorGasto: { categoria: CategoriaGasto; fraccion: number } | null;
  };
  porCobrar: { total: number; presupuestado: number; cobrado: number; clientes: number; cuentas: CuentaPorCobrar[] };
  /** Últimos 6 meses, del más viejo al actual. */
  meses: MesResumen[];
  alertas: Alerta[];
};

const CON_SALDO: EstadoTrabajo[] = ["APROBADO", "EN_CURSO", "TERMINADO", "COBRADO"];
const PENDIENTES: EstadoTurno[] = ["A_CONFIRMAR", "CONFIRMADO"];
const DIAS_BUSQUEDA = 60;

// Avisos: cuántos días antes avisar.
const DIAS_PRESUPUESTO = 3;
const DIAS_MANTENIMIENTO = 15;
const DIAS_PAGO = 7;

/** "2026-10" → para juntar cobros y gastos por mes (en Argentina). */
function claveMes(d: Date): string {
  const p = partesAR(d);
  return `${p.anio}-${p.mes}`;
}

// ───────── Visitas ─────────

/** La próxima visita pendiente (en curso o por empezar) y las demás pendientes de ese mismo día. */
async function proximasVisitas(prisma: PrismaClient, momento: Date, limite: Date) {
  const pendiente = { estado: { in: PENDIENTES }, fin: { gt: momento } } satisfies Prisma.TurnoWhereInput;
  const primera = await prisma.turno.findFirst({
    where: { ...pendiente, inicio: { lt: limite } },
    select: SELECT_VISITA,
    orderBy: ORDEN_VISITAS,
  });
  if (!primera) return { proxima: null, despues: [] };

  const despues = await prisma.turno.findMany({
    where: {
      ...pendiente,
      id: { not: primera.id },
      inicio: { gte: inicioDia(primera.inicio), lte: finDia(primera.inicio), lt: limite },
    },
    select: SELECT_VISITA,
    orderBy: ORDEN_VISITAS,
  });
  return { proxima: aVisita(primera), despues: despues.map(aVisita) };
}

/** Próximo día (después de hoy) con visitas no canceladas, y cuántas hay. */
async function siguienteDiaConVisitas(prisma: PrismaClient, hoy: Date, limite: Date) {
  const activa = { estado: { not: "CANCELADO" } } satisfies Prisma.TurnoWhereInput;
  const primera = await prisma.turno.findFirst({
    where: { ...activa, inicio: { gt: finDia(hoy), lt: limite } },
    select: { inicio: true },
    orderBy: { inicio: "asc" },
  });
  if (!primera) return null;

  const fecha = inicioDia(primera.inicio);
  const cantidad = await prisma.turno.count({
    where: { ...activa, inicio: { gte: fecha, lte: finDia(fecha), lt: limite } },
  });
  return { fecha, cantidad };
}

// ───────── Plata ─────────

/** Cobros y gastos de los últimos 6 meses, agrupados por fecha (se reparten por mes en JS). */
function plataDelSemestre(prisma: PrismaClient, desde: Date, hasta: Date) {
  const fecha = { gte: desde, lte: hasta };
  return Promise.all([
    prisma.cobro.groupBy({ by: ["fecha"], where: { fecha }, _sum: { monto: true }, _count: { _all: true } }),
    prisma.gasto.groupBy({ by: ["fecha", "categoria"], where: { fecha }, _sum: { monto: true } }),
  ]);
}

type FilaCuenta = {
  id: string;
  numero: number;
  titulo: string;
  estado: EstadoTrabajo;
  clienteId: string;
  cliente: string;
  /** Σ cantidad × precio de los ítems, sin redondear. */
  presupuesto: number;
  cobrado: number;
};

/**
 * Trabajos con plata pendiente. Las sumas (ítems y cobros) y el filtro se hacen
 * en la base para no traer todo el historial de trabajos cobrados; el saldo
 * final se calcula con las mismas reglas de lib/calculos.
 */
async function cuentasPorCobrar(prisma: PrismaClient): Promise<Omit<CuentaPorCobrar, "faltaAgendar">[]> {
  const filas = await prisma.$queryRaw<FilaCuenta[]>`
    SELECT t."id", t."numero", t."titulo", t."estado"::text AS "estado", t."clienteId", c."nombre" AS "cliente",
           COALESCE(i."suma", 0)::float8 AS "presupuesto", COALESCE(co."suma", 0)::float8 AS "cobrado"
    FROM "Trabajo" t
    JOIN "Cliente" c ON c."id" = t."clienteId"
    LEFT JOIN LATERAL (
      SELECT SUM(it."cantidad" * it."precioUnitario") AS "suma" FROM "ItemTrabajo" it WHERE it."trabajoId" = t."id"
    ) i ON TRUE
    LEFT JOIN LATERAL (
      SELECT SUM(cb."monto") AS "suma" FROM "Cobro" cb WHERE cb."trabajoId" = t."id"
    ) co ON TRUE
    WHERE t."estado"::text IN (${Prisma.join(CON_SALDO)})
      AND COALESCE(i."suma", 0) > COALESCE(co."suma", 0)
  `;

  return filas
    .map((f) => {
      // Mismo redondeo que totalItems(): se suma todo y se redondea una vez.
      const total = Math.round(f.presupuesto);
      return {
        trabajoId: f.id,
        numero: f.numero,
        titulo: f.titulo,
        estado: f.estado,
        clienteId: f.clienteId,
        cliente: f.cliente,
        total,
        cobrado: f.cobrado,
        saldo: saldo(total, f.cobrado),
      };
    })
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo || a.numero - b.numero);
}

// ───────── Avisos ─────────

type FilaFacturaImpaga = { proveedorId: string; proveedor: string; deuda: number; vencimiento: Date };

/**
 * Facturas de proveedores impagas que tienen vencimiento.
 * Deuda del proveedor = compras − pagos. Para saber QUÉ compras siguen impagas:
 * 1. Lo pagado con `compraId` se descuenta de esa compra (dato exacto).
 * 2. Los pagos a cuenta (sin compra) saldan las compras más viejas primero, así
 *    que la deuda que queda está en las compras más nuevas: se recorren de la más
 *    nueva a la más vieja hasta cubrir la deuda (ventana `posteriores`).
 * Todo se calcula en la base: devuelve solo las facturas impagas con vencimiento.
 */
function facturasImpagas(prisma: PrismaClient) {
  return prisma.$queryRaw<FilaFacturaImpaga[]>`
    WITH "pagado" AS (
      SELECT "compraId", SUM("monto") AS "monto" FROM "PagoProveedor" WHERE "compraId" IS NOT NULL GROUP BY "compraId"
    ),
    "deudas" AS (
      SELECT pr."id" AS "proveedorId", pr."nombre",
             COALESCE((SELECT SUM(c."total") FROM "Compra" c WHERE c."proveedorId" = pr."id"), 0)
           - COALESCE((SELECT SUM(p."monto") FROM "PagoProveedor" p WHERE p."proveedorId" = pr."id"), 0) AS "deuda"
      FROM "Proveedor" pr
    ),
    "compras" AS (
      SELECT c."id", c."proveedorId", c."vencimiento", d."nombre", d."deuda",
             GREATEST(c."total" - COALESCE(pg."monto", 0), 0) AS "resto",
             c."fecha"
      FROM "Compra" c
      JOIN "deudas" d ON d."proveedorId" = c."proveedorId" AND d."deuda" > 0
      LEFT JOIN "pagado" pg ON pg."compraId" = c."id"
    ),
    "acumulado" AS (
      SELECT *, SUM("resto") OVER (PARTITION BY "proveedorId" ORDER BY "fecha" DESC, "id" DESC) - "resto" AS "posteriores"
      FROM "compras"
    )
    SELECT "proveedorId", "nombre" AS "proveedor", "deuda"::float8 AS "deuda", "vencimiento"
    FROM "acumulado"
    WHERE "resto" > 0 AND "posteriores" < "deuda" AND "vencimiento" IS NOT NULL
  `;
}

async function alertas(prisma: PrismaClient, momento: Date): Promise<Alerta[]> {
  const hoy = inicioDia(momento);
  // `diasHasta(fecha) <= n` ⇔ la fecha es antes del día n + 1 (00:00).
  const hastaDia = (n: number) => sumarDias(hoy, n + 1);

  const [insumos, presupuestos, equipos, facturas] = await Promise.all([
    // Insumos activos por debajo del mínimo o sin stock.
    prisma.insumo.findMany({
      where: {
        activo: true,
        OR: [{ stock: { lte: 0 } }, { stock: { lt: prisma.insumo.fields.stockMinimo } }],
      },
      select: { id: true, nombre: true, stock: true, stockMinimo: true, unidad: true },
    }),
    // Presupuestos sin respuesta que vencen en los próximos días.
    prisma.trabajo.findMany({
      where: { estado: "PRESUPUESTO", validoHasta: { gte: hoy, lt: hastaDia(DIAS_PRESUPUESTO) } },
      select: { id: true, numero: true, titulo: true, validoHasta: true, cliente: { select: { nombre: true } } },
      orderBy: { numero: "asc" },
    }),
    // Equipos con mantenimiento vencido o cercano, salvo que el cliente ya
    // tenga un mantenimiento agendado (a confirmar o confirmado, de hoy en adelante).
    prisma.equipo.findMany({
      where: {
        proximoMantenimiento: { lt: hastaDia(DIAS_MANTENIMIENTO) },
        cliente: {
          trabajos: {
            none: { tipo: "MANTENIMIENTO", turnos: { some: { estado: { in: PENDIENTES }, inicio: { gte: hoy } } } },
          },
        },
      },
      select: {
        clienteId: true,
        tipo: true,
        frigorias: true,
        ubicacion: true,
        proximoMantenimiento: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    facturasImpagas(prisma),
  ]);

  const lista: Alerta[] = [];

  // Stock (los más críticos primero).
  insumos
    .filter((i) => estadoStock(i) !== "ok")
    .sort((a, b) => a.stock / (a.stockMinimo || 1) - b.stock / (b.stockMinimo || 1))
    .forEach((i) =>
      lista.push({ tipo: "stock", insumoId: i.id, nombre: i.nombre, stock: i.stock, stockMinimo: i.stockMinimo, unidad: i.unidad }),
    );

  // Presupuestos por vencer.
  presupuestos
    .flatMap((t) => (t.validoHasta ? [{ t, dias: diasHasta(t.validoHasta, momento) }] : []))
    .filter(({ dias }) => dias >= 0 && dias <= DIAS_PRESUPUESTO)
    .sort((a, b) => a.dias - b.dias)
    .forEach(({ t, dias }) =>
      lista.push({ tipo: "presupuesto", trabajoId: t.id, numero: t.numero, titulo: t.titulo, cliente: t.cliente.nombre, dias }),
    );

  // Mantenimientos, agrupados por cliente.
  const porCliente = new Map<string, { cliente: string; dias: number; equipos: (typeof equipos)[number][] }>();
  for (const e of equipos) {
    if (!e.proximoMantenimiento) continue;
    const dias = diasHasta(e.proximoMantenimiento, momento);
    if (dias > DIAS_MANTENIMIENTO) continue;
    const grupo = porCliente.get(e.clienteId) ?? { cliente: e.cliente.nombre, dias, equipos: [] };
    grupo.dias = Math.min(grupo.dias, dias);
    grupo.equipos.push(e);
    porCliente.set(e.clienteId, grupo);
  }
  [...porCliente.entries()]
    .sort((a, b) => a[1].dias - b[1].dias)
    .forEach(([clienteId, { cliente, dias, equipos: delCliente }]) =>
      lista.push({
        tipo: "mantenimiento",
        clienteId,
        cliente,
        equipos: delCliente.map((e) => ({ tipo: e.tipo, frigorias: e.frigorias, ubicacion: e.ubicacion })),
        dias,
      }),
    );

  // Facturas impagas de proveedores que vencen pronto (o ya vencieron).
  const porProveedor = new Map<string, { proveedor: string; saldo: number; facturas: number; dias: number }>();
  for (const f of facturas) {
    const dias = diasHasta(f.vencimiento, momento);
    if (dias > DIAS_PAGO) continue;
    const grupo = porProveedor.get(f.proveedorId) ?? { proveedor: f.proveedor, saldo: f.deuda, facturas: 0, dias };
    grupo.facturas += 1;
    grupo.dias = Math.min(grupo.dias, dias);
    porProveedor.set(f.proveedorId, grupo);
  }
  [...porProveedor.entries()]
    .sort((a, b) => a[1].dias - b[1].dias)
    .forEach(([proveedorId, g]) => lista.push({ tipo: "pago", proveedorId, ...g }));

  return lista;
}

// ───────── Consulta ─────────

export async function obtenerInicio(): Promise<DatosInicio> {
  const prisma = await leerDb();
  const momento = ahora();
  const hoy = inicioDia(momento);
  const limite = sumarDias(hoy, DIAS_BUSQUEDA);
  const desde = inicioMes(momento);
  const meses6 = Array.from({ length: 6 }, (_, i) => inicioMes(sumarMeses(desde, i - 5)));

  const [turnosHoy, { proxima, despues }, siguienteDia, esperanFecha, [cobros, gastos], cuentas, avisos] =
    await Promise.all([
      prisma.turno.findMany({
        where: { inicio: { gte: hoy, lte: finDia(hoy) }, estado: { not: "CANCELADO" } },
        select: SELECT_VISITA,
        orderBy: ORDEN_VISITAS,
      }),
      proximasVisitas(prisma, momento, limite),
      siguienteDiaConVisitas(prisma, hoy, limite),
      prisma.trabajo.findMany({ where: whereSinFecha(hoy), select: { id: true } }),
      plataDelSemestre(prisma, meses6[0], finMes(momento)),
      cuentasPorCobrar(prisma),
      alertas(prisma, momento),
    ]);

  // Cobrado y gastado por mes; gasto por categoría del mes en curso.
  const cobradoPorMes = new Map<string, number>();
  const gastoPorMes = new Map<string, number>();
  for (const c of cobros) {
    const k = claveMes(c.fecha);
    cobradoPorMes.set(k, (cobradoPorMes.get(k) ?? 0) + (c._sum.monto ?? 0));
  }
  const mesActual = claveMes(desde);
  let cantidadCobros = 0;
  for (const c of cobros) if (claveMes(c.fecha) === mesActual) cantidadCobros += c._count._all;

  const porCategoria = new Map<CategoriaGasto, number>();
  for (const g of gastos) {
    const k = claveMes(g.fecha);
    const monto = g._sum.monto ?? 0;
    gastoPorMes.set(k, (gastoPorMes.get(k) ?? 0) + monto);
    if (k === mesActual) porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + monto);
  }
  const cobrado = cobradoPorMes.get(mesActual) ?? 0;
  const gastado = gastoPorMes.get(mesActual) ?? 0;
  const [categoria, montoCategoria] = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  const meses: MesResumen[] = meses6.map((m) => ({
    mes: m,
    cobrado: cobradoPorMes.get(claveMes(m)) ?? 0,
    gastos: gastoPorMes.get(claveMes(m)) ?? 0,
  }));

  const esperan = new Set(esperanFecha.map((t) => t.id));
  const conAgenda: CuentaPorCobrar[] = cuentas.map((c) => ({
    ...c,
    faltaAgendar: c.estado === "APROBADO" && esperan.has(c.trabajoId),
  }));

  return {
    ahora: momento,
    visitasHoy: turnosHoy.map(aVisita),
    proxima,
    despues,
    siguienteDia,
    sinFecha: esperan.size,
    mes: {
      inicio: desde,
      cobrado,
      cobros: cantidadCobros,
      gastos: gastado,
      ganancia: cobrado - gastado,
      mayorGasto: categoria && gastado > 0 ? { categoria, fraccion: (montoCategoria ?? 0) / gastado } : null,
    },
    porCobrar: {
      total: sumaMontos(conAgenda.map((c) => ({ monto: c.saldo }))),
      presupuestado: sumaMontos(conAgenda.map((c) => ({ monto: c.total }))),
      cobrado: sumaMontos(conAgenda.map((c) => ({ monto: c.cobrado }))),
      clientes: new Set(conAgenda.map((c) => c.clienteId)).size,
      cuentas: conAgenda,
    },
    meses,
    alertas: avisos,
  };
}

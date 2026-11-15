import "server-only";
import { ahora, leerDb } from "@/lib/db";
import { estadoStock, sumaMontos, type EstadoStock } from "@/lib/calculos";
import { inicioDia } from "@/lib/fechas";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { MedioPago, Unidad } from "@/lib/generated/prisma/enums";

// Consultas de proveedores, compras y pagos.

export type ProveedorFila = {
  id: string;
  nombre: string;
  rubro: string | null;
  /** Compras − pagos. Positivo: les debés. Negativo: pagaste de más (a favor). */
  saldo: number;
  proximoVencimiento: Date | null;
  /** Hay alguna compra impaga con el vencimiento ya pasado. */
  vencida: boolean;
};

export type CompraFila = {
  id: string;
  fecha: Date;
  proveedorId: string;
  proveedorNombre: string;
  numeroFactura: string | null;
  vencimiento: Date | null;
  total: number;
  cantidadItems: number;
  /** Lo que falta pagar de esta compra (ver `comprasImpagas`). */
  pendiente: number;
};

/** Compras y pagos que se listan en la ficha de un proveedor (los más recientes). */
const COMPRAS_FICHA = 100;
const PAGOS_FICHA = 100;

/** Compras más nuevas primero (createdAt e id desempatan las de la misma fecha). */
const ordenCompras = [{ fecha: "desc" }, { createdAt: "desc" }, { id: "desc" }] satisfies Prisma.CompraOrderByWithRelationInput[];

type CompraImpaga = { proveedorId: string; vencimiento: Date | null; pendiente: number };

/** Compras leídas por tanda al buscar las impagas (casi siempre alcanza una). */
const TANDA_IMPAGAS = 200;

const selectCompraParaImputar = {
  id: true,
  proveedorId: true,
  fecha: true,
  createdAt: true,
  total: true,
  vencimiento: true,
  /** Pagos atados a esta compra (compraId). */
  pagos: { select: { monto: true } },
} satisfies Prisma.CompraSelect;

type CompraParaImputar = Prisma.CompraGetPayload<{ select: typeof selectCompraParaImputar }>;

/**
 * Cuánto falta pagar de cada compra.
 * - Un pago con `compraId` (p. ej. "pagada al comprar") se aplica a esa compra.
 * - Los pagos sin compra ("a cuenta") cubren las compras más viejas primero (FIFO).
 * Por eso, si un proveedor tiene saldo S > 0 (compras − pagos), lo impago son exactamente
 * S pesos en sus compras MÁS NUEVAS: se recorren de la más nueva a la más vieja descontando
 * de S lo que a cada una le falta después de sus propios pagos, hasta agotarlo.
 * Así se leen solo esas pocas compras y no todo el historial. Las compras que no
 * aparecen en el resultado están pagadas.
 */
async function comprasImpagas(prisma: PrismaClient, saldos: Map<string, number>): Promise<Map<string, CompraImpaga>> {
  const restante = new Map([...saldos].filter(([, s]) => s > 0));
  const impagas = new Map<string, CompraImpaga>();
  let ultima: { fecha: Date; createdAt: Date; id: string } | null = null;

  // Paginación por clave (de la más nueva a la más vieja) solo de los proveedores que
  // todavía tienen saldo sin ubicar. No es una consulta por fila: corta en cuanto se agota.
  while (restante.size > 0) {
    const tanda: CompraParaImputar[] = await prisma.compra.findMany({
      where: {
        proveedorId: { in: [...restante.keys()] },
        ...(ultima && {
          OR: [
            { fecha: { lt: ultima.fecha } },
            { fecha: ultima.fecha, createdAt: { lt: ultima.createdAt } },
            { fecha: ultima.fecha, createdAt: ultima.createdAt, id: { lt: ultima.id } },
          ],
        }),
      },
      orderBy: ordenCompras,
      take: TANDA_IMPAGAS,
      select: selectCompraParaImputar,
    });

    for (const c of tanda) {
      const falta = restante.get(c.proveedorId);
      if (!falta) continue;
      const pendiente = Math.min(falta, Math.max(0, c.total - sumaMontos(c.pagos)));
      if (pendiente > 0) impagas.set(c.id, { proveedorId: c.proveedorId, vencimiento: c.vencimiento, pendiente });
      if (falta > pendiente) restante.set(c.proveedorId, falta - pendiente);
      else restante.delete(c.proveedorId);
    }

    if (tanda.length < TANDA_IMPAGAS) break;
    const u = tanda[tanda.length - 1];
    ultima = { fecha: u.fecha, createdAt: u.createdAt, id: u.id };
  }
  return impagas;
}

type Vencimientos = { proximoVencimiento: Date | null; vencida: boolean };

/** Por proveedor: el vencimiento más cercano desde hoy y si hay alguno ya pasado (entre las impagas). */
function vencimientosPorProveedor(impagas: Map<string, CompraImpaga>, hoy: Date): Map<string, Vencimientos> {
  const desdeHoy = inicioDia(hoy).getTime();
  const porProveedor = new Map<string, Vencimientos>();
  for (const c of impagas.values()) {
    if (!c.vencimiento) continue;
    const v = porProveedor.get(c.proveedorId) ?? { proximoVencimiento: null, vencida: false };
    if (c.vencimiento.getTime() < desdeHoy) v.vencida = true;
    else if (!v.proximoVencimiento || c.vencimiento.getTime() < v.proximoVencimiento.getTime()) v.proximoVencimiento = c.vencimiento;
    porProveedor.set(c.proveedorId, v);
  }
  return porProveedor;
}

/** Pantalla /proveedores: deuda total, próximo vencimiento, lista y últimas compras. */
export async function resumenProveedores({ ultimas = 6 }: { ultimas?: number } = {}) {
  const prisma = await leerDb();
  const hoy = ahora();

  const [lista, comprado, pagado, recientes] = await Promise.all([
    prisma.proveedor.findMany({ select: { id: true, nombre: true, rubro: true } }),
    prisma.compra.groupBy({ by: ["proveedorId"], _sum: { total: true } }),
    prisma.pagoProveedor.groupBy({ by: ["proveedorId"], _sum: { monto: true } }),
    prisma.compra.findMany({
      orderBy: ordenCompras,
      take: ultimas,
      select: {
        id: true,
        fecha: true,
        proveedorId: true,
        numeroFactura: true,
        vencimiento: true,
        total: true,
        proveedor: { select: { nombre: true } },
        _count: { select: { items: true } },
      },
    }),
  ]);

  const saldos = new Map<string, number>();
  for (const c of comprado) saldos.set(c.proveedorId, c._sum.total ?? 0);
  for (const p of pagado) saldos.set(p.proveedorId, (saldos.get(p.proveedorId) ?? 0) - (p._sum.monto ?? 0));

  const impagas = await comprasImpagas(prisma, saldos);
  const vencimientos = vencimientosPorProveedor(impagas, hoy);

  const proveedores: ProveedorFila[] = lista
    .map((p) => {
      const saldo = saldos.get(p.id) ?? 0;
      const v = vencimientos.get(p.id);
      return {
        id: p.id,
        nombre: p.nombre,
        rubro: p.rubro,
        saldo,
        proximoVencimiento: saldo > 0 ? (v?.proximoVencimiento ?? null) : null,
        vencida: saldo > 0 && Boolean(v?.vencida),
      };
    })
    // Primero a quienes les debés (vencidas y lo que vence antes), después el resto por nombre.
    .sort((a, b) => {
      const da = a.saldo > 0 ? 0 : 1;
      const db = b.saldo > 0 ? 0 : 1;
      if (da !== db) return da - db;
      if (da === 0) {
        if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
        const va = a.proximoVencimiento?.getTime() ?? Infinity;
        const vb = b.proximoVencimiento?.getTime() ?? Infinity;
        if (va !== vb) return va - vb;
      }
      return a.nombre.localeCompare(b.nombre, "es");
    });

  const totalDeuda = proveedores.reduce((acc, p) => acc + Math.max(0, p.saldo), 0);
  const conVencimiento = proveedores
    .filter((p) => p.proximoVencimiento)
    .sort((a, b) => (a.proximoVencimiento as Date).getTime() - (b.proximoVencimiento as Date).getTime());
  const proximo = conVencimiento[0]
    ? { fecha: conVencimiento[0].proximoVencimiento as Date, proveedorId: conVencimiento[0].id, proveedorNombre: conVencimiento[0].nombre }
    : null;

  const ultimasCompras: CompraFila[] = recientes.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    proveedorId: c.proveedorId,
    proveedorNombre: c.proveedor.nombre,
    numeroFactura: c.numeroFactura,
    vencimiento: c.vencimiento,
    total: c.total,
    cantidadItems: c._count.items,
    pendiente: impagas.get(c.id)?.pendiente ?? 0,
  }));

  return {
    totalDeuda,
    proveedoresConDeuda: proveedores.filter((p) => p.saldo > 0).length,
    proximo,
    proveedores,
    ultimasCompras,
    hoy,
  };
}

export type ItemCompraDetalle = {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  insumoId: string | null;
  unidad: Unidad | null;
};

export type CompraDetalle = {
  id: string;
  fecha: Date;
  numeroFactura: string | null;
  vencimiento: Date | null;
  total: number;
  pendiente: number;
  notas: string | null;
  items: ItemCompraDetalle[];
};

export type PagoFila = { id: string; fecha: Date; monto: number; medio: MedioPago; notas: string | null };

export type InsumoDeProveedor = { id: string; nombre: string; stock: number; unidad: Unidad; estado: EstadoStock };

const selectDatosProveedor = {
  id: true,
  nombre: true,
  rubro: true,
  contacto: true,
  telefono: true,
  email: true,
  cuit: true,
  direccion: true,
  notas: true,
} satisfies Prisma.ProveedorSelect;

/**
 * Ficha de un proveedor con su cuenta. `null` si no existe.
 * Los totales y el saldo son de todo el historial; las listas traen las últimas compras y pagos.
 */
export async function obtenerProveedor(id: string) {
  const prisma = await leerDb();
  const [p, comprado, pagado, ultimasCompras, ultimosPagos, insumosQueProvee] = await Promise.all([
    prisma.proveedor.findUnique({ where: { id }, select: selectDatosProveedor }),
    prisma.compra.aggregate({ where: { proveedorId: id }, _sum: { total: true } }),
    prisma.pagoProveedor.aggregate({ where: { proveedorId: id }, _sum: { monto: true } }),
    prisma.compra.findMany({
      where: { proveedorId: id },
      orderBy: ordenCompras,
      take: COMPRAS_FICHA,
      select: {
        id: true,
        fecha: true,
        numeroFactura: true,
        vencimiento: true,
        total: true,
        notas: true,
        items: {
          orderBy: { id: "asc" },
          select: {
            id: true,
            descripcion: true,
            cantidad: true,
            precioUnitario: true,
            insumoId: true,
            insumo: { select: { unidad: true } },
          },
        },
      },
    }),
    prisma.pagoProveedor.findMany({
      where: { proveedorId: id },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: PAGOS_FICHA,
      select: { id: true, fecha: true, monto: true, medio: true, notas: true },
    }),
    prisma.insumo.findMany({
      where: { proveedorId: id, activo: true },
      select: { id: true, nombre: true, stock: true, stockMinimo: true, unidad: true },
    }),
  ]);
  if (!p) return null;

  const hoy = ahora();
  const totalComprado = comprado._sum.total ?? 0;
  const totalPagado = pagado._sum.monto ?? 0;
  const saldo = totalComprado - totalPagado;
  const impagas = await comprasImpagas(prisma, new Map([[id, saldo]]));
  const vencimientos = vencimientosPorProveedor(impagas, hoy).get(id);

  const compras: CompraDetalle[] = ultimasCompras.map((c) => ({
    id: c.id,
    fecha: c.fecha,
    numeroFactura: c.numeroFactura,
    vencimiento: c.vencimiento,
    total: c.total,
    pendiente: impagas.get(c.id)?.pendiente ?? 0,
    notas: c.notas,
    items: c.items.map((i) => ({
      id: i.id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      insumoId: i.insumoId,
      unidad: i.insumo?.unidad ?? null,
    })),
  }));

  const pagos: PagoFila[] = ultimosPagos;

  const insumos: InsumoDeProveedor[] = insumosQueProvee
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((i) => ({ id: i.id, nombre: i.nombre, stock: i.stock, unidad: i.unidad, estado: estadoStock(i) }));

  return {
    ...p,
    saldo,
    totalComprado,
    totalPagado,
    proximoVencimiento: saldo > 0 ? (vencimientos?.proximoVencimiento ?? null) : null,
    vencida: saldo > 0 && Boolean(vencimientos?.vencida),
    compras,
    pagos,
    insumos,
    hoy,
  };
}

export type ProveedorDetalle = NonNullable<Awaited<ReturnType<typeof obtenerProveedor>>>;

/** Datos de contacto de un proveedor, para editarlo o cargarle una compra. `null` si no existe. */
export async function datosProveedor(id: string) {
  const prisma = await leerDb();
  return prisma.proveedor.findUnique({ where: { id }, select: selectDatosProveedor });
}

export type DatosProveedor = NonNullable<Awaited<ReturnType<typeof datosProveedor>>>;

/** Proveedores para elegir en un <select> o en una lista. */
export async function opcionesProveedores(): Promise<{ id: string; nombre: string; rubro: string | null }[]> {
  const prisma = await leerDb();
  const proveedores = await prisma.proveedor.findMany({ select: { id: true, nombre: true, rubro: true } });
  return proveedores.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

import "server-only";
import type { EstadoTrabajo, MedioPago, Prisma } from "@/lib/generated/prisma/client";
import { ahora, leerDb } from "@/lib/db";
import { saldo, totalItems } from "@/lib/calculos";
import { finMes, inicioDia, inicioMes, mismoDia } from "@/lib/fechas";
import {
  ESTADOS_CON_DEUDA,
  SELECT_ITEM,
  agrupar,
  calcularCuenta,
  cobradoAgrupado,
  cuentaComoDeuda,
  totalPorTrabajo,
} from "./clientes";

// ───────── Formulario "Registrar cobro" ─────────

export type TrabajoACobrar = {
  id: string;
  numero: number;
  titulo: string;
  estado: EstadoTrabajo;
  total: number;
  pagado: number;
  falta: number;
};

export type ClienteACobrar = {
  id: string;
  nombre: string;
  /** Saldo total del cliente. */
  falta: number;
  /** Trabajos con saldo (y el pedido por ?trabajo=, aunque no tenga). */
  trabajos: TrabajoACobrar[];
};

export type DatosNuevoCobro = {
  clientes: ClienteACobrar[];
  /** Hoy, para el valor inicial de la fecha. */
  hoy: Date;
};

/**
 * Clientes con sus trabajos pendientes de cobro.
 * `trabajoId` fuerza a incluir ese trabajo (si no está cancelado) aunque no tenga saldo.
 */
export async function datosNuevoCobro(trabajoId?: string): Promise<DatosNuevoCobro> {
  const prisma = await leerDb();
  const hoy = ahora();

  // Se traen los trabajos que suman deuda (para el saldo de cada cliente) y,
  // si vino ?trabajo=, también ese (aunque sea un presupuesto). Ítems en paralelo.
  const filtro: Prisma.TrabajoWhereInput = {
    OR: [
      { estado: { in: [...ESTADOS_CON_DEUDA] } },
      ...(trabajoId ? [{ id: trabajoId, estado: { not: "CANCELADO" as const } }] : []),
    ],
  };
  const [clientesDb, trabajosDb, itemsDb, cobrado] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, nombre: true } }),
    prisma.trabajo.findMany({
      where: filtro,
      select: { id: true, clienteId: true, numero: true, titulo: true, estado: true },
      orderBy: { numero: "asc" },
    }),
    prisma.itemTrabajo.findMany({ where: { trabajo: { is: filtro } }, select: SELECT_ITEM }),
    cobradoAgrupado(prisma),
  ]);
  const totales = totalPorTrabajo(itemsDb);

  const trabajosPorCliente = agrupar(
    trabajosDb.map((t) => {
      const total = totales.get(t.id) ?? 0;
      const pagado = cobrado.porTrabajo.get(t.id) ?? 0;
      return {
        clienteId: t.clienteId,
        trabajo: { id: t.id, numero: t.numero, titulo: t.titulo, estado: t.estado, total, pagado, falta: saldo(total, pagado) },
      };
    }),
    (t) => t.clienteId,
  );

  const clientes = clientesDb
    .map((c) => {
      const trabajos = (trabajosPorCliente.get(c.id) ?? []).map((t) => t.trabajo);
      return {
        id: c.id,
        nombre: c.nombre,
        falta: calcularCuenta(trabajos, cobrado.porCliente.get(c.id) ?? 0).falta,
        trabajos: trabajos.filter((t) => t.id === trabajoId || (cuentaComoDeuda(t.estado) && t.falta > 0)),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { clientes, hoy };
}

/**
 * Total y cobrado de un trabajo, leídos con el cliente de la transacción
 * (para validar el monto y cerrar el trabajo en la server action).
 */
export async function saldoDeTrabajo(
  tx: Prisma.TransactionClient,
  trabajoId: string,
): Promise<{ total: number; pagado: number; falta: number }> {
  // En secuencia: dentro de una transacción comparten una sola conexión.
  const items = await tx.itemTrabajo.findMany({ where: { trabajoId }, select: { cantidad: true, precioUnitario: true } });
  const cobrado = await tx.cobro.aggregate({ where: { trabajoId }, _sum: { monto: true } });
  const total = totalItems(items);
  const pagado = cobrado._sum.monto ?? 0;
  return { total, pagado, falta: saldo(total, pagado) };
}

// ───────── Cobros del mes ─────────

export type CobroDelMes = {
  id: string;
  fecha: Date;
  monto: number;
  medio: MedioPago;
  concepto: string | null;
  cliente: { id: string; nombre: string };
  trabajo: { numero: number; titulo: string } | null;
};

export type CobrosDelMes = {
  /** Algún instante del mes mostrado (para el título). */
  mes: Date;
  hoy: Date;
  total: number;
  cantidad: number;
  porMedio: { medio: MedioPago; monto: number }[];
  /** Días con cobros, del más reciente al más viejo. */
  dias: { fecha: Date; total: number; cobros: CobroDelMes[] }[];
};

export async function cobrosDelMes(): Promise<CobrosDelMes> {
  const prisma = await leerDb();
  const hoy = ahora();

  // Solo los cobros del mes (en hora de Argentina). Se muestran todos, así que
  // los totales por día y por medio se suman sobre estas mismas filas.
  const cobros: CobroDelMes[] = await prisma.cobro.findMany({
    where: { fecha: { gte: inicioMes(hoy), lte: finMes(hoy) } },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      fecha: true,
      monto: true,
      medio: true,
      concepto: true,
      cliente: { select: { id: true, nombre: true } },
      trabajo: { select: { numero: true, titulo: true } },
    },
  });

  const dias: CobrosDelMes["dias"] = [];
  for (const c of cobros) {
    const ultimo = dias.at(-1);
    if (ultimo && mismoDia(ultimo.fecha, c.fecha)) {
      ultimo.cobros.push(c);
      ultimo.total += c.monto;
    } else {
      dias.push({ fecha: inicioDia(c.fecha), total: c.monto, cobros: [c] });
    }
  }

  const medios = new Map<MedioPago, number>();
  for (const c of cobros) medios.set(c.medio, (medios.get(c.medio) ?? 0) + c.monto);

  return {
    mes: hoy,
    hoy,
    total: cobros.reduce((a, c) => a + c.monto, 0),
    cantidad: cobros.length,
    porMedio: [...medios].map(([medio, monto]) => ({ medio, monto })).sort((a, b) => b.monto - a.monto),
    dias,
  };
}

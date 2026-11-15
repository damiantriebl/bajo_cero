import "server-only";
import type { EstadoTrabajo, MedioPago } from "@/lib/generated/prisma/client";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { saldo } from "@/lib/calculos";
import { finMes, inicioDia, inicioMes, mismoDia } from "@/lib/fechas";
import { cuentaComoDeuda, cuentasPorCliente, totalesPorTrabajo } from "./clientes";

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
  const s = await leerStore();
  const hoy = ahora();
  const cuentas = cuentasPorCliente(s);
  const totales = totalesPorTrabajo(s);

  const clientes = s.clientes
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      falta: cuentas.get(c.id)?.falta ?? 0,
      trabajos: s.trabajos
        .filter((t) => t.clienteId === c.id && t.estado !== "CANCELADO")
        .map((t) => {
          const { total, pagado } = totales.get(t.id) ?? { total: 0, pagado: 0 };
          return { id: t.id, numero: t.numero, titulo: t.titulo, estado: t.estado, total, pagado, falta: saldo(total, pagado) };
        })
        .filter((t) => t.id === trabajoId || (cuentaComoDeuda(t.estado) && t.falta > 0))
        .sort((a, b) => a.numero - b.numero),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return { clientes, hoy };
}

/** Total y cobrado de un trabajo (para validar y cerrar el trabajo en la server action). */
export function saldoDeTrabajo(s: Store, trabajoId: string): { total: number; pagado: number; falta: number } {
  const { total, pagado } = totalesPorTrabajo(s).get(trabajoId) ?? { total: 0, pagado: 0 };
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
  const s = await leerStore();
  const hoy = ahora();
  const desde = inicioMes(hoy).getTime();
  const hasta = finMes(hoy).getTime();

  const clientes = new Map(s.clientes.map((c) => [c.id, c]));
  const trabajos = new Map(s.trabajos.map((t) => [t.id, t]));

  const cobros: CobroDelMes[] = s.cobros
    .filter((c) => c.fecha.getTime() >= desde && c.fecha.getTime() <= hasta)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || b.createdAt.getTime() - a.createdAt.getTime())
    .map((c) => {
      const t = c.trabajoId ? trabajos.get(c.trabajoId) : undefined;
      return {
        id: c.id,
        fecha: c.fecha,
        monto: c.monto,
        medio: c.medio,
        concepto: c.concepto,
        cliente: { id: c.clienteId, nombre: clientes.get(c.clienteId)?.nombre ?? "Cliente borrado" },
        trabajo: t ? { numero: t.numero, titulo: t.titulo } : null,
      };
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

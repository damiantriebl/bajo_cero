import "server-only";
import type { CategoriaGasto, EstadoTrabajo, TipoEquipo, Unidad } from "@/lib/generated/prisma/enums";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { diasHasta, entre, finDia, finMes, inicioDia, inicioMes, mismoDia, sumarDias, sumarMeses } from "@/lib/fechas";
import { estadoStock, saldo, sumaMontos, totalItems } from "@/lib/calculos";
import { armarVisitas, trabajosSinFecha, turnosDelDia, type Visita } from "./agenda";

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
const DIAS_BUSQUEDA = 60;

function cobradoYGastos(s: Store, desde: Date, hasta: Date) {
  const cobros = s.cobros.filter((c) => entre(c.fecha, desde, hasta));
  const gastos = s.gastos.filter((g) => entre(g.fecha, desde, hasta));
  return { cobros, gastos, cobrado: sumaMontos(cobros), gastado: sumaMontos(gastos) };
}

function cuentasPorCobrar(s: Store, hoy: Date): CuentaPorCobrar[] {
  const esperan = new Set(trabajosSinFecha(s, hoy).map((t) => t.id));
  return s.trabajos
    .filter((t) => CON_SALDO.includes(t.estado))
    .map((t) => {
      const total = totalItems(s.items.filter((i) => i.trabajoId === t.id));
      const cobrado = sumaMontos(s.cobros.filter((c) => c.trabajoId === t.id));
      const cliente = s.clientes.find((c) => c.id === t.clienteId);
      return {
        trabajoId: t.id,
        numero: t.numero,
        titulo: t.titulo,
        estado: t.estado,
        faltaAgendar: t.estado === "APROBADO" && esperan.has(t.id),
        clienteId: t.clienteId,
        cliente: cliente?.nombre ?? "",
        total,
        cobrado,
        saldo: saldo(total, cobrado),
      };
    })
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo);
}

function alertas(s: Store, momento: Date): Alerta[] {
  const hoy = inicioDia(momento);
  const lista: Alerta[] = [];

  // Insumos por debajo del mínimo (los más críticos primero).
  s.insumos
    .filter((i) => i.activo && estadoStock(i) !== "ok")
    .sort((a, b) => a.stock / (a.stockMinimo || 1) - b.stock / (b.stockMinimo || 1))
    .forEach((i) =>
      lista.push({ tipo: "stock", insumoId: i.id, nombre: i.nombre, stock: i.stock, stockMinimo: i.stockMinimo, unidad: i.unidad }),
    );

  // Presupuestos sin respuesta que vencen en los próximos 3 días.
  s.trabajos
    .filter((t) => t.estado === "PRESUPUESTO" && t.validoHasta)
    .map((t) => ({ t, dias: diasHasta(t.validoHasta as Date, momento) }))
    .filter(({ dias }) => dias >= 0 && dias <= 3)
    .sort((a, b) => a.dias - b.dias)
    .forEach(({ t, dias }) =>
      lista.push({
        tipo: "presupuesto",
        trabajoId: t.id,
        numero: t.numero,
        titulo: t.titulo,
        cliente: s.clientes.find((c) => c.id === t.clienteId)?.nombre ?? "",
        dias,
      }),
    );

  // Equipos con mantenimiento vencido o en los próximos 15 días,
  // salvo que el cliente ya tenga un mantenimiento agendado.
  const conMantenimientoAgendado = new Set(
    s.turnos
      .filter((t) => (t.estado === "A_CONFIRMAR" || t.estado === "CONFIRMADO") && t.inicio.getTime() >= hoy.getTime())
      .map((t) => s.trabajos.find((x) => x.id === t.trabajoId))
      .filter((t) => t?.tipo === "MANTENIMIENTO")
      .map((t) => t!.clienteId),
  );
  const porCliente = new Map<string, { dias: number; equipos: (typeof s.equipos)[number][] }>();
  for (const e of s.equipos) {
    if (!e.proximoMantenimiento || conMantenimientoAgendado.has(e.clienteId)) continue;
    const dias = diasHasta(e.proximoMantenimiento, momento);
    if (dias > 15) continue;
    const grupo = porCliente.get(e.clienteId) ?? { dias, equipos: [] };
    grupo.dias = Math.min(grupo.dias, dias);
    grupo.equipos.push(e);
    porCliente.set(e.clienteId, grupo);
  }
  [...porCliente.entries()]
    .sort((a, b) => a[1].dias - b[1].dias)
    .forEach(([clienteId, { dias, equipos }]) =>
      lista.push({
        tipo: "mantenimiento",
        clienteId,
        cliente: s.clientes.find((c) => c.id === clienteId)?.nombre ?? "",
        equipos: equipos.map((e) => ({ tipo: e.tipo, frigorias: e.frigorias, ubicacion: e.ubicacion })),
        dias,
      }),
    );

  // Facturas de proveedores que vencen en 7 días (o ya vencieron) con deuda pendiente.
  s.proveedores
    .map((p) => {
      const deuda =
        sumaMontos(s.compras.filter((c) => c.proveedorId === p.id).map((c) => ({ monto: c.total }))) -
        sumaMontos(s.pagosProveedor.filter((x) => x.proveedorId === p.id));
      const porVencer = s.compras.filter(
        (c) => c.proveedorId === p.id && c.vencimiento && diasHasta(c.vencimiento, momento) <= 7,
      );
      const dias = Math.min(...porVencer.map((c) => diasHasta(c.vencimiento as Date, momento)));
      return { p, deuda, facturas: porVencer.length, dias };
    })
    .filter((x) => x.deuda > 0 && x.facturas > 0)
    .sort((a, b) => a.dias - b.dias)
    .forEach(({ p, deuda, facturas, dias }) =>
      lista.push({ tipo: "pago", proveedorId: p.id, proveedor: p.nombre, saldo: deuda, facturas, dias }),
    );

  return lista;
}

export async function obtenerInicio(): Promise<DatosInicio> {
  const s = await leerStore();
  const momento = ahora();
  const hoy = inicioDia(momento);

  // Visitas
  const visitasHoy = armarVisitas(s, turnosDelDia(s, hoy)).filter((v) => v.estado !== "CANCELADO");
  const limite = sumarDias(hoy, DIAS_BUSQUEDA).getTime();
  const pendientes = armarVisitas(
    s,
    s.turnos.filter(
      (t) =>
        (t.estado === "A_CONFIRMAR" || t.estado === "CONFIRMADO") &&
        t.fin.getTime() > momento.getTime() &&
        t.inicio.getTime() < limite,
    ),
  );
  const proxima = pendientes[0] ?? null;
  const despues = proxima ? pendientes.slice(1).filter((v) => mismoDia(v.inicio, proxima.inicio)) : [];

  const futuras = s.turnos.filter(
    (t) => t.estado !== "CANCELADO" && t.inicio.getTime() > finDia(hoy).getTime() && t.inicio.getTime() < limite,
  );
  const primera = futuras.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
  const siguienteDia = primera
    ? { fecha: inicioDia(primera.inicio), cantidad: futuras.filter((t) => mismoDia(t.inicio, primera.inicio)).length }
    : null;

  // Mes en curso
  const desde = inicioMes(momento);
  const mes = cobradoYGastos(s, desde, finMes(momento));
  const porCategoria = new Map<CategoriaGasto, number>();
  mes.gastos.forEach((g) => porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + g.monto));
  const [categoria, monto] = [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];

  // Últimos 6 meses
  const meses = Array.from({ length: 6 }, (_, i) => {
    const m = inicioMes(sumarMeses(desde, i - 5));
    const r = cobradoYGastos(s, m, finMes(m));
    return { mes: m, cobrado: r.cobrado, gastos: r.gastado };
  });

  const cuentas = cuentasPorCobrar(s, hoy);

  return {
    ahora: momento,
    visitasHoy,
    proxima,
    despues,
    siguienteDia,
    sinFecha: trabajosSinFecha(s, hoy).length,
    mes: {
      inicio: desde,
      cobrado: mes.cobrado,
      cobros: mes.cobros.length,
      gastos: mes.gastado,
      ganancia: mes.cobrado - mes.gastado,
      mayorGasto: categoria && mes.gastado > 0 ? { categoria, fraccion: (monto ?? 0) / mes.gastado } : null,
    },
    porCobrar: {
      total: sumaMontos(cuentas.map((c) => ({ monto: c.saldo }))),
      presupuestado: sumaMontos(cuentas.map((c) => ({ monto: c.total }))),
      cobrado: sumaMontos(cuentas.map((c) => ({ monto: c.cobrado }))),
      clientes: new Set(cuentas.map((c) => c.clienteId)).size,
      cuentas,
    },
    meses,
    alertas: alertas(s, momento),
  };
}

import "server-only";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import {
  diasHasta,
  entre,
  fechaAR,
  finMes,
  formatMes,
  formatMesCorto,
  inicioMes,
  partesAR,
  sumarMeses,
} from "@/lib/fechas";
import { costoConsumos, estadoStock, rentabilidad, sumaMontos, totalItems } from "@/lib/calculos";
import { CATEGORIA_GASTO, MEDIO_PAGO, TIPO_TRABAJO } from "@/lib/etiquetas";
import type { CategoriaGasto, EstadoTrabajo, TipoTrabajo } from "@/lib/generated/prisma/enums";

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
  await leerStore();
  return resolverMes(clave, ahora()).info;
}

// ───────────────────────── Ayudas compartidas por lib/data ─────────────────────────

export function delPeriodo<T extends { fecha: Date }>(filas: T[], desde: Date, hasta: Date): T[] {
  return filas.filter((f) => entre(f.fecha, desde, hasta));
}

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

const ESTADOS_CON_SALDO: EstadoTrabajo[] = ["APROBADO", "EN_CURSO", "TERMINADO", "COBRADO"];

/** Lo que falta cobrar hoy de los trabajos aprobados en adelante (no depende del mes). */
export function totalPorCobrar(s: Store): number {
  return s.trabajos
    .filter((t) => ESTADOS_CON_SALDO.includes(t.estado))
    .reduce((acc, t) => {
      const total = totalItems(s.items.filter((i) => i.trabajoId === t.id));
      const cobrado = sumaMontos(s.cobros.filter((c) => c.trabajoId === t.id));
      return acc + Math.max(0, total - cobrado);
    }, 0);
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

function armarReporte(s: Store, { info, desde, hasta }: Periodo): ReporteMes {
  const cobrado = sumaMontos(delPeriodo(s.cobros, desde, hasta));
  const gastosMes = delPeriodo(s.gastos, desde, hasta);
  const gastos = sumaMontos(gastosMes);

  const ultimos6 = Array.from({ length: 6 }, (_, i) => {
    const d = sumarMeses(desde, i - 5);
    const ini = inicioMes(d);
    const fin = finMes(d);
    return {
      clave: claveDe(d),
      corto: formatMesCorto(d),
      label: formatMes(d),
      cobrado: sumaMontos(delPeriodo(s.cobros, ini, fin)),
      gastos: sumaMontos(delPeriodo(s.gastos, ini, fin)),
    };
  });

  // Trabajos del mes: los que tuvieron al menos una visita (turno no cancelado)
  // que empezó en el mes, o que se terminaron en el mes. Cada trabajo cuenta una
  // sola vez y los trabajos cancelados no cuentan.
  const idsConVisita = new Set(
    s.turnos.filter((t) => t.estado !== "CANCELADO" && entre(t.inicio, desde, hasta)).map((t) => t.trabajoId),
  );
  const trabajosMes = s.trabajos.filter(
    (t) =>
      t.estado !== "CANCELADO" &&
      (idsConVisita.has(t.id) || (t.fechaTerminado !== null && entre(t.fechaTerminado, desde, hasta))),
  );
  const conteo = new Map<TipoTrabajo, number>();
  for (const t of trabajosMes) conteo.set(t.tipo, (conteo.get(t.tipo) ?? 0) + 1);
  const trabajosPorTipo = [...conteo.entries()]
    .map(([tipo, cantidad]) => ({ tipo, label: TIPO_TRABAJO[tipo], cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);

  // Rentabilidad: trabajos terminados (o ya cobrados) con fecha de terminado en el mes.
  const rent = s.trabajos
    .filter(
      (t) =>
        (t.estado === "TERMINADO" || t.estado === "COBRADO") &&
        t.fechaTerminado !== null &&
        entre(t.fechaTerminado, desde, hasta),
    )
    .sort((a, b) => (b.fechaTerminado?.getTime() ?? 0) - (a.fechaTerminado?.getTime() ?? 0))
    .map((t) => {
      const precio = totalItems(s.items.filter((i) => i.trabajoId === t.id));
      const insumos = costoConsumos(s.movimientos.filter((m) => m.trabajoId === t.id && m.tipo === "CONSUMO"));
      const personal = sumaMontos(s.jornadas.filter((j) => j.trabajoId === t.id));
      return {
        id: t.id,
        numero: t.numero,
        titulo: t.titulo,
        cliente: s.clientes.find((c) => c.id === t.clienteId)?.nombre ?? "Cliente",
        ...rentabilidad(precio, insumos, personal),
      };
    });
  const rentabilidadTotal = rentabilidad(
    sumaMontos(rent.map((r) => ({ monto: r.precio }))),
    sumaMontos(rent.map((r) => ({ monto: r.insumos }))),
    sumaMontos(rent.map((r) => ({ monto: r.personal }))),
  );

  const porCliente = new Map<string, { cobrado: number; cobros: number }>();
  for (const c of delPeriodo(s.cobros, desde, hasta)) {
    const actual = porCliente.get(c.clienteId) ?? { cobrado: 0, cobros: 0 };
    porCliente.set(c.clienteId, { cobrado: actual.cobrado + c.monto, cobros: actual.cobros + 1 });
  }
  const topClientes = [...porCliente.entries()]
    .map(([id, v]) => ({ id, nombre: s.clientes.find((c) => c.id === id)?.nombre ?? "Cliente", ...v }))
    .sort((a, b) => b.cobrado - a.cobrado)
    .slice(0, 5);

  return {
    mes: info,
    cobrado,
    gastos,
    ganancia: cobrado - gastos,
    porCobrar: totalPorCobrar(s),
    ultimos6,
    trabajosPorTipo,
    trabajosTotal: trabajosMes.length,
    gastosPorCategoria: porCategoria(gastosMes),
    rentabilidad: rent,
    rentabilidadTotal,
    topClientes,
  };
}

export async function reporteDelMes(clave: string | undefined): Promise<ReporteMes> {
  const s = await leerStore();
  return armarReporte(s, resolverMes(clave, ahora()));
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

function movimientosDe(s: Store, desde: Date, hasta: Date): { cobros: Movimiento[]; gastos: Movimiento[] } {
  const cobros = delPeriodo(s.cobros, desde, hasta)
    .map((c): Movimiento => {
      const cliente = s.clientes.find((x) => x.id === c.clienteId)?.nombre ?? "Cliente";
      const trabajo = c.trabajoId ? s.trabajos.find((t) => t.id === c.trabajoId) : undefined;
      return {
        id: c.id,
        fecha: c.fecha,
        tipo: "Cobro",
        rubro: c.concepto ?? "Cobro",
        detalle: trabajo ? `${cliente} · #${trabajo.numero} ${trabajo.titulo}` : cliente,
        medio: MEDIO_PAGO[c.medio],
        monto: c.monto,
      };
    })
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const gastos = delPeriodo(s.gastos, desde, hasta)
    .map(
      (g): Movimiento => ({
        id: g.id,
        fecha: g.fecha,
        tipo: "Gasto",
        rubro: CATEGORIA_GASTO[g.categoria],
        detalle: g.descripcion,
        medio: MEDIO_PAGO[g.medio],
        monto: g.monto,
      }),
    )
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  return { cobros, gastos };
}

export async function movimientosDelMes(
  clave: string | undefined,
): Promise<{ mes: MesInfo; cobros: Movimiento[]; gastos: Movimiento[]; cobrado: number; gastado: number }> {
  const s = await leerStore();
  const { info, desde, hasta } = resolverMes(clave, ahora());
  const { cobros, gastos } = movimientosDe(s, desde, hasta);
  return { mes: info, cobros, gastos, cobrado: sumaMontos(cobros), gastado: sumaMontos(gastos) };
}

export type CierreMes = ReporteMes & {
  cobros: Movimiento[];
  gastosDetalle: Movimiento[];
  empresa: { nombre: string; razonSocial: string; cuit: string | null; telefono: string | null; email: string | null };
  generado: Date;
};

export async function cierreDelMes(clave: string | undefined): Promise<CierreMes> {
  const s = await leerStore();
  const hoy = ahora();
  const periodo = resolverMes(clave, hoy);
  const { cobros, gastos } = movimientosDe(s, periodo.desde, periodo.hasta);
  return {
    ...armarReporte(s, periodo),
    cobros,
    gastosDetalle: gastos,
    empresa: {
      nombre: s.empresa.nombreFantasia,
      razonSocial: s.empresa.razonSocial,
      cuit: s.empresa.cuit,
      telefono: s.empresa.telefono,
      email: s.empresa.email,
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
  const s = await leerStore();
  const hoy = ahora();
  const { info, desde, hasta } = resolverMes(undefined, hoy);

  const deudaProveedores = s.proveedores.reduce((acc, p) => {
    const comprado = sumaMontos(s.compras.filter((c) => c.proveedorId === p.id).map((c) => ({ monto: c.total })));
    const pagado = sumaMontos(s.pagosProveedor.filter((x) => x.proveedorId === p.id));
    return acc + Math.max(0, comprado - pagado);
  }, 0);

  return {
    mes: info,
    trabajosEnCurso: s.trabajos.filter((t) => t.estado === "EN_CURSO").length,
    presupuestosPorVencer: s.trabajos.filter((t) => {
      if (t.estado !== "PRESUPUESTO" || !t.validoHasta) return false;
      const dias = diasHasta(t.validoHasta, hoy);
      return dias >= 0 && dias <= 3;
    }).length,
    insumosBajos: s.insumos.filter((i) => i.activo && estadoStock(i) !== "ok").length,
    deudaProveedores,
    gastosMes: sumaMontos(delPeriodo(s.gastos, desde, hasta)),
    cobradoMes: sumaMontos(delPeriodo(s.cobros, desde, hasta)),
    empleadosActivos: s.empleados.filter((e) => e.activo).map((e) => e.nombre),
  };
}

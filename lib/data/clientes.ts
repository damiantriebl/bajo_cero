import "server-only";
import type {
  Cliente,
  Equipo,
  EstadoTrabajo,
  MedioPago,
  TipoCliente,
  TipoTrabajo,
} from "@/lib/generated/prisma/client";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { avanceCobro, saldo, totalItems } from "@/lib/calculos";
import { diasHasta, inicioDia } from "@/lib/fechas";

// Cuentas de clientes: presupuesto aprobado, lo que pagó y lo que falta.
// Regla: suman como deuda los trabajos APROBADO, EN_CURSO, TERMINADO y COBRADO.
// PRESUPUESTO (sin aprobar) y CANCELADO no cuentan.

const ESTADOS_CON_DEUDA: readonly EstadoTrabajo[] = ["APROBADO", "EN_CURSO", "TERMINADO", "COBRADO"];

export function cuentaComoDeuda(estado: EstadoTrabajo): boolean {
  return ESTADOS_CON_DEUDA.includes(estado);
}

export type EstadoCuenta = "saldo" | "al_dia" | "presupuesto" | "sin_trabajos";

export type Cuenta = {
  /** Suma de los trabajos aprobados (o más avanzados), de toda la historia. */
  presupuesto: number;
  /** Suma de todos sus cobros. */
  pagado: number;
  /** max(0, presupuesto − pagado) */
  falta: number;
  estado: EstadoCuenta;
  /**
   * Solo los trabajos que todavía tienen saldo: es lo que se muestra en
   * "Pagó $A de $B" y en la barra, para que la historia ya cobrada no la diluya.
   * presupuesto = suma de sus totales; pagado = presupuesto − falta.
   */
  abierta: { presupuesto: number; pagado: number; avance: number };
};

// ───────── Ayudas internas (también las usa lib/data/cobros.ts) ─────────

function agrupar<T>(filas: T[], clave: (f: T) => string | null): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const f of filas) {
    const k = clave(f);
    if (k === null) continue;
    const lista = m.get(k);
    if (lista) lista.push(f);
    else m.set(k, [f]);
  }
  return m;
}

/** Total (suma de ítems) y cobrado de cada trabajo. */
export function totalesPorTrabajo(s: Store): Map<string, { total: number; pagado: number }> {
  const items = agrupar(s.items, (i) => i.trabajoId);
  const cobros = agrupar(s.cobros, (c) => c.trabajoId);
  const out = new Map<string, { total: number; pagado: number }>();
  for (const t of s.trabajos) {
    out.set(t.id, {
      total: totalItems(items.get(t.id) ?? []),
      pagado: (cobros.get(t.id) ?? []).reduce((a, c) => a + c.monto, 0),
    });
  }
  return out;
}

/**
 * @param trabajos todos los trabajos del cliente, con su total y lo cobrado de cada uno
 * @param pagado todos los cobros del cliente (con o sin trabajo asociado)
 */
export function calcularCuenta(trabajos: { estado: EstadoTrabajo; total: number; pagado: number }[], pagado: number): Cuenta {
  const conDeuda = trabajos.filter((t) => cuentaComoDeuda(t.estado));
  const presupuesto = conDeuda.reduce((a, t) => a + t.total, 0);
  const falta = saldo(presupuesto, pagado);

  let estado: EstadoCuenta;
  if (presupuesto > 0 || pagado > 0) estado = falta > 0 ? "saldo" : "al_dia";
  else if (trabajos.some((t) => t.estado === "PRESUPUESTO")) estado = "presupuesto";
  else estado = "sin_trabajos";

  const presupuestoAbierto = falta > 0 ? conDeuda.filter((t) => t.total > t.pagado).reduce((a, t) => a + t.total, 0) : 0;
  // Nunca menos que lo que falta (por si hay pagos de más en otros trabajos).
  const totalAbierto = Math.max(presupuestoAbierto, falta);
  const pagadoAbierto = totalAbierto - falta;

  return {
    presupuesto,
    pagado,
    falta,
    estado,
    abierta: { presupuesto: totalAbierto, pagado: pagadoAbierto, avance: avanceCobro(totalAbierto, pagadoAbierto) },
  };
}

/** Cuenta de cada cliente (por id). */
export function cuentasPorCliente(s: Store): Map<string, Cuenta> {
  const totales = totalesPorTrabajo(s);
  const trabajos = agrupar(s.trabajos, (t) => t.clienteId);
  const cobros = agrupar(s.cobros, (c) => c.clienteId);
  const out = new Map<string, Cuenta>();
  for (const c of s.clientes) {
    const filas = (trabajos.get(c.id) ?? []).map((t) => ({ estado: t.estado, ...(totales.get(t.id) ?? { total: 0, pagado: 0 }) }));
    const pagado = (cobros.get(c.id) ?? []).reduce((a, x) => a + x.monto, 0);
    out.set(c.id, calcularCuenta(filas, pagado));
  }
  return out;
}

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function coincide(c: Cliente, q: string): boolean {
  const texto = normalizar(q);
  if (!texto) return true;
  const campos = [c.nombre, c.direccion, c.localidad, c.telefono].filter((x): x is string => Boolean(x)).map(normalizar);
  if (campos.some((v) => v.includes(texto))) return true;
  const digitos = q.replace(/\D/g, "");
  return digitos.length >= 3 && (c.telefono ?? "").replace(/\D/g, "").includes(digitos);
}

// ───────── Listado ─────────

export type FiltroClientes = "todos" | "saldo" | "aldia";

export type FilaCliente = {
  id: string;
  nombre: string;
  tipo: TipoCliente;
  telefono: string | null;
  direccion: string | null;
  cuenta: Cuenta;
  /** Trabajo que resume al cliente: el de mayor saldo, o el más reciente. */
  trabajo: { titulo: string; total: number; pagado: number } | null;
  /** Otros trabajos con saldo, además del principal. */
  otrosConSaldo: number;
};

export type ListadoClientes = {
  clientes: FilaCliente[];
  /** Cantidades por filtro, sobre el resultado de la búsqueda. */
  conteos: Record<FiltroClientes, number>;
  /** Lo que falta cobrar entre todos los clientes (sin filtros). */
  porCobrar: number;
  /** Lo que falta cobrar entre los clientes listados. */
  faltaListados: number;
};

export async function listarClientes({ q = "", filtro = "todos" }: { q?: string; filtro?: FiltroClientes } = {}): Promise<ListadoClientes> {
  const s = await leerStore();
  const cuentas = cuentasPorCliente(s);
  const totales = totalesPorTrabajo(s);
  const trabajosPorCliente = agrupar(s.trabajos, (t) => t.clienteId);

  const todas: FilaCliente[] = s.clientes.map((c) => {
    const cuenta = cuentas.get(c.id)!;
    const trabajos = (trabajosPorCliente.get(c.id) ?? [])
      .filter((t) => t.estado !== "CANCELADO")
      .map((t) => {
        const tt = totales.get(t.id) ?? { total: 0, pagado: 0 };
        return { ...t, ...tt, falta: cuentaComoDeuda(t.estado) ? saldo(tt.total, tt.pagado) : 0 };
      })
      .sort((a, b) => b.fechaPresupuesto.getTime() - a.fechaPresupuesto.getTime());
    const conSaldo = trabajos.filter((t) => t.falta > 0).sort((a, b) => b.falta - a.falta);
    const principal =
      cuenta.estado === "presupuesto"
        ? trabajos.find((t) => t.estado === "PRESUPUESTO")
        : (conSaldo[0] ?? trabajos.find((t) => cuentaComoDeuda(t.estado)) ?? trabajos[0]);
    return {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      telefono: c.telefono,
      direccion: c.direccion,
      cuenta,
      trabajo: principal ? { titulo: principal.titulo, total: principal.total, pagado: principal.pagado } : null,
      otrosConSaldo: Math.max(0, conSaldo.length - 1),
    };
  });

  const buscadas = q.trim() ? s.clientes.filter((c) => coincide(c, q)).map((c) => todas.find((f) => f.id === c.id)!) : todas;
  const conteos: Record<FiltroClientes, number> = {
    todos: buscadas.length,
    saldo: buscadas.filter((f) => f.cuenta.falta > 0).length,
    aldia: buscadas.filter((f) => f.cuenta.falta === 0).length,
  };
  const filtradas = buscadas
    .filter((f) => (filtro === "saldo" ? f.cuenta.falta > 0 : filtro === "aldia" ? f.cuenta.falta === 0 : true))
    .sort((a, b) => {
      if (a.cuenta.falta > 0 || b.cuenta.falta > 0) return b.cuenta.falta - a.cuenta.falta;
      return a.nombre.localeCompare(b.nombre, "es");
    });

  return {
    clientes: filtradas,
    conteos,
    porCobrar: todas.reduce((a, f) => a + f.cuenta.falta, 0),
    faltaListados: filtradas.reduce((a, f) => a + f.cuenta.falta, 0),
  };
}

// ───────── Ficha del cliente ─────────

export type TrabajoDeCliente = {
  id: string;
  numero: number;
  titulo: string;
  tipo: TipoTrabajo;
  estado: EstadoTrabajo;
  total: number;
  pagado: number;
  /** Lo que falta de este trabajo (0 si no cuenta como deuda). */
  falta: number;
  cuentaComoDeuda: boolean;
  /** Próxima visita agendada (desde hoy). */
  proximoTurno: Date | null;
  fechaPresupuesto: Date;
};

export type CobroDeCliente = {
  id: string;
  fecha: Date;
  monto: number;
  medio: MedioPago;
  concepto: string | null;
  notas: string | null;
  trabajo: { id: string; numero: number; titulo: string } | null;
};

export type EquipoDeCliente = Equipo & {
  /** Días hasta el próximo mantenimiento (negativo si está vencido). */
  diasParaMantenimiento: number | null;
};

export type DetalleCliente = {
  cliente: Cliente;
  cuenta: Cuenta;
  trabajos: TrabajoDeCliente[];
  cobros: CobroDeCliente[];
  equipos: EquipoDeCliente[];
  hoy: Date;
};

const ORDEN_ESTADO: Record<EstadoTrabajo, number> = {
  EN_CURSO: 0,
  APROBADO: 1,
  TERMINADO: 2,
  PRESUPUESTO: 3,
  COBRADO: 4,
  CANCELADO: 5,
};

export async function obtenerCliente(id: string): Promise<DetalleCliente | null> {
  const s = await leerStore();
  const hoy = ahora();
  const cliente = s.clientes.find((c) => c.id === id);
  if (!cliente) return null;

  const totales = totalesPorTrabajo(s);
  const desde = inicioDia(hoy).getTime();
  const trabajosDb = s.trabajos.filter((t) => t.clienteId === id);

  const trabajos: TrabajoDeCliente[] = trabajosDb
    .map((t) => {
      const { total, pagado } = totales.get(t.id) ?? { total: 0, pagado: 0 };
      const deuda = cuentaComoDeuda(t.estado);
      const proximo = s.turnos
        .filter(
          (x) =>
            x.trabajoId === t.id &&
            x.estado !== "CANCELADO" &&
            x.estado !== "REALIZADO" &&
            x.inicio.getTime() >= desde,
        )
        .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
      return {
        id: t.id,
        numero: t.numero,
        titulo: t.titulo,
        tipo: t.tipo,
        estado: t.estado,
        total,
        pagado,
        falta: deuda ? saldo(total, pagado) : 0,
        cuentaComoDeuda: deuda,
        proximoTurno: proximo?.inicio ?? null,
        fechaPresupuesto: t.fechaPresupuesto,
      };
    })
    .sort(
      (a, b) =>
        ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.fechaPresupuesto.getTime() - a.fechaPresupuesto.getTime(),
    );

  const porId = new Map(trabajosDb.map((t) => [t.id, t]));
  const cobros: CobroDeCliente[] = s.cobros
    .filter((c) => c.clienteId === id)
    .sort((a, b) => b.fecha.getTime() - a.fecha.getTime())
    .map((c) => {
      const t = c.trabajoId ? porId.get(c.trabajoId) : undefined;
      return {
        id: c.id,
        fecha: c.fecha,
        monto: c.monto,
        medio: c.medio,
        concepto: c.concepto,
        notas: c.notas,
        trabajo: t ? { id: t.id, numero: t.numero, titulo: t.titulo } : null,
      };
    });

  const equipos: EquipoDeCliente[] = s.equipos
    .filter((e) => e.clienteId === id)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((e) => ({
      ...e,
      diasParaMantenimiento: e.proximoMantenimiento ? diasHasta(e.proximoMantenimiento, hoy) : null,
    }));

  const cuenta = calcularCuenta(trabajos, cobros.reduce((a, c) => a + c.monto, 0));

  return { cliente, cuenta, trabajos, cobros, equipos, hoy };
}

/** Datos del cliente para el formulario de edición. */
export async function obtenerDatosCliente(id: string): Promise<Cliente | null> {
  const s = await leerStore();
  return s.clientes.find((c) => c.id === id) ?? null;
}

/** Nombre del cliente (para encabezados de pantallas hijas). */
export async function obtenerNombreCliente(id: string): Promise<{ id: string; nombre: string } | null> {
  const s = await leerStore();
  const c = s.clientes.find((x) => x.id === id);
  return c ? { id: c.id, nombre: c.nombre } : null;
}

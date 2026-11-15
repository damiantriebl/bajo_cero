import "server-only";
import type {
  Cliente,
  Equipo,
  EstadoTrabajo,
  MedioPago,
  Prisma,
  TipoCliente,
  TipoTrabajo,
} from "@/lib/generated/prisma/client";
import { ahora, leerDb } from "@/lib/db";
import { avanceCobro, saldo, totalItems } from "@/lib/calculos";
import { diasHasta, inicioDia } from "@/lib/fechas";

// Cuentas de clientes: presupuesto aprobado, lo que pagó y lo que falta.
// Regla: suman como deuda los trabajos APROBADO, EN_CURSO, TERMINADO y COBRADO.
// PRESUPUESTO (sin aprobar) y CANCELADO no cuentan.

export const ESTADOS_CON_DEUDA: readonly EstadoTrabajo[] = ["APROBADO", "EN_CURSO", "TERMINADO", "COBRADO"];

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

export function agrupar<T>(filas: T[], clave: (f: T) => string | null): Map<string, T[]> {
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

/** Ítems (de varios trabajos) → total de cada trabajo, con totalItems(). */
export function totalPorTrabajo(items: { trabajoId: string; cantidad: number; precioUnitario: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [trabajoId, lista] of agrupar(items, (i) => i.trabajoId)) out.set(trabajoId, totalItems(lista));
  return out;
}

/** Lo que hace falta de cada ítem para totalPorTrabajo(). */
export const SELECT_ITEM = { trabajoId: true, cantidad: true, precioUnitario: true } as const;

/**
 * Lo cobrado, sumado en la base (una sola consulta, sin traer cada cobro):
 * por cliente (todos sus cobros, con o sin trabajo) y por trabajo.
 */
export async function cobradoAgrupado(
  prisma: Prisma.TransactionClient,
): Promise<{ porCliente: Map<string, number>; porTrabajo: Map<string, number> }> {
  const grupos = await prisma.cobro.groupBy({ by: ["clienteId", "trabajoId"], _sum: { monto: true } });
  const porCliente = new Map<string, number>();
  const porTrabajo = new Map<string, number>();
  for (const g of grupos) {
    const monto = g._sum.monto ?? 0;
    porCliente.set(g.clienteId, (porCliente.get(g.clienteId) ?? 0) + monto);
    if (g.trabajoId) porTrabajo.set(g.trabajoId, (porTrabajo.get(g.trabajoId) ?? 0) + monto);
  }
  return { porCliente, porTrabajo };
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

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

type CamposBusqueda = Pick<Cliente, "nombre" | "direccion" | "localidad" | "telefono">;

function coincide(c: CamposBusqueda, q: string): boolean {
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
  const prisma = await leerDb();

  // "Por cobrar en total" y los conteos necesitan la cuenta de TODOS los clientes,
  // así que se traen todos (pocas columnas) y la búsqueda se aplica en memoria:
  // ignora tildes ("Gomez" encuentra "Gómez") y compara teléfonos solo por dígitos.
  // CANCELADO no se trae: no suma deuda ni se muestra como trabajo del cliente.
  // Los ítems van en una consulta aparte (en paralelo) para no esperar a los trabajos.
  const noCancelado = { estado: { not: "CANCELADO" } } as const;
  const [clientes, trabajosDb, itemsDb, cobrado] = await Promise.all([
    prisma.cliente.findMany({
      select: { id: true, nombre: true, tipo: true, telefono: true, direccion: true, localidad: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.trabajo.findMany({
      where: noCancelado,
      select: { id: true, clienteId: true, titulo: true, estado: true },
      orderBy: [{ fechaPresupuesto: "desc" }, { numero: "desc" }],
    }),
    prisma.itemTrabajo.findMany({ where: { trabajo: noCancelado }, select: SELECT_ITEM }),
    cobradoAgrupado(prisma),
  ]);
  const totales = totalPorTrabajo(itemsDb);

  // Del más reciente al más viejo (orden de la consulta).
  const trabajosPorCliente = agrupar(
    trabajosDb.map((t) => {
      const total = totales.get(t.id) ?? 0;
      const pagado = cobrado.porTrabajo.get(t.id) ?? 0;
      return {
        clienteId: t.clienteId,
        titulo: t.titulo,
        estado: t.estado,
        total,
        pagado,
        falta: cuentaComoDeuda(t.estado) ? saldo(total, pagado) : 0,
      };
    }),
    (t) => t.clienteId,
  );

  const todas = clientes.map((c) => {
    const trabajos = trabajosPorCliente.get(c.id) ?? [];
    const cuenta = calcularCuenta(trabajos, cobrado.porCliente.get(c.id) ?? 0);
    const conSaldo = trabajos.filter((t) => t.falta > 0).sort((a, b) => b.falta - a.falta);
    const principal =
      cuenta.estado === "presupuesto"
        ? trabajos.find((t) => t.estado === "PRESUPUESTO")
        : (conSaldo[0] ?? trabajos.find((t) => cuentaComoDeuda(t.estado)) ?? trabajos[0]);
    const fila: FilaCliente = {
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      telefono: c.telefono,
      direccion: c.direccion,
      cuenta,
      trabajo: principal ? { titulo: principal.titulo, total: principal.total, pagado: principal.pagado } : null,
      otrosConSaldo: Math.max(0, conSaldo.length - 1),
    };
    return { fila, cliente: c };
  });

  const buscadas = (q.trim() ? todas.filter((x) => coincide(x.cliente, q)) : todas).map((x) => x.fila);
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
    porCobrar: todas.reduce((a, x) => a + x.fila.cuenta.falta, 0),
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
  const prisma = await leerDb();
  const hoy = ahora();

  // Todo en paralelo (una sola espera a la base); se une en memoria.
  const deEsteCliente = { trabajo: { is: { clienteId: id } } };
  const [cliente, trabajosDb, itemsDb, turnosDb, cobradoPorTrabajo, cobrosDb, equiposDb] = await Promise.all([
    prisma.cliente.findUnique({ where: { id } }),
    prisma.trabajo.findMany({
      where: { clienteId: id },
      select: { id: true, numero: true, titulo: true, tipo: true, estado: true, fechaPresupuesto: true },
    }),
    prisma.itemTrabajo.findMany({ where: deEsteCliente, select: SELECT_ITEM }),
    // Visitas pendientes desde hoy (la primera de cada trabajo es la próxima).
    prisma.turno.findMany({
      where: { ...deEsteCliente, estado: { notIn: ["CANCELADO", "REALIZADO"] }, inicio: { gte: inicioDia(hoy) } },
      orderBy: { inicio: "asc" },
      select: { trabajoId: true, inicio: true },
    }),
    // Lo cobrado de cada trabajo del cliente (sumado en la base).
    prisma.cobro.groupBy({ by: ["trabajoId"], where: deEsteCliente, _sum: { monto: true } }),
    prisma.cobro.findMany({
      where: { clienteId: id },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      select: { id: true, fecha: true, monto: true, medio: true, concepto: true, notas: true, trabajoId: true },
    }),
    prisma.equipo.findMany({ where: { clienteId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
  ]);
  if (!cliente) return null;

  const totales = totalPorTrabajo(itemsDb);
  const pagadoPorTrabajo = new Map(cobradoPorTrabajo.map((g) => [g.trabajoId, g._sum.monto ?? 0]));
  const proximoTurno = new Map<string, Date>();
  for (const t of turnosDb) if (!proximoTurno.has(t.trabajoId)) proximoTurno.set(t.trabajoId, t.inicio);

  const trabajos: TrabajoDeCliente[] = trabajosDb
    .map((t) => {
      const total = totales.get(t.id) ?? 0;
      const pagado = pagadoPorTrabajo.get(t.id) ?? 0;
      const deuda = cuentaComoDeuda(t.estado);
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
        proximoTurno: proximoTurno.get(t.id) ?? null,
        fechaPresupuesto: t.fechaPresupuesto,
      };
    })
    .sort(
      (a, b) =>
        ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || b.fechaPresupuesto.getTime() - a.fechaPresupuesto.getTime(),
    );

  const porId = new Map(trabajosDb.map((t) => [t.id, t]));
  const cobros: CobroDeCliente[] = cobrosDb.map(({ trabajoId, ...c }) => {
    const t = trabajoId ? porId.get(trabajoId) : undefined;
    return { ...c, trabajo: t ? { id: t.id, numero: t.numero, titulo: t.titulo } : null };
  });

  const equipos: EquipoDeCliente[] = equiposDb.map((e) => ({
    ...e,
    diasParaMantenimiento: e.proximoMantenimiento ? diasHasta(e.proximoMantenimiento, hoy) : null,
  }));

  const cuenta = calcularCuenta(trabajos, cobros.reduce((a, c) => a + c.monto, 0));

  return { cliente, cuenta, trabajos, cobros, equipos, hoy };
}

/** Datos del cliente para el formulario de edición. */
export async function obtenerDatosCliente(id: string): Promise<Cliente | null> {
  const prisma = await leerDb();
  return prisma.cliente.findUnique({ where: { id } });
}

/** Nombre del cliente (para encabezados de pantallas hijas). */
export async function obtenerNombreCliente(id: string): Promise<{ id: string; nombre: string } | null> {
  const prisma = await leerDb();
  return prisma.cliente.findUnique({ where: { id }, select: { id: true, nombre: true } });
}

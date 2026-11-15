import "server-only";
import { Prisma, type Empresa, type PrismaClient } from "@/lib/generated/prisma/client";
import type { EstadoTrabajo, EstadoTurno, MedioPago, TipoCliente, TipoTrabajo, Unidad } from "@/lib/generated/prisma/enums";
import { leerDb, ahora } from "@/lib/db";
import { EMPRESA_DEFECTO } from "@/lib/empresa-defecto";
import { costoConsumos, rentabilidad, saldo, sumaMontos, totalItems, type Rentabilidad } from "@/lib/calculos";
import { aInputFecha, sumarDias } from "@/lib/fechas";

// Trabajos y presupuestos: el trabajo agrupa lo que se cobra (ítems), las visitas,
// los cobros, los materiales usados y la mano de obra.

/** Estados que se muestran por defecto en la lista ("Activos"). */
const ESTADOS_ACTIVOS: readonly EstadoTrabajo[] = ["PRESUPUESTO", "APROBADO", "EN_CURSO", "TERMINADO"];

/** Turnos que todavía cuentan como "próxima visita". */
const TURNOS_PENDIENTES: readonly EstadoTurno[] = ["A_CONFIRMAR", "CONFIRMADO"];

export type FiltroTrabajos = "ACTIVOS" | "TODOS" | EstadoTrabajo;

// ───────── Tipos que devuelve este módulo ─────────

export type FilaTrabajo = {
  id: string;
  numero: number;
  titulo: string;
  tipo: TipoTrabajo;
  estado: EstadoTrabajo;
  cliente: { id: string; nombre: string };
  total: number;
  cobrado: number;
  falta: number;
  validoHasta: Date | null;
  proximaVisita: Date | null;
};

export type ItemDeTrabajo = {
  id: string;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  precioUnitario: number;
  importe: number;
  insumoId: string | null;
};

export type VisitaDeTrabajo = {
  id: string;
  inicio: Date;
  fin: Date;
  estado: EstadoTurno;
  notas: string | null;
  tecnicos: string[];
};

export type MaterialUsado = {
  id: string;
  fecha: Date;
  insumo: string;
  unidad: Unidad;
  cantidad: number;
  costoUnitario: number;
  costo: number;
};

/** Insumo para cargar material usado. */
export type InsumoParaConsumo = { id: string; nombre: string; unidad: Unidad; stock: number };

/** Insumo para armar ítems del presupuesto (precio de venta sugerido). */
export type InsumoParaItems = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: Unidad;
  precioVenta: number | null;
  stock: number;
};

export type DetalleTrabajo = {
  id: string;
  numero: number;
  titulo: string;
  tipo: TipoTrabajo;
  estado: EstadoTrabajo;
  /** Dirección del trabajo o, si no tiene, la del cliente. */
  direccion: string | null;
  descripcion: string | null;
  fechaPresupuesto: Date;
  validoHasta: Date | null;
  fechaAprobado: Date | null;
  fechaTerminado: Date | null;
  cliente: { id: string; nombre: string; telefono: string | null; direccion: string | null };
  items: ItemDeTrabajo[];
  total: number;
  cobrado: number;
  falta: number;
  cobros: { id: string; fecha: Date; monto: number; medio: MedioPago; concepto: string | null }[];
  visitas: VisitaDeTrabajo[];
  proximaVisita: VisitaDeTrabajo | null;
  checklist: { id: string; texto: string; hecho: boolean }[];
  materiales: MaterialUsado[];
  /** Jornadas cargadas a este trabajo. */
  jornadas: number;
  rentabilidad: Rentabilidad;
  insumos: InsumoParaConsumo[];
  /** "Ahora" del request, para fechas relativas (Hoy, Mañana…). */
  hoy: Date;
};

export type Presupuesto = {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string | null;
  estado: EstadoTrabajo;
  fechaPresupuesto: Date;
  validoHasta: Date | null;
  direccion: string | null;
  cliente: { nombre: string; tipo: TipoCliente; telefono: string | null };
  items: ItemDeTrabajo[];
  total: number;
  /** Las del trabajo o, si no tiene, las de la empresa. */
  condiciones: string | null;
  empresa: {
    razonSocial: string;
    nombreFantasia: string;
    cuit: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
    garantia: string | null;
  };
};

export type ClienteParaTrabajo = { id: string; nombre: string; direccion: string | null };

export type ItemEditable = {
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  precioUnitario: number;
  insumoId: string | null;
};

export type DatosNuevoTrabajo = {
  clientes: ClienteParaTrabajo[];
  insumos: InsumoParaItems[];
  /** Valor para <input type="date">: hoy + validez de la empresa. */
  validoHasta: string;
  condiciones: string;
};

export type TrabajoParaEditar = {
  id: string;
  numero: number;
  estado: EstadoTrabajo;
  cliente: ClienteParaTrabajo;
  titulo: string;
  tipo: TipoTrabajo;
  direccion: string;
  descripcion: string;
  condiciones: string;
  validoHasta: string;
  items: ItemEditable[];
  insumos: InsumoParaItems[];
};

// ───────── Ayudas internas ─────────

// La base ordena con collation "C" (Á después de Z): las listas chicas que se
// cargan enteras se ordenan acá, como en castellano.
const COLLATOR_ES = new Intl.Collator("es");
const porNombre = (a: { nombre: string }, b: { nombre: string }) => COLLATOR_ES.compare(a.nombre, b.nombre);

/** Minúsculas y sin acentos, para buscar. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Para buscar sin acentos en SQL sin depender de la extensión "unaccent".
const CON_ACENTO = "ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇÝáàâäãåéèêëíìîïóòôöõúùûüñçýÿ";
const SIN_ACENTO = "AAAAAAEEEEIIIIOOOOOUUUUNCYaaaaaaeeeeiiiiooooouuuuncyy";

const SELECT_ITEM = {
  id: true,
  descripcion: true,
  cantidad: true,
  unidad: true,
  precioUnitario: true,
  insumoId: true,
} satisfies Prisma.ItemTrabajoSelect;

function aItem(i: Prisma.ItemTrabajoGetPayload<{ select: typeof SELECT_ITEM }>): ItemDeTrabajo {
  return { ...i, importe: Math.round(i.cantidad * i.precioUnitario) };
}

const SELECT_INSUMO_PARA_ITEMS = {
  id: true,
  nombre: true,
  categoria: true,
  unidad: true,
  precioVenta: true,
  stock: true,
} satisfies Prisma.InsumoSelect;

async function insumosParaItems(prisma: PrismaClient): Promise<InsumoParaItems[]> {
  const insumos = await prisma.insumo.findMany({ where: { activo: true }, select: SELECT_INSUMO_PARA_ITEMS });
  return insumos.sort(porNombre);
}

/** La fila de la empresa o, si todavía no se cargó en Ajustes, los valores por defecto. */
async function empresaODefecto(prisma: PrismaClient): Promise<Empresa> {
  return (await prisma.empresa.findUnique({ where: { id: EMPRESA_DEFECTO.id } })) ?? EMPRESA_DEFECTO;
}

function whereDeFiltro(filtro: FiltroTrabajos): Prisma.TrabajoWhereInput {
  if (filtro === "TODOS") return {};
  if (filtro === "ACTIVOS") return { estado: { in: [...ESTADOS_ACTIVOS] } };
  return { estado: filtro };
}

function entraEnFiltro(filtro: FiltroTrabajos, estado: EstadoTrabajo): boolean {
  return filtro === "TODOS" ? true : filtro === "ACTIVOS" ? ESTADOS_ACTIVOS.includes(estado) : estado === filtro;
}

function contarPorEstado(grupos: { estado: EstadoTrabajo; cantidad: number }[]): Record<FiltroTrabajos, number> {
  const conteos: Record<FiltroTrabajos, number> = {
    ACTIVOS: 0,
    TODOS: 0,
    PRESUPUESTO: 0,
    APROBADO: 0,
    EN_CURSO: 0,
    TERMINADO: 0,
    COBRADO: 0,
    CANCELADO: 0,
  };
  for (const { estado, cantidad } of grupos) {
    conteos[estado] += cantidad;
    conteos.TODOS += cantidad;
    if (ESTADOS_ACTIVOS.includes(estado)) conteos.ACTIVOS += cantidad;
  }
  return conteos;
}

/**
 * Trabajos que coinciden con la búsqueda (ya normalizada): nombre del cliente o
 * título sin importar mayúsculas ni acentos, o número que empieza con lo buscado.
 * Devuelve todos los estados para poder contar cada filtro.
 */
async function buscarTrabajos(prisma: PrismaClient, q: string): Promise<{ id: string; estado: EstadoTrabajo }[]> {
  const patron = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const numero = q.replace(/^n\.?º?\s*/, "").replace(/^0+/, "");
  const porNumero = /^\d+$/.test(numero) ? Prisma.sql`OR t.numero::text LIKE ${`${numero}%`}` : Prisma.empty;
  return prisma.$queryRaw<{ id: string; estado: EstadoTrabajo }[]>`
    SELECT t.id, t.estado::text AS estado
    FROM "Trabajo" t
    JOIN "Cliente" c ON c.id = t."clienteId"
    WHERE lower(translate(c.nombre, ${CON_ACENTO}, ${SIN_ACENTO})) LIKE ${patron}
       OR lower(translate(t.titulo, ${CON_ACENTO}, ${SIN_ACENTO})) LIKE ${patron}
       ${porNumero}
  `;
}

// ───────── Consultas ─────────

/** Lista de trabajos con filtro por estado y búsqueda (cliente, título o número). */
export async function listarTrabajos(
  filtro: FiltroTrabajos,
  busqueda: string,
): Promise<{ filas: FilaTrabajo[]; conteos: Record<FiltroTrabajos, number>; hoy: Date }> {
  const prisma = await leerDb();
  const hoy = ahora();

  // Con búsqueda, primero los ids que coinciden (y sus estados, para los conteos).
  const q = normalizar(busqueda.trim());
  let conteosBusqueda: Record<FiltroTrabajos, number> | null = null;
  let where = whereDeFiltro(filtro);
  if (q) {
    const encontrados = await buscarTrabajos(prisma, q);
    conteosBusqueda = contarPorEstado(encontrados.map((e) => ({ estado: e.estado, cantidad: 1 })));
    const ids = encontrados.filter((e) => entraEnFiltro(filtro, e.estado)).map((e) => e.id);
    if (ids.length === 0) return { filas: [], conteos: conteosBusqueda, hoy };
    where = { id: { in: ids } };
  }

  const [porEstado, trabajos, cobros] = await Promise.all([
    conteosBusqueda ? null : prisma.trabajo.groupBy({ by: ["estado"], _count: { _all: true } }),
    prisma.trabajo.findMany({
      where,
      orderBy: { numero: "desc" },
      select: {
        id: true,
        numero: true,
        titulo: true,
        tipo: true,
        estado: true,
        validoHasta: true,
        cliente: { select: { id: true, nombre: true } },
        items: { select: { cantidad: true, precioUnitario: true } },
        turnos: {
          where: { estado: { in: [...TURNOS_PENDIENTES] }, fin: { gte: hoy } },
          orderBy: { inicio: "asc" },
          take: 1,
          select: { inicio: true },
        },
      },
    }),
    prisma.cobro.groupBy({ by: ["trabajoId"], where: { trabajo: { is: where } }, _sum: { monto: true } }),
  ]);

  const conteos =
    conteosBusqueda ?? contarPorEstado((porEstado ?? []).map((g) => ({ estado: g.estado, cantidad: g._count._all })));
  const cobrado = new Map(cobros.map((c) => [c.trabajoId, c._sum.monto ?? 0]));

  const filas: FilaTrabajo[] = trabajos.map((t) => {
    const total = totalItems(t.items);
    const pagado = cobrado.get(t.id) ?? 0;
    return {
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      tipo: t.tipo,
      estado: t.estado,
      cliente: t.cliente,
      total,
      cobrado: pagado,
      falta: saldo(total, pagado),
      validoHasta: t.validoHasta,
      proximaVisita: t.turnos[0]?.inicio ?? null,
    };
  });

  return { filas, conteos, hoy };
}

/** Todo lo de un trabajo para su pantalla. `null` si no existe. */
export async function obtenerTrabajo(id: string): Promise<DetalleTrabajo | null> {
  const prisma = await leerDb();
  const hoy = ahora();

  const [t, personal, insumos] = await Promise.all([
    prisma.trabajo.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        titulo: true,
        tipo: true,
        estado: true,
        direccion: true,
        descripcion: true,
        fechaPresupuesto: true,
        validoHasta: true,
        fechaAprobado: true,
        fechaTerminado: true,
        cliente: { select: { id: true, nombre: true, telefono: true, direccion: true } },
        items: { orderBy: { orden: "asc" }, select: SELECT_ITEM },
        cobros: {
          orderBy: [{ fecha: "asc" }, { createdAt: "asc" }],
          select: { id: true, fecha: true, monto: true, medio: true, concepto: true },
        },
        turnos: {
          orderBy: { inicio: "asc" },
          select: {
            id: true,
            inicio: true,
            fin: true,
            estado: true,
            notas: true,
            tecnicos: { orderBy: { nombre: "asc" }, select: { nombre: true } },
          },
        },
        checklist: { orderBy: { orden: "asc" }, select: { id: true, texto: true, hecho: true } },
        movimientos: {
          where: { tipo: "CONSUMO" },
          orderBy: { fecha: "asc" },
          select: {
            id: true,
            fecha: true,
            cantidad: true,
            costoUnitario: true,
            insumo: { select: { nombre: true, unidad: true } },
          },
        },
      },
    }),
    prisma.jornada.aggregate({ where: { trabajoId: id }, _sum: { monto: true }, _count: true }),
    prisma.insumo.findMany({ where: { activo: true }, select: { id: true, nombre: true, unidad: true, stock: true } }),
  ]);
  if (!t) return null;

  const items = t.items.map(aItem);
  const total = totalItems(items);
  const cobrado = sumaMontos(t.cobros);

  const visitas: VisitaDeTrabajo[] = t.turnos.map((v) => ({ ...v, tecnicos: v.tecnicos.map((e) => e.nombre) }));
  const proximaVisita =
    visitas.find((v) => TURNOS_PENDIENTES.includes(v.estado) && v.fin.getTime() >= hoy.getTime()) ?? null;

  const materiales: MaterialUsado[] = t.movimientos.map((m) => {
    const cantidad = Math.abs(m.cantidad);
    const costoUnitario = m.costoUnitario ?? 0;
    return {
      id: m.id,
      fecha: m.fecha,
      insumo: m.insumo.nombre,
      unidad: m.insumo.unidad,
      cantidad,
      costoUnitario,
      costo: Math.round(cantidad * costoUnitario),
    };
  });

  return {
    id: t.id,
    numero: t.numero,
    titulo: t.titulo,
    tipo: t.tipo,
    estado: t.estado,
    direccion: t.direccion ?? t.cliente.direccion,
    descripcion: t.descripcion,
    fechaPresupuesto: t.fechaPresupuesto,
    validoHasta: t.validoHasta,
    fechaAprobado: t.fechaAprobado,
    fechaTerminado: t.fechaTerminado,
    cliente: t.cliente,
    items,
    total,
    cobrado,
    falta: saldo(total, cobrado),
    cobros: t.cobros,
    visitas,
    proximaVisita,
    checklist: t.checklist,
    materiales,
    jornadas: personal._count,
    rentabilidad: rentabilidad(total, costoConsumos(t.movimientos), personal._sum.monto ?? 0),
    insumos: insumos.sort(porNombre),
    hoy,
  };
}

/** Lo que va en el presupuesto que recibe el cliente. `null` si no existe. */
export async function obtenerPresupuesto(id: string): Promise<Presupuesto | null> {
  const prisma = await leerDb();
  const [t, e] = await Promise.all([
    prisma.trabajo.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        titulo: true,
        descripcion: true,
        estado: true,
        fechaPresupuesto: true,
        validoHasta: true,
        direccion: true,
        condiciones: true,
        cliente: { select: { nombre: true, tipo: true, telefono: true, direccion: true } },
        items: { orderBy: { orden: "asc" }, select: SELECT_ITEM },
      },
    }),
    empresaODefecto(prisma),
  ]);
  if (!t) return null;

  const items = t.items.map(aItem);
  return {
    id: t.id,
    numero: t.numero,
    titulo: t.titulo,
    descripcion: t.descripcion,
    estado: t.estado,
    fechaPresupuesto: t.fechaPresupuesto,
    validoHasta: t.validoHasta,
    direccion: t.direccion ?? t.cliente.direccion,
    cliente: { nombre: t.cliente.nombre, tipo: t.cliente.tipo, telefono: t.cliente.telefono },
    items,
    total: totalItems(items),
    condiciones: t.condiciones ?? e.condicionesPresupuesto,
    empresa: {
      razonSocial: e.razonSocial,
      nombreFantasia: e.nombreFantasia,
      cuit: e.cuit,
      telefono: e.telefono,
      email: e.email,
      direccion: e.direccion,
      garantia: e.garantia,
    },
  };
}

/** Número, título y cliente (para el título de la pestaña). */
export async function resumenTrabajo(id: string): Promise<{ numero: number; titulo: string; cliente: string } | null> {
  const prisma = await leerDb();
  const t = await prisma.trabajo.findUnique({
    where: { id },
    select: { numero: true, titulo: true, cliente: { select: { nombre: true } } },
  });
  if (!t) return null;
  return { numero: t.numero, titulo: t.titulo, cliente: t.cliente.nombre };
}

/** Clientes, insumos y valores por defecto para armar un presupuesto nuevo. */
export async function datosNuevoTrabajo(): Promise<DatosNuevoTrabajo> {
  const prisma = await leerDb();
  const hoy = ahora();
  const [clientes, insumos, empresa] = await Promise.all([
    prisma.cliente.findMany({ select: { id: true, nombre: true, direccion: true } }),
    insumosParaItems(prisma),
    empresaODefecto(prisma),
  ]);
  return {
    clientes: clientes.sort(porNombre),
    insumos,
    validoHasta: aInputFecha(sumarDias(hoy, empresa.validezPresupuestoDias)),
    condiciones: empresa.condicionesPresupuesto ?? "",
  };
}

/** Un trabajo con sus ítems, listo para el formulario de edición. `null` si no existe. */
export async function obtenerTrabajoParaEditar(id: string): Promise<TrabajoParaEditar | null> {
  const prisma = await leerDb();
  const [t, insumos, empresa] = await Promise.all([
    prisma.trabajo.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        titulo: true,
        tipo: true,
        direccion: true,
        descripcion: true,
        condiciones: true,
        validoHasta: true,
        cliente: { select: { id: true, nombre: true, direccion: true } },
        items: {
          orderBy: { orden: "asc" },
          select: { descripcion: true, cantidad: true, unidad: true, precioUnitario: true, insumoId: true },
        },
      },
    }),
    insumosParaItems(prisma),
    empresaODefecto(prisma),
  ]);
  if (!t) return null;
  return {
    id: t.id,
    numero: t.numero,
    estado: t.estado,
    cliente: t.cliente,
    titulo: t.titulo,
    tipo: t.tipo,
    direccion: t.direccion ?? "",
    descripcion: t.descripcion ?? "",
    condiciones: t.condiciones ?? empresa.condicionesPresupuesto ?? "",
    validoHasta: t.validoHasta ? aInputFecha(t.validoHasta) : "",
    items: t.items,
    insumos,
  };
}

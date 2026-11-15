import "server-only";
import type { EstadoTrabajo, EstadoTurno, MedioPago, TipoCliente, TipoTrabajo, Unidad } from "@/lib/generated/prisma/enums";
import { leerStore, ahora, type Store } from "@/lib/mock/store";
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

/** Minúsculas y sin acentos, para buscar. */
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function itemsDe(s: Store, trabajoId: string): ItemDeTrabajo[] {
  return s.items
    .filter((i) => i.trabajoId === trabajoId)
    .sort((a, b) => a.orden - b.orden)
    .map((i) => ({
      id: i.id,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precioUnitario: i.precioUnitario,
      importe: Math.round(i.cantidad * i.precioUnitario),
      insumoId: i.insumoId,
    }));
}

function visitasDe(s: Store, trabajoId: string): VisitaDeTrabajo[] {
  const nombres = new Map(s.empleados.map((e) => [e.id, e.nombre]));
  return s.turnos
    .filter((t) => t.trabajoId === trabajoId)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
    .map((t) => ({
      id: t.id,
      inicio: t.inicio,
      fin: t.fin,
      estado: t.estado,
      notas: t.notas,
      tecnicos: s.turnoTecnicos
        .filter((tt) => tt.turnoId === t.id)
        .map((tt) => nombres.get(tt.empleadoId))
        .filter((n): n is string => Boolean(n)),
    }));
}

function insumosParaItems(s: Store): InsumoParaItems[] {
  return s.insumos
    .filter((i) => i.activo)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((i) => ({
      id: i.id,
      nombre: i.nombre,
      categoria: i.categoria,
      unidad: i.unidad,
      precioVenta: i.precioVenta,
      stock: i.stock,
    }));
}

function clientesParaTrabajo(s: Store): ClienteParaTrabajo[] {
  return [...s.clientes]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((c) => ({ id: c.id, nombre: c.nombre, direccion: c.direccion }));
}

// ───────── Consultas ─────────

/** Lista de trabajos con filtro por estado y búsqueda (cliente, título o número). */
export async function listarTrabajos(
  filtro: FiltroTrabajos,
  busqueda: string,
): Promise<{ filas: FilaTrabajo[]; conteos: Record<FiltroTrabajos, number>; hoy: Date }> {
  const s = await leerStore();
  const hoy = ahora();

  const clientes = new Map(s.clientes.map((c) => [c.id, c]));
  const items = agrupar(s.items, (i) => i.trabajoId);
  const cobros = agrupar(s.cobros, (c) => c.trabajoId);
  const turnos = agrupar(
    s.turnos.filter((t) => TURNOS_PENDIENTES.includes(t.estado) && t.fin.getTime() >= hoy.getTime()),
    (t) => t.trabajoId,
  );

  const q = normalizar(busqueda.trim());
  const qNumero = q.replace(/^n\.?º?\s*/, "").replace(/^0+/, "");

  const encontrados: FilaTrabajo[] = [];
  for (const t of s.trabajos) {
    const cliente = clientes.get(t.clienteId);
    const nombre = cliente?.nombre ?? "Cliente borrado";
    if (q) {
      const coincide =
        normalizar(nombre).includes(q) ||
        normalizar(t.titulo).includes(q) ||
        (qNumero !== "" && /^\d+$/.test(qNumero) && String(t.numero).startsWith(qNumero));
      if (!coincide) continue;
    }
    const total = totalItems(items.get(t.id) ?? []);
    const cobrado = sumaMontos(cobros.get(t.id) ?? []);
    const proxima = (turnos.get(t.id) ?? []).sort((a, b) => a.inicio.getTime() - b.inicio.getTime())[0];
    encontrados.push({
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      tipo: t.tipo,
      estado: t.estado,
      cliente: { id: t.clienteId, nombre },
      total,
      cobrado,
      falta: saldo(total, cobrado),
      validoHasta: t.validoHasta,
      proximaVisita: proxima?.inicio ?? null,
    });
  }

  const conteos: Record<FiltroTrabajos, number> = {
    ACTIVOS: 0,
    TODOS: encontrados.length,
    PRESUPUESTO: 0,
    APROBADO: 0,
    EN_CURSO: 0,
    TERMINADO: 0,
    COBRADO: 0,
    CANCELADO: 0,
  };
  for (const f of encontrados) {
    conteos[f.estado]++;
    if (ESTADOS_ACTIVOS.includes(f.estado)) conteos.ACTIVOS++;
  }

  const filas = encontrados
    .filter((f) =>
      filtro === "TODOS" ? true : filtro === "ACTIVOS" ? ESTADOS_ACTIVOS.includes(f.estado) : f.estado === filtro,
    )
    .sort((a, b) => b.numero - a.numero);

  return { filas, conteos, hoy };
}

/** Todo lo de un trabajo para su pantalla. `null` si no existe. */
export async function obtenerTrabajo(id: string): Promise<DetalleTrabajo | null> {
  const s = await leerStore();
  const hoy = ahora();
  const t = s.trabajos.find((x) => x.id === id);
  if (!t) return null;
  const cliente = s.clientes.find((c) => c.id === t.clienteId);

  const items = itemsDe(s, t.id);
  const total = totalItems(items);
  const cobros = s.cobros
    .filter((c) => c.trabajoId === t.id)
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .map((c) => ({ id: c.id, fecha: c.fecha, monto: c.monto, medio: c.medio, concepto: c.concepto }));
  const cobrado = sumaMontos(cobros);

  const visitas = visitasDe(s, t.id);
  const proximaVisita =
    visitas.find((v) => TURNOS_PENDIENTES.includes(v.estado) && v.fin.getTime() >= hoy.getTime()) ?? null;

  const insumos = new Map(s.insumos.map((i) => [i.id, i]));
  const consumos = s.movimientos
    .filter((m) => m.trabajoId === t.id && m.tipo === "CONSUMO")
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const materiales: MaterialUsado[] = consumos.map((m) => {
    const insumo = insumos.get(m.insumoId);
    const cantidad = Math.abs(m.cantidad);
    const costoUnitario = m.costoUnitario ?? 0;
    return {
      id: m.id,
      fecha: m.fecha,
      insumo: insumo?.nombre ?? "Insumo borrado",
      unidad: insumo?.unidad ?? "UNIDAD",
      cantidad,
      costoUnitario,
      costo: Math.round(cantidad * costoUnitario),
    };
  });

  const jornadas = s.jornadas.filter((j) => j.trabajoId === t.id);

  return {
    id: t.id,
    numero: t.numero,
    titulo: t.titulo,
    tipo: t.tipo,
    estado: t.estado,
    direccion: t.direccion ?? cliente?.direccion ?? null,
    descripcion: t.descripcion,
    fechaPresupuesto: t.fechaPresupuesto,
    validoHasta: t.validoHasta,
    fechaAprobado: t.fechaAprobado,
    fechaTerminado: t.fechaTerminado,
    cliente: {
      id: t.clienteId,
      nombre: cliente?.nombre ?? "Cliente borrado",
      telefono: cliente?.telefono ?? null,
      direccion: cliente?.direccion ?? null,
    },
    items,
    total,
    cobrado,
    falta: saldo(total, cobrado),
    cobros,
    visitas,
    proximaVisita,
    checklist: s.checklist
      .filter((c) => c.trabajoId === t.id)
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({ id: c.id, texto: c.texto, hecho: c.hecho })),
    materiales,
    jornadas: jornadas.length,
    rentabilidad: rentabilidad(total, costoConsumos(consumos), sumaMontos(jornadas)),
    insumos: s.insumos
      .filter((i) => i.activo)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, stock: i.stock })),
    hoy,
  };
}

/** Lo que va en el presupuesto que recibe el cliente. `null` si no existe. */
export async function obtenerPresupuesto(id: string): Promise<Presupuesto | null> {
  const s = await leerStore();
  const t = s.trabajos.find((x) => x.id === id);
  if (!t) return null;
  const cliente = s.clientes.find((c) => c.id === t.clienteId);
  const items = itemsDe(s, t.id);
  const e = s.empresa;
  return {
    id: t.id,
    numero: t.numero,
    titulo: t.titulo,
    descripcion: t.descripcion,
    estado: t.estado,
    fechaPresupuesto: t.fechaPresupuesto,
    validoHasta: t.validoHasta,
    direccion: t.direccion ?? cliente?.direccion ?? null,
    cliente: {
      nombre: cliente?.nombre ?? "Cliente borrado",
      tipo: cliente?.tipo ?? "PARTICULAR",
      telefono: cliente?.telefono ?? null,
    },
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
  const s = await leerStore();
  const t = s.trabajos.find((x) => x.id === id);
  if (!t) return null;
  return {
    numero: t.numero,
    titulo: t.titulo,
    cliente: s.clientes.find((c) => c.id === t.clienteId)?.nombre ?? "Cliente borrado",
  };
}

/** Clientes, insumos y valores por defecto para armar un presupuesto nuevo. */
export async function datosNuevoTrabajo(): Promise<DatosNuevoTrabajo> {
  const s = await leerStore();
  const hoy = ahora();
  return {
    clientes: clientesParaTrabajo(s),
    insumos: insumosParaItems(s),
    validoHasta: aInputFecha(sumarDias(hoy, s.empresa.validezPresupuestoDias)),
    condiciones: s.empresa.condicionesPresupuesto ?? "",
  };
}

/** Un trabajo con sus ítems, listo para el formulario de edición. `null` si no existe. */
export async function obtenerTrabajoParaEditar(id: string): Promise<TrabajoParaEditar | null> {
  const s = await leerStore();
  const t = s.trabajos.find((x) => x.id === id);
  if (!t) return null;
  const cliente = s.clientes.find((c) => c.id === t.clienteId);
  return {
    id: t.id,
    numero: t.numero,
    estado: t.estado,
    cliente: { id: t.clienteId, nombre: cliente?.nombre ?? "Cliente borrado", direccion: cliente?.direccion ?? null },
    titulo: t.titulo,
    tipo: t.tipo,
    direccion: t.direccion ?? "",
    descripcion: t.descripcion ?? "",
    condiciones: t.condiciones ?? s.empresa.condicionesPresupuesto ?? "",
    validoHasta: t.validoHasta ? aInputFecha(t.validoHasta) : "",
    items: itemsDe(s, t.id).map((i) => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad,
      unidad: i.unidad,
      precioUnitario: i.precioUnitario,
      insumoId: i.insumoId,
    })),
    insumos: insumosParaItems(s),
  };
}

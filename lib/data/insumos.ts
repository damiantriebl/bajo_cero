import "server-only";
import { ahora, leerDb } from "@/lib/db";
import { cantidadAPedir, estadoStock, type EstadoStock } from "@/lib/calculos";
import { EMPRESA_DEFECTO } from "@/lib/empresa-defecto";
import { aInputFecha } from "@/lib/fechas";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { TipoMovimiento, Unidad } from "@/lib/generated/prisma/enums";

// Consultas de insumos y movimientos de stock.

export type InsumoFila = {
  id: string;
  nombre: string;
  categoria: string | null;
  unidad: Unidad;
  stock: number;
  stockMinimo: number;
  costoUnitario: number;
  precioVenta: number | null;
  proveedorId: string | null;
  proveedorNombre: string | null;
  estado: EstadoStock;
};

export type MovimientoFila = {
  id: string;
  fecha: Date;
  tipo: TipoMovimiento;
  /** Con signo: + entra, − sale. */
  cantidad: number;
  costoUnitario: number | null;
  notas: string | null;
  insumoId: string;
  insumoNombre: string;
  unidad: Unidad;
  trabajo: { id: string; numero: number; titulo: string; clienteNombre: string | null } | null;
  compra: { id: string; proveedorId: string; proveedorNombre: string; numeroFactura: string | null } | null;
};

export type FiltroInsumos = "todos" | "bajo";

/** Movimientos que se muestran en la ficha de un insumo (los más recientes). */
const HISTORIAL_FICHA = 200;

/** Necesita reponerse: sin stock o por debajo del mínimo. */
const necesitaReponer = (i: { stock: number; stockMinimo: number }) => estadoStock(i) !== "ok";

/** Lo mismo que `necesitaReponer`, como filtro SQL (compara stock con la columna stockMinimo). */
const dondeNecesitaReponer = (prisma: PrismaClient): Prisma.InsumoWhereInput => ({
  OR: [{ stock: { lte: 0 } }, { stock: { lt: prisma.insumo.fields.stockMinimo } }],
});

/** Sin acentos ni mayúsculas: "Caño" encuentra "cano". */
const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, "es");

const selectInsumo = {
  id: true,
  nombre: true,
  categoria: true,
  unidad: true,
  stock: true,
  stockMinimo: true,
  costoUnitario: true,
  precioVenta: true,
  proveedorId: true,
  proveedor: { select: { nombre: true } },
} satisfies Prisma.InsumoSelect;

type InsumoConProveedor = Prisma.InsumoGetPayload<{ select: typeof selectInsumo }>;

const selectMovimiento = {
  id: true,
  fecha: true,
  tipo: true,
  cantidad: true,
  costoUnitario: true,
  notas: true,
  insumoId: true,
  insumo: { select: { nombre: true, unidad: true } },
  trabajo: { select: { id: true, numero: true, titulo: true, cliente: { select: { nombre: true } } } },
  compra: { select: { id: true, proveedorId: true, numeroFactura: true, proveedor: { select: { nombre: true } } } },
} satisfies Prisma.MovimientoStockSelect;

type MovimientoConRelaciones = Prisma.MovimientoStockGetPayload<{ select: typeof selectMovimiento }>;

/** Más reciente primero; el id desempata movimientos con la misma fecha. */
const ordenMovimientos = [{ fecha: "desc" }, { id: "desc" }] satisfies Prisma.MovimientoStockOrderByWithRelationInput[];

function aFila(i: InsumoConProveedor): InsumoFila {
  return {
    id: i.id,
    nombre: i.nombre,
    categoria: i.categoria,
    unidad: i.unidad,
    stock: i.stock,
    stockMinimo: i.stockMinimo,
    costoUnitario: i.costoUnitario,
    precioVenta: i.precioVenta,
    proveedorId: i.proveedorId,
    proveedorNombre: i.proveedor?.nombre ?? null,
    estado: estadoStock(i),
  };
}

function aMovimientoFila(m: MovimientoConRelaciones): MovimientoFila {
  return {
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    cantidad: m.cantidad,
    costoUnitario: m.costoUnitario,
    notas: m.notas,
    insumoId: m.insumoId,
    insumoNombre: m.insumo.nombre,
    unidad: m.insumo.unidad,
    trabajo: m.trabajo
      ? { id: m.trabajo.id, numero: m.trabajo.numero, titulo: m.trabajo.titulo, clienteNombre: m.trabajo.cliente.nombre }
      : null,
    compra: m.compra
      ? {
          id: m.compra.id,
          proveedorId: m.compra.proveedorId,
          proveedorNombre: m.compra.proveedor.nombre,
          numeroFactura: m.compra.numeroFactura,
        }
      : null,
  };
}

/** Listado de /insumos: búsqueda por nombre o categoría + filtro de stock bajo. */
export async function listarInsumos({ q, filtro }: { q: string; filtro: FiltroInsumos }) {
  const prisma = await leerDb();
  // El catálogo de insumos es chico (cientos como mucho): se trae entero en una consulta
  // y se filtra acá, así la búsqueda ignora acentos y salen todos los contadores juntos.
  const activos = await prisma.insumo.findMany({ where: { activo: true }, select: selectInsumo });

  const texto = normalizar(q);
  const encontrados = texto
    ? activos.filter((i) => normalizar(`${i.nombre} ${i.categoria ?? ""}`).includes(texto))
    : activos;

  // Los que necesitan reposición van primero; dentro de cada grupo, por nombre.
  const ordenados = [...encontrados].sort(
    (a, b) => Number(necesitaReponer(b)) - Number(necesitaReponer(a)) || porNombre(a, b),
  );
  const visibles = filtro === "bajo" ? ordenados.filter(necesitaReponer) : ordenados;

  return {
    insumos: visibles.map(aFila),
    cantidadTodos: encontrados.length,
    cantidadBajo: encontrados.filter(necesitaReponer).length,
    /** Total sin búsqueda, para el aviso de "bajo el mínimo". */
    bajoMinimo: activos.filter(necesitaReponer).length,
    hayInsumos: activos.length > 0,
  };
}

/** Últimos movimientos de stock de todos los insumos (vista "Movimientos"). */
export async function movimientosRecientes({ q, limite = 60 }: { q: string; limite?: number }) {
  const prisma = await leerDb();
  const texto = normalizar(q);

  let where: Prisma.MovimientoStockWhereInput | undefined;
  if (texto) {
    // Insumos cuyo nombre coincide (sin acentos), incluidos los dados de baja.
    const insumos = await prisma.insumo.findMany({ select: { id: true, nombre: true } });
    const ids = insumos.filter((i) => normalizar(i.nombre).includes(texto)).map((i) => i.id);
    if (ids.length === 0) return { movimientos: [] as MovimientoFila[], hoy: ahora() };
    where = { insumoId: { in: ids } };
  }

  const movimientos = await prisma.movimientoStock.findMany({
    where,
    orderBy: ordenMovimientos,
    take: limite,
    select: selectMovimiento,
  });
  return { movimientos: movimientos.map(aMovimientoFila), hoy: ahora() };
}

/** Ficha de un insumo con su historial (los últimos movimientos). `null` si no existe. */
export async function obtenerInsumo(id: string) {
  const prisma = await leerDb();
  const [insumo, movimientos] = await Promise.all([
    prisma.insumo.findUnique({
      where: { id },
      select: { ...selectInsumo, proveedor: { select: { id: true, nombre: true, telefono: true } } },
    }),
    prisma.movimientoStock.findMany({
      where: { insumoId: id },
      orderBy: ordenMovimientos,
      take: HISTORIAL_FICHA,
      select: selectMovimiento,
    }),
  ]);
  if (!insumo) return null;
  return {
    ...aFila(insumo),
    /** Cantidad sugerida para el próximo pedido (0 si hay stock suficiente). */
    aPedir: cantidadAPedir(insumo),
    proveedor: insumo.proveedor,
    movimientos: movimientos.map(aMovimientoFila),
    hoy: ahora(),
  };
}

export type InsumoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerInsumo>>>;

/** Categorías ya usadas, para sugerirlas en el formulario. */
export async function categoriasInsumos(): Promise<string[]> {
  const prisma = await leerDb();
  const filas = await prisma.insumo.groupBy({ by: ["categoria"], where: { categoria: { not: null } } });
  const set = new Set(filas.map((f) => f.categoria?.trim()).filter((c): c is string => Boolean(c)));
  return [...set].sort((a, b) => a.localeCompare(b, "es"));
}

export type OpcionInsumo = {
  id: string;
  nombre: string;
  unidad: Unidad;
  costoUnitario: number;
  proveedorId: string | null;
};

/** Insumos activos para elegir en una compra. */
export async function opcionesInsumos(): Promise<OpcionInsumo[]> {
  const prisma = await leerDb();
  const insumos = await prisma.insumo.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, unidad: true, costoUnitario: true, proveedorId: true },
  });
  return insumos.sort(porNombre);
}

export type ItemPedido = {
  id: string;
  nombre: string;
  unidad: Unidad;
  stock: number;
  stockMinimo: number;
  estado: EstadoStock;
  sugerida: number;
  costoUnitario: number;
  costoEstimado: number;
};

export type GrupoPedido = {
  proveedor: { id: string; nombre: string; contacto: string | null; telefono: string | null } | null;
  items: ItemPedido[];
  total: number;
};

/** Insumos bajo el mínimo agrupados por proveedor habitual ("Sin proveedor" al final). */
export async function pedidoSugerido() {
  const prisma = await leerDb();
  const [insumos, empresa] = await Promise.all([
    prisma.insumo.findMany({
      where: { activo: true, ...dondeNecesitaReponer(prisma) },
      select: {
        id: true,
        nombre: true,
        unidad: true,
        stock: true,
        stockMinimo: true,
        costoUnitario: true,
        proveedor: { select: { id: true, nombre: true, contacto: true, telefono: true } },
      },
    }),
    prisma.empresa.findUnique({ where: { id: EMPRESA_DEFECTO.id }, select: { nombreFantasia: true } }),
  ]);

  const grupos = new Map<string | null, GrupoPedido>();
  for (const i of insumos.sort(porNombre)) {
    const clave = i.proveedor?.id ?? null;
    let g = grupos.get(clave);
    if (!g) {
      g = { proveedor: i.proveedor, items: [], total: 0 };
      grupos.set(clave, g);
    }
    // Sin mínimo cargado (stock 0, mínimo 0) la regla da 0: sugerimos al menos 1.
    const sugerida = Math.max(1, cantidadAPedir(i));
    const costoEstimado = Math.round(sugerida * i.costoUnitario);
    g.items.push({
      id: i.id,
      nombre: i.nombre,
      unidad: i.unidad,
      stock: i.stock,
      stockMinimo: i.stockMinimo,
      estado: estadoStock(i),
      sugerida,
      costoUnitario: i.costoUnitario,
      costoEstimado,
    });
    g.total += costoEstimado;
  }

  const lista = [...grupos.values()].sort((a, b) => {
    if (!a.proveedor) return 1;
    if (!b.proveedor) return -1;
    return a.proveedor.nombre.localeCompare(b.proveedor.nombre, "es");
  });
  return { grupos: lista, empresa: empresa?.nombreFantasia ?? EMPRESA_DEFECTO.nombreFantasia };
}

/** Ítems sugeridos para precargar una compra a partir del pedido de un proveedor. */
export async function itemsPedidoDeProveedor(proveedorId: string) {
  const prisma = await leerDb();
  const insumos = await prisma.insumo.findMany({
    where: { activo: true, proveedorId, ...dondeNecesitaReponer(prisma) },
    select: { id: true, nombre: true, stock: true, stockMinimo: true, costoUnitario: true },
  });
  return insumos
    .sort(porNombre)
    .map((i) => ({ insumoId: i.id, descripcion: i.nombre, cantidad: Math.max(1, cantidadAPedir(i)), precioUnitario: i.costoUnitario }));
}

/** Fecha de hoy para <input type="date">, calculada después de abrir la lectura. */
export async function hoyInputFecha(): Promise<string> {
  await leerDb();
  return aInputFecha(ahora());
}

import "server-only";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { cantidadAPedir, estadoStock, type EstadoStock } from "@/lib/calculos";
import { aInputFecha } from "@/lib/fechas";
import type { Insumo, MovimientoStock } from "@/lib/generated/prisma/client";
import type { TipoMovimiento, Unidad } from "@/lib/generated/prisma/enums";

// Consultas de insumos y movimientos de stock.
// Único lugar que lee el almacén para estas pantallas: al pasar a Prisma
// se reemplaza el cuerpo de cada función y se mantienen los tipos.

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

/** Necesita reponerse: sin stock o por debajo del mínimo. */
const necesitaReponer = (i: Pick<Insumo, "stock" | "stockMinimo">) => estadoStock(i) !== "ok";

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const porNombre = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, "es");

function aFila(s: Store, i: Insumo): InsumoFila {
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
    proveedorNombre: s.proveedores.find((p) => p.id === i.proveedorId)?.nombre ?? null,
    estado: estadoStock(i),
  };
}

function aMovimientoFila(s: Store, m: MovimientoStock): MovimientoFila {
  const insumo = s.insumos.find((i) => i.id === m.insumoId);
  const trabajo = m.trabajoId ? s.trabajos.find((t) => t.id === m.trabajoId) : undefined;
  const compra = m.compraId ? s.compras.find((c) => c.id === m.compraId) : undefined;
  return {
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    cantidad: m.cantidad,
    costoUnitario: m.costoUnitario,
    notas: m.notas,
    insumoId: m.insumoId,
    insumoNombre: insumo?.nombre ?? "Insumo borrado",
    unidad: insumo?.unidad ?? "UNIDAD",
    trabajo: trabajo
      ? {
          id: trabajo.id,
          numero: trabajo.numero,
          titulo: trabajo.titulo,
          clienteNombre: s.clientes.find((c) => c.id === trabajo.clienteId)?.nombre ?? null,
        }
      : null,
    compra: compra
      ? {
          id: compra.id,
          proveedorId: compra.proveedorId,
          proveedorNombre: s.proveedores.find((p) => p.id === compra.proveedorId)?.nombre ?? "Proveedor",
          numeroFactura: compra.numeroFactura,
        }
      : null,
  };
}

const masRecientePrimeroMov = (a: MovimientoStock, b: MovimientoStock) => b.fecha.getTime() - a.fecha.getTime();

/** Listado de /insumos: búsqueda por nombre o categoría + filtro de stock bajo. */
export async function listarInsumos({ q, filtro }: { q: string; filtro: FiltroInsumos }) {
  const s = await leerStore();
  const activos = s.insumos.filter((i) => i.activo);
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
    insumos: visibles.map((i) => aFila(s, i)),
    cantidadTodos: encontrados.length,
    cantidadBajo: encontrados.filter(necesitaReponer).length,
    /** Total sin búsqueda, para el aviso de "bajo el mínimo". */
    bajoMinimo: activos.filter(necesitaReponer).length,
    hayInsumos: activos.length > 0,
  };
}

/** Últimos movimientos de stock de todos los insumos (vista "Movimientos"). */
export async function movimientosRecientes({ q, limite = 60 }: { q: string; limite?: number }) {
  const s = await leerStore();
  const texto = normalizar(q);
  const movs = [...s.movimientos].sort(masRecientePrimeroMov).map((m) => aMovimientoFila(s, m));
  const filtrados = texto ? movs.filter((m) => normalizar(m.insumoNombre).includes(texto)) : movs;
  return { movimientos: filtrados.slice(0, limite), hoy: ahora() };
}

/** Ficha de un insumo con su historial. `null` si no existe. */
export async function obtenerInsumo(id: string) {
  const s = await leerStore();
  const insumo = s.insumos.find((i) => i.id === id);
  if (!insumo) return null;
  const proveedor = insumo.proveedorId ? s.proveedores.find((p) => p.id === insumo.proveedorId) : undefined;
  const movimientos = s.movimientos
    .filter((m) => m.insumoId === id)
    .sort(masRecientePrimeroMov)
    .map((m) => aMovimientoFila(s, m));
  return {
    ...aFila(s, insumo),
    /** Cantidad sugerida para el próximo pedido (0 si hay stock suficiente). */
    aPedir: cantidadAPedir(insumo),
    proveedor: proveedor ? { id: proveedor.id, nombre: proveedor.nombre, telefono: proveedor.telefono } : null,
    movimientos,
    hoy: ahora(),
  };
}

export type InsumoDetalle = NonNullable<Awaited<ReturnType<typeof obtenerInsumo>>>;

/** Categorías ya usadas, para sugerirlas en el formulario. */
export async function categoriasInsumos(): Promise<string[]> {
  const s = await leerStore();
  const set = new Set(s.insumos.map((i) => i.categoria?.trim()).filter((c): c is string => Boolean(c)));
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
  const s = await leerStore();
  return s.insumos
    .filter((i) => i.activo)
    .sort(porNombre)
    .map((i) => ({ id: i.id, nombre: i.nombre, unidad: i.unidad, costoUnitario: i.costoUnitario, proveedorId: i.proveedorId }));
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
  const s = await leerStore();
  const grupos = new Map<string | null, GrupoPedido>();

  for (const i of s.insumos.filter((x) => x.activo && necesitaReponer(x)).sort(porNombre)) {
    const prov = i.proveedorId ? s.proveedores.find((p) => p.id === i.proveedorId) : undefined;
    const clave = prov?.id ?? null;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        proveedor: prov ? { id: prov.id, nombre: prov.nombre, contacto: prov.contacto, telefono: prov.telefono } : null,
        items: [],
        total: 0,
      });
    }
    // Sin mínimo cargado (stock 0, mínimo 0) la regla da 0: sugerimos al menos 1.
    const sugerida = Math.max(1, cantidadAPedir(i));
    const costoEstimado = Math.round(sugerida * i.costoUnitario);
    const g = grupos.get(clave)!;
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
  return { grupos: lista, empresa: s.empresa.nombreFantasia };
}

/** Ítems sugeridos para precargar una compra a partir del pedido de un proveedor. */
export async function itemsPedidoDeProveedor(proveedorId: string) {
  const s = await leerStore();
  return s.insumos
    .filter((i) => i.activo && i.proveedorId === proveedorId && necesitaReponer(i))
    .sort(porNombre)
    .map((i) => ({ insumoId: i.id, descripcion: i.nombre, cantidad: Math.max(1, cantidadAPedir(i)), precioUnitario: i.costoUnitario }));
}

/** Fecha de hoy para <input type="date">, calculada después de leer el almacén. */
export async function hoyInputFecha(): Promise<string> {
  await leerStore();
  return aInputFecha(ahora());
}

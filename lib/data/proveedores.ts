import "server-only";
import { ahora, leerStore, type Store } from "@/lib/mock/store";
import { estadoStock, sumaMontos, type EstadoStock } from "@/lib/calculos";
import { inicioDia } from "@/lib/fechas";
import type { Compra, PagoProveedor } from "@/lib/generated/prisma/client";
import type { MedioPago, Unidad } from "@/lib/generated/prisma/enums";

// Consultas de proveedores, compras y pagos.
// Único lugar que lee el almacén para estas pantallas: al pasar a Prisma
// se reemplaza el cuerpo de cada función y se mantienen los tipos.

export type ProveedorFila = {
  id: string;
  nombre: string;
  rubro: string | null;
  /** Compras − pagos. Positivo: les debés. Negativo: pagaste de más (a favor). */
  saldo: number;
  proximoVencimiento: Date | null;
  /** Hay alguna compra impaga con el vencimiento ya pasado. */
  vencida: boolean;
};

export type CompraFila = {
  id: string;
  fecha: Date;
  proveedorId: string;
  proveedorNombre: string;
  numeroFactura: string | null;
  vencimiento: Date | null;
  total: number;
  cantidadItems: number;
  /** Lo que falta pagar de esta compra (estimado, ver `imputarPagos`). */
  pendiente: number;
};

type CompraConPendiente = { compra: Compra; pendiente: number };

/**
 * Los pagos a proveedores no se atan a una compra puntual (PagoProveedor no
 * tiene compraId). Para saber qué compras siguen impagas (y su vencimiento):
 * 1. Un pago con la misma fecha exacta y el mismo monto que una compra es el
 *    "pagada en el momento" de esa compra y se le aplica a ella.
 * 2. El resto de los pagos se imputa a las compras más viejas primero (FIFO).
 * Es una aproximación: alcanza para mostrar "pagada / falta pagar" y el próximo
 * vencimiento sin pedir más datos al cargar un pago.
 */
function imputarPagos(compras: Compra[], pagos: PagoProveedor[]): CompraConPendiente[] {
  const ordenadas = [...compras].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const usados = new Set<string>();
  const alContado = new Set<string>();
  for (const compra of ordenadas) {
    const pago = pagos.find((p) => !usados.has(p.id) && p.monto === compra.total && p.fecha.getTime() === compra.fecha.getTime());
    if (pago) {
      usados.add(pago.id);
      alContado.add(compra.id);
    }
  }

  let disponible = sumaMontos(pagos.filter((p) => !usados.has(p.id)));
  return ordenadas.map((compra) => {
    if (alContado.has(compra.id)) return { compra, pendiente: 0 };
    const aplicado = Math.max(0, Math.min(disponible, compra.total));
    disponible -= aplicado;
    return { compra, pendiente: compra.total - aplicado };
  });
}

function cuentaDe(s: Store, proveedorId: string, hoy: Date) {
  const compras = s.compras.filter((c) => c.proveedorId === proveedorId);
  const pagos = s.pagosProveedor.filter((p) => p.proveedorId === proveedorId);
  const totalComprado = sumaMontos(compras.map((c) => ({ monto: c.total })));
  const totalPagado = sumaMontos(pagos);
  const imputadas = imputarPagos(compras, pagos);
  const desdeHoy = inicioDia(hoy).getTime();

  // Próximo vencimiento: el más cercano, desde hoy, entre las compras que siguen impagas.
  const impagas = imputadas.filter((x) => x.pendiente > 0 && x.compra.vencimiento);
  const proximoVencimiento =
    impagas
      .map((x) => x.compra.vencimiento as Date)
      .filter((v) => v.getTime() >= desdeHoy)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const vencida = impagas.some((x) => (x.compra.vencimiento as Date).getTime() < desdeHoy);

  return { totalComprado, totalPagado, saldo: totalComprado - totalPagado, imputadas, pagos, proximoVencimiento, vencida };
}

const masRecientePrimero = (a: { fecha: Date }, b: { fecha: Date }) => b.fecha.getTime() - a.fecha.getTime();

/** Pantalla /proveedores: deuda total, próximo vencimiento, lista y últimas compras. */
export async function resumenProveedores({ ultimas = 6 }: { ultimas?: number } = {}) {
  const s = await leerStore();
  const hoy = ahora();

  const cuentas = s.proveedores.map((p) => ({ p, cuenta: cuentaDe(s, p.id, hoy) }));

  const proveedores: ProveedorFila[] = cuentas
    .map(({ p, cuenta }) => ({
      id: p.id,
      nombre: p.nombre,
      rubro: p.rubro,
      saldo: cuenta.saldo,
      proximoVencimiento: cuenta.saldo > 0 ? cuenta.proximoVencimiento : null,
      vencida: cuenta.saldo > 0 && cuenta.vencida,
    }))
    // Primero a quienes les debés (vencidas y lo que vence antes), después el resto por nombre.
    .sort((a, b) => {
      const da = a.saldo > 0 ? 0 : 1;
      const db = b.saldo > 0 ? 0 : 1;
      if (da !== db) return da - db;
      if (da === 0) {
        if (a.vencida !== b.vencida) return a.vencida ? -1 : 1;
        const va = a.proximoVencimiento?.getTime() ?? Infinity;
        const vb = b.proximoVencimiento?.getTime() ?? Infinity;
        if (va !== vb) return va - vb;
      }
      return a.nombre.localeCompare(b.nombre, "es");
    });

  const totalDeuda = proveedores.reduce((acc, p) => acc + Math.max(0, p.saldo), 0);
  const conVencimiento = proveedores
    .filter((p) => p.proximoVencimiento)
    .sort((a, b) => (a.proximoVencimiento as Date).getTime() - (b.proximoVencimiento as Date).getTime());
  const proximo = conVencimiento[0]
    ? { fecha: conVencimiento[0].proximoVencimiento as Date, proveedorId: conVencimiento[0].id, proveedorNombre: conVencimiento[0].nombre }
    : null;

  const pendientePorCompra = new Map<string, number>();
  for (const { cuenta } of cuentas) for (const x of cuenta.imputadas) pendientePorCompra.set(x.compra.id, x.pendiente);

  const ultimasCompras: CompraFila[] = [...s.compras]
    .sort(masRecientePrimero)
    .slice(0, ultimas)
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      proveedorId: c.proveedorId,
      proveedorNombre: s.proveedores.find((p) => p.id === c.proveedorId)?.nombre ?? "Proveedor",
      numeroFactura: c.numeroFactura,
      vencimiento: c.vencimiento,
      total: c.total,
      cantidadItems: s.itemsCompra.filter((i) => i.compraId === c.id).length,
      pendiente: pendientePorCompra.get(c.id) ?? c.total,
    }));

  return {
    totalDeuda,
    proveedoresConDeuda: proveedores.filter((p) => p.saldo > 0).length,
    proximo,
    proveedores,
    ultimasCompras,
    hoy,
  };
}

export type ItemCompraDetalle = {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  insumoId: string | null;
  unidad: Unidad | null;
};

export type CompraDetalle = {
  id: string;
  fecha: Date;
  numeroFactura: string | null;
  vencimiento: Date | null;
  total: number;
  pendiente: number;
  notas: string | null;
  items: ItemCompraDetalle[];
};

export type PagoFila = { id: string; fecha: Date; monto: number; medio: MedioPago; notas: string | null };

export type InsumoDeProveedor = { id: string; nombre: string; stock: number; unidad: Unidad; estado: EstadoStock };

/** Ficha de un proveedor con su cuenta. `null` si no existe. */
export async function obtenerProveedor(id: string) {
  const s = await leerStore();
  const p = s.proveedores.find((x) => x.id === id);
  if (!p) return null;
  const hoy = ahora();
  const cuenta = cuentaDe(s, p.id, hoy);

  const compras: CompraDetalle[] = cuenta.imputadas
    .map(({ compra, pendiente }) => ({
      id: compra.id,
      fecha: compra.fecha,
      numeroFactura: compra.numeroFactura,
      vencimiento: compra.vencimiento,
      total: compra.total,
      pendiente,
      notas: compra.notas,
      items: s.itemsCompra
        .filter((i) => i.compraId === compra.id)
        .map((i) => ({
          id: i.id,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          insumoId: i.insumoId,
          unidad: i.insumoId ? (s.insumos.find((x) => x.id === i.insumoId)?.unidad ?? null) : null,
        })),
    }))
    .sort(masRecientePrimero);

  const pagos: PagoFila[] = [...cuenta.pagos]
    .sort(masRecientePrimero)
    .map((x) => ({ id: x.id, fecha: x.fecha, monto: x.monto, medio: x.medio, notas: x.notas }));

  const insumos: InsumoDeProveedor[] = s.insumos
    .filter((i) => i.activo && i.proveedorId === p.id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((i) => ({ id: i.id, nombre: i.nombre, stock: i.stock, unidad: i.unidad, estado: estadoStock(i) }));

  return {
    id: p.id,
    nombre: p.nombre,
    rubro: p.rubro,
    contacto: p.contacto,
    telefono: p.telefono,
    email: p.email,
    cuit: p.cuit,
    direccion: p.direccion,
    notas: p.notas,
    saldo: cuenta.saldo,
    totalComprado: cuenta.totalComprado,
    totalPagado: cuenta.totalPagado,
    proximoVencimiento: cuenta.saldo > 0 ? cuenta.proximoVencimiento : null,
    vencida: cuenta.saldo > 0 && cuenta.vencida,
    compras,
    pagos,
    insumos,
    hoy,
  };
}

export type ProveedorDetalle = NonNullable<Awaited<ReturnType<typeof obtenerProveedor>>>;

/** Datos de contacto de un proveedor, para editarlo o cargarle una compra. `null` si no existe. */
export async function datosProveedor(id: string) {
  const s = await leerStore();
  const p = s.proveedores.find((x) => x.id === id);
  if (!p) return null;
  return {
    id: p.id,
    nombre: p.nombre,
    rubro: p.rubro,
    contacto: p.contacto,
    telefono: p.telefono,
    email: p.email,
    cuit: p.cuit,
    direccion: p.direccion,
    notas: p.notas,
  };
}

export type DatosProveedor = NonNullable<Awaited<ReturnType<typeof datosProveedor>>>;

/** Proveedores para elegir en un <select> o en una lista. */
export async function opcionesProveedores(): Promise<{ id: string; nombre: string; rubro: string | null }[]> {
  const s = await leerStore();
  return [...s.proveedores]
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
    .map((p) => ({ id: p.id, nombre: p.nombre, rubro: p.rubro }));
}

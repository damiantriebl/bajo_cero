// Fábricas que arman registros con la MISMA forma que devuelve Prisma
// (todos los campos, con los mismos defaults que schema.prisma).
// Se usan en los datos de ejemplo y en las server actions mientras no haya base.
import type {
  ChecklistItem,
  Cliente,
  Cobro,
  Compra,
  Empleado,
  Equipo,
  Gasto,
  Insumo,
  ItemCompra,
  ItemTrabajo,
  Jornada,
  MovimientoStock,
  PagoProveedor,
  Proveedor,
  Trabajo,
  Turno,
} from "@/lib/generated/prisma/client";

export const nuevoId = () => globalThis.crypto.randomUUID();

type Req<T, K extends keyof T> = Pick<T, K> & Partial<Omit<T, K>>;

export function nuevoCliente(d: Req<Cliente, "nombre">, ahora = new Date()): Cliente {
  return {
    id: nuevoId(),
    tipo: "PARTICULAR",
    telefono: null,
    email: null,
    direccion: null,
    localidad: null,
    cuit: null,
    notas: null,
    createdAt: ahora,
    updatedAt: ahora,
    ...d,
  };
}

export function nuevoEquipo(d: Req<Equipo, "clienteId">, ahora = new Date()): Equipo {
  return {
    id: nuevoId(),
    tipo: "SPLIT",
    marca: null,
    modelo: null,
    frigorias: null,
    ubicacion: null,
    fechaInstalacion: null,
    proximoMantenimiento: null,
    notas: null,
    createdAt: ahora,
    ...d,
  };
}

export function nuevoTrabajo(d: Req<Trabajo, "clienteId" | "titulo" | "numero">, ahora = new Date()): Trabajo {
  return {
    id: nuevoId(),
    tipo: "INSTALACION",
    estado: "PRESUPUESTO",
    direccion: null,
    descripcion: null,
    condiciones: null,
    fechaPresupuesto: ahora,
    validoHasta: null,
    fechaAprobado: null,
    fechaTerminado: null,
    createdAt: ahora,
    updatedAt: ahora,
    ...d,
  };
}

export function nuevoItemTrabajo(d: Req<ItemTrabajo, "trabajoId" | "descripcion" | "precioUnitario">): ItemTrabajo {
  return { id: nuevoId(), cantidad: 1, unidad: null, orden: 0, insumoId: null, ...d };
}

export function nuevoChecklistItem(d: Req<ChecklistItem, "trabajoId" | "texto">): ChecklistItem {
  return { id: nuevoId(), hecho: false, orden: 0, ...d };
}

export function nuevoTurno(d: Req<Turno, "trabajoId" | "inicio" | "fin">, ahora = new Date()): Turno {
  return { id: nuevoId(), estado: "A_CONFIRMAR", notas: null, createdAt: ahora, ...d };
}

export function nuevoCobro(d: Req<Cobro, "clienteId" | "monto">, ahora = new Date()): Cobro {
  return {
    id: nuevoId(),
    trabajoId: null,
    fecha: ahora,
    medio: "TRANSFERENCIA",
    concepto: null,
    comprobanteUrl: null,
    notas: null,
    createdAt: ahora,
    ...d,
  };
}

export function nuevoProveedor(d: Req<Proveedor, "nombre">, ahora = new Date()): Proveedor {
  return {
    id: nuevoId(),
    rubro: null,
    contacto: null,
    telefono: null,
    email: null,
    cuit: null,
    direccion: null,
    notas: null,
    createdAt: ahora,
    ...d,
  };
}

export function nuevaCompra(d: Req<Compra, "proveedorId" | "total">, ahora = new Date()): Compra {
  return {
    id: nuevoId(),
    fecha: ahora,
    numeroFactura: null,
    vencimiento: null,
    comprobanteUrl: null,
    notas: null,
    createdAt: ahora,
    ...d,
  };
}

export function nuevoItemCompra(
  d: Req<ItemCompra, "compraId" | "descripcion" | "cantidad" | "precioUnitario">,
): ItemCompra {
  return { id: nuevoId(), insumoId: null, ...d };
}

export function nuevoPagoProveedor(d: Req<PagoProveedor, "proveedorId" | "monto">, ahora = new Date()): PagoProveedor {
  return { id: nuevoId(), compraId: null, fecha: ahora, medio: "TRANSFERENCIA", notas: null, createdAt: ahora, ...d };
}

export function nuevoInsumo(d: Req<Insumo, "nombre">, ahora = new Date()): Insumo {
  return {
    id: nuevoId(),
    categoria: null,
    unidad: "UNIDAD",
    stock: 0,
    stockMinimo: 0,
    costoUnitario: 0,
    precioVenta: null,
    proveedorId: null,
    activo: true,
    createdAt: ahora,
    ...d,
  };
}

export function nuevoMovimiento(
  d: Req<MovimientoStock, "insumoId" | "tipo" | "cantidad">,
  ahora = new Date(),
): MovimientoStock {
  return { id: nuevoId(), fecha: ahora, costoUnitario: null, trabajoId: null, compraId: null, notas: null, ...d };
}

export function nuevoEmpleado(d: Req<Empleado, "nombre">, ahora = new Date()): Empleado {
  return { id: nuevoId(), puesto: "Técnico", telefono: null, jornal: 0, activo: true, createdAt: ahora, ...d };
}

export function nuevaJornada(d: Req<Jornada, "empleadoId" | "fecha" | "monto">): Jornada {
  return { id: nuevoId(), trabajoId: null, horas: null, notas: null, ...d };
}

export function nuevoGasto(d: Req<Gasto, "categoria" | "descripcion" | "monto">, ahora = new Date()): Gasto {
  return {
    id: nuevoId(),
    fecha: ahora,
    medio: "EFECTIVO",
    empleadoId: null,
    trabajoId: null,
    proveedorId: null,
    compraId: null,
    comprobanteUrl: null,
    notas: null,
    createdAt: ahora,
    ...d,
  };
}

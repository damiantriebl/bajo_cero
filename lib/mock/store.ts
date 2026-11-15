import "server-only";
import { connection } from "next/server";
import type {
  ChecklistItem,
  Cliente,
  Cobro,
  Compra,
  Empleado,
  Empresa,
  Equipo,
  Foto,
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
import { crearDatosDeEjemplo } from "./seed";

// Almacén en memoria con la forma exacta de las tablas de Prisma.
// Es TEMPORAL: cuando conectemos Neon, cada lib/data/*.ts pasa a usar getPrisma().
// Vive en globalThis para sobrevivir a la recarga en caliente de `next dev`.
// En producción (serverless) cada instancia arranca con los datos de ejemplo.

export type Store = {
  empresa: Empresa;
  clientes: Cliente[];
  equipos: Equipo[];
  trabajos: Trabajo[];
  items: ItemTrabajo[];
  checklist: ChecklistItem[];
  fotos: Foto[];
  turnos: Turno[];
  /** Tabla intermedia de la relación muchos-a-muchos Turno ↔ Empleado. */
  turnoTecnicos: { turnoId: string; empleadoId: string }[];
  cobros: Cobro[];
  proveedores: Proveedor[];
  compras: Compra[];
  itemsCompra: ItemCompra[];
  pagosProveedor: PagoProveedor[];
  insumos: Insumo[];
  movimientos: MovimientoStock[];
  empleados: Empleado[];
  jornadas: Jornada[];
  gastos: Gasto[];
};

const g = globalThis as unknown as { __bajoCeroStore?: Store };

function obtener(): Store {
  if (!g.__bajoCeroStore) g.__bajoCeroStore = crearDatosDeEjemplo(new Date());
  return g.__bajoCeroStore;
}

/**
 * Para leer datos al renderizar (Server Components / funciones de lib/data).
 * Llama a connection(): marca la lectura como "por request", igual que lo será
 * una consulta real a la base. Envolver los componentes que la usan en <Suspense>.
 */
export async function leerStore(): Promise<Store> {
  await connection();
  return obtener();
}

/** Para server actions: lectura/escritura directa (no usar al renderizar). */
export function storeParaAcciones(): Store {
  return obtener();
}

/** Momento actual para lógica de render. Llamar SOLO después de leerStore(). */
export function ahora(): Date {
  return new Date();
}

/** Próximo número de presupuesto (equivale al autoincrement de Trabajo.numero). */
export function siguienteNumeroTrabajo(store: Store): number {
  return store.trabajos.reduce((max, t) => Math.max(max, t.numero), 0) + 1;
}

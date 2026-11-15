// Pasos del flujo de un trabajo: qué botón se muestra en cada estado
// y qué cambios de estado acepta el servidor.
import type { EstadoTrabajo } from "@/lib/generated/prisma/enums";

export const PASO_SIGUIENTE: Partial<Record<EstadoTrabajo, { destino: EstadoTrabajo; label: string }>> = {
  PRESUPUESTO: { destino: "APROBADO", label: "Marcar aprobado" },
  APROBADO: { destino: "EN_CURSO", label: "Empezar trabajo" },
  EN_CURSO: { destino: "TERMINADO", label: "Terminar trabajo" },
  TERMINADO: { destino: "COBRADO", label: "Marcar cobrado" },
};

const FINALES: readonly EstadoTrabajo[] = ["COBRADO", "CANCELADO"];

export function puedeCancelar(estado: EstadoTrabajo): boolean {
  return !FINALES.includes(estado);
}

/** Valida un cambio de estado. Para pasar a COBRADO no tiene que faltar plata. */
export function transicionValida(desde: EstadoTrabajo, hacia: EstadoTrabajo, falta: number): boolean {
  if (hacia === "CANCELADO") return puedeCancelar(desde);
  const paso = PASO_SIGUIENTE[desde];
  if (!paso || paso.destino !== hacia) return false;
  if (hacia === "COBRADO") return falta === 0;
  return true;
}

// Textos en castellano y tono de badge para cada enum del modelo.
import type {
  CategoriaGasto,
  EstadoTrabajo,
  EstadoTurno,
  MedioPago,
  TipoCliente,
  TipoEquipo,
  TipoTrabajo,
  Unidad,
} from "@/lib/generated/prisma/enums";

export type Tono = "ok" | "warn" | "info" | "neutral" | "danger";

export const ESTADO_TRABAJO: Record<EstadoTrabajo, { label: string; tono: Tono }> = {
  PRESUPUESTO: { label: "Presupuesto", tono: "neutral" },
  APROBADO: { label: "Aprobado", tono: "ok" },
  EN_CURSO: { label: "En curso", tono: "info" },
  TERMINADO: { label: "Terminado", tono: "warn" },
  COBRADO: { label: "Cobrado", tono: "ok" },
  CANCELADO: { label: "Cancelado", tono: "danger" },
};

/** Orden del flujo de un trabajo (sin CANCELADO). */
export const FLUJO_TRABAJO: EstadoTrabajo[] = ["PRESUPUESTO", "APROBADO", "EN_CURSO", "TERMINADO", "COBRADO"];

export const ESTADO_TURNO: Record<EstadoTurno, { label: string; tono: Tono }> = {
  A_CONFIRMAR: { label: "A confirmar", tono: "warn" },
  CONFIRMADO: { label: "Confirmado", tono: "ok" },
  REALIZADO: { label: "Realizado", tono: "neutral" },
  CANCELADO: { label: "Cancelado", tono: "danger" },
};

export const TIPO_TRABAJO: Record<TipoTrabajo, string> = {
  INSTALACION: "Instalación",
  MANTENIMIENTO: "Mantenimiento",
  REPARACION: "Reparación",
  CARGA_GAS: "Carga de gas",
  DESINSTALACION: "Desinstalación",
  OTRO: "Otro",
};

export const MEDIO_PAGO: Record<MedioPago, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  MERCADO_PAGO: "Mercado Pago",
  TARJETA: "Tarjeta",
  CHEQUE: "Cheque",
  OTRO: "Otro",
};

export const CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  PERSONAL: "Personal",
  MATERIALES: "Materiales",
  COMBUSTIBLE: "Combustible",
  HERRAMIENTAS: "Herramientas",
  VEHICULO: "Vehículo",
  IMPUESTOS: "Impuestos",
  SERVICIOS: "Servicios",
  ALQUILER: "Alquiler",
  OTROS: "Otros",
};

export const TIPO_CLIENTE: Record<TipoCliente, string> = {
  PARTICULAR: "Particular",
  EMPRESA: "Empresa",
  CONSORCIO: "Consorcio",
};

export const TIPO_EQUIPO: Record<TipoEquipo, string> = {
  SPLIT: "Split",
  PISO_TECHO: "Piso-techo",
  CASSETTE: "Cassette",
  VENTANA: "Ventana",
  PORTATIL: "Portátil",
  CENTRAL: "Central",
  OTRO: "Otro",
};

/** Unidad: [singular, plural, abreviatura] */
export const UNIDAD: Record<Unidad, { uno: string; varios: string; corta: string }> = {
  UNIDAD: { uno: "unidad", varios: "unidades", corta: "u." },
  METRO: { uno: "metro", varios: "metros", corta: "m" },
  KILO: { uno: "kilo", varios: "kilos", corta: "kg" },
  PAR: { uno: "par", varios: "pares", corta: "pares" },
  ROLLO: { uno: "rollo", varios: "rollos", corta: "rollos" },
  LITRO: { uno: "litro", varios: "litros", corta: "l" },
};

/** Convierte un Record de etiquetas en opciones para <select>. */
export function opciones<K extends string>(mapa: Record<K, string | { label: string }>): { value: K; label: string }[] {
  return (Object.keys(mapa) as K[]).map((value) => {
    const v = mapa[value];
    return { value, label: typeof v === "string" ? v : v.label };
  });
}

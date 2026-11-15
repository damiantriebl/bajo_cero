// Ayudas para server actions con formularios: validación con zod y
// estado de errores para useActionState.
import { z } from "zod";
import { parseFechaInput } from "./fechas";
import { parsePesos } from "./formato";

/** Lo que devuelve una server action usada con useActionState. */
export type EstadoForm = {
  /** Error general (arriba del formulario). */
  error?: string;
  /** Error por campo: { nombre: "Escribí el nombre" } */
  errores?: Record<string, string>;
  /** Mensaje de éxito cuando la acción no redirige. */
  ok?: string;
} | null;

export function erroresDeZod(error: z.ZodError): NonNullable<EstadoForm> {
  const { fieldErrors, formErrors } = z.flattenError(error);
  const errores: Record<string, string> = {};
  for (const [campo, mensajes] of Object.entries(fieldErrors)) {
    const m = mensajes as string[] | undefined;
    if (m?.length) errores[campo] = m[0];
  }
  return { errores, error: formErrors[0] ?? "Revisá los campos marcados." };
}

/** Object.fromEntries que conserva solo strings (descarta archivos). */
export function datosDe(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((v, k) => {
    if (typeof v === "string") out[k] = v;
  });
  return out;
}

// ───────── Esquemas para campos de formulario (todo llega como string) ─────────

export const zTexto = (mensaje: string) => z.string({ error: mensaje }).trim().min(1, mensaje);

/** Texto opcional: "" o ausente → null. */
export const zTextoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

/** "1.775.000" → 1775000 (entero > 0). */
export const zPesos = (mensaje = "Poné un monto mayor a cero") =>
  z
    .string({ error: mensaje })
    .transform((v) => parsePesos(v))
    .refine((v): v is number => v !== null && v > 0, mensaje)
    .transform((v) => v as number);

/** Monto que puede ser 0 o quedar vacío (→ null). */
export const zPesosOpcional = z
  .string()
  .optional()
  .refine((v) => !v || v.trim() === "" || parsePesos(v) !== null, "Monto inválido")
  .transform((v) => (v && v.trim() !== "" ? parsePesos(v) : null))
  .refine((v) => v === null || v >= 0, "Monto inválido");

/** "2,5" o "2.5" → 2.5 */
export const zCantidad = (mensaje = "Poné una cantidad") =>
  z
    .string({ error: mensaje })
    .transform((v) => Number(v.replace(",", ".")))
    .refine((v) => Number.isFinite(v) && v > 0, mensaje);

/** <input type="date"> → Date (00:00 Argentina). Con `hora` toma ese campo de la misma data. */
export const zFecha = (mensaje = "Elegí una fecha") =>
  z
    .string({ error: mensaje })
    .transform((v) => parseFechaInput(v))
    .refine((v): v is Date => v !== null, mensaje)
    .transform((v) => v as Date);

export const zFechaOpcional = z
  .string()
  .optional()
  .transform((v) => (v ? parseFechaInput(v) : null));

/** Valor de un enum de Prisma (pasar el objeto de lib/generated/prisma/enums). */
export const zEnum = <T extends Record<string, string>>(e: T, mensaje = "Elegí una opción") =>
  z.enum(Object.values(e) as [T[keyof T], ...T[keyof T][]], { error: mensaje });

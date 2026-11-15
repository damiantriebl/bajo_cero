import type { EstadoForm } from "@/lib/forms";

/**
 * EstadoForm + lo que se escribió. React vacía los campos no controlados al
 * terminar una acción de <form>; devolviendo los valores se vuelven a mostrar
 * cuando hay errores (se usan como defaultValue y como key del form).
 */
export type EstadoConValores = (NonNullable<EstadoForm> & { valores?: Record<string, string> }) | null;

/** Props para marcar un campo con error (aria-invalid + aria-describedby). */
export function errorDe(estado: EstadoConValores, campo: string, id = campo) {
  const error = estado?.errores?.[campo];
  return {
    error,
    props: error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {},
  };
}

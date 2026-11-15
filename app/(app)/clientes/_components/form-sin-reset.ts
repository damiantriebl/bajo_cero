"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { EstadoForm } from "@/lib/forms";

type Accion = (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;

/**
 * useActionState sin el reseteo automático del formulario de React 19:
 * si la acción devuelve errores, lo que se escribió queda en los campos.
 *
 * Uso: <form action={formAction} onSubmit={onSubmit}>. Sin JavaScript el
 * formulario se envía igual (mejora progresiva) por `action`. Con JavaScript,
 * onSubmit corta el envío nativo y despacha la acción dentro de una transición,
 * así useFormStatus (SubmitButton) sigue mostrando "Guardando…".
 */
export function useFormSinReset(accion: Accion) {
  const [estado, formAction] = useActionState(accion, null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    startTransition(() => formAction(datos));
  }

  return { estado, formAction, onSubmit, errores: estado?.errores ?? {} };
}

/** aria-invalid y aria-describedby para un campo con posible error. */
export function ariaError(id: string, error?: string) {
  return error ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` } : {};
}

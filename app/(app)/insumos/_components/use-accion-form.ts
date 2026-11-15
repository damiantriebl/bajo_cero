"use client";

import { startTransition, useActionState, useRef, type FormEvent } from "react";
import type { EstadoForm } from "@/lib/forms";

type Accion = (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;

/**
 * useActionState sin el reseteo automático de React 19.
 * Con `<form action={fn}>` React vacía el formulario después de cada envío,
 * aunque el servidor devuelva errores. Enviando desde onSubmit (preventDefault
 * + startTransition) React no lo resetea y useFormStatus sigue marcando "pending",
 * así que SubmitButton funciona igual. `action` queda para cuando no hay JS.
 *
 * Con `limpiarSiOk` el formulario se vacía solo cuando la acción devuelve `ok`.
 */
export function useAccionForm(accion: Accion, { limpiarSiOk = false }: { limpiarSiOk?: boolean } = {}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: EstadoForm, formData: FormData) => {
    const resultado = await accion(prev, formData);
    if (limpiarSiOk && resultado?.ok) formRef.current?.reset();
    return resultado;
  }, null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter);
    startTransition(() => formAction(formData));
  }

  /** Props para el campo: marca el error y lo asocia al mensaje de <Field>. */
  function campo(id: string, nombre = id) {
    const error = state?.errores?.[nombre];
    return {
      id,
      name: nombre,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? `${id}-error` : undefined,
    } as const;
  }

  return { state, formAction, onSubmit, pending, campo, formRef, errores: state?.errores ?? {} };
}

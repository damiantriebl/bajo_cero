"use client";

import { Minus, Plus } from "lucide-react";
import { Field, FormError, Input, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import type { EstadoForm } from "@/lib/forms";
import { UNIDAD } from "@/lib/etiquetas";
import type { Unidad } from "@/lib/generated/prisma/enums";
import { useAccionForm } from "./use-accion-form";

const opcion = cx(
  "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line bg-surface text-[15px] font-bold text-ink transition-colors",
  "hover:border-ink has-checked:border-night has-checked:bg-night has-checked:text-white",
  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand",
);

export function AjusteForm({
  accion,
  unidad,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  unidad: Unidad;
}) {
  const { state, formAction, onSubmit, campo, errores, formRef } = useAccionForm(accion, { limpiarSiOk: true });

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={state?.error} />

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-bold">¿Entra o sale?</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className={opcion}>
            <input type="radio" name="sentido" value="sumar" defaultChecked className="sr-only" />
            <Plus aria-hidden className="size-5" strokeWidth={2.4} />
            Sumar
          </label>
          <label className={opcion}>
            <input type="radio" name="sentido" value="restar" className="sr-only" />
            <Minus aria-hidden className="size-5" strokeWidth={2.4} />
            Restar
          </label>
        </div>
        {errores.sentido && <p className="text-[13px] font-semibold text-danger">{errores.sentido}</p>}
      </fieldset>

      <Field label={`Cantidad (${UNIDAD[unidad].varios})`} htmlFor="ajuste-cantidad" error={errores.cantidad}>
        <Input {...campo("ajuste-cantidad", "cantidad")} inputMode="decimal" autoComplete="off" placeholder="0" />
      </Field>

      <Field label="Motivo" htmlFor="ajuste-motivo" error={errores.motivo}>
        <Input {...campo("ajuste-motivo", "motivo")} autoComplete="off" placeholder="Conteo, rotura, devolución…" />
      </Field>

      <SubmitButton variante="secondary">Guardar ajuste</SubmitButton>

      <p role="status" className={cx("text-sm font-bold text-ok", !state?.ok && "sr-only")}>
        {state?.ok ?? ""}
      </p>
    </form>
  );
}

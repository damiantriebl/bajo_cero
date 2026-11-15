"use client";

import { ButtonLink, Card, Field, FormError, Input, Select, Textarea } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import { TIPO_EQUIPO, opciones } from "@/lib/etiquetas";
import type { EstadoForm } from "@/lib/forms";
import { ariaError, useFormSinReset } from "./form-sin-reset";

export function EquipoForm({
  action,
  cancelarHref,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  cancelarHref: string;
}) {
  const { estado, formAction, onSubmit, errores } = useFormSinReset(action);

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4 lg:max-w-3xl">
      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:gap-5 lg:p-6">
        <Field label="Tipo de equipo" htmlFor="tipo" error={errores.tipo}>
          <Select id="tipo" name="tipo" defaultValue="SPLIT" {...ariaError("tipo", errores.tipo)}>
            {opciones(TIPO_EQUIPO).map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Frigorías" htmlFor="frigorias" error={errores.frigorias}>
          <Input
            id="frigorias"
            name="frigorias"
            inputMode="numeric"
            autoComplete="off"
            placeholder="3000"
            {...ariaError("frigorias", errores.frigorias)}
          />
        </Field>

        <Field label="Marca" htmlFor="marca" error={errores.marca}>
          <Input id="marca" name="marca" autoComplete="off" {...ariaError("marca", errores.marca)} />
        </Field>

        <Field label="Modelo" htmlFor="modelo" error={errores.modelo}>
          <Input id="modelo" name="modelo" autoComplete="off" {...ariaError("modelo", errores.modelo)} />
        </Field>

        <Field label="Ubicación" htmlFor="ubicacion" error={errores.ubicacion} className="sm:col-span-2">
          <Input
            id="ubicacion"
            name="ubicacion"
            autoComplete="off"
            placeholder="Living, dormitorio, oficina…"
            {...ariaError("ubicacion", errores.ubicacion)}
          />
        </Field>

        <Field label="Fecha de instalación" htmlFor="fechaInstalacion" error={errores.fechaInstalacion}>
          <Input
            id="fechaInstalacion"
            name="fechaInstalacion"
            type="date"
            {...ariaError("fechaInstalacion", errores.fechaInstalacion)}
          />
        </Field>

        <Field
          label="Próximo mantenimiento"
          htmlFor="proximoMantenimiento"
          error={errores.proximoMantenimiento}
          hint="Si lo dejás vacío, queda a un año de la instalación."
        >
          <Input
            id="proximoMantenimiento"
            name="proximoMantenimiento"
            type="date"
            {...ariaError("proximoMantenimiento", errores.proximoMantenimiento)}
          />
        </Field>

        <Field label="Notas" htmlFor="notas" error={errores.notas} className="sm:col-span-2">
          <Textarea id="notas" name="notas" rows={2} {...ariaError("notas", errores.notas)} />
        </Field>
      </Card>

      <FormError message={estado?.error} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton className="sm:w-auto sm:min-w-48">Guardar equipo</SubmitButton>
        <ButtonLink href={cancelarHref} variante="ghost" tamano="lg">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}

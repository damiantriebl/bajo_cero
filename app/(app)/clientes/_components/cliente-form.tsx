"use client";

import { ButtonLink, Card, Field, FormError, Input, Textarea, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import { TIPO_CLIENTE, opciones } from "@/lib/etiquetas";
import type { EstadoForm } from "@/lib/forms";
import type { TipoCliente } from "@/lib/generated/prisma/enums";
import { ariaError, useFormSinReset } from "./form-sin-reset";

export type ValoresCliente = {
  nombre: string;
  tipo: TipoCliente;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  localidad: string | null;
  cuit: string | null;
  notas: string | null;
};

export function ClienteForm({
  action,
  cliente,
  textoBoton,
  cancelarHref,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  cliente?: ValoresCliente;
  textoBoton: string;
  cancelarHref: string;
}) {
  const { estado, formAction, onSubmit, errores } = useFormSinReset(action);
  const tipoActual = cliente?.tipo ?? "PARTICULAR";

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4 lg:max-w-3xl">
      <Card className="grid gap-4 p-4 lg:grid-cols-2 lg:gap-5 lg:p-6">
        <Field label="Nombre" htmlFor="nombre" error={errores.nombre} className="lg:col-span-2">
          <Input
            id="nombre"
            name="nombre"
            required
            autoComplete="off"
            defaultValue={cliente?.nombre}
            placeholder="Nombre y apellido o razón social"
            {...ariaError("nombre", errores.nombre)}
          />
        </Field>

        <fieldset className="flex flex-col gap-1.5 lg:col-span-2" aria-describedby={errores.tipo ? "tipo-error" : undefined}>
          <legend className="mb-1.5 text-sm font-bold">Tipo</legend>
          <div className="grid grid-cols-3 gap-2">
            {opciones(TIPO_CLIENTE).map(({ value, label }) => (
              <label
                key={value}
                className={cx(
                  "flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface px-2 text-[15px] font-semibold text-ink transition-colors",
                  "hover:border-brand has-[:checked]:border-night has-[:checked]:bg-night has-[:checked]:font-bold has-[:checked]:text-white",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                )}
              >
                <input type="radio" name="tipo" value={value} defaultChecked={value === tipoActual} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          {errores.tipo && (
            <p id="tipo-error" className="text-[13px] font-semibold text-danger">
              {errores.tipo}
            </p>
          )}
        </fieldset>

        <Field label="Teléfono" htmlFor="telefono" error={errores.telefono} hint="Con código de área, sin 0 ni 15">
          <Input
            id="telefono"
            name="telefono"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            defaultValue={cliente?.telefono ?? ""}
            placeholder="11 5555-0101"
            {...ariaError("telefono", errores.telefono)}
          />
        </Field>

        <Field label="Email" htmlFor="email" error={errores.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            defaultValue={cliente?.email ?? ""}
            {...ariaError("email", errores.email)}
          />
        </Field>

        <Field label="Dirección" htmlFor="direccion" error={errores.direccion}>
          <Input
            id="direccion"
            name="direccion"
            autoComplete="off"
            defaultValue={cliente?.direccion ?? ""}
            placeholder="Calle, número, piso y depto."
            {...ariaError("direccion", errores.direccion)}
          />
        </Field>

        <Field label="Localidad" htmlFor="localidad" error={errores.localidad}>
          <Input
            id="localidad"
            name="localidad"
            autoComplete="off"
            defaultValue={cliente?.localidad ?? ""}
            {...ariaError("localidad", errores.localidad)}
          />
        </Field>

        <Field label="CUIT" htmlFor="cuit" error={errores.cuit} hint="Opcional. Para empresas y consorcios.">
          <Input
            id="cuit"
            name="cuit"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={cliente?.cuit ?? ""}
            placeholder="30-12345678-9"
            {...ariaError("cuit", errores.cuit)}
          />
        </Field>

        <Field label="Notas" htmlFor="notas" error={errores.notas} className="lg:col-span-2">
          <Textarea
            id="notas"
            name="notas"
            rows={3}
            defaultValue={cliente?.notas ?? ""}
            placeholder="Cómo llegar, con quién hablar, horarios…"
            {...ariaError("notas", errores.notas)}
          />
        </Field>
      </Card>

      <FormError message={estado?.error} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton className="sm:w-auto sm:min-w-48">{textoBoton}</SubmitButton>
        <ButtonLink href={cancelarHref} variante="ghost" tamano="lg">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}

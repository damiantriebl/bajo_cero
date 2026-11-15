"use client";

import Link from "next/link";
import { Field, FormError, Input, Textarea, buttonClass } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import type { EstadoForm } from "@/lib/forms";
import { useAccionForm } from "@/app/(app)/insumos/_components/use-accion-form";

export type ValoresProveedor = {
  nombre: string;
  rubro: string;
  contacto: string;
  telefono: string;
  email: string;
  cuit: string;
  direccion: string;
  notas: string;
};

export function ProveedorForm({
  accion,
  valores,
  modo,
  cancelarHref,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  valores?: ValoresProveedor;
  modo: "crear" | "editar";
  cancelarHref: string;
}) {
  const { state, formAction, onSubmit, campo, errores } = useAccionForm(accion);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError message={state?.error} />

      <Field label="Nombre" htmlFor="nombre" error={errores.nombre}>
        <Input {...campo("nombre")} defaultValue={valores?.nombre} autoComplete="organization" placeholder="Ej.: Refrigeración Norte" required />
      </Field>

      <Field label="Rubro" htmlFor="rubro" error={errores.rubro} hint="Qué le comprás">
        <Input {...campo("rubro")} defaultValue={valores?.rubro} autoComplete="off" placeholder="Ej.: Caños, gas y repuestos" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Contacto" htmlFor="contacto" error={errores.contacto} hint="Con quién hablás">
          <Input {...campo("contacto")} defaultValue={valores?.contacto} autoComplete="name" placeholder="Ej.: Sergio" />
        </Field>
        <Field label="Teléfono" htmlFor="telefono" error={errores.telefono} hint="Para llamar y mandar pedidos por WhatsApp">
          <Input {...campo("telefono")} defaultValue={valores?.telefono} type="tel" inputMode="tel" autoComplete="tel" placeholder="11 5555-0000" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={errores.email}>
          <Input {...campo("email")} defaultValue={valores?.email} type="email" inputMode="email" autoComplete="email" placeholder="ventas@proveedor.com" />
        </Field>
        <Field label="CUIT" htmlFor="cuit" error={errores.cuit}>
          <Input {...campo("cuit")} defaultValue={valores?.cuit} inputMode="numeric" autoComplete="off" placeholder="30-12345678-9" />
        </Field>
      </div>

      <Field label="Dirección" htmlFor="direccion" error={errores.direccion}>
        <Input {...campo("direccion")} defaultValue={valores?.direccion} autoComplete="street-address" placeholder="Calle, número y localidad" />
      </Field>

      <Field label="Notas" htmlFor="notas" error={errores.notas}>
        <Textarea {...campo("notas")} defaultValue={valores?.notas} placeholder="Horarios, condiciones de pago, cuenta para transferir…" />
      </Field>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelarHref} className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          Cancelar
        </Link>
        <SubmitButton className="sm:w-auto">{modo === "crear" ? "Guardar proveedor" : "Guardar cambios"}</SubmitButton>
      </div>
    </form>
  );
}

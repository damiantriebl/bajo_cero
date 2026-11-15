"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Card, Field, FormError, Input, buttonClass } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import { errorDe, type EstadoConValores } from "../../gastos/_components/estado-form";

const miles = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

type Empleado = { nombre: string; puesto: string; telefono: string | null; jornal: number; activo: boolean };

export function FormEmpleado({
  accion,
  empleado,
  cancelarHref,
  textoBoton,
}: {
  accion: (prev: EstadoConValores, formData: FormData) => Promise<EstadoConValores>;
  /** Si viene, es edición (muestra "Activo"). */
  empleado?: Empleado;
  cancelarHref: string;
  textoBoton: string;
}) {
  const [estado, formAction] = useActionState(accion, null);
  const v = estado?.valores;
  const nombre = errorDe(estado, "nombre");
  const puesto = errorDe(estado, "puesto");
  const telefono = errorDe(estado, "telefono");
  const jornal = errorDe(estado, "jornal");

  return (
    <form key={JSON.stringify(v ?? null)} action={formAction} noValidate className="flex flex-col gap-4">
      <FormError message={estado?.error} />
      <Card className="flex flex-col gap-4 p-4 lg:p-5">
        <Field label="Nombre" htmlFor="nombre" error={nombre.error}>
          <Input
            id="nombre"
            name="nombre"
            autoComplete="off"
            required
            defaultValue={v?.nombre ?? empleado?.nombre ?? ""}
            {...nombre.props}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Puesto" htmlFor="puesto" error={puesto.error}>
            <Input
              id="puesto"
              name="puesto"
              list="puestos"
              required
              defaultValue={v?.puesto ?? empleado?.puesto ?? "Técnico"}
              {...puesto.props}
            />
            <datalist id="puestos">
              <option value="Técnico" />
              <option value="Ayudante" />
              <option value="Administrativo" />
            </datalist>
          </Field>
          <Field label="Teléfono (opcional)" htmlFor="telefono" error={telefono.error}>
            <Input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              defaultValue={v?.telefono ?? empleado?.telefono ?? ""}
              {...telefono.props}
            />
          </Field>
        </div>
        <Field label="Valor del jornal" htmlFor="jornal" error={jornal.error} hint="Lo que cobra por día trabajado.">
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-bold text-muted">
              $
            </span>
            <Input
              id="jornal"
              name="jornal"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              className="tabular pl-8"
              defaultValue={v?.jornal ?? (empleado?.jornal ? miles.format(empleado.jornal) : "")}
              {...jornal.props}
            />
          </div>
        </Field>
        {empleado && (
          <div className="flex flex-col gap-1">
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-[15px] font-bold">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={v ? v.activo === "on" : empleado.activo}
                aria-describedby="activo-hint"
                className="size-5 accent-brand"
              />
              Sigue trabajando
            </label>
            <p id="activo-hint" className="text-[13px] text-muted">
              Si lo destildás, pasa a “Ya no trabajan” y no aparece al cargar gastos. Su historial queda guardado.
            </p>
          </div>
        )}
      </Card>
      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <SubmitButton className="sm:w-auto sm:min-w-48">{textoBoton}</SubmitButton>
        <Link href={cancelarHref} className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

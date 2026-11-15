"use client";

import { useActionState } from "react";
import { CircleCheck } from "lucide-react";
import { Card, Field, FormError, Input, Textarea } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import type { DatosEmpresa } from "@/lib/data/empresa";
import { guardarEmpresa } from "../actions";
import { errorDe } from "../../gastos/_components/estado-form";

export function FormEmpresa({ empresa }: { empresa: DatosEmpresa }) {
  const [estado, formAction] = useActionState(guardarEmpresa, null);
  const v = estado?.valores;
  const valor = (campo: keyof DatosEmpresa) => v?.[campo] ?? String(empresa[campo] ?? "");
  const e = (campo: keyof DatosEmpresa) => errorDe(estado, campo);

  const razon = e("razonSocial");
  const fantasia = e("nombreFantasia");
  const cuit = e("cuit");
  const telefono = e("telefono");
  const email = e("email");
  const direccion = e("direccion");
  const condiciones = e("condicionesPresupuesto");
  const garantia = e("garantia");
  const validez = e("validezPresupuestoDias");

  return (
    <form key={JSON.stringify(v ?? null)} action={formAction} noValidate className="flex flex-col gap-4 lg:gap-6">
      <FormError message={estado?.error} />

      <Card className="flex flex-col gap-4 p-4 lg:p-5">
        <h2 className="text-[15px] font-bold lg:text-lg">Datos de la empresa</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de fantasía" htmlFor="nombreFantasia" error={fantasia.error}>
            <Input id="nombreFantasia" name="nombreFantasia" required defaultValue={valor("nombreFantasia")} {...fantasia.props} />
          </Field>
          <Field label="Razón social" htmlFor="razonSocial" error={razon.error}>
            <Input id="razonSocial" name="razonSocial" required defaultValue={valor("razonSocial")} {...razon.props} />
          </Field>
          <Field label="CUIT" htmlFor="cuit" error={cuit.error} hint="Con o sin guiones.">
            <Input id="cuit" name="cuit" inputMode="numeric" autoComplete="off" defaultValue={valor("cuit")} {...cuit.props} />
          </Field>
          <Field label="Teléfono" htmlFor="telefono" error={telefono.error}>
            <Input id="telefono" name="telefono" type="tel" inputMode="tel" defaultValue={valor("telefono")} {...telefono.props} />
          </Field>
          <Field label="Email" htmlFor="email" error={email.error}>
            <Input id="email" name="email" type="email" inputMode="email" defaultValue={valor("email")} {...email.props} />
          </Field>
          <Field label="Dirección" htmlFor="direccion" error={direccion.error}>
            <Input id="direccion" name="direccion" defaultValue={valor("direccion")} {...direccion.props} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4 lg:p-5">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-[15px] font-bold lg:text-lg">Presupuestos</h2>
          <p className="text-[13px] text-muted">Estos textos salen al pie de cada presupuesto que mandás.</p>
        </div>
        <Field
          label="Condiciones"
          htmlFor="condicionesPresupuesto"
          error={condiciones.error}
          hint="Una condición por renglón."
        >
          <Textarea
            id="condicionesPresupuesto"
            name="condicionesPresupuesto"
            rows={5}
            defaultValue={valor("condicionesPresupuesto")}
            {...condiciones.props}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field label="Garantía" htmlFor="garantia" error={garantia.error} hint="Ej.: 6 meses en la mano de obra.">
            <Input id="garantia" name="garantia" defaultValue={valor("garantia")} {...garantia.props} />
          </Field>
          <Field label="Validez (días)" htmlFor="validezPresupuestoDias" error={validez.error}>
            <Input
              id="validezPresupuestoDias"
              name="validezPresupuestoDias"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              className="tabular"
              defaultValue={valor("validezPresupuestoDias")}
              {...validez.props}
            />
          </Field>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton className="sm:w-auto sm:min-w-48">Guardar</SubmitButton>
        <p role="status" className="flex items-center gap-2 text-sm font-semibold text-ok">
          {estado?.ok && (
            <>
              <CircleCheck aria-hidden className="size-5 shrink-0" />
              {estado.ok}
            </>
          )}
        </p>
      </div>
    </form>
  );
}

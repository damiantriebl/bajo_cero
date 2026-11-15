"use client";

import { useState } from "react";
import { Banknote } from "lucide-react";
import { Button, Field, FormError, Input, Select, cx } from "@/components/ui/base";
import { Sheet, SubmitButton } from "@/components/ui/client";
import type { EstadoForm } from "@/lib/forms";
import { MEDIO_PAGO, opciones } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";
import { useAccionForm } from "@/app/(app)/insumos/_components/use-accion-form";

const MEDIOS = opciones(MEDIO_PAGO);

/** Botón "Registrar pago" que abre una hoja con el formulario. */
export function RegistrarPago({
  accion,
  saldo,
  hoy,
  className,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  saldo: number;
  /** "2026-11-16" para el valor inicial de la fecha. */
  hoy: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const { state, formAction, onSubmit, campo, errores, formRef } = useAccionForm(
    async (prev, formData) => {
      const resultado = await accion(prev, formData);
      if (resultado?.ok) {
        setAbierto(false);
        setAviso(resultado.ok);
      }
      return resultado;
    },
    { limpiarSiOk: true },
  );

  return (
    <>
      <Button
        variante="secondary"
        className={className}
        onClick={() => {
          setAviso(null);
          setAbierto(true);
        }}
      >
        <Banknote aria-hidden className="size-5" />
        Registrar pago
      </Button>

      <p role="status" className={cx("order-last basis-full text-sm font-bold text-ok", !aviso && "sr-only")}>
        {aviso ?? ""}
      </p>

      <Sheet open={abierto} onClose={() => setAbierto(false)} title="Registrar pago">
        <form ref={formRef} action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <FormError message={state?.error} />

          <Field
            label="Monto"
            htmlFor="pago-monto"
            error={errores.monto}
            hint={saldo > 0 ? `Les debés ${formatPesos(saldo)}` : "No le debés nada a este proveedor"}
          >
            <Input
              {...campo("pago-monto", "monto")}
              defaultValue={saldo > 0 ? String(saldo) : ""}
              inputMode="numeric"
              autoComplete="off"
              placeholder="$ 0"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha" htmlFor="pago-fecha" error={errores.fecha}>
              <Input {...campo("pago-fecha", "fecha")} type="date" defaultValue={hoy} />
            </Field>
            <Field label="Medio" htmlFor="pago-medio" error={errores.medio}>
              <Select {...campo("pago-medio", "medio")} defaultValue="TRANSFERENCIA">
                {MEDIOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notas (opcional)" htmlFor="pago-notas" error={errores.notas}>
            <Input {...campo("pago-notas", "notas")} autoComplete="off" placeholder="Ej.: factura 12877, a cuenta" />
          </Field>

          <SubmitButton>Guardar pago</SubmitButton>
        </form>
      </Sheet>
    </>
  );
}

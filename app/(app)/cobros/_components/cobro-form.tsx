"use client";

import { useState } from "react";
import { ButtonLink, Card, Field, FormError, Input, Select, Textarea, buttonClass, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import type { ClienteACobrar } from "@/lib/data/cobros";
import { MEDIO_PAGO, opciones } from "@/lib/etiquetas";
import { formatPesos, parsePesos } from "@/lib/formato";
import type { EstadoForm } from "@/lib/forms";
import { ariaError, useFormSinReset } from "../../clientes/_components/form-sin-reset";
import { numeroTrabajo } from "../../clientes/_components/cuenta";

const CONCEPTOS = ["Seña", "Pago parcial", "Saldo", "Pago total"];

const miles = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function trabajoPorDefecto(c: ClienteACobrar | undefined): string {
  return c && c.trabajos.length === 1 ? c.trabajos[0].id : "";
}

export function CobroForm({
  action,
  clientes,
  clienteInicial,
  trabajoInicial,
  hoy,
  cancelarHref,
}: {
  action: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  clientes: ClienteACobrar[];
  clienteInicial?: string;
  trabajoInicial?: string;
  /** "2026-11-14" */
  hoy: string;
  cancelarHref: string;
}) {
  const { estado, formAction, onSubmit, errores } = useFormSinReset(action);

  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const cliente = clientes.find((c) => c.id === clienteId);
  const [trabajoId, setTrabajoId] = useState(trabajoInicial ?? trabajoPorDefecto(cliente));
  const trabajo = cliente?.trabajos.find((t) => t.id === trabajoId);
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");

  const conSaldo = clientes.filter((c) => c.falta > 0);
  const resto = clientes.filter((c) => c.falta === 0);

  function elegirCliente(id: string) {
    setClienteId(id);
    setTrabajoId(trabajoPorDefecto(clientes.find((c) => c.id === id)));
  }

  function cobrarTodo() {
    if (!trabajo) return;
    setMonto(miles.format(trabajo.falta));
    if (!concepto) setConcepto(trabajo.pagado > 0 ? "Saldo" : "Pago total");
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-4 lg:max-w-3xl">
      <Card className="grid gap-4 p-4 lg:grid-cols-2 lg:gap-5 lg:p-6">
        <Field label="Cliente" htmlFor="clienteId" error={errores.clienteId}>
          <Select
            id="clienteId"
            name="clienteId"
            required
            value={clienteId}
            onChange={(e) => elegirCliente(e.target.value)}
            {...ariaError("clienteId", errores.clienteId)}
          >
            <option value="" disabled>
              Elegí un cliente
            </option>
            {conSaldo.length > 0 && (
              <optgroup label="Con saldo">
                {conSaldo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · debe {formatPesos(c.falta)}
                  </option>
                ))}
              </optgroup>
            )}
            {resto.length > 0 && (
              <optgroup label={conSaldo.length > 0 ? "Otros clientes" : "Clientes"}>
                {resto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {cliente && cliente.trabajos.length > 0 ? (
          <Field label="Trabajo" htmlFor="trabajoId" error={errores.trabajoId}>
            <Select
              id="trabajoId"
              name="trabajoId"
              value={trabajoId}
              onChange={(e) => setTrabajoId(e.target.value)}
              {...ariaError("trabajoId", errores.trabajoId)}
            >
              <option value="">Sin trabajo asociado</option>
              {cliente.trabajos.map((t) => (
                <option key={t.id} value={t.id}>
                  {numeroTrabajo(t.numero)} · {t.titulo} · {t.falta > 0 ? `falta ${formatPesos(t.falta)}` : "pagado"}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-bold">Trabajo</span>
            <input type="hidden" name="trabajoId" value="" />
            <p className="flex min-h-12 items-center rounded-xl bg-surface-2 px-3.5 text-sm text-muted">
              {cliente ? "No tiene trabajos con saldo. El cobro queda sin trabajo asociado." : "Primero elegí el cliente."}
            </p>
          </div>
        )}

        <Field label="Monto" htmlFor="monto" error={errores.monto} className="lg:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-64">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-lg font-bold text-muted">
                $
              </span>
              <Input
                id="monto"
                name="monto"
                inputMode="decimal"
                autoComplete="off"
                required
                placeholder="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                onBlur={() => {
                  const n = parsePesos(monto);
                  if (n !== null && n > 0) setMonto(miles.format(n));
                }}
                className="tabular pl-8! text-lg! font-bold"
                aria-invalid={errores.monto ? true : undefined}
                aria-describedby={errores.monto ? "monto-error" : "monto-ayuda"}
              />
            </div>
            {trabajo && trabajo.falta > 0 && (
              <button type="button" onClick={cobrarTodo} className={buttonClass("soft", "sm", "sm:h-12")}>
                Cobrar todo ({formatPesos(trabajo.falta)})
              </button>
            )}
          </div>
          {!errores.monto && (
            <p id="monto-ayuda" className="text-[13px] text-muted">
              {trabajo
                ? trabajo.falta > 0
                  ? `Falta cobrar ${formatPesos(trabajo.falta)} de ${formatPesos(trabajo.total)} de este trabajo.`
                  : "Este trabajo ya está pagado."
                : cliente && cliente.falta > 0
                  ? `Debe ${formatPesos(cliente.falta)} en total.`
                  : "Pesos, sin centavos."}
            </p>
          )}
        </Field>

        <Field label="Fecha" htmlFor="fecha" error={errores.fecha}>
          <Input id="fecha" name="fecha" type="date" required defaultValue={hoy} max={hoy} {...ariaError("fecha", errores.fecha)} />
        </Field>

        <fieldset className="flex flex-col gap-1.5 lg:col-span-2" aria-describedby={errores.medio ? "medio-error" : undefined}>
          <legend className="mb-1.5 text-sm font-bold">Medio de pago</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {opciones(MEDIO_PAGO).map(({ value, label }) => (
              <label
                key={value}
                className={cx(
                  "flex h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface px-2 text-[15px] font-semibold text-ink transition-colors",
                  "hover:border-brand has-[:checked]:border-night has-[:checked]:bg-night has-[:checked]:font-bold has-[:checked]:text-white",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                )}
              >
                <input
                  type="radio"
                  name="medio"
                  value={value}
                  defaultChecked={value === "TRANSFERENCIA"}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </div>
          {errores.medio && (
            <p id="medio-error" className="text-[13px] font-semibold text-danger">
              {errores.medio}
            </p>
          )}
        </fieldset>

        <Field label="Concepto" htmlFor="concepto" error={errores.concepto} className="lg:col-span-2">
          <Input
            id="concepto"
            name="concepto"
            autoComplete="off"
            placeholder="Seña, pago parcial, saldo…"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            {...ariaError("concepto", errores.concepto)}
          />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Conceptos frecuentes">
            {CONCEPTOS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={concepto === c}
                onClick={() => setConcepto(c)}
                className={cx(
                  "h-11 rounded-full px-3.5 text-sm transition-colors",
                  concepto === c
                    ? "bg-night font-bold text-white"
                    : "border border-line bg-surface font-semibold text-ink hover:border-brand",
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Notas" htmlFor="notas" error={errores.notas} className="lg:col-span-2">
          <Textarea id="notas" name="notas" rows={2} placeholder="Opcional" {...ariaError("notas", errores.notas)} />
        </Field>
      </Card>

      <FormError message={estado?.error} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <SubmitButton className="sm:w-auto sm:min-w-48">Guardar cobro</SubmitButton>
        <ButtonLink href={cancelarHref} variante="ghost" tamano="lg">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}

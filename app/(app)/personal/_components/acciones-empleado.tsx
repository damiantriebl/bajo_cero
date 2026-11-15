"use client";

import { useActionState, useState } from "react";
import { CalendarPlus, HandCoins } from "lucide-react";
import { Button, Field, FormError, Input, Select, cx } from "@/components/ui/base";
import { Sheet, SubmitButton } from "@/components/ui/client";
import { MEDIO_PAGO, opciones } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";
import { errorDe, type EstadoConValores } from "../../gastos/_components/estado-form";

type Accion = (prev: EstadoConValores, formData: FormData) => Promise<EstadoConValores>;

const miles = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

/** Botones "Cargar jornada" y "Registrar pago", cada uno con su formulario en una hoja. */
export function AccionesEmpleado({
  nombre,
  jornal,
  saldo,
  mesNombre,
  hoy,
  trabajos,
  cargarJornada,
  registrarPago,
}: {
  nombre: string;
  /** Mes que se está viendo ("noviembre"), para el aviso de saldo. */
  mesNombre: string;
  jornal: number;
  saldo: number;
  hoy: string;
  trabajos: { id: string; label: string }[];
  cargarJornada: Accion;
  registrarPago: Accion;
}) {
  const [abierta, setAbierta] = useState<"jornada" | "pago" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const abrir = (cual: "jornada" | "pago") => {
    setAviso(null);
    setAbierta(cual);
  };
  const listo = (mensaje: string) => {
    setAbierta(null);
    setAviso(mensaje);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button onClick={() => abrir("jornada")}>
          <CalendarPlus aria-hidden className="size-5" />
          Cargar jornada
        </Button>
        <Button variante="secondary" onClick={() => abrir("pago")}>
          <HandCoins aria-hidden className="size-5" />
          Registrar pago
        </Button>
      </div>
      <p
        role="status"
        className={cx(aviso ? "rounded-xl bg-ok-soft px-3.5 py-2.5 text-sm font-semibold text-ok" : "sr-only")}
      >
        {aviso}
      </p>

      <Sheet open={abierta === "jornada"} onClose={() => setAbierta(null)} title={`Cargar jornada de ${nombre}`}>
        <FormJornada accion={cargarJornada} hoy={hoy} jornal={jornal} trabajos={trabajos} onListo={listo} />
      </Sheet>
      <Sheet open={abierta === "pago"} onClose={() => setAbierta(null)} title={`Registrar pago a ${nombre}`}>
        <FormPago accion={registrarPago} hoy={hoy} saldo={saldo} mesNombre={mesNombre} onListo={listo} />
      </Sheet>
    </div>
  );
}

function useAccionConAviso(accion: Accion, onListo: (mensaje: string) => void) {
  return useActionState(async (prev: EstadoConValores, formData: FormData) => {
    const r = await accion(prev, formData);
    if (r?.ok) onListo(r.ok);
    return r;
  }, null);
}

function FormJornada({
  accion,
  hoy,
  jornal,
  trabajos,
  onListo,
}: {
  accion: Accion;
  hoy: string;
  jornal: number;
  trabajos: { id: string; label: string }[];
  onListo: (mensaje: string) => void;
}) {
  const [estado, formAction] = useAccionConAviso(accion, onListo);
  const v = estado?.valores;
  const fecha = errorDe(estado, "fecha", "j-fecha");
  const monto = errorDe(estado, "monto", "j-monto");
  const horas = errorDe(estado, "horas", "j-horas");
  const trabajo = errorDe(estado, "trabajoId", "j-trabajo");

  return (
    <form key={JSON.stringify(v ?? null)} action={formAction} noValidate className="flex flex-col gap-4">
      <FormError message={estado?.error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día" htmlFor="j-fecha" error={fecha.error}>
          <Input id="j-fecha" name="fecha" type="date" required defaultValue={v?.fecha ?? hoy} {...fecha.props} />
        </Field>
        <Field label="Monto" htmlFor="j-monto" error={monto.error}>
          <Input
            id="j-monto"
            name="monto"
            inputMode="decimal"
            autoComplete="off"
            required
            className="tabular"
            defaultValue={v?.monto ?? (jornal > 0 ? miles.format(jornal) : "")}
            {...monto.props}
          />
        </Field>
      </div>
      <Field label="Horas (opcional)" htmlFor="j-horas" error={horas.error}>
        <Input
          id="j-horas"
          name="horas"
          inputMode="decimal"
          autoComplete="off"
          placeholder="8"
          defaultValue={v?.horas ?? ""}
          {...horas.props}
        />
      </Field>
      <Field label="Trabajo (opcional)" htmlFor="j-trabajo" error={trabajo.error}>
        <Select id="j-trabajo" name="trabajoId" defaultValue={v?.trabajoId ?? ""} {...trabajo.props}>
          <option value="">Sin trabajo</option>
          {trabajos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <SubmitButton>Guardar jornada</SubmitButton>
    </form>
  );
}

function FormPago({
  accion,
  hoy,
  saldo,
  mesNombre,
  onListo,
}: {
  accion: Accion;
  hoy: string;
  saldo: number;
  mesNombre: string;
  onListo: (mensaje: string) => void;
}) {
  const [estado, formAction] = useAccionConAviso(accion, onListo);
  const v = estado?.valores;
  const concepto = errorDe(estado, "concepto");
  const monto = errorDe(estado, "monto", "p-monto");
  const medio = errorDe(estado, "medio", "p-medio");
  const fecha = errorDe(estado, "fecha", "p-fecha");
  const conceptoInicial = v?.concepto ?? "PAGO";

  return (
    <form key={JSON.stringify(v ?? null)} action={formAction} noValidate className="flex flex-col gap-4">
      <FormError message={estado?.error} />
      <fieldset aria-describedby={concepto.error ? "concepto-error" : undefined}>
        <legend className="mb-1.5 text-sm font-bold">¿Qué es?</legend>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "PAGO", label: "Pago" },
            { value: "ADELANTO", label: "Adelanto" },
          ].map((o) => (
            <label
              key={o.value}
              className={cx(
                "flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-surface px-3 text-[15px] font-semibold transition-colors",
                "hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:font-bold has-[:checked]:text-brand-strong",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
              )}
            >
              <input type="radio" name="concepto" value={o.value} defaultChecked={conceptoInicial === o.value} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
        {concepto.error && (
          <p id="concepto-error" className="mt-1.5 text-[13px] font-semibold text-danger">
            {concepto.error}
          </p>
        )}
      </fieldset>
      <Field
        label="Monto"
        htmlFor="p-monto"
        error={monto.error}
        hint={saldo > 0 ? `En ${mesNombre} le debés ${formatPesos(saldo)}.` : undefined}
      >
        <Input
          id="p-monto"
          name="monto"
          inputMode="decimal"
          autoComplete="off"
          required
          className="tabular"
          defaultValue={v?.monto ?? (saldo > 0 ? miles.format(saldo) : "")}
          {...monto.props}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Medio" htmlFor="p-medio" error={medio.error}>
          <Select id="p-medio" name="medio" defaultValue={v?.medio ?? "EFECTIVO"} {...medio.props}>
            {opciones(MEDIO_PAGO).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha" htmlFor="p-fecha" error={fecha.error}>
          <Input id="p-fecha" name="fecha" type="date" required defaultValue={v?.fecha ?? hoy} {...fecha.props} />
        </Field>
      </div>
      <SubmitButton>Guardar pago</SubmitButton>
    </form>
  );
}

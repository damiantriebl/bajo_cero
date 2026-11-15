"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Building2, Car, Ellipsis, Fuel, Landmark, Package, UserRound, Wrench, Zap, type LucideIcon } from "lucide-react";
import { Card, Field, FormError, Input, Select, Textarea, buttonClass, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import { CATEGORIA_GASTO, MEDIO_PAGO, opciones } from "@/lib/etiquetas";
import type { CategoriaGasto } from "@/lib/generated/prisma/enums";
import { crearGasto } from "../actions";
import { errorDe, type EstadoConValores } from "./estado-form";

const ICONOS: Record<CategoriaGasto, LucideIcon> = {
  PERSONAL: UserRound,
  MATERIALES: Package,
  COMBUSTIBLE: Fuel,
  HERRAMIENTAS: Wrench,
  VEHICULO: Car,
  IMPUESTOS: Landmark,
  SERVICIOS: Zap,
  ALQUILER: Building2,
  OTROS: Ellipsis,
};

const EJEMPLOS: Partial<Record<CategoriaGasto, string>> = {
  MATERIALES: "Ej.: Caño de cobre y aislación",
  COMBUSTIBLE: "Ej.: Nafta de la camioneta",
  HERRAMIENTAS: "Ej.: Bomba de vacío",
  VEHICULO: "Ej.: Service de la camioneta",
  IMPUESTOS: "Ej.: Monotributo",
  SERVICIOS: "Ej.: Celular de la empresa",
  ALQUILER: "Ej.: Alquiler del depósito",
};

type Props = {
  empleados: { id: string; nombre: string }[];
  trabajos: { id: string; label: string }[];
  hoy: string;
  categoriaInicial?: CategoriaGasto;
};

export function FormGasto(props: Props) {
  const [estado, formAction] = useActionState(crearGasto, null);
  return (
    <form key={JSON.stringify(estado?.valores ?? null)} action={formAction} noValidate className="flex flex-col gap-4">
      <CamposGasto {...props} estado={estado} />
    </form>
  );
}

function CamposGasto({ empleados, trabajos, hoy, categoriaInicial, estado }: Props & { estado: EstadoConValores }) {
  const v = estado?.valores;
  const inicial = v?.categoria ?? categoriaInicial ?? "";
  const [categoria, setCategoria] = useState<string>(inicial);
  const esPersonal = categoria === "PERSONAL";

  const cat = errorDe(estado, "categoria");
  const emp = errorDe(estado, "empleadoId");
  const desc = errorDe(estado, "descripcion");
  const monto = errorDe(estado, "monto");
  const fecha = errorDe(estado, "fecha");
  const medio = errorDe(estado, "medio");
  const trabajo = errorDe(estado, "trabajoId");

  return (
    <>
      <FormError message={estado?.error} />

      <Card className="flex flex-col gap-4 p-4 lg:p-5">
        <fieldset className="flex flex-col gap-2" aria-describedby={cat.error ? "categoria-error" : undefined}>
          <legend className="mb-2 text-sm font-bold">¿En qué fue?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {opciones(CATEGORIA_GASTO).map(({ value, label }) => {
              const Icono = ICONOS[value];
              return (
                <label
                  key={value}
                  className={cx(
                    "flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-[15px] font-semibold transition-colors",
                    "hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:font-bold has-[:checked]:text-brand-strong",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                    cat.error && "border-danger",
                  )}
                >
                  <input
                    type="radio"
                    name="categoria"
                    value={value}
                    defaultChecked={inicial === value}
                    onChange={() => setCategoria(value)}
                    className="sr-only"
                    {...(cat.error ? { "aria-invalid": true } : {})}
                  />
                  <Icono aria-hidden className="size-5 shrink-0" />
                  {label}
                </label>
              );
            })}
          </div>
          {cat.error && (
            <p id="categoria-error" className="text-[13px] font-semibold text-danger">
              {cat.error}
            </p>
          )}
        </fieldset>

        {esPersonal &&
          (empleados.length > 0 ? (
            <Field label="¿A quién le pagaste?" htmlFor="empleadoId" error={emp.error}>
              <Select id="empleadoId" name="empleadoId" defaultValue={v?.empleadoId ?? ""} required {...emp.props}>
                <option value="" disabled>
                  Elegí una persona
                </option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="rounded-xl bg-warn-soft px-3.5 py-3 text-sm text-warn-strong">
              No hay personal cargado.{" "}
              <Link href="/personal/nuevo" className="font-bold underline">
                Agregá a alguien
              </Link>{" "}
              para registrarle pagos.
            </p>
          ))}

        <Field
          label="Descripción"
          htmlFor="descripcion"
          error={desc.error}
          hint={esPersonal ? "Si la dejás vacía, queda “Pago a” y el nombre." : undefined}
        >
          <Input
            id="descripcion"
            name="descripcion"
            defaultValue={v?.descripcion ?? ""}
            placeholder={EJEMPLOS[categoria as CategoriaGasto] ?? "¿En qué se gastó?"}
            autoComplete="off"
            {...desc.props}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Monto" htmlFor="monto" error={monto.error}>
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 font-bold text-muted">
                $
              </span>
              <Input
                id="monto"
                name="monto"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                defaultValue={v?.monto ?? ""}
                required
                className="tabular pl-8"
                {...monto.props}
              />
            </div>
          </Field>
          <Field label="Fecha" htmlFor="fecha" error={fecha.error}>
            <Input id="fecha" name="fecha" type="date" defaultValue={v?.fecha ?? hoy} required {...fecha.props} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="¿Cómo pagaste?" htmlFor="medio" error={medio.error}>
            <Select id="medio" name="medio" defaultValue={v?.medio ?? "EFECTIVO"} {...medio.props}>
              {opciones(MEDIO_PAGO).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Trabajo (opcional)" htmlFor="trabajoId" error={trabajo.error}>
            <Select id="trabajoId" name="trabajoId" defaultValue={v?.trabajoId ?? ""} {...trabajo.props}>
              <option value="">Sin trabajo</option>
              {trabajos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Notas (opcional)" htmlFor="notas">
          <Textarea id="notas" name="notas" rows={3} defaultValue={v?.notas ?? ""} />
        </Field>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row-reverse sm:justify-start">
        <SubmitButton className="sm:w-auto sm:min-w-48">Guardar gasto</SubmitButton>
        <Link href="/gastos" className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          Cancelar
        </Link>
      </div>
    </>
  );
}

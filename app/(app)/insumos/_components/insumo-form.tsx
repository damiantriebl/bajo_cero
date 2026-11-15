"use client";

import { Field, FormError, Input, Select, buttonClass } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import Link from "next/link";
import type { EstadoForm } from "@/lib/forms";
import { UNIDAD } from "@/lib/etiquetas";
import type { Unidad } from "@/lib/generated/prisma/enums";
import { useAccionForm } from "./use-accion-form";

export type ValoresInsumo = {
  nombre: string;
  categoria: string;
  unidad: Unidad;
  stockMinimo: string;
  costoUnitario: string;
  precioVenta: string;
  proveedorId: string;
};

const UNIDADES = (Object.keys(UNIDAD) as Unidad[]).map((u) => ({
  value: u,
  label: `${UNIDAD[u].varios.charAt(0).toUpperCase()}${UNIDAD[u].varios.slice(1)} (${UNIDAD[u].corta})`,
}));

export function InsumoForm({
  accion,
  valores,
  categorias,
  proveedores,
  modo,
  cancelarHref,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  valores?: ValoresInsumo;
  categorias: string[];
  proveedores: { id: string; nombre: string }[];
  modo: "crear" | "editar";
  cancelarHref: string;
}) {
  const { state, formAction, onSubmit, campo, errores } = useAccionForm(accion);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError message={state?.error} />

      <Field label="Nombre" htmlFor="nombre" error={errores.nombre}>
        <Input {...campo("nombre")} defaultValue={valores?.nombre} autoComplete="off" placeholder="Ej.: Caño de cobre 1/4″" required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Categoría" htmlFor="categoria" error={errores.categoria} hint="Elegí una o escribí una nueva">
          <Input {...campo("categoria")} defaultValue={valores?.categoria} list="categorias-insumo" autoComplete="off" placeholder="Ej.: Cañería" />
          <datalist id="categorias-insumo">
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>

        <Field label="Unidad" htmlFor="unidad" error={errores.unidad}>
          <Select {...campo("unidad")} defaultValue={valores?.unidad ?? "UNIDAD"}>
            {UNIDADES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {modo === "crear" && (
          <Field label="Stock inicial" htmlFor="stock" error={errores.stock} hint="Lo que tenés hoy">
            <Input {...campo("stock")} inputMode="decimal" autoComplete="off" placeholder="0" />
          </Field>
        )}
        <Field label="Stock mínimo" htmlFor="stockMinimo" error={errores.stockMinimo} hint="Por debajo de esto te avisamos">
          <Input {...campo("stockMinimo")} defaultValue={valores?.stockMinimo} inputMode="decimal" autoComplete="off" placeholder="0" />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Costo por unidad" htmlFor="costoUnitario" error={errores.costoUnitario} hint="Lo que te cobra el proveedor">
          <Input {...campo("costoUnitario")} defaultValue={valores?.costoUnitario} inputMode="numeric" autoComplete="off" placeholder="$ 0" />
        </Field>
        <Field label="Precio de venta (opcional)" htmlFor="precioVenta" error={errores.precioVenta} hint="Lo que le cobrás al cliente">
          <Input {...campo("precioVenta")} defaultValue={valores?.precioVenta} inputMode="numeric" autoComplete="off" placeholder="$ 0" />
        </Field>
      </div>

      <Field label="Proveedor habitual (opcional)" htmlFor="proveedorId" error={errores.proveedorId} hint="Se usa para armar el pedido">
        <Select {...campo("proveedorId")} defaultValue={valores?.proveedorId ?? ""}>
          <option value="">Sin proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
      </Field>

      {modo === "editar" && (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
          El stock no se cambia acá: usá <strong className="text-ink">Ajustar stock</strong> en la ficha del insumo, así queda en el historial.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={cancelarHref} className={buttonClass("secondary", "lg", "w-full sm:w-auto")}>
          Cancelar
        </Link>
        <SubmitButton className="sm:w-auto">{modo === "crear" ? "Guardar insumo" : "Guardar cambios"}</SubmitButton>
      </div>
    </form>
  );
}

"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import type { InsumoParaConsumo } from "@/lib/data/trabajos";
import type { EstadoForm } from "@/lib/forms";
import { UNIDAD } from "@/lib/etiquetas";
import { formatNumero } from "@/lib/formato";
import { Field, FormError, Input, Select, buttonClass } from "@/components/ui/base";
import { registrarMaterial } from "../actions";

/** Carga de material usado: descuenta del stock y suma al costo del trabajo. */
export function FormMaterial({ trabajoId, insumos }: { trabajoId: string; insumos: InsumoParaConsumo[] }) {
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  // Campos controlados y envío desde onSubmit: si el servidor devuelve un error,
  // lo cargado queda; si sale bien, se vacía para cargar el siguiente.
  const [estado, accion, pending] = useActionState(async (prev: EstadoForm, formData: FormData) => {
    const r = await registrarMaterial(trabajoId, prev, formData);
    if (r?.ok) {
      setInsumoId("");
      setCantidad("");
    }
    return r;
  }, null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => accion(formData));
  }

  const insumo = insumos.find((i) => i.id === insumoId);
  const n = Number(cantidad.replace(",", "."));
  const quedaria = insumo && cantidad.trim() !== "" && Number.isFinite(n) && n > 0 ? insumo.stock - n : null;
  const errores = estado?.errores ?? {};

  return (
    <form
      action={accion}
      onSubmit={onSubmit}
      className="flex flex-col gap-3 border-t border-line-soft bg-surface-2 px-3.5 py-3"
    >
      <h3 className="text-sm font-bold">Registrar material usado</h3>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <Field label="Material" htmlFor="material-insumo" error={errores.insumoId}>
          <Select
            id="material-insumo"
            name="insumoId"
            required
            value={insumoId}
            onChange={(e) => setInsumoId(e.target.value)}
            aria-invalid={errores.insumoId ? true : undefined}
            aria-describedby={errores.insumoId ? "material-insumo-error" : undefined}
          >
            <option value="">Elegí un material</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} (quedan {formatNumero(i.stock)} {UNIDAD[i.unidad].corta})
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={insumo ? `Cantidad (${UNIDAD[insumo.unidad].varios})` : "Cantidad"}
          htmlFor="material-cantidad"
          error={errores.cantidad}
        >
          <Input
            id="material-cantidad"
            name="cantidad"
            inputMode="decimal"
            required
            autoComplete="off"
            placeholder="0"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="tabular"
            aria-invalid={errores.cantidad ? true : undefined}
            aria-describedby={errores.cantidad ? "material-cantidad-error" : undefined}
          />
        </Field>
      </div>

      {insumo && quedaria !== null && quedaria < 0 && (
        <p role="status" className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-sm font-semibold text-warn">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          El stock va a quedar en {formatNumero(quedaria)} {UNIDAD[insumo.unidad].corta}. Se registra igual.
        </p>
      )}
      {estado?.ok && (
        // El servidor avisa con "Ojo" cuando el stock quedó negativo.
        <p role="status" className={estado.ok.includes("Ojo") ? "text-sm font-semibold text-warn" : "text-sm font-semibold text-ok"}>
          {estado.ok}
        </p>
      )}
      <FormError message={estado?.errores && Object.keys(estado.errores).length > 0 ? null : estado?.error} />

      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className={buttonClass("secondary", "lg", "w-full sm:w-auto sm:self-start")}
      >
        {pending ? "Registrando…" : "Registrar material"}
      </button>
    </form>
  );
}

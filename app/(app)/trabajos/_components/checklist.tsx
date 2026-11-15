"use client";

import { useActionState, useOptimistic } from "react";
import { Check, Plus } from "lucide-react";
import { Card, FormError, Input, ProgressBar, buttonClass, cx } from "@/components/ui/base";
import { agregarPaso, alternarPaso } from "../actions";

type Paso = { id: string; texto: string; hecho: boolean };

/** Pasos del trabajo: se tildan con un toque y se pueden agregar nuevos. */
export function Checklist({ trabajoId, pasos }: { trabajoId: string; pasos: Paso[] }) {
  const [optimistas, alternar] = useOptimistic(pasos, (actual: Paso[], id: string) =>
    actual.map((p) => (p.id === id ? { ...p, hecho: !p.hecho } : p)),
  );
  const [estado, agregar] = useActionState(agregarPaso.bind(null, trabajoId), null);

  const hechos = optimistas.filter((p) => p.hecho).length;
  const errorTexto = estado?.errores?.texto;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex flex-col gap-2 px-3.5 pt-3 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-bold">Checklist</h2>
          {optimistas.length > 0 && (
            <span className="text-[13px] text-muted">
              {hechos} de {optimistas.length} pasos
            </span>
          )}
        </div>
        {optimistas.length > 0 && <ProgressBar value={hechos / optimistas.length} />}
      </div>

      {optimistas.length > 0 ? (
        <ul className="flex flex-col border-t border-line-soft [&>*+*]:border-t [&>*+*]:border-line-soft">
          {optimistas.map((p) => (
            <li key={p.id}>
              <form
                action={async () => {
                  alternar(p.id);
                  await alternarPaso(p.id);
                }}
              >
                <button
                  type="submit"
                  aria-pressed={p.hecho}
                  className="flex min-h-12 w-full items-center gap-3 px-3.5 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      p.hecho ? "border-ok bg-ok text-white" : "border-track bg-surface",
                    )}
                  >
                    {p.hecho && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  <span className={cx("text-[15px]", p.hecho && "text-muted line-through")}>{p.texto}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="border-t border-line-soft px-3.5 py-3 text-sm text-muted">
          Sin pasos todavía. Sumá los que haya que hacer en la obra.
        </p>
      )}

      <form action={agregar} className="flex flex-col gap-1.5 border-t border-line-soft bg-surface-2 px-3.5 py-3">
        <label htmlFor="paso-nuevo" className="text-sm font-bold">
          Agregar paso
        </label>
        <div className="flex gap-2">
          <Input
            id="paso-nuevo"
            name="texto"
            required
            maxLength={200}
            placeholder="Ej.: Probar pérdidas con nitrógeno"
            autoComplete="off"
            aria-invalid={errorTexto ? true : undefined}
            aria-describedby={errorTexto ? "paso-nuevo-error" : undefined}
          />
          <button type="submit" aria-label="Agregar paso" className={buttonClass("soft", "md", "shrink-0")}>
            <Plus aria-hidden className="size-5" />
            <span className="max-sm:sr-only">Agregar</span>
          </button>
        </div>
        {errorTexto && (
          <p id="paso-nuevo-error" className="text-[13px] font-semibold text-danger">
            {errorTexto}
          </p>
        )}
        {!errorTexto && <FormError message={estado?.error} />}
      </form>
    </Card>
  );
}

"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Plus, X } from "lucide-react";
import { Button, Card, Field, FormError, Input, Select, Textarea, buttonClass } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import type { EstadoForm } from "@/lib/forms";
import { MEDIO_PAGO, UNIDAD, opciones } from "@/lib/etiquetas";
import { formatPesos, parsePesos } from "@/lib/formato";
import type { Unidad } from "@/lib/generated/prisma/enums";
import { useAccionForm } from "@/app/(app)/insumos/_components/use-accion-form";

export type OpcionInsumoCompra = {
  id: string;
  nombre: string;
  unidad: Unidad;
  costoUnitario: number;
  proveedorId: string | null;
};

export type ItemInicial = { insumoId: string | null; descripcion: string; cantidad: number; precioUnitario: number };

type Fila = { key: string; insumoId: string; descripcion: string; cantidad: string; precio: string };

const MEDIOS = opciones(MEDIO_PAGO);

/** "2,5" → 2.5 (0 si no es un número válido). */
function aCantidad(v: string): number {
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const subtotal = (f: Fila) => aCantidad(f.cantidad) * (parsePesos(f.precio) ?? 0);

export function CompraForm({
  accion,
  hoy,
  proveedorId,
  proveedorNombre,
  insumos,
  inicial,
  cancelarHref,
}: {
  accion: (prev: EstadoForm, formData: FormData) => Promise<EstadoForm>;
  /** "2026-11-16" */
  hoy: string;
  proveedorId: string;
  proveedorNombre: string;
  insumos: OpcionInsumoCompra[];
  inicial: ItemInicial[];
  cancelarHref: string;
}) {
  const { state, formAction, onSubmit, campo, errores } = useAccionForm(accion);

  const [filas, setFilas] = useState<Fila[]>(() =>
    (inicial.length ? inicial : [{ insumoId: null, descripcion: "", cantidad: 1, precioUnitario: 0 }]).map((i, n) => ({
      key: `fila-${n}`,
      insumoId: i.insumoId ?? "",
      descripcion: i.insumoId ? "" : i.descripcion,
      cantidad: String(i.cantidad).replace(".", ","),
      precio: i.precioUnitario > 0 ? String(i.precioUnitario) : "",
    })),
  );
  const siguiente = useRef(filas.length);
  const [pagada, setPagada] = useState(false);

  const delProveedor = insumos.filter((i) => i.proveedorId === proveedorId);
  const otros = insumos.filter((i) => i.proveedorId !== proveedorId);
  const total = Math.round(filas.reduce((acc, f) => acc + subtotal(f), 0));

  function cambiar(key: string, cambios: Partial<Fila>) {
    setFilas((fs) => fs.map((f) => (f.key === key ? { ...f, ...cambios } : f)));
  }

  function elegirInsumo(key: string, insumoId: string) {
    const insumo = insumos.find((i) => i.id === insumoId);
    // Al elegir un insumo se precarga su último costo; "Otra cosa" deja escribir la descripción.
    cambiar(key, insumo ? { insumoId, descripcion: "", precio: insumo.costoUnitario > 0 ? String(insumo.costoUnitario) : "" } : { insumoId: "" });
  }

  function agregar() {
    const key = `fila-${siguiente.current++}`;
    setFilas((fs) => [...fs, { key, insumoId: "", descripcion: "", cantidad: "1", precio: "" }]);
  }

  function quitar(key: string) {
    setFilas((fs) => fs.filter((f) => f.key !== key));
  }

  const itemsJson = JSON.stringify(
    filas.map((f) => ({ insumoId: f.insumoId || null, descripcion: f.descripcion, cantidad: f.cantidad, precioUnitario: f.precio })),
  );

  /** Props de accesibilidad para un campo de una fila (los errores vienen como "items.N.campo"). */
  const errorFila = (n: number, campoFila: string) => errores[`items.${n}.${campoFila}`];
  const a11yFila = (id: string, error?: string) => ({
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  });

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={state?.error} />
      <input type="hidden" name="items" value={itemsJson} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-6">
        {/* Factura */}
        <Card className="flex flex-col gap-4 p-4 lg:col-start-2 lg:row-start-1">
          <h2 className="text-lg font-bold">Factura</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Field label="Fecha de compra" htmlFor="fecha" error={errores.fecha}>
              <Input {...campo("fecha")} type="date" defaultValue={hoy} required />
            </Field>
            <Field label="Número de factura (opcional)" htmlFor="numeroFactura" error={errores.numeroFactura}>
              <Input {...campo("numeroFactura")} autoComplete="off" placeholder="A-0003-00012877" />
            </Field>
          </div>
        </Card>

        {/* Ítems */}
        <section aria-labelledby="titulo-items" className="flex flex-col gap-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <div className="flex min-h-11 items-center justify-between gap-3">
            <h2 id="titulo-items" className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">
              Qué compraste
            </h2>
            <span className="text-[13px] text-muted">
              {filas.length} {filas.length === 1 ? "ítem" : "ítems"}
            </span>
          </div>

          {errores.items && (
            <p id="items-error" className="text-[13px] font-semibold text-danger">
              {errores.items}
            </p>
          )}

          <ol className="flex flex-col gap-3">
            {filas.map((f, n) => {
              const insumo = insumos.find((i) => i.id === f.insumoId);
              const u = insumo ? UNIDAD[insumo.unidad] : null;
              const base = `item-${f.key}`;
              return (
                <li key={f.key} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-muted">Ítem {n + 1}</span>
                    {filas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => quitar(f.key)}
                        aria-label={`Quitar ítem ${n + 1}`}
                        className="-my-1 -mr-2 flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                      >
                        <X aria-hidden className="size-5" />
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Insumo" htmlFor={`${base}-insumo`} error={errorFila(n, "insumoId")}>
                      <Select
                        {...a11yFila(`${base}-insumo`, errorFila(n, "insumoId"))}
                        value={f.insumoId}
                        onChange={(e) => elegirInsumo(f.key, e.target.value)}
                      >
                        <option value="">Otra cosa (no suma stock)</option>
                        {delProveedor.length > 0 && (
                          <optgroup label={`De ${proveedorNombre}`}>
                            {delProveedor.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {otros.length > 0 && (
                          <optgroup label={delProveedor.length > 0 ? "Otros insumos" : "Insumos"}>
                            {otros.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.nombre}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </Select>
                    </Field>
                    {!f.insumoId && (
                      <Field label="Descripción" htmlFor={`${base}-descripcion`} error={errorFila(n, "descripcion")}>
                        <Input
                          {...a11yFila(`${base}-descripcion`, errorFila(n, "descripcion"))}
                          value={f.descripcion}
                          onChange={(e) => cambiar(f.key, { descripcion: e.target.value })}
                          autoComplete="off"
                          placeholder="Ej.: Válvulas de servicio"
                        />
                      </Field>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label={u ? `Cantidad (${u.corta})` : "Cantidad"} htmlFor={`${base}-cantidad`} error={errorFila(n, "cantidad")}>
                      <Input
                        {...a11yFila(`${base}-cantidad`, errorFila(n, "cantidad"))}
                        value={f.cantidad}
                        onChange={(e) => cambiar(f.key, { cantidad: e.target.value })}
                        inputMode="decimal"
                        autoComplete="off"
                      />
                    </Field>
                    <Field label={u ? `Precio por ${u.uno}` : "Precio unitario"} htmlFor={`${base}-precio`} error={errorFila(n, "precioUnitario")}>
                      <Input
                        {...a11yFila(`${base}-precio`, errorFila(n, "precioUnitario"))}
                        value={f.precio}
                        onChange={(e) => cambiar(f.key, { precio: e.target.value })}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="$ 0"
                      />
                    </Field>
                  </div>

                  <p className="flex items-baseline justify-between gap-3 border-t border-line-soft pt-2.5 text-sm">
                    <span className="text-muted">Subtotal</span>
                    <span className="tabular text-base font-bold">{formatPesos(subtotal(f))}</span>
                  </p>
                </li>
              );
            })}
          </ol>

          <Button variante="soft" onClick={agregar} className="self-start">
            <Plus aria-hidden className="size-5" strokeWidth={2.4} />
            Agregar ítem
          </Button>
        </section>

        {/* Total y pago */}
        <Card className="flex flex-col gap-4 p-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-start-2">
          <div className="flex items-baseline justify-between gap-3" aria-live="polite">
            <span className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">Total</span>
            <span className="tabular text-[28px] leading-none font-bold">{formatPesos(total)}</span>
          </div>

          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 has-checked:border-brand has-checked:bg-brand-soft">
            <input
              type="checkbox"
              name="pagada"
              checked={pagada}
              onChange={(e) => setPagada(e.target.checked)}
              className="size-5 shrink-0 accent-brand"
            />
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">Pagada en el momento</span>
              <span className="text-[13px] text-muted">Se registra el pago por el total</span>
            </span>
          </label>

          {pagada ? (
            <Field label="¿Cómo pagaste?" htmlFor="medio" error={errores.medio}>
              <Select {...campo("medio")} defaultValue="TRANSFERENCIA">
                {MEDIOS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Vence (opcional)" htmlFor="vencimiento" error={errores.vencimiento} hint="Cuándo tenés que pagarla">
              <Input {...campo("vencimiento")} type="date" />
            </Field>
          )}

          <Field label="Notas (opcional)" htmlFor="notas" error={errores.notas}>
            <Textarea {...campo("notas")} className="min-h-20" placeholder="Ej.: faltó entregar la aislación" />
          </Field>

          <div className="flex flex-col gap-3">
            <SubmitButton>Guardar compra</SubmitButton>
            <Link href={cancelarHref} className={buttonClass("secondary", "lg", "w-full")}>
              Cancelar
            </Link>
          </div>
        </Card>
      </div>
    </form>
  );
}

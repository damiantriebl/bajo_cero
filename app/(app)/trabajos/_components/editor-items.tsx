"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PackageSearch, Plus, Trash2 } from "lucide-react";
import type { InsumoParaItems, ItemEditable } from "@/lib/data/trabajos";
import { UNIDAD } from "@/lib/etiquetas";
import { formatNumero, formatPesos, parsePesos } from "@/lib/formato";
import { Button, Input, Money, cx } from "@/components/ui/base";
import { Sheet } from "@/components/ui/client";

type Fila = {
  key: string;
  descripcion: string;
  cantidad: string;
  unidad: string;
  precio: string;
  insumoId: string | null;
};

const miles = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3, useGrouping: false });

/** "1,5" o "1.5" → 1.5 */
function parseCantidad(valor: string): number | null {
  const limpio = valor.trim().replace(/\s/g, "").replace(",", ".");
  if (limpio === "") return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function filaDesdeItem(item: ItemEditable, i: number): Fila {
  return {
    key: `i${i}`,
    descripcion: item.descripcion,
    cantidad: decimal.format(item.cantidad),
    unidad: item.unidad ?? "",
    precio: miles.format(item.precioUnitario),
    insumoId: item.insumoId,
  };
}

const UNIDADES_SUGERIDAS = ["u.", "m", "kg", "par", "pares", "rollos", "l", "hs"];

/**
 * Filas de "qué se le cobra": descripción, cantidad, unidad y precio unitario.
 * Viaja al servidor como JSON en el campo oculto `items`.
 */
export function EditorItems({
  inicial,
  insumos,
  errores,
}: {
  inicial: ItemEditable[];
  insumos: InsumoParaItems[];
  errores: Record<string, string>;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicial.length > 0
      ? inicial.map(filaDesdeItem)
      : [{ key: "n0", descripcion: "", cantidad: "1", unidad: "", precio: "", insumoId: null }],
  );
  const [eligiendo, setEligiendo] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contador = useRef(0);
  const enfocar = useRef<string | null>(null);

  // Después de agregar o quitar una fila, mover el foco a donde sigue la carga.
  useEffect(() => {
    if (!enfocar.current) return;
    document.getElementById(enfocar.current)?.focus();
    enfocar.current = null;
  }, [filas]);

  function agregar(datos: Partial<Omit<Fila, "key">> = {}) {
    contador.current += 1;
    const key = `n${contador.current}`;
    enfocar.current = datos.descripcion ? `${key}-cantidad` : `${key}-descripcion`;
    setFilas((f) => [...f, { key, descripcion: "", cantidad: "1", unidad: "", precio: "", insumoId: null, ...datos }]);
  }

  function cambiar(key: string, campo: "descripcion" | "cantidad" | "unidad" | "precio", valor: string) {
    setFilas((f) => f.map((x) => (x.key === key ? { ...x, [campo]: valor } : x)));
  }

  function quitar(key: string) {
    enfocar.current = "items-agregar";
    setFilas((f) => f.filter((x) => x.key !== key));
  }

  function elegirInsumo(insumo: InsumoParaItems) {
    agregar({
      descripcion: insumo.nombre,
      unidad: UNIDAD[insumo.unidad].corta,
      precio: insumo.precioVenta !== null ? miles.format(insumo.precioVenta) : "",
      insumoId: insumo.id,
    });
    setEligiendo(false);
    setBusqueda("");
  }

  const datos = filas.map((f) => ({
    descripcion: f.descripcion.trim(),
    cantidad: parseCantidad(f.cantidad),
    unidad: f.unidad.trim() || null,
    precioUnitario: parsePesos(f.precio),
    insumoId: f.insumoId,
  }));
  const total = Math.round(datos.reduce((acc, d) => acc + (d.cantidad ?? 0) * (d.precioUnitario ?? 0), 0));

  const q = normalizar(busqueda.trim());
  const insumosFiltrados = q
    ? insumos.filter((i) => normalizar(`${i.nombre} ${i.categoria ?? ""}`).includes(q))
    : insumos;

  const hayErrorDeFila = Object.keys(errores).some((k) => k.startsWith("items."));

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="items" value={JSON.stringify(datos)} />
      <datalist id="unidades-sugeridas">
        {UNIDADES_SUGERIDAS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {filas.length > 0 && (
        <div
          aria-hidden
          className="hidden text-[13px] font-bold tracking-[0.06em] text-muted uppercase lg:grid lg:grid-cols-[minmax(0,1fr)_5.5rem_6rem_8.5rem_7.5rem_2.75rem] lg:gap-2"
        >
          <span>Descripción</span>
          <span>Cantidad</span>
          <span>Unidad</span>
          <span>Precio c/u</span>
          <span className="text-right">Subtotal</span>
          <span />
        </div>
      )}

      {filas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-track px-4 py-6 text-center text-sm text-muted">
          Todavía no hay ítems. Agregá al menos uno.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5 lg:gap-2">
          {filas.map((f, i) => {
            const n = i + 1;
            const err = (campo: string) => errores[`items.${i}.${campo}`];
            const a11y = (campo: string) =>
              err(campo) ? { "aria-invalid": true, "aria-describedby": `${f.key}-${campo}-error` } : {};
            const cantidad = parseCantidad(f.cantidad);
            const precio = parsePesos(f.precio);
            const subtotal = cantidad !== null && precio !== null ? Math.round(cantidad * precio) : null;

            return (
              <li
                key={f.key}
                className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3 lg:grid lg:grid-cols-[minmax(0,1fr)_5.5rem_6rem_8.5rem_7.5rem_2.75rem] lg:items-start lg:gap-2 lg:rounded-none lg:border-0 lg:p-0"
              >
                <div className="flex items-end gap-2 lg:contents">
                  <Celda
                    id={`${f.key}-descripcion`}
                    label={<><span className="sr-only">Ítem {n}, </span>Descripción</>}
                    error={err("descripcion")}
                    className="min-w-0 flex-1"
                  >
                    <Input
                      id={`${f.key}-descripcion`}
                      value={f.descripcion}
                      onChange={(e) => cambiar(f.key, "descripcion", e.target.value)}
                      required
                      maxLength={200}
                      placeholder="Ej.: Mano de obra de instalación"
                      autoComplete="off"
                      {...a11y("descripcion")}
                    />
                  </Celda>
                  <button
                    type="button"
                    onClick={() => quitar(f.key)}
                    aria-label={`Quitar ítem ${n}${f.descripcion ? `: ${f.descripcion}` : ""}`}
                    className="flex size-12 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-danger-soft hover:text-danger lg:order-last lg:size-11 lg:self-start"
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </button>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-2 lg:contents">
                  <Celda id={`${f.key}-cantidad`} label={<><span className="sr-only">Ítem {n}, </span>Cantidad</>} error={err("cantidad")}>
                    <Input
                      id={`${f.key}-cantidad`}
                      value={f.cantidad}
                      onChange={(e) => cambiar(f.key, "cantidad", e.target.value)}
                      inputMode="decimal"
                      required
                      autoComplete="off"
                      className="tabular"
                      {...a11y("cantidad")}
                    />
                  </Celda>
                  <Celda id={`${f.key}-unidad`} label={<><span className="sr-only">Ítem {n}, </span>Unidad</>} error={err("unidad")}>
                    <Input
                      id={`${f.key}-unidad`}
                      value={f.unidad}
                      onChange={(e) => cambiar(f.key, "unidad", e.target.value)}
                      list="unidades-sugeridas"
                      maxLength={20}
                      placeholder="u."
                      autoComplete="off"
                      {...a11y("unidad")}
                    />
                  </Celda>
                  <Celda
                    id={`${f.key}-precio`}
                    label={<><span className="sr-only">Ítem {n}, </span>Precio c/u</>}
                    error={err("precioUnitario")}
                    errorId={`${f.key}-precioUnitario-error`}
                  >
                    <div className="relative">
                      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted">
                        $
                      </span>
                      <Input
                        id={`${f.key}-precio`}
                        value={f.precio}
                        onChange={(e) => cambiar(f.key, "precio", e.target.value)}
                        onBlur={() => {
                          const p = parsePesos(f.precio);
                          if (p !== null) cambiar(f.key, "precio", miles.format(p));
                        }}
                        inputMode="numeric"
                        required
                        autoComplete="off"
                        placeholder="0"
                        className="tabular pl-7"
                        {...a11y("precioUnitario")}
                      />
                    </div>
                  </Celda>
                </div>

                <p className="flex items-baseline justify-end gap-1.5 text-sm text-muted lg:h-12 lg:items-center lg:text-[15px]">
                  <span className="lg:sr-only">Subtotal</span>
                  <span className="font-bold text-ink tabular">{subtotal !== null ? formatPesos(subtotal) : "—"}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}

      {errores.items && !hayErrorDeFila && (
        <p id="items-error" className="text-[13px] font-semibold text-danger">
          {errores.items}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button id="items-agregar" variante="soft" tamano="sm" onClick={() => agregar()}>
          <Plus aria-hidden className="size-5" />
          Agregar ítem
        </Button>
        {insumos.length > 0 && (
          <Button variante="ghost" tamano="sm" onClick={() => setEligiendo(true)}>
            <PackageSearch aria-hidden className="size-5" />
            Agregar desde insumos
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
        <span className="text-[15px] font-bold">Total</span>
        <Money value={total} className="text-xl font-bold" />
      </div>

      <Sheet open={eligiendo} onClose={() => setEligiendo(false)} title="Agregar desde insumos">
        <Input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            // Enter adentro del formulario lo enviaría.
            if (e.key === "Enter") e.preventDefault();
          }}
          aria-label="Buscar insumo"
          placeholder="Buscar por nombre o categoría"
          autoComplete="off"
        />
        <p className="text-[13px] text-muted">Se carga con el precio de venta. Después lo podés cambiar.</p>
        {insumosFiltrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No hay insumos con ese nombre.</p>
        ) : (
          <ul className="-mx-2 flex max-h-[50dvh] flex-col overflow-y-auto">
            {insumosFiltrados.map((ins) => {
              const u = UNIDAD[ins.unidad];
              return (
                <li key={ins.id}>
                  <button
                    type="button"
                    onClick={() => elegirInsumo(ins)}
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[15px] font-bold">{ins.nombre}</span>
                      <span className="text-[13px] text-muted">
                        {ins.categoria ? `${ins.categoria} · ` : ""}
                        Stock: {formatNumero(ins.stock)} {u.corta}
                      </span>
                    </span>
                    <span className={cx("shrink-0 text-right text-sm tabular", ins.precioVenta === null ? "text-muted" : "font-bold")}>
                      {ins.precioVenta === null ? "Sin precio" : `${formatPesos(ins.precioVenta)} / ${u.corta}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>
    </div>
  );
}

/** Campo de una fila: etiqueta visible en el celular, solo para lectores en la computadora. */
function Celda({
  id,
  label,
  error,
  errorId,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  errorId?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[13px] font-bold lg:sr-only">
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId ?? `${id}-error`} className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

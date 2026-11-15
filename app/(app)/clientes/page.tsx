import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { Plus, Search, X } from "lucide-react";
import {
  ButtonLink,
  Card,
  EmptyState,
  Money,
  PageHeader,
  ProgressBar,
  Skeleton,
  cx,
} from "@/components/ui/base";
import { listarClientes, type FilaCliente, type FiltroClientes, type ListadoClientes } from "@/lib/data/clientes";
import { TIPO_CLIENTE } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";
import { EstadoCuentaBadge, primero } from "./_components/cuenta";

export const metadata: Metadata = { title: "Clientes" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ClientesPage({ searchParams }: Props) {
  return (
    <>
      <PageHeader
        title="Clientes"
        actions={
          <ButtonLink href="/clientes/nuevo" tamano="sm">
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
            Nuevo
          </ButtonLink>
        }
      />
      <Suspense fallback={<ListadoSkeleton />}>
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const FILTROS: { valor: FiltroClientes; label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "saldo", label: "Con saldo" },
  { valor: "aldia", label: "Al día" },
];

function leerFiltro(v: string | undefined): FiltroClientes {
  return v === "saldo" || v === "aldia" ? v : "todos";
}

function urlClientes(q: string, filtro: FiltroClientes) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (filtro !== "todos") p.set("filtro", filtro);
  const s = p.toString();
  return s ? `/clientes?${s}` : "/clientes";
}

async function Listado({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (primero(sp.q) ?? "").trim();
  const filtro = leerFiltro(primero(sp.filtro));
  const datos = await listarClientes({ q, filtro });

  return (
    <>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-6">
        <div className="flex flex-col gap-3">
          <Form action="/clientes" role="search" className="lg:max-w-md">
            {filtro !== "todos" && <input type="hidden" name="filtro" value={filtro} />}
            <div className="flex h-12 items-center gap-2.5 rounded-[14px] border border-line bg-surface pl-3.5 text-muted focus-within:border-brand focus-within:outline-2 focus-within:outline-brand/25">
              <Search aria-hidden className="size-5 shrink-0" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                aria-label="Buscar cliente"
                placeholder="Buscar por nombre, dirección o teléfono"
                enterKeyHint="search"
                autoComplete="off"
                className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden"
              />
              {q && (
                <Link
                  href={urlClientes("", filtro)}
                  aria-label="Borrar búsqueda"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:text-ink"
                >
                  <X aria-hidden className="size-5" />
                </Link>
              )}
            </div>
          </Form>

          <nav aria-label="Filtrar clientes" className="-mx-5 flex gap-2 overflow-x-auto px-5 lg:mx-0 lg:px-0">
            {FILTROS.map(({ valor, label }) => {
              const activo = filtro === valor;
              return (
                <Link
                  key={valor}
                  href={urlClientes(q, valor)}
                  aria-current={activo ? "true" : undefined}
                  className={cx(
                    "flex h-11 shrink-0 items-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
                    activo ? "bg-night font-bold text-white" : "border border-line bg-surface font-semibold text-ink hover:border-brand",
                  )}
                >
                  {label} · {datos.conteos[valor]}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-night px-4 py-3.5 text-white lg:min-w-72 lg:flex-col lg:items-start lg:gap-1 lg:px-5 lg:py-4">
          <span className="text-sm font-semibold text-night-text">Por cobrar en total</span>
          <Money value={datos.porCobrar} className="text-[22px] leading-tight font-bold lg:text-[28px]" />
        </div>
      </div>

      {datos.clientes.length === 0 ? (
        <SinResultados q={q} filtro={filtro} hayClientes={datos.conteos.todos > 0 || q !== ""} />
      ) : (
        <>
          <ListaMovil filas={datos.clientes} />
          <TablaClientes datos={datos} />
        </>
      )}
    </>
  );
}

function SinResultados({ q, filtro, hayClientes }: { q: string; filtro: FiltroClientes; hayClientes: boolean }) {
  if (!hayClientes) {
    return (
      <EmptyState
        title="Todavía no cargaste clientes"
        description="Cargá el primero para armarle presupuestos y registrar sus pagos."
        action={<ButtonLink href="/clientes/nuevo">Cargar cliente</ButtonLink>}
      />
    );
  }
  if (q) {
    return (
      <EmptyState
        title={`No encontramos clientes para “${q}”`}
        description="Probá con otra parte del nombre, la calle o el teléfono."
        action={
          <ButtonLink href={urlClientes("", filtro)} variante="secondary">
            Ver todos
          </ButtonLink>
        }
      />
    );
  }
  return (
    <EmptyState
      title={filtro === "saldo" ? "Ningún cliente tiene saldo pendiente" : "No hay clientes al día"}
      action={
        <ButtonLink href="/clientes" variante="secondary">
          Ver todos
        </ButtonLink>
      }
    />
  );
}

/** Texto bajo el nombre: el trabajo que resume la cuenta. */
function detalle(f: FilaCliente): string {
  if (!f.trabajo) return f.direccion ?? "Sin trabajos todavía";
  const { titulo, total, pagado } = f.trabajo;
  if (f.cuenta.estado === "saldo") return f.otrosConSaldo > 0 ? `${titulo} y ${f.otrosConSaldo} más` : titulo;
  if (f.cuenta.estado === "presupuesto") return `${titulo} · ${formatPesos(total)}`;
  return pagado > 0 ? `${titulo} · pagó ${formatPesos(pagado)}` : titulo;
}

function ListaMovil({ filas }: { filas: FilaCliente[] }) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface lg:hidden [&>li+li]:border-t [&>li+li]:border-line-soft">
      {filas.map((f) => (
        <li key={f.id}>
          {f.cuenta.falta > 0 ? (
            <Link href={`/clientes/${f.id}`} className="flex flex-col gap-2 px-3.5 py-3 text-ink transition-colors hover:bg-surface-2">
              <span className="flex items-start justify-between gap-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-base font-bold">{f.nombre}</span>
                  <span className="text-[13px] text-muted">{detalle(f)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <span className="text-xs font-bold text-warn">Debe</span>
                  <Money value={f.cuenta.falta} className="text-base font-bold" />
                </span>
              </span>
              <ProgressBar value={f.cuenta.abierta.avance} />
              <span className="text-[13px] text-muted">
                {f.cuenta.abierta.pagado > 0
                  ? `Pagó ${formatPesos(f.cuenta.abierta.pagado)} de ${formatPesos(f.cuenta.abierta.presupuesto)}`
                  : `Todavía no pagó nada de ${formatPesos(f.cuenta.abierta.presupuesto)}`}
              </span>
            </Link>
          ) : (
            <Link
              href={`/clientes/${f.id}`}
              className="flex min-h-16 items-center justify-between gap-2.5 px-3.5 py-2.5 text-ink transition-colors hover:bg-surface-2"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-base font-bold">{f.nombre}</span>
                <span className="text-[13px] text-muted">{detalle(f)}</span>
              </span>
              <EstadoCuentaBadge estado={f.cuenta.estado} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

const th = "py-2.5 px-3 border-b-[1.5px] border-ink text-xs font-bold tracking-[0.06em] text-muted uppercase";
const td = "py-3 px-3";

function MontoOGuion({ value }: { value: number }) {
  return value > 0 ? <Money value={value} /> : <span className="text-muted">—</span>;
}

/** Con saldo: solo los trabajos que deben. Sin saldo: toda la historia. */
function montosFila(f: FilaCliente) {
  return f.cuenta.falta > 0 ? f.cuenta.abierta : f.cuenta;
}

function TablaClientes({ datos }: { datos: ListadoClientes }) {
  const { clientes, faltaListados } = datos;
  return (
    <Card className="hidden p-5 pt-3 lg:block">
      <table className="w-full border-collapse text-[15px]">
        <caption className="sr-only">Cuentas de los clientes</caption>
        <thead>
          <tr>
            <th scope="col" className={cx(th, "pl-0 text-left")}>
              Cliente
            </th>
            <th scope="col" className={cx(th, "text-left")}>
              Tipo
            </th>
            <th scope="col" className={cx(th, "text-left")}>
              Teléfono
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Presupuesto
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Pagó
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Falta
            </th>
            <th scope="col" className={cx(th, "pr-0 text-left")}>
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((f) => (
            <tr key={f.id} className="relative border-b border-line-soft transition-colors hover:bg-surface-2">
              <td className={cx(td, "pl-0")}>
                <Link
                  href={`/clientes/${f.id}`}
                  className="font-bold text-ink after:absolute after:inset-0 after:content-[''] hover:text-brand focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-brand"
                >
                  {f.nombre}
                </Link>
                <span className="block max-w-80 truncate text-[13px] text-muted">{detalle(f)}</span>
              </td>
              <td className={td}>{TIPO_CLIENTE[f.tipo]}</td>
              <td className={cx(td, "tabular whitespace-nowrap")}>{f.telefono ?? <span className="text-muted">—</span>}</td>
              <td className={cx(td, "text-right")}>
                <MontoOGuion value={montosFila(f).presupuesto} />
              </td>
              <td className={cx(td, "text-right")}>
                <MontoOGuion value={montosFila(f).pagado} />
              </td>
              <td className={cx(td, "text-right font-bold", f.cuenta.falta === 0 && "text-muted")}>
                <Money value={f.cuenta.falta} />
              </td>
              <td className={cx(td, "pr-0")}>
                <EstadoCuentaBadge estado={f.cuenta.estado} />
              </td>
            </tr>
          ))}
        </tbody>
        {clientes.length > 1 && (
          <tfoot>
            <tr className="border-t-[1.5px] border-ink">
              <th scope="row" className={cx(td, "pl-0 text-left font-bold")}>
                Total
              </th>
              <td className={cx(td, "text-[13px] text-muted")} colSpan={4}>
                {clientes.length} clientes
              </td>
              <td className={cx(td, "text-right text-[17px] font-bold text-warn")}>
                <Money value={faltaListados} />
              </td>
              <td className={cx(td, "pr-0")} />
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  );
}

function ListadoSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Cargando clientes">
      <Skeleton className="h-12 lg:max-w-md" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
      </div>
      <Skeleton className="h-14" />
      <Skeleton className="h-80" />
    </div>
  );
}

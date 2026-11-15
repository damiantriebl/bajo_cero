import { Suspense, type ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import {
  Badge,
  ButtonLink,
  EmptyState,
  List,
  ListSkeleton,
  PageHeader,
  SectionTitle,
  Skeleton,
  cx,
} from "@/components/ui/base";
import { listarInsumos, movimientosRecientes, type FiltroInsumos, type InsumoFila } from "@/lib/data/insumos";
import { formatPesos } from "@/lib/formato";
import { MovimientosLista } from "./_components/movimientos";
import { ESTADO_STOCK, cantidadUnidad, precioPorUnidad } from "./_components/stock";

type Vista = "insumos" | "movimientos";

const primero = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function urlInsumos(params: { q?: string; filtro?: FiltroInsumos; vista?: Vista }): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.filtro === "bajo") sp.set("filtro", "bajo");
  if (params.vista === "movimientos") sp.set("vista", "movimientos");
  const s = sp.toString();
  return s ? `/insumos?${s}` : "/insumos";
}

export default function InsumosPage(props: PageProps<"/insumos">) {
  return (
    <>
      <PageHeader
        title="Insumos"
        actions={
          <ButtonLink href="/insumos/nuevo" tamano="sm">
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
            Nuevo
          </ButtonLink>
        }
      />
      <Suspense fallback={<CargandoInsumos />}>
        <ContenidoInsumos searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

function CargandoInsumos() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-12 lg:max-w-sm" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
      <ListSkeleton rows={6} />
    </div>
  );
}

async function ContenidoInsumos({ searchParams }: Pick<PageProps<"/insumos">, "searchParams">) {
  const sp = await searchParams;
  const q = primero(sp.q).trim();
  const vista: Vista = primero(sp.vista) === "movimientos" ? "movimientos" : "insumos";
  const filtro: FiltroInsumos = vista === "insumos" && primero(sp.filtro) === "bajo" ? "bajo" : "todos";

  const listado = await listarInsumos({ q, filtro });

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Form action="/insumos" replace scroll={false} role="search" className="lg:w-96">
          {filtro === "bajo" && <input type="hidden" name="filtro" value="bajo" />}
          {vista === "movimientos" && <input type="hidden" name="vista" value="movimientos" />}
          <label
            className={cx(
              "flex h-12 items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 text-muted",
              "focus-within:border-brand focus-within:outline-2 focus-within:outline-brand/25",
            )}
          >
            <Search aria-hidden className="size-5 shrink-0" />
            <span className="sr-only">Buscar insumo</span>
            <input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar caño, cable, gas…"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/80"
            />
          </label>
          <button type="submit" className="sr-only">
            Buscar
          </button>
        </Form>

        <nav aria-label="Filtrar insumos" className="flex flex-wrap gap-2">
          <Chip href={urlInsumos({ q })} activo={vista === "insumos" && filtro === "todos"}>
            Todos · {listado.cantidadTodos}
          </Chip>
          <Chip href={urlInsumos({ q, filtro: "bajo" })} activo={vista === "insumos" && filtro === "bajo"}>
            Stock bajo · {listado.cantidadBajo}
          </Chip>
          <Chip href={urlInsumos({ q, vista: "movimientos" })} activo={vista === "movimientos"}>
            Movimientos
          </Chip>
        </nav>
      </div>

      {vista === "movimientos" ? (
        <VistaMovimientos q={q} />
      ) : (
        <>
          {listado.bajoMinimo > 0 && <AvisoBajoMinimo cantidad={listado.bajoMinimo} />}
          <VistaInsumos
            insumos={listado.insumos}
            q={q}
            filtro={filtro}
            hayInsumos={listado.hayInsumos}
          />
        </>
      )}
    </>
  );
}

function Chip({ href, activo, children }: { href: string; activo: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      replace
      scroll={false}
      aria-current={activo ? "page" : undefined}
      className={cx(
        "inline-flex h-11 items-center rounded-full px-3.5 text-sm whitespace-nowrap transition-colors",
        activo ? "bg-night font-bold text-white" : "border border-line bg-surface font-semibold text-ink hover:border-ink",
      )}
    >
      {children}
    </Link>
  );
}

function AvisoBajoMinimo({ cantidad }: { cantidad: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-warn-soft py-2 pr-2 pl-3.5 text-warn-strong">
      <p className="flex min-w-0 flex-col">
        <span className="text-[15px] font-bold">
          {cantidad} {cantidad === 1 ? "insumo bajo el mínimo" : "insumos bajo el mínimo"}
        </span>
        <span className="text-[13px]">El pedido al proveedor se arma solo</span>
      </p>
      <Link
        href="/insumos/pedido"
        className="inline-flex h-11 shrink-0 items-center rounded-xl bg-warn px-3.5 text-sm font-bold whitespace-nowrap text-white transition-colors hover:bg-warn-strong"
      >
        Armar pedido
      </Link>
    </div>
  );
}

function VistaInsumos({
  insumos,
  q,
  filtro,
  hayInsumos,
}: {
  insumos: InsumoFila[];
  q: string;
  filtro: FiltroInsumos;
  hayInsumos: boolean;
}) {
  if (!hayInsumos) {
    return (
      <EmptyState
        title="Todavía no cargaste insumos"
        description="Cargá los materiales que usás para saber cuánto te queda y armar los pedidos."
        action={<ButtonLink href="/insumos/nuevo">Nuevo insumo</ButtonLink>}
      />
    );
  }
  if (insumos.length === 0) {
    return q ? (
      <EmptyState
        title={`No encontramos “${q}”`}
        description="Probá con otra palabra o revisá cómo está escrito."
        action={
          <ButtonLink href={urlInsumos({ filtro })} variante="secondary">
            Ver todos
          </ButtonLink>
        }
      />
    ) : (
      <EmptyState title="No hay insumos bajo el mínimo" description="Todo tiene stock suficiente." />
    );
  }

  return (
    <>
      {/* Celular: filas como en el diseño */}
      <List className="lg:hidden">
        {insumos.map((i) => (
          <Link
            key={i.id}
            href={`/insumos/${i.id}`}
            className="flex min-h-15 flex-col justify-center gap-1 px-3.5 py-2.5 text-ink transition-colors hover:bg-surface-2"
          >
            <span className="flex items-baseline justify-between gap-2.5">
              <span className="min-w-0 text-[15px] font-bold">{i.nombre}</span>
              <span className="tabular shrink-0 text-base font-bold whitespace-nowrap">{cantidadUnidad(i.stock, i.unidad)}</span>
            </span>
            <span className="flex items-center justify-between gap-2.5">
              <span className="min-w-0 text-[13px] text-muted">
                Mínimo {cantidadUnidad(i.stockMinimo, i.unidad)} · {precioPorUnidad(i.costoUnitario, i.unidad)}
              </span>
              <Badge tono={ESTADO_STOCK[i.estado].tono} className="shrink-0">
                {ESTADO_STOCK[i.estado].label}
              </Badge>
            </span>
          </Link>
        ))}
      </List>

      {/* Computadora: tabla con todos los datos */}
      <div className="hidden rounded-2xl border border-line bg-surface px-5 pt-2 pb-1 lg:block">
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Insumos y su stock</caption>
          <thead>
            <tr className="text-xs font-bold tracking-[0.06em] text-muted uppercase">
              <th scope="col" className="border-b-[1.5px] border-ink py-2.5 pr-3 text-left">Insumo</th>
              <th scope="col" className="border-b-[1.5px] border-ink px-3 py-2.5 text-left">Categoría</th>
              <th scope="col" className="border-b-[1.5px] border-ink px-3 py-2.5 text-right">Stock</th>
              <th scope="col" className="border-b-[1.5px] border-ink px-3 py-2.5 text-right">Mínimo</th>
              <th scope="col" className="border-b-[1.5px] border-ink px-3 py-2.5 text-right">Costo</th>
              <th scope="col" className="border-b-[1.5px] border-ink px-3 py-2.5 text-right">Venta</th>
              <th scope="col" className="border-b-[1.5px] border-ink px-3 py-2.5 text-left">Proveedor</th>
              <th scope="col" className="border-b-[1.5px] border-ink py-2.5 pl-3 text-left">Estado</th>
            </tr>
          </thead>
          <tbody className="[&>tr:last-child>td]:border-b-0">
            {insumos.map((i) => (
              <tr key={i.id} className="transition-colors hover:bg-surface-2">
                <td className="border-b border-line-soft py-1 pr-3">
                  <Link href={`/insumos/${i.id}`} className="flex min-h-11 items-center font-bold text-ink hover:text-brand">
                    {i.nombre}
                  </Link>
                </td>
                <td className="border-b border-line-soft px-3 py-1 text-muted">{i.categoria ?? "—"}</td>
                <td className="tabular border-b border-line-soft px-3 py-1 text-right font-bold whitespace-nowrap">
                  {cantidadUnidad(i.stock, i.unidad)}
                </td>
                <td className="tabular border-b border-line-soft px-3 py-1 text-right whitespace-nowrap">
                  {cantidadUnidad(i.stockMinimo, i.unidad)}
                </td>
                <td className="tabular border-b border-line-soft px-3 py-1 text-right whitespace-nowrap">{formatPesos(i.costoUnitario)}</td>
                <td className="tabular border-b border-line-soft px-3 py-1 text-right whitespace-nowrap">
                  {i.precioVenta !== null ? formatPesos(i.precioVenta) : "—"}
                </td>
                <td className="border-b border-line-soft px-3 py-1">
                  {i.proveedorId ? (
                    <Link href={`/proveedores/${i.proveedorId}`} className="text-brand hover:underline">
                      {i.proveedorNombre}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="border-b border-line-soft py-1 pl-3">
                  <Badge tono={ESTADO_STOCK[i.estado].tono}>{ESTADO_STOCK[i.estado].label}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

async function VistaMovimientos({ q }: { q: string }) {
  const { movimientos, hoy } = await movimientosRecientes({ q });
  if (movimientos.length === 0) {
    return q ? (
      <EmptyState title={`No hay movimientos de “${q}”`} description="Probá con otro nombre de insumo." />
    ) : (
      <EmptyState
        title="Todavía no hay movimientos"
        description="Acá vas a ver lo que entra con cada compra y lo que sale en cada trabajo."
      />
    );
  }
  return (
    <section className="flex flex-col gap-2" aria-labelledby="titulo-movimientos">
      <SectionTitle>
        <span id="titulo-movimientos">Últimos movimientos</span>
      </SectionTitle>
      <MovimientosLista movimientos={movimientos} hoy={hoy} modo="global" />
    </section>
  );
}

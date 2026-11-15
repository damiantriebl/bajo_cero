import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import Form from "next/form";
import { Plus, Search } from "lucide-react";
import { listarTrabajos, type FilaTrabajo, type FiltroTrabajos } from "@/lib/data/trabajos";
import { ESTADO_TRABAJO, FLUJO_TRABAJO } from "@/lib/etiquetas";
import { diasHasta, formatFechaCorta } from "@/lib/fechas";
import { formatPesos } from "@/lib/formato";
import { Badge, ButtonLink, Card, EmptyState, Input, List, ListSkeleton, Money, PageHeader, Skeleton, cx } from "@/components/ui/base";
import { diaYHora, diaYHoraEnFrase, numeroCorto, numeroTrabajo } from "./_components/util";

export const metadata: Metadata = { title: "Trabajos" };

const FILTROS: { valor: FiltroTrabajos; label: string }[] = [
  { valor: "ACTIVOS", label: "Activos" },
  ...FLUJO_TRABAJO.map((e) => ({ valor: e, label: ESTADO_TRABAJO[e].label })),
  { valor: "CANCELADO", label: ESTADO_TRABAJO.CANCELADO.label },
  { valor: "TODOS", label: "Todos" },
];

function leerFiltro(valor: string | string[] | undefined): FiltroTrabajos {
  const v = typeof valor === "string" ? valor.toUpperCase() : "";
  return FILTROS.find((f) => f.valor === v)?.valor ?? "ACTIVOS";
}

function hrefFiltro(filtro: FiltroTrabajos, q: string): string {
  const p = new URLSearchParams();
  if (filtro !== "ACTIVOS") p.set("estado", filtro);
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/trabajos?${s}` : "/trabajos";
}

export default function TrabajosPage({ searchParams }: PageProps<"/trabajos">) {
  return (
    <>
      <PageHeader
        title="Trabajos"
        actions={
          <ButtonLink href="/trabajos/nuevo">
            <Plus aria-hidden className="size-5" strokeWidth={2.4} />
            Nuevo presupuesto
          </ButtonLink>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-11" />
            <ListSkeleton rows={5} />
          </div>
        }
      >
        <Listado searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Listado({ searchParams }: Pick<PageProps<"/trabajos">, "searchParams">) {
  const sp = await searchParams;
  const filtro = leerFiltro(sp.estado);
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const { filas, conteos, hoy } = await listarTrabajos(filtro, q);

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <Form action="/trabajos" role="search" className="relative lg:max-w-md">
        {filtro !== "ACTIVOS" && <input type="hidden" name="estado" value={filtro} />}
        <label htmlFor="buscar-trabajos" className="sr-only">
          Buscar trabajos
        </label>
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
        <Input
          id="buscar-trabajos"
          type="search"
          name="q"
          defaultValue={q}
          enterKeyHint="search"
          placeholder="Buscar por cliente, título o N.º"
          autoComplete="off"
          className="pl-11"
        />
      </Form>

      <nav aria-label="Filtrar por estado" className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
        <ul className="flex w-max gap-2 lg:w-auto lg:flex-wrap">
          {FILTROS.map((f) => {
            const activo = f.valor === filtro;
            return (
              <li key={f.valor}>
                <Link
                  href={hrefFiltro(f.valor, q)}
                  scroll={false}
                  aria-current={activo ? "page" : undefined}
                  className={cx(
                    "flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors",
                    activo ? "border-night bg-night text-white" : "border-line bg-surface text-ink hover:border-brand",
                  )}
                >
                  {f.label}
                  <span className={cx("tabular text-xs", activo ? "text-ice-light" : "text-muted")}>
                    {conteos[f.valor]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {filas.length === 0 ? (
        <EmptyState
          title={q ? `No encontramos “${q}”` : "No hay trabajos acá"}
          description={
            q
              ? "Probá con otro nombre, parte del título o el número del presupuesto."
              : "Cuando armes un presupuesto, aparece en esta lista."
          }
          action={
            q || filtro !== "ACTIVOS" ? (
              <ButtonLink href="/trabajos" variante="secondary">
                Ver trabajos activos
              </ButtonLink>
            ) : (
              <ButtonLink href="/trabajos/nuevo">Armar presupuesto</ButtonLink>
            )
          }
        />
      ) : (
        <>
          <List className="lg:hidden">
            {filas.map((f) => (
              <FilaCelular key={f.id} f={f} hoy={hoy} />
            ))}
          </List>
          <TablaTrabajos filas={filas} hoy={hoy} />
        </>
      )}
    </div>
  );
}

// ───────── Datos de cada fila ─────────

/** Visita próxima, o vencimiento si todavía es presupuesto. */
function seguimiento(f: FilaTrabajo, hoy: Date): { texto: string; aviso?: boolean } | null {
  if (f.proximaVisita) return { texto: `Visita ${diaYHoraEnFrase(f.proximaVisita, hoy)}` };
  if (f.estado === "PRESUPUESTO" && f.validoHasta) {
    const dias = diasHasta(f.validoHasta, hoy);
    if (dias < 0) return { texto: "Presupuesto vencido", aviso: true };
    if (dias === 0) return { texto: "Vence hoy", aviso: true };
    if (dias === 1) return { texto: "Vence mañana", aviso: true };
    return { texto: `Válido hasta ${formatFechaCorta(f.validoHasta)}` };
  }
  if (f.estado === "APROBADO" || f.estado === "EN_CURSO") return { texto: "Sin visita agendada", aviso: true };
  return null;
}

/** "Falta" solo tiene sentido en trabajos aprobados y en marcha. */
const muestraFalta = (f: FilaTrabajo) =>
  f.estado === "APROBADO" || f.estado === "EN_CURSO" || f.estado === "TERMINADO";

function FilaCelular({ f, hoy }: { f: FilaTrabajo; hoy: Date }) {
  const estado = ESTADO_TRABAJO[f.estado];
  const seg = seguimiento(f, hoy);
  return (
    <Link href={`/trabajos/${f.id}`} className="flex flex-col gap-1 px-3.5 py-3 text-ink transition-colors hover:bg-surface-2">
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-semibold text-muted">
          {numeroTrabajo(f.numero)} · {f.cliente.nombre}
        </span>
        <Badge tono={estado.tono}>{estado.label}</Badge>
      </span>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-[15px] font-bold">{f.titulo}</span>
        <Money value={f.total} className="text-[15px] font-bold" />
      </span>
      {(seg || (muestraFalta(f) && f.falta > 0)) && (
        <span className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className={cx(seg?.aviso ? "font-semibold text-warn" : "text-muted")}>{seg?.texto}</span>
          {muestraFalta(f) && f.falta > 0 && (
            <span className="font-bold whitespace-nowrap text-warn tabular">Falta {formatPesos(f.falta)}</span>
          )}
        </span>
      )}
    </Link>
  );
}

const th = "border-b-[1.5px] border-ink px-3 py-2.5 text-xs font-bold tracking-[0.06em] text-muted uppercase";
const td = "border-b border-line-soft px-3 py-3";

function TablaTrabajos({ filas, hoy }: { filas: FilaTrabajo[]; hoy: Date }) {
  return (
    <Card className="hidden overflow-x-auto px-3 py-2 lg:block">
      <table className="w-full border-collapse text-[15px]">
        <caption className="sr-only">Trabajos</caption>
        <thead>
          <tr>
            <th scope="col" className={cx(th, "text-left")}>
              N.º
            </th>
            <th scope="col" className={cx(th, "text-left")}>
              Cliente
            </th>
            <th scope="col" className={cx(th, "text-left")}>
              Trabajo
            </th>
            <th scope="col" className={cx(th, "text-left")}>
              Próxima visita
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Total
            </th>
            <th scope="col" className={cx(th, "text-right")}>
              Falta
            </th>
            <th scope="col" className={cx(th, "text-left")}>
              Estado
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => {
            const estado = ESTADO_TRABAJO[f.estado];
            const seg = seguimiento(f, hoy);
            return (
              <tr key={f.id} className="relative transition-colors hover:bg-surface-2">
                <td className={cx(td, "text-muted tabular")}>{numeroCorto(f.numero)}</td>
                <td className={cx(td, "font-semibold")}>{f.cliente.nombre}</td>
                <td className={td}>
                  <Link
                    href={`/trabajos/${f.id}`}
                    className="font-bold text-ink after:absolute after:inset-0 hover:text-brand focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand"
                  >
                    {f.titulo}
                  </Link>
                </td>
                <td className={cx(td, "text-sm", seg?.aviso ? "font-semibold text-warn" : "text-muted")}>
                  {f.proximaVisita ? diaYHora(f.proximaVisita, hoy) : (seg?.texto ?? "—")}
                </td>
                <td className={cx(td, "text-right")}>
                  <Money value={f.total} />
                </td>
                <td className={cx(td, "text-right font-bold")}>
                  {muestraFalta(f) ? (
                    <Money value={f.falta} className={f.falta > 0 ? "text-warn" : "text-ok"} />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className={td}>
                  <Badge tono={estado.tono}>{estado.label}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

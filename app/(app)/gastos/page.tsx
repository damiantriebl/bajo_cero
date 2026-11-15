import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Plus } from "lucide-react";
import {
  ButtonLink,
  Card,
  EmptyState,
  Eyebrow,
  HeroCard,
  List,
  ListLinkRow,
  ListSkeleton,
  Money,
  PageHeader,
  SectionTitle,
  Skeleton,
  cx,
} from "@/components/ui/base";
import { gastosDelMes, type GastosDelMes } from "@/lib/data/gastos";
import { personalDelMes } from "@/lib/data/personal";
import { formatFechaCorta } from "@/lib/fechas";
import { CATEGORIA_GASTO } from "@/lib/etiquetas";
import { formatPesos } from "@/lib/formato";
import { MesNavDesdeUrl, MesNavSkeleton } from "../reportes/_components/mes-nav";
import { conParams, primero } from "../reportes/_components/mes";
import { BarrasCategorias } from "../reportes/_components/graficos";
import { plural, textoSaldo } from "../personal/_components/saldo";

export const metadata: Metadata = { title: "Gastos" };

export default function GastosPage({ searchParams }: PageProps<"/gastos">) {
  return (
    <>
      <PageHeader
        title="Gastos"
        actions={
          <Suspense fallback={<MesNavSkeleton />}>
            <MesNavDesdeUrl base="/gastos" searchParams={searchParams} conservar={["categoria"]} />
          </Suspense>
        }
      />
      <Suspense fallback={<GastosSkeleton />}>
        <ContenidoGastos searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function GastosSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando gastos">
      <Skeleton className="h-36 bg-night/15" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        <Skeleton className="h-64" />
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}

async function ContenidoGastos({ searchParams }: Pick<PageProps<"/gastos">, "searchParams">) {
  const sp = await searchParams;
  const mesClave = primero(sp.mes);
  const [d, personal] = await Promise.all([gastosDelMes(mesClave, primero(sp.categoria)), personalDelMes(mesClave)]);
  const mes = d.mes;

  return (
    <>
      <HeroCard className="lg:flex-row lg:items-end lg:justify-between lg:p-6">
        <div className="flex flex-col gap-0.5">
          <Eyebrow tono="night">Gastado en {mes.nombre}</Eyebrow>
          <Money value={d.total} className="text-[34px] leading-tight font-bold lg:text-[40px]" />
          <p className="text-sm text-night-text lg:text-[15px]">
            Cobraste <Money value={d.cobrado} /> ·{" "}
            {d.quedan >= 0 ? (
              <>
                te quedan <Money value={d.quedan} />
              </>
            ) : (
              <>
                gastaste <Money value={-d.quedan} /> más de lo que entró
              </>
            )}
          </p>
        </div>
        <ButtonLink href="/gastos/nuevo" variante="ice" className="self-start lg:self-auto">
          <Plus aria-hidden className="size-5" />
          Cargar gasto
        </ButtonLink>
      </HeroCard>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
        <div className="flex flex-col gap-4 lg:gap-6">
          <Card className="flex flex-col gap-3 p-3.5 lg:p-5">
            <h2 className="text-[15px] font-bold lg:text-lg">En qué se fue</h2>
            {d.porCategoria.length > 0 ? (
              <BarrasCategorias filas={d.porCategoria} />
            ) : (
              <p className="text-sm text-muted">Todavía no hay gastos en {mes.nombre}.</p>
            )}
          </Card>

          {personal.empleados.length > 0 && (
            <section className="flex flex-col gap-1">
              <SectionTitle
                action={
                  <Link
                    href={conParams("/personal", { mes: mes.clave })}
                    className="flex min-h-11 items-center px-1 text-sm font-bold text-brand hover:underline"
                  >
                    Ver personal
                  </Link>
                }
              >
                {mes.esActual ? "Personal este mes" : `Personal en ${mes.nombre}`}
              </SectionTitle>
              <List>
                {personal.empleados.map((e) => (
                  <ListLinkRow
                    key={e.id}
                    href={conParams(`/personal/${e.id}`, { mes: mes.clave })}
                    chevron={false}
                    title={`${e.nombre} · ${e.puesto.toLowerCase()}`}
                    subtitle={`${plural(e.jornadas, "jornada", "jornadas")} · ${textoSaldo(e.saldo).texto.toLowerCase()}`}
                    trailing={<Money value={e.devengado} className="text-base font-bold" />}
                  />
                ))}
              </List>
            </section>
          )}
        </div>

        <UltimosGastos d={d} />
      </div>
    </>
  );
}

function UltimosGastos({ d }: { d: GastosDelMes }) {
  const { mes } = d;
  const hrefFiltro = (categoria: string | null) => conParams("/gastos", { mes: mes.clave, categoria });
  const chips = d.porCategoria.map((c) => ({ categoria: c.categoria, label: c.label }));
  if (d.categoria && !chips.some((c) => c.categoria === d.categoria)) {
    chips.push({ categoria: d.categoria, label: CATEGORIA_GASTO[d.categoria] });
  }

  return (
    <section className="flex min-w-0 flex-col gap-2" aria-labelledby="ultimos-gastos">
      <SectionTitle>
        <span id="ultimos-gastos">Últimos gastos</span>
      </SectionTitle>

      {(chips.length > 1 || d.categoria) && (
        <nav
          aria-label="Filtrar por categoría"
          className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
        >
          <Chip href={hrefFiltro(null)} activo={!d.categoria}>
            Todas
          </Chip>
          {chips.map((c) => (
            <Chip key={c.categoria} href={hrefFiltro(c.categoria)} activo={d.categoria === c.categoria}>
              {c.label}
            </Chip>
          ))}
        </nav>
      )}

      {d.gastos.length === 0 ? (
        <EmptyState
          title={d.categoria ? "No hay gastos de esa categoría" : `No hay gastos en ${mes.nombre}`}
          description="Cargá cada gasto cuando lo hacés y a fin de mes tenés la cuenta hecha."
          action={<ButtonLink href="/gastos/nuevo">Cargar gasto</ButtonLink>}
        />
      ) : (
        <>
          {/* Celular: lista */}
          <List className="lg:hidden">
            {d.gastos.map((g) => (
              <ListLinkRow
                key={g.id}
                href={`/gastos/${g.id}`}
                chevron={false}
                title={g.descripcion}
                subtitle={`${formatFechaCorta(g.fecha)} · ${g.categoriaLabel} · ${g.medioLabel}`}
                trailing={<Money value={g.monto} className="text-base font-bold" />}
              />
            ))}
          </List>

          {/* Computadora: tabla */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block">
            <table className="w-full text-left text-[15px]">
              <caption className="sr-only">
                Gastos de {mes.nombre}
                {d.categoria ? `, categoría ${CATEGORIA_GASTO[d.categoria]}` : ""}
              </caption>
              <thead className="bg-surface-2 text-[13px] text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Fecha
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Descripción
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Categoría
                  </th>
                  <th scope="col" className="px-4 py-3 font-bold">
                    Medio
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-bold">
                    Monto
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {d.gastos.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-surface-2">
                    <td className="tabular px-4 py-3 whitespace-nowrap text-muted">{formatFechaCorta(g.fecha)}</td>
                    <td className="px-4 py-3">
                      <Link href={`/gastos/${g.id}`} className="font-bold text-ink hover:text-brand hover:underline">
                        {g.descripcion}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{g.categoriaLabel}</td>
                    <td className="px-4 py-3">{g.medioLabel}</td>
                    <td className="px-4 py-3 text-right font-bold">
                      <Money value={g.monto} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line">
                <tr>
                  <th scope="row" colSpan={4} className="px-4 py-3 text-right font-bold">
                    Total{d.categoria ? " de la categoría" : ""}
                  </th>
                  <td className="px-4 py-3 text-right font-bold">
                    <Money value={d.totalFiltrado} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {d.categoria && (
            <p className="text-sm text-muted lg:hidden">
              Total de la categoría: <strong className="text-ink">{formatPesos(d.totalFiltrado)}</strong>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Chip({ href, activo, children }: { href: string; activo: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activo ? "true" : undefined}
      className={cx(
        "flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors",
        activo ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:bg-surface-2",
      )}
    >
      {children}
    </Link>
  );
}

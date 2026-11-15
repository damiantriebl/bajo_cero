import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Download, FileText } from "lucide-react";
import {
  ButtonLink,
  Card,
  EmptyState,
  List,
  ListLinkRow,
  Money,
  PageHeader,
  Skeleton,
  Stat,
  buttonClass,
  cx,
} from "@/components/ui/base";
import { infoMes, reporteDelMes, type ReporteMes } from "@/lib/data/reportes";
import { formatPesos, formatPorcentaje } from "@/lib/formato";
import { MesNav, MesNavSkeleton } from "./_components/mes-nav";
import { conParams, primero } from "./_components/mes";
import { BarrasCategorias, BarrasHorizontales, GraficoMensual } from "./_components/graficos";
import { plural } from "../personal/_components/saldo";

export const metadata: Metadata = { title: "Reportes" };

type Busqueda = PageProps<"/reportes">["searchParams"];

export default function ReportesPage({ searchParams }: PageProps<"/reportes">) {
  return (
    <>
      <PageHeader
        title="Reportes"
        actions={
          <Suspense fallback={<MesNavSkeleton />}>
            <AccionesEncabezado searchParams={searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<ReportesSkeleton />}>
        <ContenidoReportes searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function ReportesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando reportes">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <Skeleton className="h-64" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

function BotonesDescarga({ mes, className }: { mes: string; className?: string }) {
  return (
    <div className={cx("grid grid-cols-2 gap-2.5", className)}>
      {/* Route Handler: <a> común (no <Link>) para que el navegador descargue el archivo. */}
      <a href={`/reportes/exportar?mes=${mes}`} download className={buttonClass("secondary", "md")}>
        <Download aria-hidden className="size-5" />
        Bajar en Excel
      </a>
      <ButtonLink href={`/reportes/cierre?mes=${mes}`}>
        <FileText aria-hidden className="size-5" />
        Cierre en PDF
      </ButtonLink>
    </div>
  );
}

async function AccionesEncabezado({ searchParams }: { searchParams: Busqueda }) {
  const sp = await searchParams;
  const mes = await infoMes(primero(sp.mes));
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MesNav mes={mes} base="/reportes" />
      {/* En la computadora, las descargas van arriba; en el celular, al final. */}
      <BotonesDescarga mes={mes.clave} className="hidden lg:grid" />
    </div>
  );
}

async function ContenidoReportes({ searchParams }: { searchParams: Busqueda }) {
  const sp = await searchParams;
  const r = await reporteDelMes(primero(sp.mes));
  const { mes } = r;

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <Stat label="Cobrado" value={formatPesos(r.cobrado)} href="/cobros" />
        <Stat label="Gastos" value={formatPesos(r.gastos)} href={conParams("/gastos", { mes: mes.clave })} />
        <Stat label="Ganancia del mes" value={formatPesos(r.ganancia)} hint="Cobrado menos gastos" tono="night" />
        <Stat label="Por cobrar" value={formatPesos(r.porCobrar)} hint="A hoy, de trabajos aprobados" tono="warn" />
      </div>

      <Card className="p-3.5 lg:p-5">
        <GraficoMensual titulo="Últimos 6 meses" meses={r.ultimos6} actual={mes.clave} />
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <Card className="flex flex-col gap-3 p-3.5 lg:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-bold lg:text-lg">Trabajos de {mes.nombre}</h2>
            <span className="text-[13px] font-semibold whitespace-nowrap text-muted">{r.trabajosTotal} en total</span>
          </div>
          {r.trabajosPorTipo.length > 0 ? (
            <>
              <BarrasHorizontales
                filas={r.trabajosPorTipo.map((t) => ({
                  clave: t.tipo,
                  label: t.label,
                  valor: t.cantidad,
                  fraccion: t.cantidad / r.trabajosPorTipo[0].cantidad,
                }))}
              />
              <p className="text-[13px] text-muted">Cuenta los trabajos con visitas o terminados en el mes.</p>
            </>
          ) : (
            <p className="text-sm text-muted">No hubo visitas ni trabajos terminados en {mes.nombre}.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-3.5 lg:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-bold lg:text-lg">Gastos por categoría</h2>
            <Link
              href={conParams("/gastos", { mes: mes.clave })}
              className="-my-3 flex min-h-11 items-center text-sm font-bold whitespace-nowrap text-brand hover:underline"
            >
              Ver gastos
            </Link>
          </div>
          {r.gastosPorCategoria.length > 0 ? (
            <BarrasCategorias filas={r.gastosPorCategoria} />
          ) : (
            <p className="text-sm text-muted">No hay gastos cargados en {mes.nombre}.</p>
          )}
        </Card>
      </div>

      <Rentabilidad r={r} />

      <section className="flex flex-col gap-2" aria-labelledby="top-clientes">
        <h2 id="top-clientes" className="text-[15px] font-bold lg:text-lg">
          Los que más pagaron en {mes.nombre}
        </h2>
        {r.topClientes.length > 0 ? (
          <List className="lg:max-w-2xl">
            {r.topClientes.map((c, i) => (
              <ListLinkRow
                key={c.id}
                href={`/clientes/${c.id}`}
                leading={
                  <span
                    aria-hidden
                    className="tabular flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-bold text-brand-strong"
                  >
                    {i + 1}
                  </span>
                }
                title={c.nombre}
                subtitle={plural(c.cobros, "cobro", "cobros")}
                trailing={<Money value={c.cobrado} className="text-base font-bold" />}
              />
            ))}
          </List>
        ) : (
          <Card className="px-4 py-5 text-sm text-muted">No hubo cobros en {mes.nombre}.</Card>
        )}
      </section>

      <BotonesDescarga mes={mes.clave} className="lg:hidden" />
    </>
  );
}

function Rentabilidad({ r }: { r: ReporteMes }) {
  const { mes, rentabilidad: filas, rentabilidadTotal: total } = r;
  const th = "px-4 py-3 font-bold";
  return (
    <section className="flex flex-col gap-2" aria-labelledby="rentabilidad">
      <div className="flex flex-col gap-0.5">
        <h2 id="rentabilidad" className="text-[15px] font-bold lg:text-lg">
          Rentabilidad por trabajo
        </h2>
        <p className="text-[13px] text-muted">
          Trabajos terminados en {mes.nombre}: precio menos insumos usados y jornadas del personal.
        </p>
      </div>

      {filas.length === 0 ? (
        <EmptyState title={`No se terminó ningún trabajo en ${mes.nombre}`} />
      ) : (
        <>
          {/* Celular: tarjetas */}
          <List className="lg:hidden">
            {filas.map((f) => (
              <Link key={f.id} href={`/trabajos/${f.id}`} className="flex flex-col gap-1.5 px-3.5 py-3 text-ink hover:bg-surface-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[15px] font-bold">
                    #{f.numero} · {f.titulo}
                  </span>
                  <span className={cx("tabular text-sm font-bold whitespace-nowrap", f.ganancia < 0 && "text-danger")}>
                    {formatPorcentaje(f.margen)}
                  </span>
                </span>
                <span className="text-[13px] text-muted">{f.cliente}</span>
                <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[13px]">
                  <span>
                    Precio <Money value={f.precio} className="font-bold" />
                  </span>
                  <span>
                    Ganancia{" "}
                    <Money value={f.ganancia} className={cx("font-bold", f.ganancia < 0 ? "text-danger" : "text-ok")} />
                  </span>
                  <span>
                    Insumos <Money value={f.insumos} className="font-semibold" />
                  </span>
                  <span>
                    Personal <Money value={f.personal} className="font-semibold" />
                  </span>
                </span>
              </Link>
            ))}
          </List>

          {/* Computadora: tabla */}
          <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface lg:block">
            <table className="w-full text-left text-[15px]">
              <caption className="sr-only">Rentabilidad de los trabajos terminados en {mes.nombre}</caption>
              <thead className="bg-surface-2 text-[13px] text-muted">
                <tr>
                  <th scope="col" className={th}>
                    Trabajo
                  </th>
                  <th scope="col" className={th}>
                    Cliente
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Precio
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Insumos
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Personal
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Ganancia
                  </th>
                  <th scope="col" className={`${th} text-right`}>
                    Margen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {filas.map((f) => (
                  <tr key={f.id} className="transition-colors hover:bg-surface-2">
                    <th scope="row" className="px-4 py-3 text-left">
                      <Link href={`/trabajos/${f.id}`} className="font-bold text-ink hover:text-brand hover:underline">
                        #{f.numero} · {f.titulo}
                      </Link>
                    </th>
                    <td className="px-4 py-3">{f.cliente}</td>
                    <td className="px-4 py-3 text-right">
                      <Money value={f.precio} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={f.insumos} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={f.personal} />
                    </td>
                    <td className={cx("px-4 py-3 text-right font-bold", f.ganancia < 0 && "text-danger")}>
                      <Money value={f.ganancia} />
                    </td>
                    <td className="tabular px-4 py-3 text-right">{formatPorcentaje(f.margen)}</td>
                  </tr>
                ))}
              </tbody>
              {filas.length > 1 && (
                <tfoot className="border-t border-line font-bold">
                  <tr>
                    <th scope="row" colSpan={2} className="px-4 py-3 text-left">
                      Total
                    </th>
                    <td className="px-4 py-3 text-right">
                      <Money value={total.precio} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={total.insumos} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={total.personal} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Money value={total.ganancia} />
                    </td>
                    <td className="tabular px-4 py-3 text-right">{formatPorcentaje(total.margen)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </section>
  );
}

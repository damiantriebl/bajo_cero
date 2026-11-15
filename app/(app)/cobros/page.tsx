import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { ButtonLink, EmptyState, Eyebrow, HeroCard, Money, PageHeader, Skeleton } from "@/components/ui/base";
import { cobrosDelMes } from "@/lib/data/cobros";
import { MEDIO_PAGO } from "@/lib/etiquetas";
import { diasHasta, formatDiaRelativo, formatFechaLarga, formatMes } from "@/lib/fechas";
import { numeroTrabajo } from "../clientes/_components/cuenta";

export const metadata: Metadata = { title: "Cobros" };

export default function CobrosPage() {
  return (
    <>
      <PageHeader
        title="Cobros"
        actions={
          <ButtonLink href="/cobros/nuevo" tamano="sm">
            <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
            Registrar cobro
          </ButtonLink>
        }
      />
      <Suspense fallback={<CobrosSkeleton />}>
        <CobrosDelMes />
      </Suspense>
    </>
  );
}

async function CobrosDelMes() {
  const d = await cobrosDelMes();
  const mes = formatMes(d.mes).toLowerCase();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <HeroCard aria-labelledby="cobrado-mes" className="lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1">
        <div className="flex flex-col gap-0.5">
          <Eyebrow tono="night">
            <span id="cobrado-mes">Cobrado en {mes}</span>
          </Eyebrow>
          <Money value={d.total} className="text-4xl leading-tight font-bold" />
          <span className="text-sm text-night-text">
            {d.cantidad === 1 ? "1 cobro" : `${d.cantidad} cobros`} en el mes
          </span>
        </div>
        {d.porMedio.length > 0 && (
          <dl className="flex flex-col border-t border-night-track pt-3 text-sm">
            {d.porMedio.map((m) => (
              <div key={m.medio} className="flex items-center justify-between gap-3 py-1">
                <dt className="text-night-text">{MEDIO_PAGO[m.medio]}</dt>
                <dd>
                  <Money value={m.monto} className="font-bold" />
                </dd>
              </div>
            ))}
          </dl>
        )}
      </HeroCard>

      <div className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
        {d.dias.length === 0 ? (
          <EmptyState
            title={`Todavía no hay cobros en ${mes}`}
            description="Cuando registres una seña o un pago, aparece acá."
            action={<ButtonLink href="/cobros/nuevo">Registrar cobro</ButtonLink>}
          />
        ) : (
          d.dias.map((dia) => {
            const n = diasHasta(dia.fecha, d.hoy);
            const titulo = n === 0 || n === -1 ? formatDiaRelativo(dia.fecha, d.hoy) : formatFechaLarga(dia.fecha);
            return (
              <section key={dia.fecha.toISOString()} aria-label={titulo} className="flex flex-col gap-2">
                <div className="flex min-h-8 items-center justify-between gap-3">
                  <h2 className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">{titulo}</h2>
                  <Money value={dia.total} className="text-sm font-bold text-muted" />
                </div>
                <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface [&>li+li]:border-t [&>li+li]:border-line-soft">
                  {dia.cobros.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/clientes/${c.cliente.id}`}
                        className="flex min-h-15 items-center gap-3 px-3.5 py-2.5 text-ink transition-colors hover:bg-surface-2"
                      >
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[15px] font-bold lg:text-base">{c.cliente.nombre}</span>
                          <span className="text-[13px] text-muted">
                            {c.concepto ?? "Pago"} · {MEDIO_PAGO[c.medio].toLowerCase()}
                            {c.trabajo && ` · ${numeroTrabajo(c.trabajo.numero)} ${c.trabajo.titulo}`}
                          </span>
                        </span>
                        <Money value={c.monto} className="text-base font-bold text-ok" />
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

function CobrosSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6" aria-busy="true" aria-label="Cargando cobros">
      <Skeleton className="h-44 rounded-[20px] lg:col-start-2 lg:row-start-1" />
      <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-20" />
      </div>
    </div>
  );
}

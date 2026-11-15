import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ButtonLink, EmptyState, List, ListSkeleton, PageHeader, SectionTitle, Skeleton, cx } from "@/components/ui/base";
import { obtenerAgenda, type Agenda, type DiaAgenda, type TrabajoSinFecha } from "@/lib/data/agenda";
import { aInputHora, formatDiaSemanaCorto, formatFechaCorta, formatFechaLarga, formatMes, partesAR } from "@/lib/fechas";
import {
  duracionQueEntra,
  hrefAgenda,
  hrefNuevoTurno,
  lineaDeTiempo,
  minutosEntre,
  numeroTrabajo,
  textoDuracion,
  textoVisitas,
  type Vista,
} from "./_components/utilidades";
import { FilaLibre, FilaLineaDeTiempo, LinkAgendar, TarjetaSemana, minutosAgendados } from "./_components/visita";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage(props: PageProps<"/agenda">) {
  return (
    <Suspense fallback={<AgendaCargando />}>
      <AgendaContenido searchParams={props.searchParams} />
    </Suspense>
  );
}

function AgendaCargando() {
  return (
    <>
      <PageHeader title="Agenda" />
      <Skeleton className="h-17" />
      <ListSkeleton rows={3} />
    </>
  );
}

async function AgendaContenido({ searchParams }: Pick<PageProps<"/agenda">, "searchParams">) {
  const sp = await searchParams;
  const vista: Vista = sp.vista === "dia" ? "dia" : "semana";
  const datos = await obtenerAgenda(typeof sp.dia === "string" ? sp.dia : undefined);
  const { dia } = datos;
  const sePuedeAgendar = dia.iso >= datos.hoyIso;

  return (
    <>
      <PageHeader
        title="Agenda"
        eyebrow={formatMes(dia.fecha)}
        actions={
          <>
            <ToggleVista vista={vista} dia={dia.iso} />
            <div className="hidden lg:flex">
              <ButtonLink href={hrefNuevoTurno(sePuedeAgendar ? { fecha: dia.iso } : {})} tamano="sm">
                <Plus aria-hidden className="size-5" />
                Nuevo turno
              </ButtonLink>
            </div>
          </>
        }
      />
      {vista === "semana" ? <VistaSemana datos={datos} /> : <VistaDia datos={datos} />}
    </>
  );
}

// ───────── Controles ─────────

function ToggleVista({ vista, dia }: { vista: Vista; dia: string }) {
  const opciones: { valor: Vista; label: string }[] = [
    { valor: "dia", label: "Día" },
    { valor: "semana", label: "Semana" },
  ];
  return (
    <nav aria-label="Vista" className="flex gap-0.5 rounded-[14px] bg-line-soft p-[3px]">
      {opciones.map(({ valor, label }) => (
        <Link
          key={valor}
          href={hrefAgenda(valor, dia)}
          scroll={false}
          aria-current={vista === valor ? "page" : undefined}
          className={cx(
            "flex h-11 items-center rounded-[11px] px-3.5 text-sm font-bold transition-colors",
            vista === valor ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

const botonIcono =
  "flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-colors hover:border-brand";

/** Hoy · anterior · siguiente */
function Navegacion({
  anterior,
  siguiente,
  hoy,
}: {
  anterior: { href: string; label: string };
  siguiente: { href: string; label: string };
  hoy: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {hoy && (
        <Link
          href={hoy}
          scroll={false}
          className="flex h-11 items-center rounded-xl border border-line bg-surface px-3.5 text-sm font-bold text-brand transition-colors hover:border-brand"
        >
          Hoy
        </Link>
      )}
      <Link href={anterior.href} scroll={false} aria-label={anterior.label} className={botonIcono}>
        <ChevronLeft aria-hidden className="size-5" />
      </Link>
      <Link href={siguiente.href} scroll={false} aria-label={siguiente.label} className={botonIcono}>
        <ChevronRight aria-hidden className="size-5" />
      </Link>
    </div>
  );
}

function rangoSemana(semana: DiaAgenda[]): string {
  const primero = semana[0].fecha;
  const ultimo = semana[semana.length - 1].fecha;
  const mismoMes = partesAR(primero).mes === partesAR(ultimo).mes;
  return `${mismoMes ? partesAR(primero).dia : formatFechaCorta(primero)} al ${formatFechaCorta(ultimo)}`;
}

// ───────── Vista semana ─────────

function VistaSemana({ datos }: { datos: Agenda }) {
  const { semana, dia } = datos;
  const estaHoy = semana.some((d) => d.esHoy);
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-bold">Semana del {rangoSemana(semana)}</p>
        <Navegacion
          anterior={{ href: hrefAgenda("semana", datos.anterior.semana), label: "Semana anterior" }}
          siguiente={{ href: hrefAgenda("semana", datos.siguiente.semana), label: "Semana siguiente" }}
          hoy={estaHoy ? null : hrefAgenda("semana", datos.hoyIso)}
        />
      </div>

      {/* Celular y tablet: tira de días y el día elegido */}
      <div className="flex flex-col gap-4 lg:hidden">
        <TiraDias semana={semana} elegido={dia.iso} />
        <DiaElegido datos={datos} />
      </div>

      {/* Computadora: la semana entera en columnas */}
      <ColumnasSemana datos={datos} />

      <SinFecha trabajos={datos.sinFecha} />
    </>
  );
}

function Puntos({ cantidad, claro }: { cantidad: number; claro: boolean }) {
  return (
    <span aria-hidden className="flex h-1.5 gap-[3px]">
      {Array.from({ length: Math.min(cantidad, 4) }, (_, i) => (
        <span key={i} className={cx("size-1.5 rounded-full", claro ? "bg-ice" : "bg-brand")} />
      ))}
    </span>
  );
}

function TiraDias({ semana, elegido }: { semana: DiaAgenda[]; elegido: string }) {
  return (
    <nav aria-label="Días de la semana" className={cx("grid gap-1.5", semana.length === 7 ? "grid-cols-7" : "grid-cols-6")}>
      {semana.map((d) => {
        const sel = d.iso === elegido;
        return (
          <Link
            key={d.iso}
            href={hrefAgenda("semana", d.iso)}
            scroll={false}
            aria-current={sel ? "true" : undefined}
            aria-label={`${formatFechaLarga(d.fecha)}${d.esHoy ? ", hoy" : ""}: ${textoVisitas(d.cantidad)}`}
            className={cx(
              "flex h-17 flex-col items-center justify-center gap-[3px] rounded-[14px] transition-colors",
              sel ? "bg-night text-white" : "border bg-surface text-ink hover:border-brand",
              !sel && (d.esHoy ? "border-brand" : "border-line"),
            )}
          >
            <span className={cx("text-xs font-bold tracking-[0.05em]", sel ? "text-white" : "text-muted")}>
              {formatDiaSemanaCorto(d.fecha)}
            </span>
            <span className="text-xl leading-none font-bold">{partesAR(d.fecha).dia}</span>
            <Puntos cantidad={d.cantidad} claro={sel} />
          </Link>
        );
      })}
    </nav>
  );
}

function ColumnasSemana({ datos }: { datos: Agenda }) {
  return (
    <section aria-label={`Semana del ${rangoSemana(datos.semana)}`} className="hidden lg:block">
      <div className="overflow-x-auto pb-1">
        <div className="grid auto-cols-[minmax(150px,1fr)] grid-flow-col gap-3">
          {datos.semana.map((d) => (
            <div
              key={d.iso}
              className={cx("flex flex-col gap-2 rounded-2xl p-2", d.esHoy ? "bg-brand-soft" : "bg-surface/60")}
            >
              <h3>
                <Link
                  href={hrefAgenda("dia", d.iso)}
                  aria-label={`${formatFechaLarga(d.fecha)}${d.esHoy ? ", hoy" : ""}: ${textoVisitas(d.cantidad)}. Ver el día`}
                  className="flex min-h-11 items-baseline justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface"
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-xs font-bold tracking-[0.05em] text-muted">{formatDiaSemanaCorto(d.fecha)}</span>
                    <span className="text-xl leading-none font-bold">{partesAR(d.fecha).dia}</span>
                  </span>
                  {d.esHoy && <span className="text-xs font-bold text-brand-strong">Hoy</span>}
                </Link>
              </h3>
              {d.visitas.map((v) => (
                <TarjetaSemana key={v.id} visita={v} />
              ))}
              {d.visitas.length === 0 && <p className="px-2 text-[13px] text-muted">Sin visitas</p>}
              {d.iso >= datos.hoyIso && (
                <LinkAgendar href={hrefNuevoTurno({ fecha: d.iso })} className="mt-auto bg-surface/60">
                  Agendar
                  <span className="sr-only"> el {formatFechaLarga(d.fecha)}</span>
                </LinkAgendar>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Vista día ─────────

function VistaDia({ datos }: { datos: Agenda }) {
  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
      <DiaElegido
        datos={datos}
        navegacion={
          <Navegacion
            anterior={{ href: hrefAgenda("dia", datos.anterior.dia), label: "Día anterior" }}
            siguiente={{ href: hrefAgenda("dia", datos.siguiente.dia), label: "Día siguiente" }}
            hoy={datos.dia.esHoy ? null : hrefAgenda("dia", datos.hoyIso)}
          />
        }
      />
      <SinFecha trabajos={datos.sinFecha} />
    </div>
  );
}

// ───────── Día elegido (línea de tiempo) ─────────

function DiaElegido({ datos, navegacion }: { datos: Agenda; navegacion?: ReactNode }) {
  const { dia } = datos;
  const sePuedeAgendar = dia.iso >= datos.hoyIso;
  const minutos = minutosAgendados(dia.visitas);

  return (
    <section aria-labelledby="dia-elegido" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 id="dia-elegido" className="text-[17px] font-bold">
            {formatFechaLarga(dia.fecha)}
            {dia.esHoy && <span className="text-brand-strong"> · Hoy</span>}
          </h2>
          <span className="text-[13px] font-semibold text-muted">
            {dia.cantidad > 0 ? `${textoVisitas(dia.cantidad)} · ${textoDuracion(minutos)} de trabajo` : "Sin visitas"}
          </span>
        </div>
        {navegacion}
      </div>

      {dia.visitas.length === 0 ? (
        <EmptyState
          title={sePuedeAgendar ? "Todavía no hay visitas este día" : "No hubo visitas este día"}
          description={sePuedeAgendar ? "Agendá una o elegí otro día de la semana." : undefined}
          action={
            sePuedeAgendar ? (
              <ButtonLink href={hrefNuevoTurno({ fecha: dia.iso })} variante="soft" tamano="sm">
                <CalendarPlus aria-hidden className="size-5" />
                Agendar visita
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {lineaDeTiempo(dia.visitas, datos.ahora).map((item) =>
            item.tipo === "visita" ? (
              <FilaLineaDeTiempo key={item.visita.id} visita={item.visita} />
            ) : (
              <FilaLibre
                key={`libre-${item.desde.getTime()}`}
                desde={item.desde}
                hasta={item.hasta}
                href={hrefNuevoTurno({
                  fecha: dia.iso,
                  hora: aInputHora(item.desde),
                  duracion: duracionQueEntra(minutosEntre(item.desde, item.hasta)),
                })}
              />
            ),
          )}
          {sePuedeAgendar && (
            <div className="flex gap-2.5">
              <div className="w-12 shrink-0" />
              <LinkAgendar href={hrefNuevoTurno({ fecha: dia.iso })} className="flex-1">
                Agendar otra visita este día
              </LinkAgendar>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ───────── Trabajos sin fecha ─────────

function estadoPago(t: TrabajoSinFecha): string {
  if (t.total > 0 && t.saldo === 0) return "pagado";
  if (t.cobrado > 0) return "seña cobrada";
  return "sin cobros";
}

function SinFecha({ trabajos }: { trabajos: TrabajoSinFecha[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Sin fecha todavía</SectionTitle>
      {trabajos.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm text-muted">
          Todos los trabajos aprobados ya tienen fecha.
        </p>
      ) : (
        <List>
          {trabajos.map((t) => (
            <div key={t.id} className="flex min-h-15 items-center gap-3 py-2 pr-2 pl-3.5">
              <Link href={`/trabajos/${t.id}`} className="flex min-w-0 flex-1 flex-col text-ink hover:text-brand-strong">
                <span className="truncate text-[15px] font-bold">{t.cliente}</span>
                <span className="text-[13px] text-muted">
                  {numeroTrabajo(t.numero)} · {t.titulo} · {estadoPago(t)}
                </span>
              </Link>
              <ButtonLink href={hrefNuevoTurno({ trabajo: t.id })} variante="soft" tamano="sm">
                Agendar
                <span className="sr-only"> {t.titulo}</span>
              </ButtonLink>
            </div>
          ))}
        </List>
      )}
    </section>
  );
}

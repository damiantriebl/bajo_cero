import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronLeft, FileText, MapPin, Pencil, Plus } from "lucide-react";
import { obtenerTrabajo, resumenTrabajo, type DetalleTrabajo } from "@/lib/data/trabajos";
import { ESTADO_TURNO, MEDIO_PAGO, UNIDAD } from "@/lib/etiquetas";
import { formatFechaCorta, formatHora } from "@/lib/fechas";
import { formatNumero, formatPesos, formatPorcentaje, linkMapa } from "@/lib/formato";
import { avanceCobro } from "@/lib/calculos";
import { Badge, ButtonLink, Card, Eyebrow, ListLinkRow, Money, ProgressBar, Skeleton, cx } from "@/components/ui/base";
import { SubmitButton } from "@/components/ui/client";
import { cambiarEstado } from "../actions";
import { PASO_SIGUIENTE, puedeCancelar } from "../_components/flujo";
import { EstadoStepper } from "../_components/estado-stepper";
import { Checklist } from "../_components/checklist";
import { FormMaterial } from "../_components/form-material";
import { CancelarTrabajo } from "../_components/cancelar-trabajo";
import { cantidadConUnidad, diaYHora, diaYHoraEnFrase, numeroTrabajo, unirNombres } from "../_components/util";

export async function generateMetadata({ params }: PageProps<"/trabajos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const r = await resumenTrabajo(id);
  return { title: r ? `${r.titulo} · ${numeroTrabajo(r.numero)}` : "Trabajo" };
}

export default function TrabajoPage({ params }: PageProps<"/trabajos/[id]">) {
  return (
    <Suspense fallback={<DetalleCargando />}>
      <Detalle params={params} />
    </Suspense>
  );
}

function DetalleCargando() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Cargando trabajo">
      <Skeleton className="h-11 w-full max-w-xs" />
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-6 w-full max-w-2xl" />
      <Skeleton className="h-13 w-full max-w-md" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}

async function Detalle({ params }: Pick<PageProps<"/trabajos/[id]">, "params">) {
  const { id } = await params;
  const t = await obtenerTrabajo(id);
  if (!t) notFound();

  return (
    <>
      <Encabezado t={t} />
      <EstadoStepper estado={t.estado} />
      <Acciones t={t} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <QueSeCobra t={t} />
          <LoQueTeQueda t={t} />
          <Checklist trabajoId={t.id} pasos={t.checklist} />
          <Materiales t={t} />
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <Cobros t={t} />
          <Visitas t={t} />
        </div>
      </div>

      {puedeCancelar(t.estado) && (
        <div className="border-t border-line pt-4">
          <CancelarTrabajo trabajoId={t.id} numero={numeroTrabajo(t.numero)} />
        </div>
      )}
    </>
  );
}

// ───────── Encabezado y acciones ─────────

function Encabezado({ t }: { t: DetalleTrabajo }) {
  const proxima = t.proximaVisita;
  let cuando: string | null = null;
  if (proxima) {
    cuando = diaYHoraEnFrase(proxima.inicio, t.hoy);
    if (proxima.tecnicos.length > 0) cuando += ` · ${unirNombres(proxima.tecnicos)}`;
  } else if (t.estado === "PRESUPUESTO" && t.validoHasta) {
    cuando = `válido hasta el ${formatFechaCorta(t.validoHasta)}`;
  } else if (t.estado === "APROBADO" || t.estado === "EN_CURSO") {
    cuando = "sin visita agendada";
  } else if ((t.estado === "TERMINADO" || t.estado === "COBRADO") && t.fechaTerminado) {
    cuando = `terminado el ${formatFechaCorta(t.fechaTerminado)}`;
  }

  return (
    <header className="flex flex-col gap-2">
      <div className="-mx-2 flex items-center justify-between gap-2">
        <Link
          href={`/clientes/${t.cliente.id}`}
          aria-label={`Volver a ${t.cliente.nombre}`}
          className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full text-ink transition-colors hover:bg-surface lg:rounded-xl lg:pr-3"
        >
          <ChevronLeft aria-hidden className="size-6" />
          <span className="hidden text-[15px] font-bold lg:inline">{t.cliente.nombre}</span>
        </Link>
        <Eyebrow>Trabajo {numeroTrabajo(t.numero)}</Eyebrow>
        <Link
          href={`/trabajos/${t.id}/editar`}
          aria-label="Editar trabajo"
          className="flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-ink transition-colors hover:bg-surface lg:rounded-xl lg:px-3"
        >
          <Pencil aria-hidden className="size-5" />
          <span className="hidden text-[15px] font-bold lg:inline">Editar</span>
        </Link>
      </div>

      <h1 className="font-display text-[30px] leading-none font-bold tracking-[0.01em] uppercase italic lg:text-[42px]">
        {t.titulo}
      </h1>
      <p className="text-sm text-muted lg:text-[15px]">
        {t.cliente.nombre}
        {cuando && ` · ${cuando}`}
      </p>
      {t.direccion && (
        <a
          href={linkMapa(t.direccion)}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <MapPin aria-hidden className="size-4 shrink-0" />
          {t.direccion}
          <span className="sr-only"> (abre el mapa)</span>
        </a>
      )}
      {t.descripcion && <p className="max-w-2xl text-[15px] whitespace-pre-line">{t.descripcion}</p>}
    </header>
  );
}

/** Botones según el estado. "Ver presupuesto" siempre; al lado, el paso que sigue. */
function Acciones({ t }: { t: DetalleTrabajo }) {
  const paso = PASO_SIGUIENTE[t.estado];
  const boton = "max-sm:px-3! max-sm:whitespace-normal! text-center leading-tight sm:w-auto";

  let segundo: ReactNode = null;
  if (t.estado === "TERMINADO" && t.falta > 0) {
    segundo = (
      <ButtonLink href={`/cobros/nuevo?trabajo=${t.id}`} variante="secondary" tamano="lg" className={boton}>
        Registrar cobro
      </ButtonLink>
    );
  } else if (paso) {
    segundo = (
      <form action={cambiarEstado.bind(null, t.id, paso.destino)} className="flex">
        <SubmitButton variante="secondary" pendingText="Guardando…" className={boton}>
          {paso.label}
        </SubmitButton>
      </form>
    );
  }

  return (
    <section aria-label="Acciones del trabajo" className={cx("grid gap-2.5 sm:flex sm:flex-wrap", segundo ? "grid-cols-2" : "grid-cols-1")}>
      <ButtonLink href={`/trabajos/${t.id}/presupuesto`} tamano="lg" className={boton}>
        <FileText aria-hidden className="size-5 shrink-0" />
        Ver presupuesto
      </ButtonLink>
      {segundo}
    </section>
  );
}

// ───────── Secciones ─────────

function CabeceraCard({ titulo, accion }: { titulo: string; accion?: ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft py-0.5 pr-1 pl-3.5">
      <h2 className="text-[15px] font-bold">{titulo}</h2>
      {accion}
    </div>
  );
}

function LinkCard({ href, icono, children }: { href: string; icono: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-11 items-center gap-1 rounded-xl px-2.5 text-sm font-bold text-brand transition-colors hover:bg-brand-soft"
    >
      {icono}
      {children}
    </Link>
  );
}

function QueSeCobra({ t }: { t: DetalleTrabajo }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CabeceraCard
        titulo="Qué se le cobra"
        accion={
          <LinkCard href={`/trabajos/${t.id}/editar`} icono={<Pencil aria-hidden className="size-4" />}>
            Editar ítems
          </LinkCard>
        }
      />
      {t.items.length === 0 ? (
        <p className="border-b border-line-soft px-3.5 py-3 text-sm text-muted">Todavía no hay ítems.</p>
      ) : (
        <ul>
          {t.items.map((i) => (
            <li key={i.id} className="flex min-h-10 items-center justify-between gap-3 border-b border-line-soft px-3.5 py-2">
              <span className="text-sm font-semibold">
                {i.descripcion}
                {(i.cantidad !== 1 || i.unidad) && (
                  <span className="font-normal text-muted"> · {cantidadConUnidad(i.cantidad, i.unidad)}</span>
                )}
              </span>
              <Money value={i.importe} className="text-sm font-bold" />
            </li>
          ))}
        </ul>
      )}
      <div className="flex min-h-12.5 items-center justify-between gap-3 bg-surface-2 px-3.5">
        <span className="text-[15px] font-bold">Total</span>
        <Money value={t.total} className="text-xl font-bold" />
      </div>
    </Card>
  );
}

function LoQueTeQueda({ t }: { t: DetalleTrabajo }) {
  const r = t.rentabilidad;
  const negativa = r.ganancia < 0;
  return (
    <Card className="flex flex-col gap-2.5 px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-bold">Lo que te queda</h2>
        <span className="text-xs font-semibold text-muted">Solo lo ve el dueño</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-4">
        <Dato label="Precio" valor={r.precio} />
        <Dato label="Insumos" valor={r.insumos} />
        <Dato label="Personal" valor={r.personal} nota={t.jornadas === 1 ? "1 jornada" : `${t.jornadas} jornadas`} />
        <Dato
          label={`Ganancia · ${formatPorcentaje(r.margen)}`}
          valor={r.ganancia}
          className={negativa ? "text-danger" : "text-ok"}
        />
      </dl>
    </Card>
  );
}

function Dato({ label, valor, nota, className }: { label: string; valor: number; nota?: string; className?: string }) {
  return (
    <div className="flex flex-col">
      <dt className={cx("text-xs", className ? cx("font-bold", className) : "text-muted")}>{label}</dt>
      <dd className={cx("text-[15px] font-bold tabular", className)}>{formatPesos(valor)}</dd>
      {nota && <dd className="text-xs text-muted">{nota}</dd>}
    </div>
  );
}

function Cobros({ t }: { t: DetalleTrabajo }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CabeceraCard
        titulo="Cobros"
        accion={
          t.estado !== "CANCELADO" && (
            <LinkCard href={`/cobros/nuevo?trabajo=${t.id}`} icono={<Plus aria-hidden className="size-4" strokeWidth={2.4} />}>
              Registrar cobro
            </LinkCard>
          )
        }
      />
      <div className="flex flex-col gap-2 border-b border-line-soft px-3.5 py-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-muted">Cobrado</span>
            <Money value={t.cobrado} className="text-base font-bold text-ok" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted">Falta</span>
            <Money value={t.falta} className={cx("text-base font-bold", t.falta > 0 ? "text-warn" : "text-ok")} />
          </div>
        </div>
        <ProgressBar value={avanceCobro(t.total, t.cobrado)} label={`Cobrado ${formatPorcentaje(avanceCobro(t.total, t.cobrado))} del total`} />
      </div>
      {t.cobros.length === 0 ? (
        <p className="px-3.5 py-3 text-sm text-muted">Todavía no hay cobros.</p>
      ) : (
        <ul className="[&>*+*]:border-t [&>*+*]:border-line-soft">
          {t.cobros.map((c) => (
            <li key={c.id} className="flex min-h-14 items-center justify-between gap-3 px-3.5 py-2">
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-bold">
                  {c.concepto ?? "Cobro"} · {MEDIO_PAGO[c.medio].toLowerCase()}
                </span>
                <span className="text-[13px] text-muted">{formatFechaCorta(c.fecha)}</span>
              </span>
              <Money value={c.monto} className="text-base font-bold text-ok" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Visitas({ t }: { t: DetalleTrabajo }) {
  const puedeAgendar = puedeCancelar(t.estado);
  return (
    <Card className="flex flex-col overflow-hidden">
      <CabeceraCard
        titulo="Visitas"
        accion={
          puedeAgendar && (
            <LinkCard href={`/agenda/nuevo?trabajo=${t.id}`} icono={<CalendarPlus aria-hidden className="size-4" />}>
              Agendar visita
            </LinkCard>
          )
        }
      />
      {t.visitas.length === 0 ? (
        <p className="px-3.5 py-3 text-sm text-muted">Sin visitas agendadas.</p>
      ) : (
        <div className="[&>*+*]:border-t [&>*+*]:border-line-soft">
          {t.visitas.map((v) => {
            const estado = ESTADO_TURNO[v.estado];
            const detalle = [v.tecnicos.length > 0 ? unirNombres(v.tecnicos) : "Sin técnico asignado", v.notas]
              .filter(Boolean)
              .join(" · ");
            return (
              <ListLinkRow
                key={v.id}
                href={`/agenda/${v.id}`}
                title={`${diaYHora(v.inicio, t.hoy)} a ${formatHora(v.fin)}`}
                subtitle={detalle}
                trailing={<Badge tono={estado.tono}>{estado.label}</Badge>}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Materiales({ t }: { t: DetalleTrabajo }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <CabeceraCard
        titulo="Materiales usados"
        accion={
          t.materiales.length > 0 && (
            <span className="pr-2.5 text-sm text-muted">
              Costo <strong className="text-ink tabular">{formatPesos(t.rentabilidad.insumos)}</strong>
            </span>
          )
        }
      />
      {t.materiales.length === 0 ? (
        <p className="px-3.5 py-3 text-sm text-muted">Todavía no se cargó material para este trabajo.</p>
      ) : (
        <ul className="[&>*+*]:border-t [&>*+*]:border-line-soft">
          {t.materiales.map((m) => (
            <li key={m.id} className="flex min-h-14 items-center justify-between gap-3 px-3.5 py-2">
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-bold">{m.insumo}</span>
                <span className="text-[13px] text-muted">
                  {formatNumero(m.cantidad)} {UNIDAD[m.unidad].corta} · {formatPesos(m.costoUnitario)} c/u ·{" "}
                  {formatFechaCorta(m.fecha)}
                </span>
              </span>
              <Money value={m.costo} className="text-[15px] font-bold" />
            </li>
          ))}
        </ul>
      )}
      <FormMaterial trabajoId={t.id} insumos={t.insumos} />
    </Card>
  );
}
